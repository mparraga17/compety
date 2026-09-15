import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { HAY_SERVIDOR, supabase, usuarioActual } from '../datos/supabase';
import { destinoDe, type DestinoAviso } from './destino';

export type { DestinoAviso } from './destino';

/**
 * Notificaciones push.
 *
 * Por que existen, con respaldo. En STEP UP (JAMA, RCT, 602 adultos) la competicion fue el
 * unico formato cuyo efecto persistio al apagar la gamificacion, pero lo que aguanto fue
 * competicion CON VINCULOS SOCIALES REALES. Saber que alguien acaba de sumar es ese vinculo.
 * Y solo el 3 % de usuarios de apps de salud sigue activo a los 30 dias.
 *
 * ⚠️ Por que son POCAS. La teoria de la autodeterminacion dice que los avisos sin criterio
 * generan motivacion controlada, que predice abandono. Se avisa en dos casos y nada mas: una
 * sesion por encima de la normal PROPIA de quien la hizo, o un cambio de liderato. El resto
 * es ruido.
 *
 * ⛔ RESTRICCION DE APPLE, y decide el diseno del mensaje. La regla es literal: no se puede
 * revelar informacion obtenida de HealthKit a un tercero sin permiso expreso del usuario.
 *   ✅ vale: "Marta ha sumado 88 puntos. Una de sus sesiones mas fuertes."
 *   ⛔ no vale: cualquier cosa con pulsos, zonas o minutos de esfuerzo.
 * Sale gratis porque al servidor solo sube la cifra, pero queda dicho para que nadie lo rompa.
 */

/** Como se ve el aviso con la app abierta. Patron de LeonApostolico. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type EstadoPush =
  | { tipo: 'listo'; token: string }
  | { tipo: 'sin-permiso' }
  | { tipo: 'no-soportado' }
  | { tipo: 'error'; mensaje: string };

/**
 * Pide permiso y devuelve el token de Expo.
 *
 * Se comprueba el permiso antes de pedirlo, para no volver a mostrar la hoja a quien ya dijo
 * si. Es el patron que ya funcionaba en LeonApostolico.
 */
export async function prepararPush(): Promise<EstadoPush> {
  // En simulador no hay push. No es un error, es que no aplica.
  if (!Device.isDevice) return { tipo: 'no-soportado' };

  try {
    const actual = await Notifications.getPermissionsAsync();
    let concedido = actual.granted;

    if (!concedido && actual.canAskAgain) {
      const pedido = await Notifications.requestPermissionsAsync();
      concedido = pedido.granted;
    }
    if (!concedido) return { tipo: 'sin-permiso' };

    const { data } = await Notifications.getExpoPushTokenAsync();
    return { tipo: 'listo', token: data };
  } catch (e) {
    return { tipo: 'error', mensaje: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Guarda el token en el perfil, que es de donde lo lee el servidor.
 *
 * ⚠️ Hay que mantenerlo al dia. Apple y Google pueden bloquear apps que sigan enviando avisos
 * a dispositivos que los han bloqueado o que han desinstalado la app, asi que los tokens
 * muertos se limpian leyendo los recibos en el servidor.
 */
export async function guardarToken(token: string): Promise<void> {
  if (!HAY_SERVIDOR) return;

  const usuario = await usuarioActual();

  const { error } = await supabase.from('perfiles').update({ push_token: token }).eq('id', usuario);
  if (error) throw error;
}

/**
 * Al cerrar sesion se suelta el token, para no avisar a un teléfono que ya no es tuyo.
 *
 * ⚠️ Si el update falla, LANZA, igual que `guardarToken`. Antes se tragaba el error y un
 * logout sin red dejaba el token vivo en el perfil en silencio: los avisos de tus ligas
 * (nombres y puntos incluidos) seguian llegando a un telefono que ya no era tuyo. Quien
 * llama decide si puede tolerar el fallo (el borrado de cuenta si: la cascada se lleva el
 * token de todas formas) o si debe abortar (cerrar sesion).
 */
export async function soltarToken(): Promise<void> {
  if (!HAY_SERVIDOR) return;

  const usuario = await usuarioActual();

  const { error } = await supabase.from('perfiles').update({ push_token: null }).eq('id', usuario);
  if (error) throw error;
}

/**
 * Canal de Android. En iOS no hace nada, pero la app declara Android en app.json y sin canal
 * los avisos entran silenciados.
 */
export async function prepararCanal(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('ligas', {
    name: 'Ligas',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
  });
}

/**
 * Escucha los toques en los avisos y avisa a la app de a dónde ir. Devuelve la función para
 * dejar de escuchar. Cubre también el aviso que ABRIÓ la app desde cerrada, que en iOS no pasa
 * por el listener.
 */
export function escucharToques(onDestino: (destino: DestinoAviso) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((respuesta) => {
    const destino = destinoDe(respuesta.notification.request.content.data);
    if (destino !== null) onDestino(destino);
  });
  void Notifications.getLastNotificationResponseAsync()
    .then((ultima) => {
      const destino = ultima === null ? null : destinoDe(ultima.notification.request.content.data);
      if (destino !== null) onDestino(destino);
    })
    .catch(() => undefined);
  return () => sub.remove();
}
