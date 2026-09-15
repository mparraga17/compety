import * as AppleAuthentication from 'expo-apple-authentication';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';

import { actualizaCuenta, guardaCuenta, leeCuenta, olvidaCuenta } from './almacen';
import { almacenNativo, borrarTodoLocal } from './almacenNativo';
import { borrarCuenta as borrarEnServidor } from './ligas';
import { HAY_SERVIDOR, supabase, usuarioActual } from './supabase';
import { olvidaZonaHorariaDeclarada } from './zonaHoraria';
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

/**
 * Lee el perfil del servidor. LANZA si la consulta falla.
 *
 * ⛔⛔ Aqui estaba el fallo que mandaba a gente con cuenta a la pantalla de alta. Se ignoraba
 * `error`, asi que un fallo de red devolvia `nombre: null`, que para el arranque significa
 * "no ha terminado el alta". Un fallo de red no es un estado del perfil: se propaga, y quien
 * llama decide (ver `sesionActual`). `data === null` sin error SI significa que no hay fila.
 *
 * Al leer bien se guarda una copia local, que es lo que permite arrancar sin red la proxima vez.
 */
async function perfilDe(id: string, correo: string | null): Promise<Cuenta> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('nombre, usuario')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;

  const cuenta: Cuenta = {
    id,
    correo,
    nombre: (data?.nombre as string | undefined) ?? null,
    usuario: (data?.usuario as string | undefined) ?? null,
  };
  // La copia es una comodidad, no la verdad: si el almacen falla, la cuenta sigue valiendo.
  await guardaCuenta(almacenNativo(), cuenta).catch(() => undefined);
  return cuenta;
}

/**
 * Resultado de comprobar la sesion al arrancar. Tres casos, y la diferencia entre el segundo y
 * el tercero es la que importa:
 *
 *   `sin-sesion`      nadie ha entrado, o la sesion murio de verdad (revocada, cuenta borrada).
 *                     Lo correcto es la pantalla de entrar.
 *   `cuenta`          hay sesion y se sabe quien eres. Puede venir del servidor o, sin red, de
 *                     la copia local.
 *   `sin-comprobar`   hay sesion guardada pero el servidor no responde y no hay copia local.
 *                     Mandar a entrar aqui seria mentir: la persona tiene cuenta. Se reintenta.
 */
export type EstadoSesion =
  | { tipo: 'sin-sesion' }
  | { tipo: 'cuenta'; cuenta: Cuenta }
  | { tipo: 'sin-comprobar'; error: unknown };

/**
 * ⚠️ Verificado en el codigo de supabase-js (GoTrueClient, `__loadSession`): cuando el token de
 * acceso ha caducado y la renovacion falla por RED, `getSession()` devuelve `session: null` con
 * un error reintentable, pero la sesion SIGUE guardada en el telefono. O sea que "session null"
 * no significa "sin sesion": hay que mirar el error. Sin esto, abrir la app tras una hora sin
 * cobertura te devolvia a "Entrar con Apple".
 */
export async function sesionActual(): Promise<EstadoSesion> {
  if (!HAY_SERVIDOR) return { tipo: 'sin-sesion' };
  const almacen = almacenNativo();

  const { data, error } = await supabase.auth.getSession();
  const usuario = data.session?.user;

  if (usuario === undefined) {
    if (error !== null && isAuthRetryableFetchError(error)) {
      // Sesion guardada que no se pudo renovar sin red. Con copia local se arranca con ella;
      // la sesion se renueva sola en la primera consulta que encuentre red.
      const guardada = await leeCuenta(almacen).catch(() => null);
      if (guardada !== null) return { tipo: 'cuenta', cuenta: guardada };
      return { tipo: 'sin-comprobar', error };
    }
    // Sin sesion, o muerta de verdad. La copia local, si queda, es de otra vida: fuera.
    await olvidaCuenta(almacen).catch(() => undefined);
    return { tipo: 'sin-sesion' };
  }

  try {
    return { tipo: 'cuenta', cuenta: await perfilDe(usuario.id, usuario.email ?? null) };
  } catch (e) {
    // Hay sesion pero el perfil no se pudo leer. La copia local vale SOLO si es de esta misma
    // persona; nunca se arranca con la cuenta de otra que uso el telefono antes.
    const guardada = await leeCuenta(almacen, usuario.id).catch(() => null);
    if (guardada !== null) {
      return { tipo: 'cuenta', cuenta: { ...guardada, correo: usuario.email ?? guardada.correo } };
    }
    return { tipo: 'sin-comprobar', error: e };
  }
}

/**
 * Avisa cuando la sesion se cierra, por la via que sea: cerrar sesion, borrar la cuenta, o que
 * supabase-js la de por muerta (token revocado, cuenta borrada desde otro sitio).
 *
 * ⛔ Sin esto la app seguia "dentro" con una sesion muerta: cada subida hacia `return` en
 * silencio al no encontrar usuario, el contador de subidas seguia sumando y el segundo plano
 * decia que todo iba bien. Las puntuaciones dejaban de subir para siempre sin ninguna señal.
 *
 * Devuelve la funcion para dejar de escuchar.
 */
export function alCerrarseSesion(alCerrar: () => void): () => void {
  if (!HAY_SERVIDOR) return () => undefined;
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_OUT') alCerrar();
  });
  return () => subscription.unsubscribe();
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
    const { data: previo, error: errorPrevio } = await supabase
      .from('perfiles')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    // Mismo criterio que `perfilDe`: un fallo al consultar no es "no existe". Se propaga y la
    // pantalla de entrar lo enseña; sin red no se puede completar el alta de todas formas.
    if (errorPrevio) throw errorPrevio;

    if (previo === null) {
      const { error: errorAlta } = await supabase
        .from('perfiles')
        .insert({ id, nombre: sugerido.slice(0, 40) });
      // 23505 = ya existe: otro dispositivo se adelanto entre la consulta y el alta. No es un
      // fallo, el perfil esta. Cualquier otro error si lo es.
      if (errorAlta && errorAlta.code !== '23505') throw errorAlta;
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

  const id = await usuarioActual();

  const { error } = await supabase
    .from('perfiles')
    .upsert({ id, nombre: nombre.trim() }, { onConflict: 'id' });
  if (error) throw error;
  // La copia local sigue a la verdad del servidor. Best-effort, como al leer.
  await actualizaCuenta(almacenNativo(), { nombre: nombre.trim() }).catch(() => undefined);
}

export async function salir(): Promise<void> {
  if (!HAY_SERVIDOR) return;
  // Se suelta el token primero, para no seguir avisando a un telefono que ya no es de nadie.
  // ⚠️ Y si no se puede soltar (sin red), el cierre de sesion ABORTA y la pantalla enseña el
  // error: cerrar sesion dejando el token vivo seguiria mandando avisos con nombres y puntos
  // de tus ligas a un telefono que ya no es tuyo. Reintentar con red es el camino.
  await soltarToken();
  // ⚠️ `signOut` devuelve el error en vez de lanzarlo, y sin red NO borra la sesion local
  // (verificado en `_signOut`: solo la borra si el servidor respondio o si el fallo es 401/403/
  // 404). Ignorarlo hacia que "cerrar sesion" pareciera funcionar y al siguiente arranque la
  // persona siguiera dentro. Se propaga por lo mismo que el token: mejor un error visible que
  // un cierre de sesion que no cierra nada.
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  await olvidaCuenta(almacenNativo()).catch(() => undefined);
  // La zona horaria declarada era de esta cuenta: la siguiente en este telefono declara la suya.
  await olvidaZonaHorariaDeclarada().catch(() => undefined);
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
