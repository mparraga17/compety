-- Migración 13 · ZONA HORARIA: el servidor sabe qué hora es para cada persona y para cada ciudad
--
-- Decisión de producto (15 sep 2026): la liga tiene que tener en cuenta el huso horario de cada
-- usuario. Hasta hoy el servidor no sabía en qué zona vive nadie: cada función recibía la FECHA
-- del teléfono (`p_hoy`, `p_periodo`) y se fiaba de ella dentro de un margen de ±2 días. Tres
-- consecuencias, todas malas:
--
--   · El cierre de una jornada de división lo disparaba el primer miembro cuyo reloj llegara al
--     lunes, con SU lunes: alguien en Buenos Aires cerraba la semana de una división de Madrid
--     cinco horas tarde, o alguien en Tokio ocho horas antes.
--   · La clasificación y el palmarés usaban la fecha que mandara el cliente: un reloj mal puesto
--     (o mal intencionado) movía la ventana de todo el mundo dentro del margen.
--   · No había forma de razonar sobre "la semana de esta persona" en el servidor.
--
-- Ahora cada perfil guarda su zona horaria IANA (`Europe/Madrid`, `America/Mexico_City`…), la app
-- la actualiza al arrancar si cambia, y el servidor calcula "hoy" y "esta semana" con ella:
--
--   · lo PERSONAL (cerrar tus periodos, tu clasificación, tu palmarés) va con TU zona;
--   · lo COLECTIVO (la jornada de una división) va con la zona de LA CIUDAD, que se fija al crear
--     la zona con la del primero que entra (vive allí por definición). Todos los miembros de la
--     división cierran a la vez, cuando es lunes en esa ciudad, dispare quien dispare.
--
-- ⚠️ COMPATIBILIDAD: las firmas de las funciones NO cambian. El build 8 sigue mandando `p_hoy` /
-- `p_periodo`, y el servidor ahora los IGNORA: la fecha del cliente deja de ser fuente de verdad
-- (era el candado de la migración 10; ya no hace falta un candado para un dato que no se usa).
--
-- ⛔ NO APLICADA a producción al escribirse. Se aplica con:
--   npx supabase db query --linked --project-ref vrmfvjtwyaofkqpvpbmx -o json -f supabase/migracion-13-zona-horaria.sql
--
-- No destructiva: dos columnas nuevas con valor por defecto (la beta está en España) y funciones
-- reemplazadas. Idempotente: se puede pegar dos veces.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Columnas ────────────────────────────────────────────────────────────────
-- Por defecto Madrid: es donde está toda la beta, y es mejor que UTC para las filas que ya
-- existen. La app la sobreescribe con la del teléfono en el primer arranque tras actualizar.
alter table public.perfiles
  add column if not exists zona_horaria text not null default 'Europe/Madrid';
alter table public.zonas
  add column if not exists zona_horaria text not null default 'Europe/Madrid';

-- ── 2. Helpers de fecha ───────────────────────────────────────────────────────
-- Aquí y en ningún otro sitio se convierte "ahora" en "hoy". `now() at time zone <zona>` da el
-- instante en la hora civil de esa zona, y `::date` se queda con el día. Con cambio de hora
-- incluido: es Postgres quien lo resuelve, no una resta de horas.

/** Zona horaria de una persona. Madrid si no tiene perfil aún (recién dada de alta). */
create or replace function zona_horaria_de(p_usuario uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select zona_horaria from perfiles where id = p_usuario), 'Europe/Madrid');
$$;

/** Qué día es hoy para esa persona. */
create or replace function hoy_de(p_usuario uuid)
returns date
language sql
security definer
set search_path = public
stable
as $$
  select (now() at time zone zona_horaria_de(p_usuario))::date;
$$;

/** Qué día es hoy en una zona horaria dada (la de una ciudad). */
create or replace function hoy_en(p_zona_horaria text)
returns date
language sql
set search_path = public
stable
as $$
  select (now() at time zone p_zona_horaria)::date;
$$;

-- Los helpers solo los llaman otras funciones. Ni siquiera `authenticated`: `hoy_de` con un uuid
-- ajeno diría la zona horaria de otra persona, que es un dato personal.
revoke execute on function zona_horaria_de(uuid) from public, anon, authenticated;
revoke execute on function hoy_de(uuid) from public, anon, authenticated;
revoke execute on function hoy_en(text) from public, anon, authenticated;

-- ── 3. La app declara su zona ─────────────────────────────────────────────────
-- Se valida dejando que Postgres la interprete: `now() at time zone 'Marte/Olympus'` lanza
-- 22023 (invalid_parameter_value), y eso es exactamente "no es una zona horaria". Más exacto
-- que una lista propia, y no hay que mantenerlo.
--
-- La columna no está en el grant por columnas de `perfiles` (migración 10) a propósito: solo se
-- escribe por aquí, validada.
create or replace function elegir_zona_horaria(p_zona text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  v_prueba timestamp;
begin
  if v_yo is null then
    raise exception 'hace falta sesion';
  end if;
  if p_zona is null or char_length(p_zona) not between 1 and 64 then
    raise exception 'zona horaria no valida';
  end if;
  begin
    v_prueba := now() at time zone p_zona;
  exception
    when invalid_parameter_value then
      raise exception 'zona horaria no valida';
  end;

  update perfiles set zona_horaria = p_zona where id = v_yo and zona_horaria is distinct from p_zona;
end;
$$;

revoke execute on function elegir_zona_horaria(text) from public, anon;
grant execute on function elegir_zona_horaria(text) to authenticated;

-- ── 4. Cerrar TUS periodos: con TU zona ───────────────────────────────────────
-- `p_hoy` se ignora: se conserva por compatibilidad con el build 8.
create or replace function cerrar_periodos(p_hoy date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy date;
  v_filas int;
begin
  if auth.uid() is null then
    raise exception 'hace falta sesion';
  end if;
  v_hoy := hoy_de(auth.uid());

  update puntuaciones
     set cerrado = true
   where usuario = auth.uid()
     and not cerrado
     and periodo < v_hoy;

  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

-- ── 5. La clasificación: la ventana es la de quien mira ───────────────────────
-- `p_periodo` se ignora (compatibilidad). Cuerpo idéntico al de la migración 11 salvo el origen
-- de la fecha, incluida la lección 42702: todo cualificado.
create or replace function clasificacion(p_liga uuid, p_horizonte text, p_periodo date)
returns table (usuario uuid, nombre text, puntos int, sesiones int, tono text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy date;
  v_desde date;
  v_hasta date;
begin
  if not es_miembro(p_liga, auth.uid()) then
    raise exception 'no estas en esa liga';
  end if;
  v_hoy := hoy_de(auth.uid());

  v_desde := case p_horizonte
    when 'wtd' then date_trunc('week', v_hoy::timestamp)::date   -- lunes ISO, como la app
    when 'mtd' then date_trunc('month', v_hoy::timestamp)::date
    when 'ytd' then date_trunc('year', v_hoy::timestamp)::date
    when 'd7' then v_hoy - 6
    when 'd30' then v_hoy - 29
    else null
  end;
  if v_desde is null then
    raise exception 'horizonte no valido';
  end if;

  -- Hasta dónde llega la ventana. Un miembro en un huso más adelantado ya puede haber escrito
  -- su fila de "mañana" (su hoy), y es su último dato: en las ventanas móviles entra. En las de
  -- calendario el tope es el FIN del tramo de quien mira, no hoy: su fila del lunes siguiente
  -- (que para él ya es semana nueva) no puede colarse como resultado de la semana que aquí aún
  -- no ha terminado.
  v_hasta := case p_horizonte
    when 'wtd' then v_desde + 6
    when 'mtd' then (v_desde + interval '1 month')::date - 1
    when 'ytd' then (v_desde + interval '1 year')::date - 1
    else v_hoy + 1
  end;

  return query
    with ultimas as (
      select distinct on (p.usuario)
        p.usuario as quien,
        p.puntos as pts,
        p.sesiones as ses,
        p.tono as tn,
        p.actualizado as act
      from puntuaciones p
      join miembros m on m.liga = p.liga and m.usuario = p.usuario
      where p.liga = p_liga
        and p.horizonte = p_horizonte
        and p.periodo between v_desde and v_hasta
      order by p.usuario, p.periodo desc
    )
    select u.quien, pe.nombre, u.pts, u.ses, u.tn
    from ultimas u
    join perfiles pe on pe.id = u.quien
    order by u.pts desc, u.act asc;
end;
$$;

-- ── 6. El palmarés: tramos terminados según quien mira ────────────────────────
-- `p_hoy` se ignora (compatibilidad). Cuerpo de la migración 05 con la fecha del servidor.
create or replace function palmares(p_liga uuid, p_horizonte text, p_hoy date)
returns table (
  inicio date,
  usuario uuid,
  nombre text,
  puntos int,
  sesiones int,
  puesto bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy date;
  v_trunc text;
begin
  if not es_miembro(p_liga, auth.uid()) then
    raise exception 'no estas en esa liga';
  end if;
  v_hoy := hoy_de(auth.uid());

  v_trunc := case p_horizonte
    when 'wtd' then 'week'
    when 'mtd' then 'month'
    when 'ytd' then 'year'
    else null
  end;
  if v_trunc is null then
    raise exception 'ese horizonte no tiene cierre';
  end if;

  return query
  with finales as (
    select distinct on (date_trunc(v_trunc, p.periodo), p.usuario)
      date_trunc(v_trunc, p.periodo)::date as tramo,
      p.usuario as quien,
      p.puntos as pts,
      p.sesiones as ses
    from puntuaciones p
    where p.liga = p_liga
      and p.horizonte = p_horizonte
      and p.cerrado
      and (date_trunc(v_trunc, p.periodo) + ('1 ' || v_trunc)::interval)::date <= v_hoy
    order by date_trunc(v_trunc, p.periodo), p.usuario, p.periodo desc
  )
  select
    f.tramo,
    f.quien,
    pe.nombre,
    f.pts,
    f.ses,
    rank() over (partition by f.tramo order by f.pts desc)
  from finales f
  join perfiles pe on pe.id = f.quien
  order by f.tramo desc, f.pts desc;
end;
$$;

-- `semanas_ganadas` llama a `palmares` pasándole `p_hoy`, que ahora se ignora: no hay que tocarla.

-- ── 7. La jornada de cada división: con la zona de SU ciudad ──────────────────
-- `p_hoy` se ignora (compatibilidad). Cuerpo de la migración 10 con dos cambios: la semana que
-- se cierra se calcula POR ZONA con la hora de esa ciudad, y por tanto dentro del bucle.
create or replace function aplicar_movimientos(p_hoy date)
returns table (mov_ciudad text, mov_distrito text, mov_semana date, mov_de int, mov_a int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zona record;
  v_semana date;
begin
  if auth.uid() is null then
    raise exception 'hace falta sesion';
  end if;

  for v_zona in
    select distinct z.id, z.zona_horaria
      from miembros m
      join ligas l on l.id = m.liga
      join zonas z on z.id = l.zona
     where m.usuario = auth.uid()
  loop
    -- Lunes de la semana que acaba de terminar EN ESA CIUDAD. Si allí aún es domingo, la
    -- semana en curso no se toca aunque quien dispara ya esté en lunes.
    v_semana := date_trunc('week', hoy_en(v_zona.zona_horaria)::timestamp)::date - 7;

    if not exists (
      select 1
        from puntuaciones p
        join ligas l on l.id = p.liga
       where l.zona = v_zona.id
         and p.horizonte = 'wtd'
         and p.periodo >= v_semana and p.periodo < v_semana + 7
    ) then
      continue;
    end if;

    insert into cierres_zona (zona, semana) values (v_zona.id, v_semana)
    on conflict do nothing;
    if not found then
      continue;
    end if;

    insert into movimientos (liga, semana, usuario, puesto, de_division, a_division)
    with divisiones as (
      select l.id as liga, l.division
        from ligas l
       where l.zona = v_zona.id
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

    update miembros m
       set liga = destino.id
      from movimientos mo
      join ligas origen on origen.id = mo.liga
      join ligas destino on destino.zona = origen.zona and destino.division = mo.a_division
     where mo.semana = v_semana
       and origen.zona = v_zona.id
       and mo.de_division <> mo.a_division
       and m.liga = mo.liga
       and m.usuario = mo.usuario;
  end loop;

  -- Lo que le pasó a quien pregunta en la ÚLTIMA jornada cerrada de cada una de sus zonas. Se
  -- lee de `cierres_zona` y no de una fecha calculada: con ciudades en husos distintos no hay
  -- una única "semana pasada".
  return query
    select z.ciudad, z.distrito, mo.semana, mo.de_division, mo.a_division
      from movimientos mo
      join ligas l on l.id = mo.liga
      join zonas z on z.id = l.zona
      join lateral (
        select max(c.semana) as ultima from cierres_zona c where c.zona = z.id
      ) u on true
     where mo.usuario = auth.uid()
       and mo.semana = u.ultima
       and mo.de_division <> mo.a_division;
end;
$$;

-- ── 8. Una zona nueva nace con la hora de quien la estrena ────────────────────
-- Cuerpo de la migración 06 con una sola línea más en el insert de `zonas`.
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
  insert into zonas (ciudad, distrito, zona_horaria)
  values (trim(p_ciudad), p_distrito, zona_horaria_de(auth.uid()))
  on conflict (lower(trim(ciudad)), lower(trim(coalesce(distrito, '')))) do nothing
  returning id into v_zona;

  if v_zona is null then
    select z.id into v_zona from zonas z
     where lower(trim(z.ciudad)) = lower(trim(p_ciudad))
       and lower(trim(coalesce(z.distrito, ''))) = lower(trim(coalesce(p_distrito, '')));
  end if;

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

-- Misma política que en la 06: interna, no la llama nadie desde fuera.
revoke execute on function unirse_zona_interna(text, text) from public, anon, authenticated;

-- ── Lo que se revisó y NO se toca ─────────────────────────────────────────────
--
-- · El `periodo` que escribe la app sigue siendo la fecha LOCAL del teléfono (misma zona que el
--   perfil, porque es el mismo dispositivo). El disparador de la migración 12 lo acota a ±2 días
--   del servidor; con la zona conocida podría acotarse a ±1 de `hoy_de(usuario)`, pero un perfil
--   con la zona sin actualizar (primer arranque sin red tras viajar) daría falsos rechazos.
-- · `semanas_ganadas(p_liga, p_anio, p_hoy)`: delega en `palmares`, que ya ignora `p_hoy`.
-- · Las ligas PRIVADAS con miembros en husos distintos: cada uno ve la tabla con su propia semana
--   (decisión de producto: la zona de cada usuario). Durante las horas de diferencia entre dos
--   lunes, quien va por delante puede no ver aún la fila nueva del otro. Es lo que significa
--   "cada uno con su hora"; una zona por liga privada sería la alternativa si algún día molesta.
--
-- ── Checklist tras aplicar ────────────────────────────────────────────────────
--
-- 1. `select column_name, column_default from information_schema.columns where table_name in ('perfiles','zonas') and column_name='zona_horaria';` → 2 filas, default 'Europe/Madrid'.
-- 2. `select zona_horaria, count(*) from perfiles group by 1;` → todo Madrid hasta que la app actualice.
-- 3. Con sesión real: `select elegir_zona_horaria('Marte/Olympus');` → 'zona horaria no valida';
--    `select elegir_zona_horaria('America/Mexico_City');` → ok y el perfil cambia.
-- 4. `select has_function_privilege('authenticated', 'hoy_de(uuid)', 'EXECUTE');` → false.
-- 5. Build 8: sincronizar y abrir Competi tienen que seguir funcionando (mismas firmas).
-- 6. Recuento total de filas idéntico antes y después.
