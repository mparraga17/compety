-- Migracion 04: usuarios de demostracion.
--
-- PARA QUE: probar la UX real de amigos, ligas y clasificacion sin necesitar personas de verdad.
-- El usuario lo pidio asi: *"que yo los busque y los agregue y me aparezcan, pero que sea un
-- usuario inventado"*. O sea que no basta con meter filas: tienen que RESPONDER.
--
-- ⭐ EL PROBLEMA QUE RESUELVE, y no es obvio. Agregar a alguien deja la amistad en `pendiente`
-- hasta que la otra parte acepta. Un usuario demo no tiene telefono ni dedo, asi que la peticion
-- se quedaria colgada para siempre y la prueba no llegaria a ninguna parte. Aqui hay un trigger
-- que hace que los demo acepten solos, que es lo unico que permite recorrer el circuito entero.
--
-- ⚠️⚠️ ESTO NO PUEDE LLEGAR A PRODUCCION CON DATOS DENTRO. Motivos, en orden de gravedad:
--   1. Apple prohibe expresamente datos falsos relacionados con salud (guia 5.1.3.ii). Las
--      PUNTUACIONES no son datos de HealthKit, asi que el riesgo es menor que sembrar en
--      HealthKit, pero un ranking poblado de gente inventada es engano al usuario igualmente.
--   2. Un usuario real podria buscar `demo_marta`, agregarla y competir contra un fantasma.
--   3. Los perfiles demo ocupan nombres de usuario del espacio real.
--
-- ⇒ Se cargan A MANO en el proyecto de pruebas y se borran con `select limpiar_demo();` antes de
-- cualquier build de produccion. Hay una comprobacion al final que avisa si quedan.
--
-- ⛔ Y sigue en pie la regla dura del proyecto: aqui NO entra ningun dato de salud. Los demo
-- tienen puntuaciones y nada mas, igual que una persona real. El servidor no recibe pulsos.

-- ── Marca de demo ──────────────────────────────────────────────────────────────
-- Una columna y no una tabla aparte: asi los demo pasan por exactamente el mismo codigo que una
-- persona real, que es el objetivo de la prueba. Si vivieran en otra tabla estariamos probando
-- un camino distinto del que usan los usuarios.
alter table perfiles
  add column if not exists demo boolean not null default false;

-- Para poder listarlos y borrarlos sin recorrer la tabla.
create index if not exists perfiles_demo on perfiles (demo) where demo;

-- ── ⭐ Los demo aceptan solos ───────────────────────────────────────────────────
-- Sin esto la peticion se queda en `pendiente` para siempre y no se puede probar nada.
--
-- ⚠️ Se limita a filas donde el DESTINATARIO es demo. Una peticion entre dos personas reales no
-- la toca, asi que el comportamiento normal de la app no cambia.
--
-- El retardo no se simula: aceptar al instante es lo que hace la prueba util. Si algun dia se
-- quiere probar el estado "pendiente", se agrega a un demo con `auto_acepta = false`.
alter table perfiles
  add column if not exists auto_acepta boolean not null default true;

create or replace function demo_acepta_sola()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from perfiles
     where id = new.a and demo and auto_acepta
  ) then
    new.estado := 'aceptada';
    new.resuelta := now();
  end if;
  return new;
end;
$$;

drop trigger if exists demo_auto_acepta on amistades;
create trigger demo_auto_acepta
  before insert on amistades
  for each row execute function demo_acepta_sola();

-- ── Crear un usuario demo ──────────────────────────────────────────────────────
-- ⚠️ Escribe en `auth.users` directamente, que es lo que permite que el demo sea un usuario de
-- pleno derecho: puede estar en ligas, tener puntuaciones y aparecer en la clasificacion. La
-- alternativa (crearlos por la API de admin) exigiria la clave secreta en un script, y esa clave
-- no debe salir de los secretos de las Edge Functions.
--
-- La contrasena queda inutilizable a proposito: estos usuarios NO se pueden usar para entrar.
-- Existen para ser buscados y para poblar una tabla, no para iniciar sesion.
create or replace function crear_demo(
  p_usuario text,
  p_nombre text,
  p_auto_acepta boolean default true
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  if p_usuario !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'usuario no valido: %', p_usuario;
  end if;

  -- Ya existe: se devuelve el que hay, para que el script se pueda ejecutar dos veces.
  select id into v_id from perfiles where lower(usuario) = lower(p_usuario) and demo;
  if v_id is not null then
    return v_id;
  end if;

  v_id := gen_random_uuid();

  insert into auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    v_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    -- `.invalid` es un TLD reservado por la RFC 2606: nunca va a resolver, asi que ningun
    -- correo real puede coincidir con estos.
    p_usuario || '@demo.invalid',
    -- Hash imposible de alcanzar con ninguna contrasena. Estos usuarios no entran.
    '$2a$10$demo.no.se.puede.usar.para.entrar.nunca.jamas.aqui',
    now(), now(), now(),
    '{"provider":"demo","providers":["demo"]}'::jsonb,
    '{"demo":true}'::jsonb
  );

  insert into perfiles (id, nombre, usuario, demo, auto_acepta)
  values (v_id, p_nombre, lower(p_usuario), true, p_auto_acepta);

  return v_id;
end;
$$;

-- ── Poner puntuaciones a un demo ───────────────────────────────────────────────
-- ⚠️ Las puntuaciones se pasan a mano y NO se generan al azar. Motivo de metodo, y este proyecto
-- ya lo aprendio tres veces con el ranking: con datos aleatorios no se puede juzgar si el orden
-- es defendible. Con cifras elegidas si, porque sabes que esperabas ver.
--
-- Rango util para probar: la escala del motor da unos 50 puntos a una sesion media, y el total de
-- una semana con bonus ronda 60-90. Cifras fuera de ahi delatan que algo va mal en el motor.
create or replace function demo_puntua(
  p_usuario text,
  p_liga uuid,
  p_horizonte text,
  p_periodo date,
  p_puntos int,
  p_sesiones int default 4,
  p_tono text default 'normal'
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from perfiles where lower(usuario) = lower(p_usuario) and demo;
  if v_id is null then
    raise exception 'no hay demo con usuario %', p_usuario;
  end if;

  -- Tiene que estar en la liga o la clasificacion no lo incluye.
  insert into miembros (liga, usuario) values (p_liga, v_id)
  on conflict (liga, usuario) do nothing;

  insert into puntuaciones (liga, usuario, horizonte, periodo, puntos, sesiones, tono)
  values (p_liga, v_id, p_horizonte, p_periodo, p_puntos, p_sesiones, p_tono)
  on conflict (liga, usuario, horizonte, periodo) do update
    set puntos = excluded.puntos,
        sesiones = excluded.sesiones,
        tono = excluded.tono,
        actualizado = now();
end;
$$;

-- ── ⭐ Rellenar TODAS las ventanas de una vez ───────────────────────────────────
-- La app ofrece cinco ventanas (wtd, d7, mtd, d30, ytd) y cada una lee su propia fila. Si solo
-- se puebla una, al cambiar de periodo la tabla sale vacia y parece que la app esta rota.
--
-- Los multiplicadores no son arbitrarios: el tope de sesiones escala con la ventana (5 para una
-- semana, 20 para un mes, 60 para un año), pero la puntuacion es una MEDIA mas un bonus acotado,
-- asi que no crece en proporcion al tiempo. Sube poco, que es lo que hace el motor real.
create or replace function demo_puntua_todo(
  p_usuario text,
  p_liga uuid,
  p_puntos int,
  p_sesiones int default 4,
  p_tono text default 'normal'
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy date := current_date;
begin
  perform demo_puntua(p_usuario, p_liga, 'wtd', v_hoy, p_puntos, p_sesiones, p_tono);
  perform demo_puntua(p_usuario, p_liga, 'd7', v_hoy, p_puntos, p_sesiones, p_tono);
  -- En un mes hay mas sesiones, pero la media apenas se mueve.
  perform demo_puntua(p_usuario, p_liga, 'mtd', v_hoy, p_puntos + 2, p_sesiones * 3, p_tono);
  perform demo_puntua(p_usuario, p_liga, 'd30', v_hoy, p_puntos + 2, p_sesiones * 3, p_tono);
  perform demo_puntua(p_usuario, p_liga, 'ytd', v_hoy, p_puntos + 4, p_sesiones * 12, p_tono);
end;
$$;

-- ── Limpieza ───────────────────────────────────────────────────────────────────
-- ⭐ Se borra de `auth.users` y el resto cae en cascada: perfiles, miembros, puntuaciones,
-- amistades y avisos. Es la misma via que el borrado de cuenta real, asi que probar esto prueba
-- tambien que el borrado funciona.
create or replace function limpiar_demo()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas int;
begin
  delete from auth.users
   where id in (select id from perfiles where demo);
  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

-- ── Cuantos demo hay ───────────────────────────────────────────────────────────
-- Para comprobar antes de un build de produccion que no queda ninguno.
create or replace function hay_demo()
returns int
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from perfiles where demo;
$$;

-- ── Permisos ───────────────────────────────────────────────────────────────────
-- ⛔ Revocar de `public` PRIMERO, que es el fallo que ya se corrigio dos veces en este proyecto:
-- Postgres concede EXECUTE a PUBLIC al crear la funcion y anon/authenticated lo heredan.
--
-- ⚠️ Estas funciones NO se exponen a la app. Solo `service_role` y el editor SQL del panel. Si
-- `authenticated` pudiera llamar a `crear_demo`, cualquiera con la clave publica podria fabricar
-- usuarios y ocupar nombres.
revoke execute on function crear_demo(text, text, boolean) from public, anon, authenticated;
revoke execute on function demo_puntua(text, uuid, text, date, int, int, text) from public, anon, authenticated;
revoke execute on function demo_puntua_todo(text, uuid, int, int, text) from public, anon, authenticated;
revoke execute on function limpiar_demo() from public, anon, authenticated;
revoke execute on function hay_demo() from public, anon, authenticated;

grant execute on function crear_demo(text, text, boolean) to service_role;
grant execute on function demo_puntua(text, uuid, text, date, int, int, text) to service_role;
grant execute on function demo_puntua_todo(text, uuid, int, int, text) to service_role;
grant execute on function limpiar_demo() to service_role;
grant execute on function hay_demo() to service_role;

-- ── ⛔ BUG que aparece al juntar el trigger con `pedir_amistad` ─────────────────
-- Encontrado al escribir esto, y habria dado una prueba enganosa.
--
-- `pedir_amistad` acaba con `insert into amistades ...` y despues `return 'enviada'`, con el
-- texto FIJO. El trigger de arriba es BEFORE INSERT y cambia el estado a 'aceptada', pero la
-- funcion ya iba a devolver 'enviada' de todas formas.
--
-- Efecto: agregas a `demo_marta`, la fila queda aceptada en la base de datos, y la app te pinta
-- "Pendiente". Al recargar aparece como amiga. Es decir, la prueba de UX mostraria un estado
-- equivocado justo en el paso que se queria probar.
--
-- ⇒ Se devuelve el estado REAL con `returning`. Y el arreglo vale igual para personas reales: si
-- algun dia se añade otro trigger sobre `amistades`, la funcion ya no miente.
create or replace function pedir_amistad(p_a uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  v_existe amistades;
  v_estado text;
begin
  if v_yo is null then
    raise exception 'hace falta sesion';
  end if;
  if p_a = v_yo then
    raise exception 'no puedes agregarte a ti mismo';
  end if;
  if not exists (select 1 from perfiles where id = p_a) then
    raise exception 'esa persona no existe';
  end if;

  -- Si ya existe la relacion en cualquier sentido, no se crea otra.
  select * into v_existe from amistades
   where least(de, a) = least(v_yo, p_a)
     and greatest(de, a) = greatest(v_yo, p_a);

  if v_existe.de is not null then
    -- Caso bonito: los dos se piden a la vez. La segunda peticion acepta la primera.
    if v_existe.estado = 'pendiente' and v_existe.a = v_yo then
      update amistades set estado = 'aceptada', resuelta = now()
       where de = v_existe.de and a = v_existe.a;
      return 'amigos';
    end if;
    return case when v_existe.estado = 'aceptada' then 'amigos'
                when v_existe.de = v_yo then 'enviada'
                else 'recibida' end;
  end if;

  -- ⭐ `returning` en vez de texto fijo: el trigger puede haber aceptado la peticion ya.
  insert into amistades (de, a) values (v_yo, p_a)
  returning estado into v_estado;

  return case when v_estado = 'aceptada' then 'amigos' else 'enviada' end;
end;
$$;

revoke execute on function pedir_amistad(uuid) from public, anon;
grant execute on function pedir_amistad(uuid) to authenticated;
