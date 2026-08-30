import type { TipoDeporte } from './met';

/**
 * Traduccion de los codigos de actividad de HealthKit a los tipos del motor.
 *
 * HealthKit devuelve `workoutActivityType` como codigo numerico. Los que aparecieron en
 * datos reales del usuario el 28 ago: 21 ciclismo, 37 correr, 50 fuerza, 52 caminar.
 *
 * Lista de Apple: https://developer.apple.com/documentation/healthkit/hkworkoutactivitytype
 *
 * ⚠️ Barre es 58 y pilates 59. Son el nicho principal del producto y todavia no han aparecido
 * en datos reales, asi que su comportamiento no esta verificado.
 */
export const ACTIVIDAD: Record<number, TipoDeporte> = {
  13: 'BIKING', // cycling
  16: 'DANCE',
  21: 'BIKING', // ⭐ el que aparece en datos reales, no el 13
  24: 'GOLF',
  35: 'PADDLEBOARDING',
  37: 'RUNNING',
  46: 'SWIMMING',
  50: 'STRENGTH_TRAINING', // traditionalStrengthTraining
  52: 'WALKING',
  57: 'YOGA',
  58: 'BARRE',
  59: 'PILATES',
  63: 'TENNIS',
  75: 'HIKING',
  80: 'WORKOUT', // highIntensityIntervalTraining
  3000: 'SPORT', // other
};

/** Nombre visible. Se resuelve en la interfaz, nunca se guarda dentro del dato. */
export const NOMBRE_ES: Record<TipoDeporte, string> = {
  RUNNING: 'Correr',
  TRAIL_RUNNING: 'Trail',
  TREADMILL: 'Cinta',
  TENNIS: 'Tenis',
  PADEL: 'Pádel',
  BADMINTON: 'Bádminton',
  SQUASH: 'Squash',
  STRENGTH_TRAINING: 'Fuerza',
  WORKOUT: 'Entreno',
  CIRCUIT_TRAINING: 'Circuito',
  BARRE: 'Barre',
  PILATES: 'Pilates',
  YOGA: 'Yoga',
  DANCE: 'Baile',
  GOLF: 'Golf',
  WALKING: 'Caminar',
  HIKING: 'Senderismo',
  SWIMMING: 'Natación',
  BIKING: 'Bici',
  PADDLEBOARDING: 'Paddle surf',
  SPORT: 'Deporte',
};

export const NOMBRE_EN: Record<TipoDeporte, string> = {
  RUNNING: 'Running',
  TRAIL_RUNNING: 'Trail',
  TREADMILL: 'Treadmill',
  TENNIS: 'Tennis',
  PADEL: 'Padel',
  BADMINTON: 'Badminton',
  SQUASH: 'Squash',
  STRENGTH_TRAINING: 'Strength',
  WORKOUT: 'Workout',
  CIRCUIT_TRAINING: 'Circuit',
  BARRE: 'Barre',
  PILATES: 'Pilates',
  YOGA: 'Yoga',
  DANCE: 'Dance',
  GOLF: 'Golf',
  WALKING: 'Walking',
  HIKING: 'Hiking',
  SWIMMING: 'Swimming',
  BIKING: 'Cycling',
  PADDLEBOARDING: 'Paddleboarding',
  SPORT: 'Sport',
};

/** Del codigo de HealthKit al tipo del motor. null si no se reconoce. */
export function tipoDe(codigo: number | string | null | undefined): TipoDeporte | null {
  if (codigo == null) return null;
  const n = typeof codigo === 'number' ? codigo : Number(codigo);
  return Number.isFinite(n) ? (ACTIVIDAD[n] ?? null) : null;
}

/**
 * Nombre visible de una actividad. Si el codigo no se reconoce se muestra tal cual, para
 * poder anadirlo a la tabla cuando aparezca en datos reales.
 */
export function nombreDe(
  codigo: number | string | null | undefined,
  idioma: 'es' | 'en' = 'es',
): string {
  const tipo = tipoDe(codigo);
  if (tipo === null) return `Actividad ${String(codigo ?? '?')}`;
  return idioma === 'es' ? NOMBRE_ES[tipo] : NOMBRE_EN[tipo];
}
