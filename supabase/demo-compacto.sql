-- Version compacta de migracion-04-demo.sql + demo-poblar.sql, para pegar de una vez en el
-- editor SQL de Supabase. Mismo contenido, sin los comentarios largos.
--
-- ⚠️ La version documentada es `migracion-04-demo.sql`. Esta existe solo para poder inyectarla
-- desde el navegador sin pelearse con el portapapeles. Si cambias una, cambia la otra.
--
-- ⛔ NO puede quedar en produccion: `select limpiar_demo();` antes de cualquier build.

alter table perfiles add column if not exists demo boolean not null default false;
alter table perfiles add column if not exists auto_acepta boolean not null default true;
create index if not exists perfiles_demo on perfiles (demo) where demo;

create or replace function demo_acepta_sola() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from perfiles where id = new.a and demo and auto_acepta) then
    new.estado := 'aceptada';
    new.resuelta := now();
  end if;
  return new;
end; $$;

drop trigger if exists demo_auto_acepta on amistades;
create trigger demo_auto_acepta before insert on amistades
  for each row execute function demo_acepta_sola();

create or replace function crear_demo(p_usuario text, p_nombre text, p_auto_acepta boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_usuario !~ '^[a-z0-9_]{3,20}$' then raise exception 'usuario no valido: %', p_usuario; end if;
  select id into v_id from perfiles where lower(usuario) = lower(p_usuario) and demo;
  if v_id is not null then return v_id; end if;
  v_id := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    p_usuario || '@demo.invalid', '$2a$10$demo.no.se.puede.usar.para.entrar.jamas.aqui',
    now(), now(), now(), '{"provider":"demo","providers":["demo"]}'::jsonb, '{"demo":true}'::jsonb);
  insert into perfiles (id, nombre, usuario, demo, auto_acepta)
  values (v_id, p_nombre, lower(p_usuario), true, p_auto_acepta);
  return v_id;
end; $$;

create or replace function demo_puntua(p_usuario text, p_liga uuid, p_horizonte text,
  p_periodo date, p_puntos int, p_sesiones int default 4, p_tono text default 'normal')
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from perfiles where lower(usuario) = lower(p_usuario) and demo;
  if v_id is null then raise exception 'no hay demo con usuario %', p_usuario; end if;
  insert into miembros (liga, usuario) values (p_liga, v_id) on conflict do nothing;
  insert into puntuaciones (liga, usuario, horizonte, periodo, puntos, sesiones, tono)
  values (p_liga, v_id, p_horizonte, p_periodo, p_puntos, p_sesiones, p_tono)
  on conflict (liga, usuario, horizonte, periodo) do update
    set puntos = excluded.puntos, sesiones = excluded.sesiones,
        tono = excluded.tono, actualizado = now();
end; $$;

create or replace function demo_puntua_todo(p_usuario text, p_liga uuid, p_puntos int,
  p_sesiones int default 4, p_tono text default 'normal')
returns void language plpgsql security definer set search_path = public as $$
declare v_hoy date := current_date;
begin
  perform demo_puntua(p_usuario, p_liga, 'wtd', v_hoy, p_puntos, p_sesiones, p_tono);
  perform demo_puntua(p_usuario, p_liga, 'd7', v_hoy, p_puntos, p_sesiones, p_tono);
  perform demo_puntua(p_usuario, p_liga, 'mtd', v_hoy, p_puntos + 2, p_sesiones * 3, p_tono);
  perform demo_puntua(p_usuario, p_liga, 'd30', v_hoy, p_puntos + 2, p_sesiones * 3, p_tono);
  perform demo_puntua(p_usuario, p_liga, 'ytd', v_hoy, p_puntos + 4, p_sesiones * 12, p_tono);
end; $$;

create or replace function limpiar_demo() returns int
language plpgsql security definer set search_path = public as $$
declare v_filas int;
begin
  delete from auth.users where id in (select id from perfiles where demo);
  get diagnostics v_filas = row_count;
  return v_filas;
end; $$;

create or replace function hay_demo() returns int
language sql security definer set search_path = public stable as $$
  select count(*)::int from perfiles where demo;
$$;

-- ⛔ Bug real: `pedir_amistad` devolvia 'enviada' con texto FIJO, asi que con el trigger de
-- arriba la app pintaba "Pendiente" cuando la amistad ya estaba aceptada. Se arregla con
-- `returning`, y el arreglo vale igual para personas reales.
create or replace function pedir_amistad(p_a uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_yo uuid := auth.uid();
  v_existe amistades;
  v_estado text;
begin
  if v_yo is null then raise exception 'hace falta sesion'; end if;
  if p_a = v_yo then raise exception 'no puedes agregarte a ti mismo'; end if;
  if not exists (select 1 from perfiles where id = p_a) then raise exception 'esa persona no existe'; end if;
  select * into v_existe from amistades
   where least(de, a) = least(v_yo, p_a) and greatest(de, a) = greatest(v_yo, p_a);
  if v_existe.de is not null then
    if v_existe.estado = 'pendiente' and v_existe.a = v_yo then
      update amistades set estado = 'aceptada', resuelta = now()
       where de = v_existe.de and a = v_existe.a;
      return 'amigos';
    end if;
    return case when v_existe.estado = 'aceptada' then 'amigos'
                when v_existe.de = v_yo then 'enviada' else 'recibida' end;
  end if;
  insert into amistades (de, a) values (v_yo, p_a) returning estado into v_estado;
  return case when v_estado = 'aceptada' then 'amigos' else 'enviada' end;
end; $$;

revoke execute on function crear_demo(text, text, boolean) from public, anon, authenticated;
revoke execute on function demo_puntua(text, uuid, text, date, int, int, text) from public, anon, authenticated;
revoke execute on function demo_puntua_todo(text, uuid, int, int, text) from public, anon, authenticated;
revoke execute on function limpiar_demo() from public, anon, authenticated;
revoke execute on function hay_demo() from public, anon, authenticated;
revoke execute on function pedir_amistad(uuid) from public, anon;
grant execute on function pedir_amistad(uuid) to authenticated;

-- ── Poblar ─────────────────────────────────────────────────────────────────────
-- Las cifras no son al azar: cada demo prueba un caso que el producto dice resolver.
--   marta 88 solo barre  = LA TESIS (si no gana, el handicap no funciona)
--   nacho 52 siete paseos = EL CONTROL NEGATIVO (si gana, premiamos frecuencia otra vez)
-- Orden esperado: 88 - 80 - 77 - 61 - 52
select crear_demo('demo_marta', 'Marta');
select crear_demo('demo_sergio', 'Sergio');
select crear_demo('demo_lucia', 'Lucia');
select crear_demo('demo_nacho', 'Nacho');
select crear_demo('demo_carmen', 'Carmen');
select crear_demo('demo_pendiente', 'Alvaro', false);

do $$
declare v_liga record;
begin
  for v_liga in select id from ligas loop
    perform demo_puntua_todo('demo_marta', v_liga.id, 88, 5, 'fuerte');
    perform demo_puntua_todo('demo_sergio', v_liga.id, 80, 4, 'normal');
    perform demo_puntua_todo('demo_lucia', v_liga.id, 77, 5, 'normal');
    perform demo_puntua_todo('demo_carmen', v_liga.id, 61, 3, 'suave');
    perform demo_puntua_todo('demo_nacho', v_liga.id, 52, 7, 'suave');
  end loop;
end $$;

select (select hay_demo()) as perfiles_demo, (select count(*) from ligas) as tus_ligas;
