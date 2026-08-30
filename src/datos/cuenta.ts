import { borrarTodoLocal } from './almacenNativo';
import { borrarCuenta as borrarEnServidor } from './ligas';
import { HAY_SERVIDOR, supabase } from './supabase';
import { soltarToken } from '../avisos/push';

/**
 * Cuenta y sesion.
 *
 * Entrada por correo con enlace, sin contrasena. Motivo: una contrasena mas que gestionar es
 * friccion en el alta, y el alta es donde se pierde a la gente. Solo el 3 % de usuarios de apps
 * de salud sigue activo a los 30 dias, asi que cada paso de mas cuesta caro.
 *
 * ⚠️ Apple exige que se pueda BORRAR la cuenta desde dentro de la app, no solo cerrar sesion.
 * Esta abajo, y borra tambien lo local.
 */

export type Cuenta = {
  id: string;
  correo: string | null;
  nombre: string | null;
};

export async function sesionActual(): Promise<Cuenta | null> {
  if (!HAY_SERVIDOR) return null;

  const { data } = await supabase.auth.getSession();
  const usuario = data.session?.user;
  if (usuario === undefined) return null;

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombre')
    .eq('id', usuario.id)
    .maybeSingle();

  return {
    id: usuario.id,
    correo: usuario.email ?? null,
    nombre: (perfil?.nombre as string | undefined) ?? null,
  };
}

/** Manda el enlace de entrada al correo. */
export async function pedirEnlace(correo: string): Promise<void> {
  if (!HAY_SERVIDOR) throw new Error('sin-servidor');

  const { error } = await supabase.auth.signInWithOtp({
    email: correo.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

/** Entrada con el codigo de seis digitos del correo, alternativa al enlace. */
export async function entrarConCodigo(correo: string, codigo: string): Promise<Cuenta | null> {
  if (!HAY_SERVIDOR) throw new Error('sin-servidor');

  const { error } = await supabase.auth.verifyOtp({
    email: correo.trim().toLowerCase(),
    token: codigo.trim(),
    type: 'email',
  });
  if (error) throw error;
  return sesionActual();
}

/**
 * Nombre visible. Es lo unico que ven los demas, junto con la puntuacion.
 * Se crea el perfil si no existia.
 */
export async function guardarNombre(nombre: string): Promise<void> {
  if (!HAY_SERVIDOR) return;

  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (id === undefined) throw new Error('sin sesion');

  const { error } = await supabase
    .from('perfiles')
    .upsert({ id, nombre: nombre.trim() }, { onConflict: 'id' });
  if (error) throw error;
}

export async function salir(): Promise<void> {
  if (!HAY_SERVIDOR) return;
  // Se suelta el token primero, para no seguir avisando a un telefono que ya no es de nadie.
  await soltarToken();
  await supabase.auth.signOut();
}

/**
 * Borrado de cuenta. Requisito de Apple para apps con cuentas.
 * El borrado en cascada del perfil se lleva miembros, puntuaciones y avisos.
 */
export async function borrarCuenta(): Promise<void> {
  await soltarToken();
  await borrarEnServidor();
  await borrarTodoLocal();
}
