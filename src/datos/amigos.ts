import { HAY_SERVIDOR, supabase } from './supabase';

/**
 * Amigos y nombre de usuario.
 *
 * ⭐ El principio que manda: SER ENCONTRABLE NO ES SER VISIBLE.
 *
 * Buscar a alguien devuelve su nombre de usuario, su nombre visible y su foto. Nada mas. Las
 * puntuaciones siguen colgando de la pertenencia a una liga, asi que agregar a alguien NO da
 * acceso a sus numeros: eso lo da entrar en una liga con esa persona.
 *
 * ⚠️ La busqueda es por coincidencia EXACTA, no parcial. No es una limitacion tecnica, es la
 * decision: con busqueda parcial se podria recorrer el listado de quien usa la app probando
 * prefijos, y en una app de salud eso ya es un dato sensible por si mismo.
 */

/** Que relacion tienes con alguien que acabas de buscar. */
export type Relacion = 'yo' | 'amigos' | 'enviada' | 'recibida' | 'ninguna';

export type Persona = {
  id: string;
  usuario: string;
  nombre: string;
  /** Ruta en Storage, o null. Mientras sea null la app pinta la inicial del nombre. */
  avatar: string | null;
  relacion: Relacion;
};

export type Amistad = {
  id: string;
  usuario: string;
  nombre: string;
  avatar: string | null;
  /** Para la bandeja: si la peticion la mandaste tu o te la mandaron. */
  direccion: 'enviada' | 'recibida';
};

/** Formato del nombre de usuario. Se valida aqui y otra vez en el SQL. */
export const FORMATO_USUARIO = /^[a-z0-9_]{3,20}$/;

function sinServidor(): never {
  throw new Error('sin-servidor');
}

/**
 * Elige tu nombre de usuario. Es con lo que te encuentran los demas.
 *
 * Se guarda en minusculas a proposito: asi `Pepito` y `pepito` son la misma persona y nadie
 * puede registrar un parecido para confundir a nadie.
 */
export async function elegirUsuario(usuario: string): Promise<void> {
  if (!HAY_SERVIDOR) sinServidor();

  const limpio = usuario.trim().toLowerCase();
  if (!FORMATO_USUARIO.test(limpio)) throw new Error('usuario-no-valido');

  const { error } = await supabase.rpc('elegir_usuario', { p_usuario: limpio });
  if (error) throw error;
}

/**
 * Busca una persona por su nombre de usuario exacto.
 *
 * Devuelve null si no existe. ⚠️ No hay autocompletado ni sugerencias, y es intencionado:
 * hay que saber el nombre de antemano, que es el caso real (te lo dicen y lo escribes).
 */
export async function buscarPersona(usuario: string): Promise<Persona | null> {
  if (!HAY_SERVIDOR) return null;

  const limpio = usuario.trim().toLowerCase();
  // Se corta aqui para no gastar una llamada con algo que el servidor va a rechazar igual.
  if (!FORMATO_USUARIO.test(limpio)) return null;

  const { data, error } = await supabase.rpc('buscar_persona', { p_usuario: limpio });
  if (error) throw error;

  const filas = (data ?? []) as Persona[];
  return filas[0] ?? null;
}

/**
 * Manda peticion de amistad.
 *
 * Devuelve el estado resultante. ⭐ Si esa persona ya te habia pedido a ti, esto ACEPTA su
 * peticion en vez de crear otra, que es lo que uno esperaria cuando dos se agregan a la vez.
 */
export async function pedirAmistad(id: string): Promise<Relacion> {
  if (!HAY_SERVIDOR) sinServidor();

  const { data, error } = await supabase.rpc('pedir_amistad', { p_a: id });
  if (error) throw error;
  return data as Relacion;
}

/** Acepta una peticion. Solo puede aceptar quien la recibio: agregar es bilateral. */
export async function aceptarAmistad(id: string): Promise<void> {
  if (!HAY_SERVIDOR) sinServidor();

  const { error } = await supabase.rpc('aceptar_amistad', { p_de: id });
  if (error) throw error;
}

/** Rompe la amistad o retira la peticion. Sirve en los dos sentidos. */
export async function quitarAmistad(id: string): Promise<void> {
  if (!HAY_SERVIDOR) return;

  const { data } = await supabase.auth.getSession();
  const yo = data.session?.user.id;
  if (yo === undefined) return;

  // La politica de RLS ya limita el borrado a las filas donde apareces, asi que este filtro es
  // para acertar con la fila, no para autorizar.
  const { error } = await supabase
    .from('amistades')
    .delete()
    .or(`and(de.eq.${yo},a.eq.${id}),and(de.eq.${id},a.eq.${yo})`);
  if (error) throw error;
}

/** Tus amigos aceptados. */
export async function misAmigos(): Promise<readonly Amistad[]> {
  if (!HAY_SERVIDOR) return [];

  const { data, error } = await supabase.rpc('mis_amistades', { p_estado: 'aceptada' });
  if (error) throw error;
  return (data ?? []) as Amistad[];
}

/** Peticiones sin resolver, tuyas y de otros. Filtrar por `direccion` para la bandeja. */
export async function peticiones(): Promise<readonly Amistad[]> {
  if (!HAY_SERVIDOR) return [];

  const { data, error } = await supabase.rpc('mis_amistades', { p_estado: 'pendiente' });
  if (error) throw error;
  return (data ?? []) as Amistad[];
}

/**
 * Mete a un amigo en una liga tuya, sin dictarle el codigo.
 *
 * ⭐ Esta es la funcion que convierte los amigos en crecimiento. Exige dos cosas: que tu estes
 * en la liga y que sea amigo ACEPTADO. Aqui es donde la amistad si da acceso a ver puntuaciones,
 * y por eso hacen falta los dos sies.
 */
export async function invitarALiga(liga: string, amigo: string): Promise<void> {
  if (!HAY_SERVIDOR) sinServidor();

  const { error } = await supabase.rpc('invitar_a_liga', { p_liga: liga, p_amigo: amigo });
  if (error) throw error;
}
