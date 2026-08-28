import {
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';

import { TIPOS_A_LEER } from './tipos';

/**
 * Puerta unica a HealthKit.
 *
 * Ninguna pantalla llama a la libreria directamente: todo pasa por preparar().
 * Asi es imposible pedir datos antes de haber pedido autorizacion, que es lo que
 * crashea la app.
 *
 * Limite de iOS que condiciona todo lo de abajo: por privacidad, una app NO puede
 * saber si el usuario concedio permiso de LECTURA. Si no lo tiene, la consulta
 * devuelve vacio, igual que si no hubiera datos.
 * https://developer.apple.com/documentation/healthkit/hkhealthstore/1614152-requestauthorization
 *
 * Consecuencia de producto: nunca afirmar "no tienes datos". Ver salud/estado.ts.
 */

export type EstadoPermisos =
  | { tipo: 'no-disponible' }
  | { tipo: 'sin-preguntar' }
  | { tipo: 'preguntado' };

/** Promesa compartida: la hoja del sistema se muestra una sola vez. */
let autorizacion: Promise<boolean> | null = null;

export function hayHealthKit(): boolean {
  return isHealthDataAvailable();
}

/**
 * Pide autorizacion si hace falta y resuelve cuando ya se puede consultar.
 * Idempotente: llamarla muchas veces no reabre la hoja.
 */
export function preparar(): Promise<boolean> {
  autorizacion ??= requestAuthorization({ toRead: TIPOS_A_LEER }).catch((error) => {
    // Si falla, se limpia para poder reintentar en el proximo arranque.
    autorizacion = null;
    throw error;
  });
  return autorizacion;
}

/**
 * Si ya se pregunto por todos los tipos. NO dice que concedio, eso iOS no lo cuenta.
 * Sirve para decidir si mostrar la pantalla de bienvenida o ir directo a los datos.
 */
export async function estadoPermisos(): Promise<EstadoPermisos> {
  if (!isHealthDataAvailable()) return { tipo: 'no-disponible' };

  const estado = await getRequestStatusForAuthorization({ toRead: TIPOS_A_LEER });
  // shouldRequest = 1: quedan tipos sin preguntar. unnecessary = 2: ya se pregunto.
  return estado === 1 ? { tipo: 'sin-preguntar' } : { tipo: 'preguntado' };
}
