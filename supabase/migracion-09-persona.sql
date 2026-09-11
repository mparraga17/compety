-- ══════════════════════════════════════════════════════════════════════════════
-- Migración 09 · PERSONA: los entrenos de una persona concreta
--
-- Pedido por los amigos de la beta (11 sep): "si estás en la liga con alguien y le pulsas, ves sus
-- entrenos". El feed ya los mezcla a todos; esto es el filtro por persona, con la MISMA regla de
-- visibilidad (`ve_entrenos_de`: uno mismo, amigos aceptados, compañeros de liga privada). Un
-- compañero de liga de ZONA sigue sin poder verlos: la app se lo dice y le ofrece pedir amistad.
--
-- Idempotente.
-- ══════════════════════════════════════════════════════════════════════════════

-- Mismas columnas que `feed`, para que el cliente pinte las dos listas con el mismo componente.
create or replace function entrenos_de(
  p_usuario uuid,
  p_limite int default 30,
  p_antes timestamptz default null
)
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
  join perfiles p on p.id = e.usuario
  where e.usuario = p_usuario
    and not e.oculto
    and ve_entrenos_de(p_usuario)
    and (p_antes is null or e.fin < p_antes)
  order by e.fin desc
  limit least(greatest(p_limite, 1), 50);
$$;

revoke execute on function entrenos_de(uuid, int, timestamptz) from public, anon;
grant execute on function entrenos_de(uuid, int, timestamptz) to authenticated;

-- `ve_entrenos_de(uuid)` ya tiene EXECUTE para authenticated (migración 08): la app la llama por
-- RPC para distinguir "no tiene entrenos" de "no puedes verlos".
