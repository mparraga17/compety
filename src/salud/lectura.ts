import {
  queryQuantitySamples,
  queryWorkoutSamples,
} from '@kingstinct/react-native-healthkit';

import { preparar } from './permisos';
import type { TipoLeible } from './tipos';

/**
 * Toda lectura pasa por aqui, y toda lectura empieza con `await preparar()`.
 * Ese await es lo que hace imposible el crash por consultar sin autorizar.
 *
 * Nota de la API: las funciones sin anchor devuelven el array directamente. Las
 * variantes ...WithAnchor devuelven { samples, deletedSamples, newAnchor } y son las
 * que se usaran en segundo plano, para recuperar avisos perdidos sin huecos.
 */

/** Tipos derivados de la propia API, para no acoplarse a nombres internos. */
export type Sesion = Awaited<ReturnType<typeof queryWorkoutSamples>>[number];
export type MuestraCantidad = Awaited<ReturnType<typeof queryQuantitySamples>>[number];

/** Sesiones de ejercicio de los ultimos N dias. */
export async function leerSesiones(dias = 90): Promise<readonly Sesion[]> {
  await preparar();

  const desde = new Date();
  desde.setDate(desde.getDate() - dias);

  return queryWorkoutSamples({
    limit: 0,
    filter: { date: { startDate: desde } },
  });
}

/**
 * Pulsos de UNA sesion concreta. Es el camino de la metrica: estos pulsos dan el
 * tiempo en zonas de FC y de ahi sale el Edwards TRIMP.
 *
 * Devuelve [] tanto si el usuario no llevaba pulsera como si no dio permiso: iOS no
 * permite distinguirlo. Quien llame a esto NO debe concluir "no hay datos", tiene que
 * pasar por SinDatos o por la estimacion de cargaSinFc.
 */
export async function leerPulsosDeSesion(sesion: Sesion) {
  await preparar();

  return queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
    limit: 0,
    filter: { workout: sesion },
    ascending: true,
  });
}

/** Muestras de una metrica de la pestana Salud. */
export async function leerMetrica(tipo: TipoLeible, dias = 90) {
  await preparar();

  const desde = new Date();
  desde.setDate(desde.getDate() - dias);

  return queryQuantitySamples(tipo as 'HKQuantityTypeIdentifierRestingHeartRate', {
    limit: 0,
    filter: { date: { startDate: desde } },
    ascending: true,
  });
}
