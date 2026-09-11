-- ══════════════════════════════════════════════════════════════════════════════
-- Migración 08 · SOCIAL: avisos a una persona, feed de entrenos, reacciones y comentarios
--
-- Nace de la primera tarde de TestFlight con amigos (11 sep 2026). Tres cosas pedidas:
--   1. Que al pedir amistad le llegue un aviso a la otra persona. No existía: `pedir_amistad`
--      solo escribía en `amistades`, y `avisos` ni admitía la clase (CHECK) ni una fila sin liga.
--   2. Que los amigos vean tus entrenos y puedan reaccionar y comentar (feed estilo red social).
--   3. Aviso al dueño del entreno cuando alguien reacciona o comenta.
--
-- ⛔ REGLA DE ARQUITECTURA, que sigue en pie: al servidor no suben pulsos, zonas ni minutos.
-- Lo NUEVO que viaja por entreno es el TIPO de deporte (RUNNING, BARRE…), que es una etiqueta de
-- actividad y no una medida de salud; junto a los puntos y el tono, que ya viajaban agregados.
-- Decisión tomada al construir el feed, documentada en la política de privacidad (sección de
-- datos compartidos con otros usuarios).
--
-- ¿Quién ve los entrenos de quién? Amigos ACEPTADOS y compañeros de liga PRIVADA. Las ligas de
-- zona (30 desconocidos de tu barrio) quedan fuera a propósito: competir en una tabla con alguien
-- no es lo mismo que enseñarle cada entreno.
--
-- Idempotente: se puede pegar dos veces sin romper nada.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. `avisos` generalizada: de liga (como antes) O a una persona ─────────────
alter table avisos alter column liga drop not null;
alter table avisos alter column puntos drop not null;
alter table avisos alter column tono drop not null;
alter table avisos add column if not exists destinatario uuid references auth.users(id) on delete cascade;
alter table avisos add column if not exists entreno uuid;
-- Texto corto que acompaña al aviso: el emoji de una reacción o el arranque de un comentario.
alter table avisos add column if not exists texto text check (char_length(texto) <= 120);

alter table avisos drop constraint if exists avisos_clase_check;
alter table avisos add constraint avisos_clase_check
  check (clase in ('sesion','liderato','amistad','amistad_aceptada','reaccion','comentario'));

-- Coherencia: los de liga llevan liga, puntos y tono; los personales llevan destinatario.
alter table avisos drop constraint if exists avisos_destino_check;
alter table avisos add constraint avisos_destino_check check (
  (clase in ('sesion','liderato') and liga is not null and puntos is not null and tono is not null)
  or (clase in ('amistad','amistad_aceptada','reaccion','comentario') and destinatario is not null)
);

-- Destinatarios: los personales van a esa persona; los de liga, a los demás miembros. Siempre
-- respetando el interruptor global del perfil, y el de la liga en los de liga.
create or replace function destinatarios_de(p_aviso uuid)
returns table (push_token text)
language sql
security definer
set search_path = public
stable
as $$
  select pe.push_token
  from avisos a
  join miembros m on a.destinatario is null and m.liga = a.liga and m.usuario <> a.autor and m.avisos
  join perfiles pe on pe.id = m.usuario and pe.avisos
  where a.id = p_aviso and pe.push_token is not null
  union
  select pe.push_token
  from avisos a
  join perfiles pe on pe.id = a.destinatario and pe.avisos
  where a.id = p_aviso and a.destinatario is not null and a.destinatario <> a.autor
    and pe.push_token is not null;
$$;

revoke execute on function destinatarios_de(uuid) from public, anon, authenticated;
grant execute on function destinatarios_de(uuid) to service_role;

-- ── 2. Aviso al pedir y al aceptar amistad ─────────────────────────────────────
-- Misma función que la migración 04 (con su `returning`), más el aviso. La huella lleva el día:
-- una petición repetida el mismo día no vuelve a sonar; al día siguiente sí.
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

  select * into v_existe from amistades
   where least(de, a) = least(v_yo, p_a)
     and greatest(de, a) = greatest(v_yo, p_a);

  if v_existe.de is not null then
    -- Los dos se piden a la vez: la segunda petición acepta la primera, y se avisa a quien pidió.
    if v_existe.estado = 'pendiente' and v_existe.a = v_yo then
      update amistades set estado = 'aceptada', resuelta = now()
       where de = v_existe.de and a = v_existe.a;
      insert into avisos (autor, destinatario, clase, huella)
      values (v_yo, v_existe.de, 'amistad_aceptada',
              'amistad_aceptada:' || v_existe.de || ':' || v_yo || ':' || current_date)
      on conflict (huella) do nothing;
      return 'amigos';
    end if;
    return case when v_existe.estado = 'aceptada' then 'amigos'
                when v_existe.de = v_yo then 'enviada'
                else 'recibida' end;
  end if;

  insert into amistades (de, a) values (v_yo, p_a)
  returning estado into v_estado;

  -- El aviso solo si la petición quedó pendiente de verdad (la demo acepta sola por trigger).
  if v_estado = 'pendiente' then
    insert into avisos (autor, destinatario, clase, huella)
    values (v_yo, p_a, 'amistad', 'amistad:' || v_yo || ':' || p_a || ':' || current_date)
    on conflict (huella) do nothing;
  end if;

  return case when v_estado = 'aceptada' then 'amigos' else 'enviada' end;
end;
$$;

revoke execute on function pedir_amistad(uuid) from public, anon;
grant execute on function pedir_amistad(uuid) to authenticated;

create or replace function aceptar_amistad(p_de uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'hace falta sesion';
  end if;

  update amistades
     set estado = 'aceptada', resuelta = now()
   where de = p_de and a = auth.uid() and estado = 'pendiente';

  if not found then
    raise exception 'no hay peticion pendiente';
  end if;

  insert into avisos (autor, destinatario, clase, huella)
  values (auth.uid(), p_de, 'amistad_aceptada',
          'amistad_aceptada:' || p_de || ':' || auth.uid() || ':' || current_date)
  on conflict (huella) do nothing;
end;
$$;

revoke execute on function aceptar_amistad(uuid) from public, anon;
grant execute on function aceptar_amistad(uuid) to authenticated;

-- ── 3. Entrenos publicados: la materia prima del feed ──────────────────────────
create table if not exists entrenos (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null references auth.users(id) on delete cascade,
  -- `usuario|idSesion`: repetir la sincronización no duplica, y corregir el deporte actualiza.
  huella text not null unique,
  -- Tipo del motor (RUNNING, BARRE…). Etiqueta de actividad; null si HealthKit no lo trajo.
  deporte text,
  puntos int not null check (puntos between 0 and 1000),
  -- Comparado con la base PROPIA de quien entrena. Nunca en absoluto.
  tono text not null check (tono in ('suave','normal','fuerte')),
  -- Cuándo terminó, redondeado al minuto en el teléfono.
  fin timestamptz not null,
  creado timestamptz not null default now()
);

create index if not exists entrenos_usuario_fin on entrenos (usuario, fin desc);

-- ⭐ "Quitar del feed" NO borra: la siguiente sincronización volvería a publicar la misma huella
-- y el entreno reaparecería. Se marca oculto y `publicar_entrenos` no toca esa columna.
alter table entrenos add column if not exists oculto boolean not null default false;

alter table entrenos enable row level security;

-- Los avisos de reacción y comentario apuntan al entreno; si el entreno se borra, se van con él.
alter table avisos drop constraint if exists avisos_entreno_fkey;
alter table avisos add constraint avisos_entreno_fkey
  foreign key (entreno) references entrenos(id) on delete cascade;

-- ¿Puedo YO ver los entrenos de `p_autor`? Uno mismo, amigos aceptados y compañeros de liga
-- privada. SECURITY DEFINER para leer `amistades` y `miembros` sin depender de sus RLS.
--
-- ⚠️ Deliberadamente sin parámetro "quién": va siempre con `auth.uid()`. Si aceptara dos uuids,
-- cualquier persona con sesión podría preguntar por RPC si otras dos son amigas.
create or replace function ve_entrenos_de(p_autor uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() is not null and (
    p_autor = auth.uid()
    or exists (
      select 1 from amistades
      where estado = 'aceptada'
        and least(de, a) = least(p_autor, auth.uid())
        and greatest(de, a) = greatest(p_autor, auth.uid())
    )
    or exists (
      select 1
      from miembros m1
      join miembros m2 on m2.liga = m1.liga
      join ligas l on l.id = m1.liga and l.zona is null
      where m1.usuario = p_autor and m2.usuario = auth.uid()
    )
  );
$$;

-- Lo mismo, a partir del id del entreno. Para las políticas de reacciones y comentarios.
create or replace function ve_entreno(p_entreno uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select ve_entrenos_de(e.usuario) from entrenos e where e.id = p_entreno and not e.oculto),
    false
  );
$$;

-- Las políticas se evalúan con el rol de quien consulta, así que `authenticated` necesita EXECUTE.
revoke execute on function ve_entrenos_de(uuid) from public, anon;
grant execute on function ve_entrenos_de(uuid) to authenticated;
revoke execute on function ve_entreno(uuid) from public, anon;
grant execute on function ve_entreno(uuid) to authenticated;

drop policy if exists "entrenos: los de tu gente" on entrenos;
create policy "entrenos: los de tu gente" on entrenos
  for select using (not oculto and ve_entrenos_de(usuario));

-- ⛔ Sin política de INSERT, UPDATE ni DELETE: todo entra por `publicar_entrenos` y se oculta por
-- `ocultar_entreno`. (Una política de UPDATE sin restringir columnas dejaría cambiar los puntos.)
drop policy if exists "entrenos: borrar los tuyos" on entrenos;

-- Quitar un entreno del feed es cosa de su dueño. Se lleva reacciones y comentarios: sin entreno
-- visible no tienen dónde vivir, y dejarlos sería conservar texto de otros sobre algo borrado.
create or replace function ocultar_entreno(p_entreno uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'hace falta sesion';
  end if;
  update entrenos set oculto = true where id = p_entreno and usuario = auth.uid();
  if not found then
    raise exception 'ese entreno no es tuyo';
  end if;
  delete from reacciones where entreno = p_entreno;
  delete from comentarios where entreno = p_entreno;
end;
$$;

revoke execute on function ocultar_entreno(uuid) from public, anon;
grant execute on function ocultar_entreno(uuid) to authenticated;

-- Publicación en lote desde la sincronización. El cliente manda [{id, deporte, puntos, tono, fin}].
-- Tope de 60 por llamada: es más de lo que hay en 30 días y corta cualquier abuso.
create or replace function publicar_entrenos(p_entrenos jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  v_n int := 0;
  e jsonb;
begin
  if v_yo is null then
    raise exception 'hace falta sesion';
  end if;
  if jsonb_typeof(p_entrenos) <> 'array' or jsonb_array_length(p_entrenos) > 60 then
    raise exception 'lote no valido';
  end if;

  for e in select * from jsonb_array_elements(p_entrenos) loop
    insert into entrenos (usuario, huella, deporte, puntos, tono, fin)
    values (
      v_yo,
      v_yo::text || '|' || (e->>'id'),
      nullif(left(e->>'deporte', 40), ''),
      least(1000, greatest(0, (e->>'puntos')::int)),
      e->>'tono',
      (e->>'fin')::timestamptz
    )
    -- Corregir el deporte o recalcular puntos actualiza la fila; el momento no cambia.
    on conflict (huella) do update
      set deporte = excluded.deporte, puntos = excluded.puntos, tono = excluded.tono;
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

revoke execute on function publicar_entrenos(jsonb) from public, anon;
grant execute on function publicar_entrenos(jsonb) to authenticated;

-- ── 4. Reacciones: una por persona y entreno, de un repertorio corto ───────────
create table if not exists reacciones (
  entreno uuid not null references entrenos(id) on delete cascade,
  usuario uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('🔥','💪','👏','❤️')),
  creado timestamptz not null default now(),
  primary key (entreno, usuario)
);

alter table reacciones enable row level security;

drop policy if exists "reacciones: las de lo que ves" on reacciones;
create policy "reacciones: las de lo que ves" on reacciones
  for select using (ve_entreno(entreno));

-- Escribir, solo por `reaccionar`: comprueba que ves el entreno y anota el aviso.
create or replace function reaccionar(p_entreno uuid, p_emoji text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  v_dueno uuid;
  v_nueva boolean;
begin
  if v_yo is null then
    raise exception 'hace falta sesion';
  end if;
  if not ve_entreno(p_entreno) then
    raise exception 'no ves ese entreno';
  end if;

  -- Sin emoji: quitar la reacción.
  if p_emoji is null then
    delete from reacciones where entreno = p_entreno and usuario = v_yo;
    return;
  end if;

  v_nueva := not exists (select 1 from reacciones where entreno = p_entreno and usuario = v_yo);

  insert into reacciones (entreno, usuario, emoji) values (p_entreno, v_yo, p_emoji)
  on conflict (entreno, usuario) do update set emoji = excluded.emoji, creado = now();

  -- Aviso al dueño solo la PRIMERA vez que esta persona reacciona a este entreno: cambiar de
  -- emoji no vuelve a sonar. Y nunca por reaccionar a lo tuyo.
  select usuario into v_dueno from entrenos where id = p_entreno;
  if v_nueva and v_dueno <> v_yo then
    insert into avisos (autor, destinatario, clase, entreno, texto, huella)
    values (v_yo, v_dueno, 'reaccion', p_entreno, p_emoji, 'reaccion:' || p_entreno || ':' || v_yo)
    on conflict (huella) do nothing;
  end if;
end;
$$;

revoke execute on function reaccionar(uuid, text) from public, anon;
grant execute on function reaccionar(uuid, text) to authenticated;

-- ── 5. Comentarios ─────────────────────────────────────────────────────────────
create table if not exists comentarios (
  id uuid primary key default gen_random_uuid(),
  entreno uuid not null references entrenos(id) on delete cascade,
  usuario uuid not null references auth.users(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 280),
  creado timestamptz not null default now()
);

create index if not exists comentarios_entreno_creado on comentarios (entreno, creado);

alter table comentarios enable row level security;

drop policy if exists "comentarios: los de lo que ves" on comentarios;
create policy "comentarios: los de lo que ves" on comentarios
  for select using (ve_entreno(entreno));

-- Borra el autor del comentario, o el dueño del entreno (modera lo que pasa bajo su entreno).
drop policy if exists "comentarios: borrar" on comentarios;
create policy "comentarios: borrar" on comentarios
  for delete using (
    auth.uid() = usuario
    or auth.uid() = (select e.usuario from entrenos e where e.id = entreno)
  );

create or replace function comentar(p_entreno uuid, p_texto text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  v_dueno uuid;
  v_id uuid;
  v_texto text := btrim(p_texto);
begin
  if v_yo is null then
    raise exception 'hace falta sesion';
  end if;
  if not ve_entreno(p_entreno) then
    raise exception 'no ves ese entreno';
  end if;
  if char_length(v_texto) < 1 or char_length(v_texto) > 280 then
    raise exception 'comentario vacio o demasiado largo';
  end if;

  insert into comentarios (entreno, usuario, texto) values (p_entreno, v_yo, v_texto)
  returning id into v_id;

  select usuario into v_dueno from entrenos where id = p_entreno;
  if v_dueno <> v_yo then
    insert into avisos (autor, destinatario, clase, entreno, texto, huella)
    values (v_yo, v_dueno, 'comentario', p_entreno, left(v_texto, 80), 'comentario:' || v_id)
    on conflict (huella) do nothing;
  end if;

  return v_id;
end;
$$;

revoke execute on function comentar(uuid, text) from public, anon;
grant execute on function comentar(uuid, text) to authenticated;

-- ── 6. Lecturas del feed. Funciones para juntar el nombre sin abrir `perfiles` ─
-- Mismo motivo que `clasificacion` y `mis_amistades`: el nombre se resuelve en el servidor.

-- El feed: entrenos de tu gente, del más reciente al más antiguo, con el resumen de reacciones,
-- la tuya y el número de comentarios. Paginado por `p_antes` (el `fin` del último recibido).
create or replace function feed(p_limite int default 30, p_antes timestamptz default null)
returns table (
  id uuid,
  usuario uuid,
  nombre text,
  deporte text,
  puntos int,
  tono text,
  fin timestamptz,
  reacciones jsonb,
  mi_reaccion text,
  comentarios int
)
language sql
security definer
set search_path = public
stable
as $$
  with gente as (
    select auth.uid() as id
    union
    select case when de = auth.uid() then a else de end
    from amistades
    where estado = 'aceptada' and (de = auth.uid() or a = auth.uid())
    union
    select m2.usuario
    from miembros m1
    join miembros m2 on m2.liga = m1.liga
    join ligas l on l.id = m1.liga and l.zona is null
    where m1.usuario = auth.uid()
  )
  select
    e.id,
    e.usuario,
    coalesce(p.nombre, '') as nombre,
    e.deporte,
    e.puntos,
    e.tono,
    e.fin,
    coalesce(
      (select jsonb_object_agg(r.emoji, r.n)
       from (select emoji, count(*) as n from reacciones where entreno = e.id group by emoji) r),
      '{}'::jsonb
    ) as reacciones,
    (select emoji from reacciones where entreno = e.id and usuario = auth.uid()) as mi_reaccion,
    (select count(*)::int from comentarios where entreno = e.id) as comentarios
  from entrenos e
  join gente g on g.id = e.usuario
  join perfiles p on p.id = e.usuario
  where auth.uid() is not null
    and not e.oculto
    and (p_antes is null or e.fin < p_antes)
  order by e.fin desc
  limit least(greatest(p_limite, 1), 50);
$$;

revoke execute on function feed(int, timestamptz) from public, anon;
grant execute on function feed(int, timestamptz) to authenticated;

-- Los comentarios de un entreno, con nombre. Vacío si no lo ves.
create or replace function comentarios_de(p_entreno uuid)
returns table (id uuid, usuario uuid, nombre text, texto text, creado timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.usuario, coalesce(p.nombre, '') as nombre, c.texto, c.creado
  from comentarios c
  join perfiles p on p.id = c.usuario
  where c.entreno = p_entreno and ve_entreno(p_entreno)
  order by c.creado asc;
$$;

revoke execute on function comentarios_de(uuid) from public, anon;
grant execute on function comentarios_de(uuid) to authenticated;

-- Quién ha reaccionado con qué. Para la hoja de detalle.
create or replace function reacciones_de(p_entreno uuid)
returns table (usuario uuid, nombre text, emoji text)
language sql
security definer
set search_path = public
stable
as $$
  select r.usuario, coalesce(p.nombre, '') as nombre, r.emoji
  from reacciones r
  join perfiles p on p.id = r.usuario
  where r.entreno = p_entreno and ve_entreno(p_entreno)
  order by r.creado asc;
$$;

revoke execute on function reacciones_de(uuid) from public, anon;
grant execute on function reacciones_de(uuid) to authenticated;

-- ── 7. Borrado de cuenta: lo social se va con la cuenta ────────────────────────
-- Las tres tablas nuevas referencian auth.users con `on delete cascade`, así que `borrar_mi_cuenta`
-- (que borra el usuario de auth) ya las limpia. Sin cambios necesarios.
