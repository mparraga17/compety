import { Linking } from 'react-native';

/**
 * Como se cuenta un dato ausente.
 *
 * iOS no deja saber si el usuario denego un permiso de lectura: un vacio puede ser
 * "no llevaba la pulsera" o "no me das permiso", y son indistinguibles. Asi que la
 * app no afirma ninguna de las dos.
 *
 * Es el mismo criterio que ya estaba en el panel: un dia sin dato no es un cero,
 * significa que no llevaba la pulsera.
 */

export type EstadoDato<T> =
  | { hay: true; valor: T }
  /** Se consulto y no vino nada. Sin permiso o sin pulsera, no se puede saber. */
  | { hay: false; motivo: 'sin-datos' }
  /** El iPhone no tiene HealthKit (iPad, simulador viejo). */
  | { hay: false; motivo: 'no-disponible' };

export function conDato<T>(valor: T): EstadoDato<T> {
  return { hay: true, valor };
}

export function sinDato<T>(): EstadoDato<T> {
  return { hay: false, motivo: 'sin-datos' };
}

/** Convierte una lista de muestras en EstadoDato sin inventar ceros. */
export function desdeMuestras<T>(muestras: readonly T[]): EstadoDato<readonly T[]> {
  return muestras.length > 0 ? conDato(muestras) : sinDato();
}

/** Abre Ajustes > Privacidad > Salud > Compety para revisar los permisos. */
export function abrirAjustes(): Promise<void> {
  return Linking.openSettings();
}
