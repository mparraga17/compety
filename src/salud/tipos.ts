/**
 * Fuente unica de verdad de lo que Compety lee de HealthKit.
 *
 * Por que existe este fichero: la libreria crashea la app si pides datos de un
 * tipo que no has solicitado en requestAuthorization. Declarando los tipos aqui
 * y derivando de ellos el tipo TypeScript, pedir algo no autorizado no compila.
 * El fallo se detecta en Windows, no en el iPhone.
 */

/** Tipos que se piden en la hoja de permisos. Anadir aqui y en ningun otro sitio. */
export const TIPOS_A_LEER = [
  // Nucleo de la metrica: pulsos por sesion -> zonas de FC -> Edwards TRIMP
  'HKWorkoutTypeIdentifier',
  'HKQuantityTypeIdentifierHeartRate',

  // Contexto de la sesion
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierStepCount',

  // Pestana Salud (informativo, no puntua)
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierRespiratoryRate',
  'HKQuantityTypeIdentifierOxygenSaturation',
  'HKQuantityTypeIdentifierVO2Max',
  // Ojo: HRV no llega de Fitbit ni de WHOOP. Se pide para quien use Oura o
  // Apple Watch, pero NO puntua nada o se premiaria tener una marca concreta.
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
] as const;

/** Solo estos tipos se pueden leer. Cualquier otro es error de compilacion. */
export type TipoLeible = (typeof TIPOS_A_LEER)[number];

/**
 * Compety no escribe en HealthKit. Apple lo prohibe para datos falsos (5.1.3.ii)
 * y no hay motivo de producto para escribir.
 */
export const TIPOS_A_ESCRIBIR = [] as const;

/** Metricas de la pestana Salud, con su direccion de mejora. */
export const METRICAS_SALUD = [
  { tipo: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN', clave: 'hrv', mejorSubir: true },
  { tipo: 'HKQuantityTypeIdentifierRestingHeartRate', clave: 'fcReposo', mejorSubir: false },
  { tipo: 'HKQuantityTypeIdentifierOxygenSaturation', clave: 'spo2', mejorSubir: true },
  { tipo: 'HKQuantityTypeIdentifierRespiratoryRate', clave: 'respiracion', mejorSubir: false },
  { tipo: 'HKQuantityTypeIdentifierVO2Max', clave: 'vo2max', mejorSubir: true },
  { tipo: 'HKQuantityTypeIdentifierStepCount', clave: 'pasos', mejorSubir: true },
] as const satisfies readonly { tipo: TipoLeible; clave: string; mejorSubir: boolean }[];
