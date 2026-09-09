-- Migracion 03: arreglo de `crear_liga`.
--
-- ⛔ EL BUG: crear una liga fallaba con 42702 «column reference "codigo" is ambiguous», que en la
-- app se veia como un inutil "[object Object]".
--
-- La causa: la funcion declara `returns table (id uuid, codigo text)`, y esos nombres se
-- convierten en VARIABLES dentro del cuerpo. Cuando el `exit when not exists (select 1 from ligas
-- where codigo = v_codigo)` menciona `codigo`, Postgres no sabe si te refieres a la columna de la
-- tabla `ligas` o a la variable de salida de la funcion. Y no avisa al crearla: falla al ejecutar.
--
-- 📌 Por eso no lo cazo la prueba de la migracion 02: alli se probo `buscar_persona`,
-- `pedir_amistad` y compania, pero NO `crear_liga`, que venia del esquema base y se dio por buena.
-- Leccion: probar tambien lo que ya estaba, no solo lo que se acaba de escribir.
--
-- ⭐ EL ARREGLO, y por que este y no otro: se renombran las columnas de salida a `liga_id` y
-- `liga_codigo`. La alternativa habitual es cualificar todo con `ligas.codigo`, pero eso deja la
-- trampa viva para el siguiente que edite la funcion. Con nombres distintos el choque no puede
-- volver a ocurrir.
--
-- ⚠️ Cambia el nombre de las claves que devuelve el RPC, asi que `crearLiga()` en
-- `src/datos/ligas.ts` se actualiza a la vez.

-- ⚠️ `create or replace` NO basta: cambiar los nombres de las columnas de salida cambia el tipo
-- de retorno, y Postgres lo rechaza con 42P13 «cannot change return type of existing function».
-- Hay que borrarla primero. Es seguro: una funcion no guarda datos.
drop function if exists crear_liga(text, text);

create function crear_liga(p_nombre text, p_deporte text default null)
returns table (liga_id uuid, liga_codigo text)
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
  --
  -- `extensions.` va cualificado porque pgcrypto vive en el esquema `extensions` en Supabase y
  -- esta funcion fija `search_path = public`.
  --
  -- Y el `upper` va ANTES del `translate`: al reves, una 'i' o una 'o' de base64 acababan como
  -- I y O justo despues de haberlas limpiado.
  loop
    v_codigo := substr(
      translate(upper(encode(extensions.gen_random_bytes(8), 'base64')), '+/=IO01', 'ABCDEFG'),
      1, 6
    );
    -- Ahora `codigo` solo puede ser la columna de `ligas`: ya no hay variable con ese nombre.
    exit when not exists (select 1 from ligas where ligas.codigo = v_codigo);
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

revoke execute on function crear_liga(text, text) from public, anon;
grant execute on function crear_liga(text, text) to authenticated;
