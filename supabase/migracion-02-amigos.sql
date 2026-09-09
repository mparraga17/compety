-- Migracion 02: nombre de usuario y amigos.
--
-- Se carga DESPUES de `esquema.sql`. Va aparte y no dentro de el porque el esquema base ya esta
-- aplicado en el proyecto `vrmfvjtwyaofkqpvpbmx`, y reejecutarlo entero con datos dentro es
-- justo lo que hay que evitar.
--
-- ── El principio que manda aqui ───────────────────────────────────────────────
-- SER ENCONTRABLE NO ES SER VISIBLE. Son dos permisos distintos y el esquema los separa:
--
--   buscar a alguien  → ves su nombre de usuario, su nombre visible y su foto. Nada mas.
--   ser amigo suyo    → ademas ves que existe la relacion.
--   estar en su liga  → ahi, y solo ahi, ves su puntuacion.
--
-- La puntuacion sigue colgando de `miembros`, como estaba. Agregar a alguien NO da acceso a sus
-- numeros. Eso lo da entrar en una liga con esa persona, que es un acto explicito de las dos
-- partes. Asi la funcion social crece la app sin ampliar lo que se ve de nadie.
--
-- ⚠️ Y sigue en pie la regla dura: aqui no entra ningun dato de salud. Ni aqui ni en ninguna
-- tabla nueva. El servidor no tiene pulsos que filtrar porque nunca los recibe.

-- ── Nombre de usuario ─────────────────────────────────────────────────────────
-- La etiqueta con la que te encuentran. Es publica por definicion: para eso existe.
--
-- Se guarda en minusculas y se busca en minusculas, asi que `Pepito` y `pepito` son la misma
-- persona y nadie puede registrar un parecido para confundir. El nombre VISIBLE (`nombre`) sigue
-- siendo otra cosa, editable y con mayusculas y acentos.
alter table perfiles
  add column if not exists usuario text unique
    check (usuario is null or usuario ~ '^[a-z0-9_]{3,20}$');

-- Foto de perfil: ruta en Storage, no la imagen.
-- ⚠️ La columna se crea AHORA aunque el bucket de Storage todavia no exista, porque anadir
-- columnas a una tabla vacia es gratis y hacerlo con datos dentro no lo es. Mientras sea null,
-- la app pinta la inicial del nombre.
alter table perfiles
  add column if not exists avatar text;

-- ⭐ Indice sobre el nombre en minusculas: es la unica consulta de busqueda que se permite.
create unique index if not exists perfiles_usuario_unico on perfiles (lower(usuario));

-- ── Amistades ─────────────────────────────────────────────────────────────────
-- Una fila por par, con `de` = quien pide y `a` = quien recibe. La direccion se guarda porque
-- hace falta para saber a quien le toca aceptar.
--
-- ⚠️ El `check (de < a)` de otros esquemas NO sirve aqui: perderia quien pidio a quien. En su
-- lugar hay un indice unico sobre el par ordenado, mas abajo, que evita que Ana pida a Luis
-- mientras Luis pide a Ana y salgan dos peticiones para la misma relacion.
create table if not exists amistades (
  de uuid not null references auth.users(id) on delete cascade,
  a uuid not null references auth.users(id) on delete cascade,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','aceptada')),
  creada timestamptz not null default now(),
  resuelta timestamptz,
  primary key (de, a),
  -- Nadie se agrega a si mismo.
  check (de <> a)
);

alter table amistades enable row level security;

-- ⭐ Una relacion, una fila, en cualquiera de los dos sentidos. `least`/`greatest` sobre el par
-- de uuid da la misma clave para (Ana,Luis) y (Luis,Ana), asi que la segunda peticion choca
-- contra el indice en vez de crear un duplicado.
create unique index if not exists amistades_par_unico
  on amistades (least(de, a), greatest(de, a));

-- Para pintar la lista de amigos y la bandeja de peticiones sin recorrer la tabla.
create index if not exists amistades_para_mi on amistades (a, estado);
create index if not exists amistades_mias on amistades (de, estado);

-- Ves las filas en las que apareces, y solo esas. Ni las de terceros ni las agregadas.
create policy "amistades: las tuyas" on amistades
  for select using (auth.uid() = de or auth.uid() = a);

-- ⛔ Sin politica de INSERT ni de UPDATE, igual que en `ligas` y `miembros`. Se entra por las
-- funciones de abajo, que son las que validan. Es el mismo patron que ya evito el agujero que
-- repiten los demas proyectos.

-- Romper la amistad o retirar la peticion siempre se puede, por los dos lados.
create policy "amistades: deshacer" on amistades
  for delete using (auth.uid() = de or auth.uid() = a);

-- ── Elegir tu nombre de usuario ───────────────────────────────────────────────
-- Va como funcion y no como update directo para dar un error claro cuando ya esta cogido, en
-- vez de un 23505 de Postgres que la app tendria que traducir.
create or replace function elegir_usuario(p_usuario text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limpio text;
begin
  if auth.uid() is null then
    raise exception 'hace falta sesion';
  end if;

  v_limpio := lower(trim(p_usuario));

  if v_limpio !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'usuario no valido';
  end if;

  -- Cogido por otra persona. Si es el tuyo, no pasa nada y se queda igual.
  if exists (
    select 1 from perfiles where lower(usuario) = v_limpio and id <> auth.uid()
  ) then
    raise exception 'usuario ocupado';
  end if;

  update perfiles set usuario = v_limpio where id = auth.uid();

  if not found then
    raise exception 'primero hay que crear el perfil';
  end if;
end;
$$;

-- ── ⭐ Buscar personas: por coincidencia EXACTA ────────────────────────────────
-- Esta es la funcion delicada del fichero, asi que el motivo va escrito.
--
-- Lo que devuelve: nombre de usuario, nombre visible, foto y si ya hay relacion. NADA MAS.
-- Ni puntuaciones, ni ligas, ni correo, ni token push, ni fecha de alta. Es exactamente lo que
-- hace falta para reconocer a alguien y decidir si le mandas la peticion.
--
-- ⛔ Y busca por IGUALDAD, no por `like`. La diferencia no es un detalle:
-- con busqueda parcial, escribir 'a' devolveria a media app, y probando prefijos se puede
-- recorrer el listado entero de usuarios. Eso convierte la funcion en un directorio de quien
-- usa Compety, que en una app de salud es dato sensible por si mismo: revela que esa persona
-- usa una app de fitness con pulsera. Con igualdad exacta hay que saber el nombre de antemano,
-- que es justo el caso de uso real (te lo dicen y lo escribes).
--
-- 📌 Consecuencia asumida: no hay autocompletado ni "quiza conoces a". Se acepta. La via para
-- meter a un grupo entero sigue siendo el codigo de liga, que es mas rapido que buscar uno a uno.
create or replace function buscar_persona(p_usuario text)
returns table (id uuid, usuario text, nombre text, avatar text, relacion text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limpio text;
begin
  if auth.uid() is null then
    raise exception 'hace falta sesion';
  end if;

  v_limpio := lower(trim(p_usuario));

  -- Se valida el formato antes de consultar: una cadena de 1 caracter no llega ni a la tabla.
  if v_limpio !~ '^[a-z0-9_]{3,20}$' then
    return;
  end if;

  return query
    select
      pe.id,
      pe.usuario,
      pe.nombre,
      pe.avatar,
      case
        when pe.id = auth.uid() then 'yo'
        when am.estado = 'aceptada' then 'amigos'
        when am.estado = 'pendiente' and am.de = auth.uid() then 'enviada'
        when am.estado = 'pendiente' then 'recibida'
        else 'ninguna'
      end as relacion
    from perfiles pe
    left join amistades am
      on least(am.de, am.a) = least(pe.id, auth.uid())
     and greatest(am.de, am.a) = greatest(pe.id, auth.uid())
    where lower(pe.usuario) = v_limpio;
end;
$$;

-- ── Pedir amistad ─────────────────────────────────────────────────────────────
-- Recibe el id que devolvio `buscar_persona`, no el nombre, para no repetir la busqueda.
create or replace function pedir_amistad(p_a uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  v_existe amistades;
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

  -- ⭐ Si ya existe la relacion en cualquier sentido, no se crea otra.
  select * into v_existe from amistades
   where least(de, a) = least(v_yo, p_a)
     and greatest(de, a) = greatest(v_yo, p_a);

  if v_existe.de is not null then
    -- Caso bonito: los dos se piden a la vez. La segunda peticion acepta la primera en vez de
    -- fallar, que es lo que la persona esperaria.
    if v_existe.estado = 'pendiente' and v_existe.a = v_yo then
      update amistades set estado = 'aceptada', resuelta = now()
       where de = v_existe.de and a = v_existe.a;
      return 'amigos';
    end if;
    return case when v_existe.estado = 'aceptada' then 'amigos'
                when v_existe.de = v_yo then 'enviada'
                else 'recibida' end;
  end if;

  insert into amistades (de, a) values (v_yo, p_a);
  return 'enviada';
end;
$$;

-- ── Aceptar ───────────────────────────────────────────────────────────────────
-- Solo puede aceptar QUIEN RECIBIO la peticion. Es la condicion que hace que agregar sea
-- bilateral y no algo que te pueden imponer.
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
end;
$$;

-- ── Mis amigos y mi bandeja ───────────────────────────────────────────────────
-- Va como funcion para poder juntar el perfil sin abrir `perfiles` a lecturas de terceros, que
-- es el mismo motivo por el que `clasificacion` es una funcion y no una vista.
--
-- `p_estado`: 'aceptada' da la lista de amigos; 'pendiente' da la bandeja de peticiones.
create or replace function mis_amistades(p_estado text default 'aceptada')
returns table (id uuid, usuario text, nombre text, avatar text, direccion text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'hace falta sesion';
  end if;
  if p_estado not in ('aceptada','pendiente') then
    raise exception 'estado no valido';
  end if;

  return query
    select
      pe.id,
      pe.usuario,
      pe.nombre,
      pe.avatar,
      case when am.de = auth.uid() then 'enviada' else 'recibida' end as direccion
    from amistades am
    join perfiles pe
      on pe.id = case when am.de = auth.uid() then am.a else am.de end
   where am.estado = p_estado
     and (am.de = auth.uid() or am.a = auth.uid())
   order by am.creada desc;
end;
$$;

-- ── Invitar a un amigo a una liga ─────────────────────────────────────────────
-- ⭐ ESTA es la funcion que convierte los amigos en crecimiento: mete a alguien en tu liga sin
-- dictarle el codigo. El codigo sigue existiendo para grupos de WhatsApp; esto es para uno a uno.
--
-- Dos condiciones, las dos necesarias:
--   1. Tienes que estar TU en la liga (no puedes meter gente en ligas ajenas).
--   2. Tiene que ser amigo ACEPTADO (no vale meter a un desconocido, ni a quien te ignoro la
--      peticion). Aqui es donde la amistad da acceso a ver puntuaciones, y por eso exige que las
--      dos partes hayan dicho si.
create or replace function invitar_a_liga(p_liga uuid, p_amigo uuid)
returns void
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

  if not exists (
    select 1 from amistades
     where estado = 'aceptada'
       and least(de, a) = least(auth.uid(), p_amigo)
       and greatest(de, a) = greatest(auth.uid(), p_amigo)
  ) then
    raise exception 'esa persona no es tu amigo';
  end if;

  insert into miembros (liga, usuario) values (p_liga, p_amigo)
  on conflict (liga, usuario) do nothing;
end;
$$;

-- ── Permisos ──────────────────────────────────────────────────────────────────
-- ⛔ Revocar de `public` PRIMERO. Postgres concede EXECUTE a la pseudo-rol PUBLIC al crear
-- cualquier funcion, y anon/authenticated lo heredan de ahi. Es el mismo fallo que ya se corrigio
-- en el esquema base: revocar solo de anon y authenticated no revoca nada.
revoke execute on function elegir_usuario(text) from public, anon;
revoke execute on function buscar_persona(text) from public, anon;
revoke execute on function pedir_amistad(uuid) from public, anon;
revoke execute on function aceptar_amistad(uuid) from public, anon;
revoke execute on function mis_amistades(text) from public, anon;
revoke execute on function invitar_a_liga(uuid, uuid) from public, anon;

-- Solo con sesion. `anon` no busca a nadie: sin esto, cualquiera con la clave publica podria
-- comprobar si un nombre de usuario existe sin ni siquiera registrarse.
grant execute on function elegir_usuario(text) to authenticated;
grant execute on function buscar_persona(text) to authenticated;
grant execute on function pedir_amistad(uuid) to authenticated;
grant execute on function aceptar_amistad(uuid) to authenticated;
grant execute on function mis_amistades(text) to authenticated;
grant execute on function invitar_a_liga(uuid, uuid) to authenticated;
