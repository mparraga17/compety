import * as AppleAuthentication from 'expo-apple-authentication';

import { borrarTodoLocal } from './almacenNativo';
import { borrarCuenta as borrarEnServidor } from './ligas';
import { HAY_SERVIDOR, supabase } from './supabase';
import { soltarToken } from '../avisos/push';

/**
 * Cuenta y sesion.
 *
 * ⭐ Entrada con Sign in with Apple, sin correo y sin contrasena. El iPhone ya sabe quien eres:
 * Face ID y dentro. Motivos, por orden de peso:
 *
 *   1. Es el alta mas corta que existe en iOS, y el alta es donde se pierde a la gente. Solo el
 *      3 % de usuarios de apps de salud sigue activo a los 30 dias, asi que cada paso cuesta.
 *   2. La guia 4.8 de Apple lo exige de todas formas si hay cualquier login social.
 *   3. Permite ocultar el correo real, que encaja con una app de salud y con la linea de guardar
 *      lo minimo que sigue todo el diseno.
 *
 * ⛔ Se descarto la entrada por correo, que estaba implementada, porque Supabase cerro la edicion
 * de plantillas en capa gratuita el 3 jun 2026: la plantilla manda un enlace y la app pedia un
 * codigo de seis digitos que nunca llegaba. Y el SMS quedo descartado antes por coste.
 *
 * ⚠️ Apple exige poder BORRAR la cuenta desde dentro de la app, no solo cerrar sesion. Esta
 * abajo, y borra tambien lo local.
 */

export type Cuenta = {
  id: string;
  /** null si la persona eligio ocultar su correo a Apple. */
  correo: string | null;
  /** Nombre visible en la clasificacion. */
  nombre: string | null;
  /** Con el que te encuentran tus amigos. null hasta que lo elige. */
  usuario: string | null;
};

/** Si el dispositivo soporta Sign in with Apple. En iOS 13+ siempre; en Android nunca. */
export async function hayEntradaApple(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync();
}

async function perfilDe(id: string, correo: string | null): Promise<Cuenta> {
  const { data } = await supabase
    .from('perfiles')
    .select('nombre, usuario')
    .eq('id', id)
    .maybeSingle();

  return {
    id,
    correo,
    nombre: (data?.nombre as string | undefined) ?? null,
    usuario: (data?.usuario as string | undefined) ?? null,
  };
}

export async function sesionActual(): Promise<Cuenta | null> {
  if (!HAY_SERVIDOR) return null;

  const { data } = await supabase.auth.getSession();
  const usuario = data.session?.user;
  if (usuario === undefined) return null;

  return perfilDe(usuario.id, usuario.email ?? null);
}

/**
 * Entrada con Apple.
 *
 * ⚠️ Detalle que hay que respetar: Apple da el nombre real SOLO en el primer login. Los
 * siguientes devuelven null. Aqui no importa mucho porque el nombre visible lo elige la persona,
 * pero se aprovecha como valor por defecto para no dejar el campo vacio.
 *
 * Devuelve null si la persona cancela, que no es un error y no debe pintar aviso rojo.
 */
export async function entrarConApple(): Promise<Cuenta | null> {
  if (!HAY_SERVIDOR) throw new Error('sin-servidor');

  let credencial: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credencial = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (e) {
    // Cancelar no es fallar.
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw e;
  }

  if (credencial.identityToken === null) throw new Error('apple-sin-token');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credencial.identityToken,
  });
  if (error) throw error;

  const id = data.user?.id;
  if (id === undefined) throw new Error('sin-usuario');

  // Solo llega en el primer login. Se usa como sugerencia del nombre visible.
  const sugerido = credencial.fullName?.givenName ?? null;
  if (sugerido !== null) {
    const { data: previo } = await supabase
      .from('perfiles')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (previo === null) {
      await supabase.from('perfiles').insert({ id, nombre: sugerido.slice(0, 40) });
    }
  }

  return perfilDe(id, data.user?.email ?? null);
}

/**
 * Nombre visible. Es lo que ven los demas en la clasificacion, junto con la puntuacion.
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
  // ⚠️ Y si no se puede soltar (sin red), el cierre de sesion ABORTA y la pantalla enseña el
  // error: cerrar sesion dejando el token vivo seguiria mandando avisos con nombres y puntos
  // de tus ligas a un telefono que ya no es tuyo. Reintentar con red es el camino.
  await soltarToken();
  await supabase.auth.signOut();
}

/**
 * Borrado de cuenta. Requisito de Apple para apps con cuentas.
 * El borrado en cascada del perfil se lleva miembros, puntuaciones, avisos y amistades.
 */
export async function borrarCuenta(): Promise<void> {
  // Aqui un fallo al soltar el token NO bloquea: el borrado en cascada del perfil se lleva
  // el token de todas formas, y bloquear el borrado de cuenta (requisito de Apple) por un
  // update prescindible seria el tradeoff equivocado.
  await soltarToken().catch(() => undefined);
  await borrarEnServidor();
  await borrarTodoLocal();
}
