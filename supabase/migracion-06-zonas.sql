-- Migración 06: ligas públicas de zona (ciudad y distrito) con divisiones.
--
-- ⭐ POR QUÉ EXISTE: pedido explícito del usuario (8 sep): ligas por distrito y ciudad. Y el
-- fundamento de producto ya estaba escrito en PRODUCTO.md: sin promoción y descenso el mismo
-- gana todas las semanas y el resto se va (la competencia percibida es una de las tres
-- necesidades de la teoría de la autodeterminación). El patrón es el de Duolingo, que está
-- medido: cohortes pequeñas, ranking de 7 días, los de arriba suben y los de abajo bajan.
--
-- Decisiones que esta migración cierra:
--
--   1. LA ZONA LA CONFIRMA EL USUARIO. El GPS es un atajo que rellena los campos en el
--      teléfono (decisión del 8 sep); aquí NUNCA llegan coordenadas, solo el nombre
--      confirmado. Ciudad obligatoria, distrito opcional.
--   2. LAS LIGAS DE ZONA SON FILAS DE `ligas`, no un tipo nuevo. Con `zona` y `division`
--      puestos reutilizan `puntuaciones`, `clasificacion`, el palmarés y toda la
--      sincronización sin tocar una línea. La membresía sigue en `miembros`, así que
--      `es_miembro` y las políticas RLS existentes valen tal cual: una liga de zona solo la
--      ve quien está dentro, igual que en Duolingo solo ves tu propia cohorte.
--   3. ARRANQUE EN FRÍO: las divisiones nacen bajo demanda. La primera persona de una zona
--      crea la División 1; cuando la división más baja llega a 30 miembros (la cohorte de
--      Duolingo), quien llega estrena una nueva por debajo. Y con menos de 4 personas nadie
--      sube ni baja: mover a alguien en una liga de 2 sería ruido, no competición.
--
-- ⚠️ La entrada sigue el patrón de siempre: NINGÚN insert directo, todo por funciones
-- SECURITY DEFINER. Y sigue en pie la regla dura: aquí no entra ningún dato de salud.

-- ── Zonas ──────────────────────────────────────────────────────────────────────
-- Una fila por (ciudad) y otra por (ciudad, distrito). Solo nombres de lugar: no hay dato
-- personal, así que puede leerla cualquier persona con sesión.
create table if not exists zonas (
  id uuid primary key default gen_random_uuid(),
  ciudad text not null check (char_length(trim(ciudad)) between 1 and 40),
  distrito text check (distrito is null or char_length(trim(distrito)) between 1 and 40),
  -- Cuántas divisiones tiene la zona. Lo mantienen las funciones al crear ligas; existe para
  -- que la app sepa si hay división por debajo (zona de descenso) sin poder leer las ligas
  -- ajenas, que RLS le oculta a propósito.
  divisiones int not null default 1 check (divisiones >= 1),
  creada timestamptz not null default now()
);

-- ⭐ Se compara en minúsculas y sin espacios sobrantes, para que «Madrid» y «madrid » sean la
-- misma zona y nadie fragmente la liga escribiendo distinto. El nombre VISIBLE queda como lo
-- escribió la primera persona.
create unique index if not exists zonas_unicas
  on zonas (lower(trim(ciudad)), lower(trim(coalesce(distrito, ''))));

alter table zonas enable row level security;

create policy "zonas: visibles con sesion" on zonas
  for select to authenticated using (true);

-- ── Ligas de zona ──────────────────────────────────────────────────────────────
-- `zona` y `division` van juntas o ninguna: una liga privada no tiene división y una de zona
-- siempre la tiene.
alter table ligas
  add column if not exists zona uuid references zonas(id) on delete cascade;
alter table ligas
  add column if not exists division int check (division is null or division >= 1);

alter table ligas drop constraint if exists ligas_zona_division;
alter table ligas add constraint ligas_zona_division
  check ((zona is null) = (division is null));

-- Una liga por división dentro de cada zona. División 1 es la de arriba.
create unique index if not exists ligas_zona_division_unica
  on ligas (zona, division) where zona is not null;

-- ── Marcador de jornadas aplicadas ─────────────────────────────────────────────
-- ⭐ Idempotencia del cierre. `aplicar_movimientos` lo llama la app al sincronizar (igual que
-- `cerrar_periodos`: más simple que un cron), así que varios miembros pueden intentarlo a la
-- vez. El primero que inserta el marcador procesa la jornada; el resto la ve hecha y pasa.
create table if not exists cierres_zona (
  zona uuid not null references zonas(id) on delete cascade,
  semana date not null,
  creado timestamptz not null default now(),
  primary key (zona, semana)
);

alter table cierres_zona enable row level security;
-- Sin políticas a propósito: solo lo tocan las funciones SECURITY DEFINER.

-- ── Movimientos: quién subió y quién bajó ──────────────────────────────────────
-- El resultado de cada jornada. Existe por dos motivos: es lo que hace idempotente el
-- traslado entre divisiones, y es lo que permite decirle a alguien «ascendiste» cuando abra
-- la app, que es el momento pico de este sistema.
create table if not exists movimientos (
  -- Liga de ORIGEN (la división en la que se jugó la jornada).
  liga uuid not null references ligas(id) on delete cascade,
  -- Lunes de la semana que se cerró.
  semana date not null,
  usuario uuid not null references auth.users(id) on delete cascade,
  puesto int not null,
  de_division int not null,
  a_division int not null,
  creado timestamptz not null default now(),
  primary key (liga, semana, usuario)
);

alter table movimientos enable row level security;

-- Cada quien ve solo sus propios movimientos. La clasificación de la jornada ya se ve por
-- `palmares`, que exige ser miembro.
create policy "movimientos: los tuyos" on movimientos
  for select using (auth.uid() = usuario);

-- ── Cuántos suben y cuántos bajan ──────────────────────────────────────────────
-- ⭐ La regla escala con el tamaño y tiene réplica EXACTA en `src/motor/divisiones.ts`, que es
-- la que pinta las zonas de ascenso y descenso en la tabla. Si se cambia aquí hay que
-- cambiarla allí.
--
--   n < 4      → 0   mover a alguien en una liga de 2 o 3 es ruido, no competición
--   n 4 a 7    → 1
--   n 8 a 11   → 2
--   n >= 12    → 3   el tope: Duolingo mueve ~un tercio, aquí somos más conservadores
--                    porque las divisiones de barrio serán pequeñas
create or replace function cuantos_mueven(n int)
returns int
language sql
immutable
as $$
  select case when n < 4 then 0 else least(3, n / 4) end;
$$;

-- ── Código de liga, extraído ───────────────────────────────────────────────────
-- El mismo generador de `crear_liga` (migración 03), como función para poder usarlo también
-- al crear divisiones. Sin I, O, 0 ni 1, y `extensions.` cualificado por el search_path.
create or replace function genera_codigo_liga()
returns text
language plpgsql
as $$
declare
  v_codigo text;
  v_intentos int := 0;
begin
  loop
    v_codigo := substr(
      translate(upper(encode(extensions.gen_random_bytes(8), 'base64')), '+/=IO01', 'ABCDEFG'),
      1, 6
    );
    exit when not exists (select 1 from ligas where ligas.codigo = v_codigo);
    v_intentos := v_intentos + 1;
    if v_intentos > 20 then
      raise exception 'no se pudo generar codigo';
    end if;
  end loop;
  return v_codigo;
end;
$$;

-- ── Unirse a una zona ──────────────────────────────────────────────────────────
-- Interna: mete a quien llama en la división que toca de UNA zona (ciudad o distrito),
-- creando zona y división si hacen falta. La pública de abajo la llama una o dos veces.
create or replace function unirse_zona_interna(p_ciudad text, p_distrito text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zona uuid;
  v_liga uuid;
  v_division int;
  v_cuantos bigint;
begin
  -- Zona, creándola si no existe. El `on conflict` cubre la carrera de dos personas
  -- estrenando la misma zona a la vez: la segunda no falla, reselecciona.
  insert into zonas (ciudad, distrito)
  values (trim(p_ciudad), p_distrito)
  on conflict (lower(trim(ciudad)), lower(trim(coalesce(distrito, '')))) do nothing
  returning id into v_zona;

  if v_zona is null then
    select z.id into v_zona from zonas z
     where lower(trim(z.ciudad)) = lower(trim(p_ciudad))
       and lower(trim(coalesce(z.distrito, ''))) = lower(trim(coalesce(p_distrito, '')));
  end if;

  -- ⭐ Se entra por ABAJO, como en Duolingo: la división más baja. Y cuando esa llega a 30
  -- (la cohorte que Duolingo midió como «todos ven una posición alcanzable delante»), quien
  -- llega estrena una división nueva por debajo.
  select l.id, l.division, count(m.usuario)
    into v_liga, v_division, v_cuantos
    from ligas l
    left join miembros m on m.liga = l.id
   where l.zona = v_zona
   group by l.id, l.division
   order by l.division desc
   limit 1;

  if v_liga is null then
    v_division := 1;
  elsif v_cuantos >= 30 then
    v_division := v_division + 1;
    v_liga := null;
  end if;

  if v_liga is null then
    insert into ligas (nombre, deporte, codigo, creador, zona, division)
    values (
      coalesce(p_distrito, trim(p_ciudad)),
      null,
      genera_codigo_liga(),
      auth.uid(),
      v_zona,
      v_division
    )
    on conflict (zona, division) where zona is not null do nothing
    returning ligas.id into v_liga;

    -- Carrera: otra persona creó la misma división un instante antes. Se entra en la suya.
    if v_liga is null then
      select l.id into v_liga from ligas l
       where l.zona = v_zona and l.division = v_division;
    end if;

    update zonas set divisiones = greatest(divisiones, v_division) where id = v_zona;
  end if;

  insert into miembros (liga, usuario) values (v_liga, auth.uid())
  on conflict (liga, usuario) do nothing;
end;
$$;

-- La puerta pública. Te mete en la liga de tu ciudad y, si das distrito, también en la del
-- distrito. Son dos competiciones: la del barrio es alcanzable, la de la ciudad da escala.
--
-- ⚠️ TU ZONA ES UNA: unirse a una zona te saca de la anterior. Sin esta regla alguien podría
-- apuntarse a veinte distritos y las ligas de barrio dejarían de significar barrio.
create or replace function unirse_a_zona(p_ciudad text, p_distrito text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ciudad text := trim(coalesce(p_ciudad, ''));
  v_distrito text := nullif(trim(coalesce(p_distrito, '')), '');
begin
  if auth.uid() is null then
    raise exception 'hace falta sesion';
  end if;
  if char_length(v_ciudad) not between 1 and 40 then
    raise exception 'ciudad no valida';
  end if;
  if v_distrito is not null and char_length(v_distrito) > 40 then
    raise exception 'distrito no valido';
  end if;

  -- Fuera de la zona anterior. Las puntuaciones históricas se quedan donde se jugaron.
  delete from miembros m
   using ligas l
   where l.id = m.liga and l.zona is not null and m.usuario = auth.uid();

  perform unirse_zona_interna(v_ciudad, null);
  if v_distrito is not null then
    perform unirse_zona_interna(v_ciudad, v_distrito);
  end if;
end;
$$;

-- Salirse de las ligas de zona. Las privadas no se tocan.
create or replace function salir_de_zona()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'hace falta sesion';
  end if;

  delete from miembros m
   using ligas l
   where l.id = m.liga and l.zona is not null and m.usuario = auth.uid();
end;
$$;

-- ── Aplicar ascensos y descensos ───────────────────────────────────────────────
-- Cierra la jornada de la semana pasada en las zonas de quien llama. Lo dispara la app al
-- sincronizar, igual que `cerrar_periodos`: no hace falta que sea puntual al segundo, hace
-- falta que sea idempotente, y lo es por el marcador de `cierres_zona`.
--
-- ⚠️ El resultado de cada quien es su ÚLTIMA fila wtd de la semana, SIN exigir `cerrado`. El
-- motivo: `cerrar_periodos` solo cierra las filas propias cuando esa persona sincroniza, así
-- que exigir el candado dejaría fuera a quien compitió toda la semana y no ha abierto la app
-- el lunes. Su fila ya no puede cambiar de todas formas: el upsert escribe solo el periodo
-- del día en curso.
--
-- ⚠️ La semana se calcula con la fecha LOCAL de quien dispara, coherente con el resto del
-- sistema. Con miembros en husos muy distintos la jornada podría cerrarse unas horas antes
-- para algunos; es la decisión abierta de siempre y se asume igual que en `cerrar_periodos`.
create or replace function aplicar_movimientos(p_hoy date)
returns table (mov_ciudad text, mov_distrito text, mov_semana date, mov_de int, mov_a int)
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Lunes de la semana que acaba de terminar.
  v_semana date := (date_trunc('week', p_hoy::timestamp))::date - 7;
  v_zona uuid;
begin
  if auth.uid() is null then
    raise exception 'hace falta sesion';
  end if;

  for v_zona in
    select distinct l.zona
      from miembros m
      join ligas l on l.id = m.liga
     where m.usuario = auth.uid() and l.zona is not null
  loop
    -- Sin actividad no hay jornada: mover gente por desempates de antigüedad sería churn.
    if not exists (
      select 1
        from puntuaciones p
        join ligas l on l.id = p.liga
       where l.zona = v_zona
         and p.horizonte = 'wtd'
         and p.periodo >= v_semana and p.periodo < v_semana + 7
    ) then
      continue;
    end if;

    -- El candado de la jornada. Si otra persona ya la procesó, FOUND queda en falso.
    insert into cierres_zona (zona, semana) values (v_zona, v_semana)
    on conflict do nothing;
    if not found then
      continue;
    end if;

    -- Clasificación final de cada división y a dónde va cada quien. Todo de una vez, con la
    -- foto de ANTES de mover a nadie. Quien no puntuó cuenta con 0: la inactividad baja, que
    -- es parte del diseño de Duolingo y lo que evita divisiones altas llenas de fantasmas.
    insert into movimientos (liga, semana, usuario, puesto, de_division, a_division)
    with divisiones as (
      select l.id as liga, l.division
        from ligas l
       where l.zona = v_zona
    ),
    tope as (
      select max(d.division) as ultima from divisiones d
    ),
    finales as (
      select distinct on (p.liga, p.usuario) p.liga, p.usuario, p.puntos
        from puntuaciones p
        join divisiones d on d.liga = p.liga
       where p.horizonte = 'wtd'
         and p.periodo >= v_semana and p.periodo < v_semana + 7
       order by p.liga, p.usuario, p.periodo desc
    ),
    tabla as (
      select d.liga,
             d.division,
             m.usuario,
             row_number() over (
               partition by d.liga
               order by coalesce(f.puntos, 0) desc, m.entro asc
             ) as puesto,
             count(*) over (partition by d.liga) as n
        from divisiones d
        join miembros m on m.liga = d.liga
        left join finales f on f.liga = d.liga and f.usuario = m.usuario
    )
    select t.liga,
           v_semana,
           t.usuario,
           t.puesto::int,
           t.division,
           case
             when t.division > 1 and t.puesto <= cuantos_mueven(t.n::int)
               then t.division - 1
             else t.division + 1
           end
      from tabla t, tope x
     where (t.division > 1 and t.puesto <= cuantos_mueven(t.n::int))
        or (t.division < x.ultima and t.puesto > t.n - cuantos_mueven(t.n::int))
    on conflict do nothing;

    -- El traslado: la fila de `miembros` cambia de liga, conservando `entro` y la preferencia
    -- de avisos. Las puntuaciones históricas se quedan en la división donde se jugaron.
    update miembros m
       set liga = destino.id
      from movimientos mo
      join ligas origen on origen.id = mo.liga
      join ligas destino on destino.zona = origen.zona and destino.division = mo.a_division
     where mo.semana = v_semana
       and origen.zona = v_zona
       and mo.de_division <> mo.a_division
       and m.liga = mo.liga
       and m.usuario = mo.usuario;
  end loop;

  -- Tus propios movimientos de esta jornada, para que la app celebre el ascenso. Los nombres
  -- de salida van con prefijo `mov_` por la lección de la migración 03: un nombre de columna
  -- de salida igual al de una tabla da 42702 al ejecutar, no al crear.
  return query
    select z.ciudad, z.distrito, mo.semana, mo.de_division, mo.a_division
      from movimientos mo
      join ligas l on l.id = mo.liga
      join zonas z on z.id = l.zona
     where mo.usuario = auth.uid()
       and mo.semana = v_semana
       and mo.de_division <> mo.a_division;
end;
$$;

-- ── `entrar_en_liga` no abre ligas de zona ─────────────────────────────────────
-- Las ligas de zona tienen código (la columna es not null) pero el código NO es su puerta:
-- si valiera, cualquiera podría saltarse el reparto por divisiones dictando un código. Se
-- entra solo por `unirse_a_zona`.
create or replace function entrar_en_liga(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_liga uuid;
begin
  if auth.uid() is null then
    raise exception 'hace falta sesion';
  end if;

  select id into v_liga from ligas
   where codigo = upper(trim(p_codigo)) and zona is null;
  if v_liga is null then
    raise exception 'codigo no valido';
  end if;

  insert into miembros (liga, usuario) values (v_liga, auth.uid())
  on conflict (liga, usuario) do nothing;

  return v_liga;
end;
$$;

-- ── Permisos ───────────────────────────────────────────────────────────────────
-- ⛔ Revocar de `public` PRIMERO, la lección de siempre: anon y authenticated heredan el
-- EXECUTE que Postgres regala a PUBLIC al crear cualquier función.
revoke execute on function unirse_a_zona(text, text) from public, anon;
revoke execute on function salir_de_zona() from public, anon;
revoke execute on function aplicar_movimientos(date) from public, anon;
-- Las internas no las llama nadie desde fuera.
revoke execute on function unirse_zona_interna(text, text) from public, anon, authenticated;
revoke execute on function genera_codigo_liga() from public, anon, authenticated;
revoke execute on function cuantos_mueven(int) from public, anon, authenticated;

grant execute on function unirse_a_zona(text, text) to authenticated;
grant execute on function salir_de_zona() to authenticated;
grant execute on function aplicar_movimientos(date) to authenticated;
