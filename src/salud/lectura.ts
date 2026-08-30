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
 * Pulsos de UNA sesion. Es el camino de la metrica: dan el tiempo en zonas de FC y de ahi
 * sale el Edwards TRIMP.
 *
 * ⭐ MEDIDO EN UN IPHONE REAL (28 ago 2026), y corrige lo que parecia obvio: el filtro
 * `{ workout }` devuelve CERO muestras con datos de Fitbit. Medido en una sesion de 29 min:
 * 0 pulsos por vinculo, 30 por rango de horas.
 *
 * Motivo: HealthKit solo vincula muestras a un entreno si la app que las escribio hizo ese
 * vinculo explicitamente, y el puente de Google Health no lo hace. Escribe los pulsos
 * sueltos y los entrenos por separado.
 *
 * ⇒ Se lee por RANGO de horas y se intenta el vinculo solo como refuerzo. Esto va a pasar
 * con cualquier fuente que no sea Apple Watch, asi que el rango es el camino principal.
 *
 * Devuelve [] tanto si no habia pulsera como si falta el permiso: iOS no deja distinguirlo.
 * Quien llame a esto NO debe concluir "no hay datos".
 */
export async function leerPulsosDeSesion(sesion: Sesion) {
  await preparar();

  const [porVinculo, porRango] = await Promise.all([
    queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
      limit: 0,
      filter: { workout: sesion },
      ascending: true,
    }),
    queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
      limit: 0,
      filter: { date: { startDate: sesion.startDate, endDate: sesion.endDate } },
      ascending: true,
    }),
  ]);

  // El vinculo es mas preciso cuando existe, pero casi nunca existe fuera de Apple Watch.
  return porVinculo.length >= porRango.length ? porVinculo : porRango;
}

/**
 * Pulsos entre dos fechas, sin filtrar por sesion.
 *
 * Existe para distinguir dos casos que se confunden: que no haya pulsos, o que si los haya
 * pero HealthKit no los tenga ASOCIADOS al entreno. El filtro `{ workout }` solo devuelve
 * muestras vinculadas a esa sesion, y no todas las fuentes hacen ese vinculo.
 *
 * Si por rango hay pulsos y por sesion no, la carga se puede calcular igual: se cruzan por
 * hora de inicio y fin.
 */
export async function leerPulsosEntre(desde: Date, hasta: Date) {
  await preparar();

  return queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
    limit: 0,
    filter: { date: { startDate: desde, endDate: hasta } },
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
