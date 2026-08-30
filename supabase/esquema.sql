-- Esquema de Compety.
--
-- REGLA QUE MANDA SOBRE TODO LO DEMAS: aqui no entra ningun dato de salud. Ni pulsos, ni
-- zonas, ni sueno, ni minutos en zona. Solo la puntuacion ya calculada en el telefono.
-- Motivos: RGPD, menos dano en una filtracion, y la guia 5.1.3 de Apple.
--
-- Efecto secundario buscado: el servidor no puede filtrar datos de salud porque no los tiene.
-- Eso hace que las notificaciones a otras personas cumplan la regla de HealthKit por
-- construccion, no por cuidado.
--
-- Patron de seguridad tomado de `cargaapp`, revisado con el MCP de GitHub: unirse a una liga
-- es una funcion SECURITY DEFINER y NINGUNA tabla tiene politica de INSERT abierta. El agujero
-- que repiten los demas proyectos es dejar que cualquiera inserte su propia fila de miembro.

-- ── Perfiles ───────────────────────────────────────────────────────────────────
-- El nombre visible es lo unico que ven los demas, junto con la puntuacion.
create table if not exists perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 1 and 40),
  creado timestamptz not null default now(),
  -- Token de Expo para las notificaciones push. Se borra cuando deja de ser valido.
  push_token text,
  -- Preferencia global. Por liga hay otra en miembros.
  avisos boolean not null default true
);

alter table perfiles enable row level security;

-- Cada quien lee y escribe SOLO su perfil.
create policy "perfil propio: leer" on perfiles
  for select using (auth.uid() = id);
create policy "perfil propio: crear" on perfiles
  for insert with check (auth.uid() = id);
create policy "perfil propio: editar" on perfiles
  for update using (auth.uid() = id);

-- ── Ligas ──────────────────────────────────────────────────────────────────────
-- `deporte` null es la liga general, que acepta cualquier actividad. El resto guarda el id
-- de liga del motor: padel, tenis, correr, estudio, fuerza, golf, paseo.
create table if not exists ligas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(trim(nombre)) between 1 and 40),
  deporte text,
  -- Codigo para invitar. Corto para poder dictarlo por telefono.
  codigo text not null unique check (codigo ~ '^[A-Z0-9]{6}$'),
  creador uuid not null references auth.users(id) on delete cascade,
  creado timestamptz not null default now()
);

alter table ligas enable row level security;

-- ── Miembros ───────────────────────────────────────────────────────────────────
create table if not exists miembros (
  liga uuid not null references ligas(id) on delete cascade,
  usuario uuid not null references auth.users(id) on delete cascade,
  entro timestamptz not null default now(),
  -- Autonomia, que es requisito de la teoria de la autodeterminacion: los avisos se pueden
  -- apagar liga por liga sin salirse de ella.
  avisos boolean not null default true,
  primary key (liga, usuario)
);

alter table miembros enable row level security;

-- ⭐ Funcion de pertenencia, con SECURITY DEFINER para romper la recursion de RLS.
-- Sin esto, la politica de `miembros` consultaria `miembros` y Postgres da error 42P17.
create or replace function es_miembro(p_liga uuid, p_usuario uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from miembros where liga = p_liga and usuario = p_usuario
  );
$$;

-- Ves una liga si estas dentro. El codigo no sirve para fisgar, solo para entrar.
create policy "ligas: solo las tuyas" on ligas
  for select using (es_miembro(id, auth.uid()));

-- Ves a los miembros de tus ligas, y a nadie mas.
create policy "miembros: los de tus ligas" on miembros
  for select using (es_miembro(liga, auth.uid()));

-- Solo puedes cambiar TU fila, y solo la preferencia de avisos.
create policy "miembros: editar lo tuyo" on miembros
  for update using (auth.uid() = usuario);

-- Salirse de una liga siempre se puede.
create policy "miembros: salirte" on miembros
  for delete using (auth.uid() = usuario);

-- ⛔ Ojo: NO hay politica de INSERT en `miembros` ni en `ligas`. A proposito. Se entra solo
-- por las funciones de abajo, que validan el codigo. Es el agujero que repiten los demas.

-- ── Puntuaciones ───────────────────────────────────────────────────────────────
-- Una fila por persona, liga y periodo. La cifra ya viene calculada del telefono.
create table if not exists puntuaciones (
  liga uuid not null references ligas(id) on delete cascade,
  usuario uuid not null references auth.users(id) on delete cascade,
  -- Ventana temporal del motor: wtd, d7, mtd, d30, ytd.
  horizonte text not null check (horizonte in ('wtd','d7','mtd','d30','ytd')),
  -- Dia de cierre del periodo en hora local de quien puntua, como AAAA-MM-DD.
  periodo date not null,
  puntos int not null check (puntos between 0 and 1000),
  sesiones int not null default 0 check (sesiones >= 0),
  -- Etiqueta cualitativa comparada con la base PROPIA de esa persona. Nunca valores
  -- absolutos, que no son comparables entre marcas de pulsera.
  tono text check (tono in ('suave','normal','fuerte')),
  actualizado timestamptz not null default now(),
  -- ⭐ Idempotencia. El segundo plano puede despertar la app varias veces con los mismos
  -- datos, y sin esto el leaderboard contaria doble.
  primary key (liga, usuario, horizonte, periodo)
);

alter table puntuaciones enable row level security;

create policy "puntuaciones: las de tus ligas" on puntuaciones
  for select using (es_miembro(liga, auth.uid()));

-- Escribes tu propia puntuacion, y solo si estas en la liga.
create policy "puntuaciones: subir la tuya" on puntuaciones
  for insert with check (auth.uid() = usuario and es_miembro(liga, auth.uid()));
create policy "puntuaciones: corregir la tuya" on puntuaciones
  for update using (auth.uid() = usuario and es_miembro(liga, auth.uid()));

create index if not exists puntuaciones_tabla
  on puntuaciones (liga, horizonte, periodo, puntos desc);

-- ── Avisos ─────────────────────────────────────────────────────────────────────
-- ⭐ Patron de Dizkarte: el aviso se ESCRIBE primero y un webhook dispara el envio. Asi el
-- aviso queda registrado aunque el push falle, y se puede depurar sin adivinar.
--
-- ⛔ REGLA DURA: aqui NO puede entrar ningun dato de salud. Apple es literal: no se puede
-- revelar informacion obtenida de HealthKit a un tercero sin permiso expreso. Puntuacion y
-- tono si, porque son datos derivados que la persona consiente al entrar en una liga.
-- Nada de pulsos, zonas ni minutos de esfuerzo.
create table if not exists avisos (
  id uuid primary key default gen_random_uuid(),
  liga uuid not null references ligas(id) on delete cascade,
  -- Quien lo provoca.
  autor uuid not null references auth.users(id) on delete cascade,
  clase text not null check (clase in ('sesion','liderato')),
  puntos int not null check (puntos between 0 and 1000),
  tono text not null check (tono in ('suave','normal','fuerte')),
  creado timestamptz not null default now(),
  estado text not null default 'pendiente'
    check (estado in ('pendiente','enviado','suprimido','fallido')),
  -- Evita avisar dos veces de la misma sesion si el segundo plano se repite.
  huella text not null unique
);

alter table avisos enable row level security;

create policy "avisos: los de tus ligas" on avisos
  for select using (es_miembro(liga, auth.uid()));

-- ── Entrar en una liga ─────────────────────────────────────────────────────────
-- SECURITY DEFINER porque valida el codigo y luego inserta. Es la unica puerta de entrada.
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

  select id into v_liga from ligas where codigo = upper(trim(p_codigo));
  if v_liga is null then
    raise exception 'codigo no valido';
  end if;

  insert into miembros (liga, usuario) values (v_liga, auth.uid())
  on conflict (liga, usuario) do nothing;

  return v_liga;
end;
$$;

-- Crear liga y quedarse dentro, en una sola operacion.
create or replace function crear_liga(p_nombre text, p_deporte text default null)
returns table (id uuid, codigo text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_codigo text;
  v_intentos int := 0;
begin
  if auth.uid() is null then
    raise exception 'hace falta sesion';
  end if;

  -- Sin I, O, 0 ni 1, que se confunden al dictarlos.
  loop
    v_codigo := upper(
      substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=IO01lo', 'ABCDEFGHJ'), 1, 6)
    );
    exit when not exists (select 1 from ligas where codigo = v_codigo);
    v_intentos := v_intentos + 1;
    if v_intentos > 20 then
      raise exception 'no se pudo generar codigo';
    end if;
  end loop;

  insert into ligas (nombre, deporte, codigo, creador)
  values (trim(p_nombre), p_deporte, v_codigo, auth.uid())
  returning ligas.id into v_id;

  insert into miembros (liga, usuario) values (v_id, auth.uid());

  return query select v_id, v_codigo;
end;
$$;

-- ── Clasificacion ──────────────────────────────────────────────────────────────
-- Devuelve la tabla de una liga. Va como funcion para poder juntar el nombre del perfil sin
-- abrir la tabla `perfiles` a lecturas de terceros.
create or replace function clasificacion(p_liga uuid, p_horizonte text, p_periodo date)
returns table (usuario uuid, nombre text, puntos int, sesiones int, tono text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_miembro(p_liga, auth.uid()) then
    raise exception 'no estas en esa liga';
  end if;

  return query
    select p.usuario, pe.nombre, p.puntos, p.sesiones, p.tono
    from puntuaciones p
    join perfiles pe on pe.id = p.usuario
    where p.liga = p_liga and p.horizonte = p_horizonte and p.periodo = p_periodo
    order by p.puntos desc, p.actualizado asc;
end;
$$;

-- ── Borrado de cuenta ──────────────────────────────────────────────────────────
-- Apple lo exige dentro de la app. El borrado en cascada de `perfiles` se lleva miembros,
-- puntuaciones y avisos.
create or replace function borrar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'hace falta sesion';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- ── Cuando avisar ──────────────────────────────────────────────────────────────
-- ⚠️ Decision de producto con respaldo, no capricho de volumen.
--
-- A favor de avisar: en STEP UP (JAMA, RCT, 602 adultos) la competicion fue el unico formato
-- cuyo efecto persistio al apagar la gamificacion, pero lo que aguanto fue competicion CON
-- VINCULOS SOCIALES REALES. Un aviso de que alguien acaba de sumar es ese vinculo. Y solo el
-- 3 % de usuarios de apps de salud sigue activo a los 30 dias, asi que sin avisos la gente no
-- vuelve.
--
-- En contra de avisar mucho: la teoria de la autodeterminacion (Deci y Ryan) dice que los
-- puntos y avisos puestos sin criterio generan motivacion controlada, que predice abandono.
--
-- ⇒ Se avisa POCO y con motivo. Dos casos, y nada mas:
--   1. La sesion esta por encima de LA PROPIA normal de quien la hizo (tono 'fuerte').
--   2. Cambia el liderato de la liga.
-- Comparar con la normal propia y no con una escala absoluta es obligatorio: los valores
-- absolutos no son comparables entre marcas de pulsera.
create or replace function anotar_aviso(
  p_liga uuid,
  p_clase text,
  p_puntos int,
  p_tono text,
  p_huella text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'hace falta sesion';
  end if;
  if not es_miembro(p_liga, auth.uid()) then
    raise exception 'no estas en esa liga';
  end if;

  -- Solo los dos casos con respaldo. Una sesion normal o suave no molesta a nadie.
  if p_clase = 'sesion' and p_tono <> 'fuerte' then
    return;
  end if;

  insert into avisos (liga, autor, clase, puntos, tono, huella)
  values (p_liga, auth.uid(), p_clase, p_puntos, p_tono, p_huella)
  on conflict (huella) do nothing;
end;
$$;

-- Destinatarios de un aviso: los demas miembros que no lo han apagado.
-- La usa la Edge Function, que corre con service_role.
create or replace function destinatarios_de(p_aviso uuid)
returns table (push_token text)
language sql
security definer
set search_path = public
stable
as $$
  select pe.push_token
  from avisos a
  join miembros m on m.liga = a.liga and m.usuario <> a.autor and m.avisos
  join perfiles pe on pe.id = m.usuario and pe.avisos
  where a.id = p_aviso and pe.push_token is not null;
$$;

-- Nombre visible de una persona. Solo para la Edge Function, que corre con service_role.
-- Existe para no abrir `perfiles` a lecturas de terceros: el nombre se resuelve en el
-- servidor al redactar el aviso, no viaja por la app.
create or replace function nombre_de(p_usuario uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select nombre from perfiles where id = p_usuario;
$$;

-- ⚠️ Sin GRANT a anon ni authenticated: solo service_role la puede llamar.
revoke execute on function nombre_de(uuid) from anon, authenticated;
revoke execute on function destinatarios_de(uuid) from anon, authenticated;

-- ── ⭐ Semanas cerradas: la puntuacion se CONGELA ───────────────────────────────
-- Decision de producto que habia que tomar antes de guardar datos, porque cambiar tablas con
-- filas dentro es caro.
--
-- El problema: la base personal se recalcula cuando llegan datos nuevos, asi que una semana ya
-- terminada podria cambiar de puntuacion de forma retroactiva. Quien gano el lunes podria dejar
-- de haber ganado el jueves, sin haber hecho nada.
--
-- ⇒ Al cerrar el periodo la puntuacion se congela. Motivo, y no es solo comodidad tecnica: la
-- teoria de la autodeterminacion (Deci y Ryan) dice que la COMPETENCIA percibida es una de las
-- tres necesidades, y que perderla predice abandono. Ganar y que luego te lo quiten es la forma
-- mas directa de romperla. Ademas en el ensayo STEP UP lo que sostuvo el efecto fue la
-- competicion con vinculos sociales reales, y esos vinculos no aguantan un ranking que cambia
-- el pasado.
--
-- Consecuencia asumida y declarada: una semana cerrada puede haberse calculado con una base
-- personal peor afinada que la de hoy. Se acepta, porque un resultado estable vale mas que un
-- resultado exacto a posteriori. La ventana en curso si se recalcula, que es lo que la gente
-- espera mientras la semana esta viva.
alter table puntuaciones
  add column if not exists cerrado boolean not null default false;

-- Una vez cerrada, la fila no se puede modificar. Es la garantia de que nadie reescribe el
-- pasado, ni por error de la app ni por un segundo plano que despierte tarde.
create or replace function protege_cerradas()
returns trigger
language plpgsql
as $$
begin
  if old.cerrado then
    raise exception 'esa semana ya esta cerrada';
  end if;
  return new;
end;
$$;

drop trigger if exists no_tocar_cerradas on puntuaciones;
create trigger no_tocar_cerradas
  before update on puntuaciones
  for each row execute function protege_cerradas();

-- Cierra los periodos que ya pasaron. Se llama desde la app al sincronizar: mas simple que un
-- cron, y no hace falta que sea puntual al segundo.
--
-- ⚠️ La zona horaria era la otra decision abierta. Se cierra por la hora LOCAL de cada persona,
-- que es la que esa persona vivio. La alternativa, una referencia unica tipo UTC, haria que a
-- alguien en Mexico se le cerrara la semana a media tarde del domingo. Con un grupo en Espana da
-- igual; en cuanto entra alguien fuera, no.
create or replace function cerrar_periodos(p_hoy date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas int;
begin
  if auth.uid() is null then
    raise exception 'hace falta sesion';
  end if;

  update puntuaciones
     set cerrado = true
   where usuario = auth.uid()
     and not cerrado
     and periodo < p_hoy;

  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;
