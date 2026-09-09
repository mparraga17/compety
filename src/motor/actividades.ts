import type { TipoDeporte } from './met';

/**
 * Traduccion de los codigos de actividad de HealthKit a los tipos del motor.
 *
 * HealthKit devuelve `workoutActivityType` como codigo numerico de `HKWorkoutActivityType`.
 *
 * ⛔⛔ ESTA TABLA ESTUVO MAL Y DABA DATOS FALSOS EN PANTALLA (31 ago 2026).
 *
 * El usuario vio *"Actividad BIKING, 305,6 min"* y dijo que **no habia hecho bici**. Tenia razon:
 * el codigo **21 es GOLF**, no ciclismo. Los 305 minutos encajaban con una vuelta de golf y no con
 * una bici, que era la pista que delataba el fallo.
 *
 * Cinco codigos estaban mal, y el comentario anterior afirmaba que estaban *"verificados con datos
 * reales"*, lo que hizo que nadie los volviera a mirar:
 *
 * | codigo | decia | es de verdad |
 * |---|---|---|
 * | 21 | ciclismo | **golf** |
 * | 24 | golf | hockey |
 * | 35 | paddle surf | **remo** |
 * | 59 | pilates | **core training** |
 * | 63 | tenis | **HIIT** |
 * | 75 | senderismo | disc sports |
 * | 80 | HIIT | cooldown |
 *
 * ⛔ Y el 8 sep cayo el SEXTO: `26` como senderismo, cuando 24 = hiking y 26 = hunting. Salio
 * al comparar la tabla entera contra el enum generado de kingstinct, no leyendo con cuidado.
 * La regla que queda: esta tabla solo se toca con el enum oficial delante, y el test de
 * cobertura de abajo obliga a mapear el enum COMPLETO para que nada caiga a "Actividad N".
 *
 * ⚠️ **Por que no lo caza nada automatico:** un codigo mal traducido produce una sesion
 * perfectamente valida con el deporte equivocado. No hay excepcion, no hay error de tipos, y el
 * MET aplicado es el del deporte falso, asi que **la puntuacion tambien sale mal**. Solo lo detecta
 * una persona que sepa lo que hizo.
 *
 * 📌 Verificado contra la enumeracion oficial de `HKWorkoutActivityType`:
 * https://developer.apple.com/documentation/healthkit/hkworkoutactivitytype
 */
/**
 * ⭐ TABLA COMPLETA desde el 8 sep: los 84 códigos del enum, ninguno cae a null.
 *
 * Viene del análisis de qué escriben las plataformas en HealthKit: Apple Watch y Garmin
 * escriben el tipo exacto, y Whoop escribe hasta la fuerza con sus series. Con la tabla a
 * medias, un partido de baloncesto de un Apple Watch salía como "Actividad 6". La tesis del
 * producto es competir con cualquier pulsera, así que el mapa cubre el enum entero: lo
 * frecuente a su deporte, lo minoritario al cubo más cercano (WORKOUT si es de gimnasio,
 * SPORT si es juego o aire libre). El corrector por sesión sigue siendo la red final.
 *
 * ⛔⛔ Y el análisis cazó OTRO código mal, el sexto: `26` estaba como senderismo, pero el
 * enum real dice 24 = hiking, 25 = hockey, **26 = hunting**. Misma familia que el golf/21:
 * nada automático lo detecta, solo comparar contra la enumeración oficial. Verificado contra
 * `healthkit.generated.ts` de kingstinct (el código que corre en la app) el 8 sep 2026.
 */
export const ACTIVIDAD: Record<number, TipoDeporte> = {
  1: 'SPORT', // americanFootball
  2: 'SPORT', // archery
  3: 'SPORT', // australianFootball
  4: 'BADMINTON',
  5: 'SPORT', // baseball
  6: 'BASKETBALL',
  7: 'SPORT', // bowling
  8: 'MARTIAL_ARTS', // boxing
  9: 'CLIMBING',
  10: 'SPORT', // cricket
  11: 'WORKOUT', // crossTraining
  12: 'SPORT', // curling
  13: 'BIKING', // cycling
  14: 'DANCE',
  15: 'DANCE', // danceInspiredTraining
  16: 'WORKOUT', // elliptical
  17: 'SPORT', // equestrianSports
  18: 'MARTIAL_ARTS', // fencing: combate, la FC se comporta igual
  19: 'SPORT', // fishing
  20: 'STRENGTH_TRAINING', // functionalStrengthTraining
  21: 'GOLF', // ⛔ NO es ciclismo. Era el primer bug.
  22: 'WORKOUT', // gymnastics
  23: 'SPORT', // handball
  24: 'HIKING', // ⛔ hiking es 24, no 26. Era el sexto bug.
  25: 'SPORT', // hockey
  26: 'SPORT', // hunting
  27: 'SPORT', // lacrosse
  28: 'MARTIAL_ARTS',
  29: 'YOGA', // mindAndBody
  30: 'WORKOUT', // mixedMetabolicCardioTraining
  31: 'PADDLEBOARDING', // paddleSports
  32: 'SPORT', // play
  33: 'YOGA', // preparationAndRecovery: estiramientos, gasto de esa familia
  34: 'SQUASH', // racquetball, lo mas cercano
  35: 'ROWING',
  36: 'SPORT', // rugby
  37: 'RUNNING',
  38: 'SPORT', // sailing
  39: 'SKATING', // skatingSports
  40: 'SKIING', // snowSports
  41: 'SOCCER',
  42: 'SPORT', // softball
  43: 'SQUASH',
  44: 'WORKOUT', // stairClimbing
  45: 'PADDLEBOARDING', // surfingSports
  46: 'SWIMMING',
  47: 'TENNIS', // tableTennis
  48: 'TENNIS', // ⭐ el tenis de verdad
  49: 'RUNNING', // trackAndField
  50: 'STRENGTH_TRAINING', // traditionalStrengthTraining
  51: 'SPORT', // volleyball
  52: 'WALKING',
  53: 'SWIMMING', // waterFitness
  54: 'SWIMMING', // waterPolo
  55: 'PADDLEBOARDING', // waterSports
  56: 'MARTIAL_ARTS', // wrestling
  57: 'YOGA',
  58: 'BARRE',
  59: 'STRENGTH_TRAINING', // coreTraining
  60: 'SKIING', // crossCountrySkiing
  61: 'SKIING', // downhillSkiing
  62: 'WORKOUT', // flexibility
  63: 'WORKOUT', // highIntensityIntervalTraining
  64: 'WORKOUT', // jumpRope
  65: 'MARTIAL_ARTS', // kickboxing
  66: 'PILATES', // ⭐ el pilates de verdad, no el 59
  67: 'SKIING', // snowboarding
  68: 'WORKOUT', // stairs
  69: 'WORKOUT', // stepTraining
  70: 'WALKING', // wheelchairWalkPace
  71: 'RUNNING', // wheelchairRunPace
  72: 'YOGA', // taiChi
  73: 'WORKOUT', // mixedCardio
  74: 'BIKING', // handCycling
  75: 'SPORT', // discSports
  76: 'WORKOUT', // fitnessGaming
  77: 'DANCE', // cardioDance
  78: 'DANCE', // socialDance
  79: 'PADEL', // pickleball, lo mas cercano en el motor
  80: 'YOGA', // cooldown
  82: 'SPORT', // swimBikeRun (el triatlón entero; las piernas llegan como sub-actividades)
  83: 'SPORT', // transition
  84: 'SWIMMING', // underwaterDiving
  3000: 'SPORT', // other ⚠️ aquí caen las pesas de Fitbit: su puente pierde el tipo
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
  SOCCER: 'Fútbol',
  BASKETBALL: 'Baloncesto',
  ROWING: 'Remo',
  CLIMBING: 'Escalada',
  MARTIAL_ARTS: 'Artes marciales',
  SKIING: 'Esquí',
  SKATING: 'Patinaje',
};

/**
 * Icono de cada deporte, tomado de la maqueta `app-preview/`.
 *
 * ⭐ Son emojis y no una libreria de iconos a proposito: se renderizan con la fuente del sistema,
 * asi que no hacen falta ni `@expo/vector-icons` ni `expo-font`, que son nativos y obligarian a
 * recompilar. La maqueta ya los usaba, asi que el resultado es identico al aprobado.
 */
export const ICONO: Record<TipoDeporte, string> = {
  TENNIS: '🎾',
  PADEL: '🥎',
  BADMINTON: '🏸',
  SQUASH: '🎾',
  RUNNING: '🏃',
  TRAIL_RUNNING: '⛰️',
  TREADMILL: '🏃',
  STRENGTH_TRAINING: '🏋️',
  GOLF: '⛳',
  BARRE: '🩰',
  PILATES: '🧘',
  YOGA: '🧘',
  DANCE: '💃',
  WALKING: '🚶',
  HIKING: '🥾',
  WORKOUT: '💪',
  CIRCUIT_TRAINING: '💪',
  SPORT: '🤸',
  SWIMMING: '🏊',
  BIKING: '🚴',
  PADDLEBOARDING: '🏄',
  SOCCER: '⚽',
  BASKETBALL: '🏀',
  ROWING: '🚣',
  CLIMBING: '🧗',
  MARTIAL_ARTS: '🥋',
  SKIING: '⛷️',
  SKATING: '⛸️',
};

/** Icono de un tipo del motor. Punto medio si no se reconoce, nunca un hueco. */
export function iconoDe(tipo: string | null | undefined): string {
  if (tipo == null || tipo === '') return '·';
  return ICONO[tipo as TipoDeporte] ?? '·';
}

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
  SOCCER: 'Football',
  BASKETBALL: 'Basketball',
  ROWING: 'Rowing',
  CLIMBING: 'Climbing',
  MARTIAL_ARTS: 'Martial arts',
  SKIING: 'Skiing',
  SKATING: 'Skating',
};

/**
 * Todos los tipos del motor, para el corrector de deporte de una sesion.
 *
 * ⭐ Existe por un hecho medido en el iPhone del usuario (8 sep): Fitbit escribe las pesas en
 * Apple Health como "otro" (codigo 3000), aunque en su app esten guardadas como Pesas. El dato
 * llega sin deporte, asi que la salida es dejar corregirlo en la app, sesion a sesion.
 */
export const TIPOS: readonly TipoDeporte[] = Object.keys(NOMBRE_ES) as TipoDeporte[];

/** ¿Es un tipo valido del motor? Guarda de los valores que vuelven del almacen. */
export function esTipoDeporte(x: string | null | undefined): x is TipoDeporte {
  return x != null && x in NOMBRE_ES;
}

/** Del codigo de HealthKit al tipo del motor. null si no se reconoce. */
export function tipoDe(codigo: number | string | null | undefined): TipoDeporte | null {
  if (codigo == null) return null;
  const n = typeof codigo === 'number' ? codigo : Number(codigo);
  return Number.isFinite(n) ? (ACTIVIDAD[n] ?? null) : null;
}

/**
 * Nombre visible de un tipo YA traducido del motor.
 *
 * ⚠️ Existe porque `nombreDe` espera el **codigo numerico** de HealthKit, y en la app las sesiones
 * ya llevan el tipo resuelto (`'GOLF'`, `'SPORT'`...). Pasarle el tipo a `nombreDe` hacia que
 * `Number('BIKING')` diera `NaN` y saliera **"Actividad BIKING"** en pantalla, que es lo que el
 * usuario vio en el iPhone. Dos funciones distintas para dos entradas distintas.
 *
 * 📌 Acepta `string` y no solo `TipoDeporte` porque en todo el motor `tipo` esta declarado como
 * `string | null` (en `SesionPuntuada`, `SesionCruda`, `SesionConRitmo`...). Estrechar el tipo aqui
 * obligaria a cambiarlo en cinco ficheros del motor, que es un refactor mayor por un nombre.
 * Un tipo que no este en la tabla se devuelve tal cual, para poder anadirlo cuando aparezca.
 */
export function nombreDeTipo(tipo: string | null | undefined, idioma: 'es' | 'en' = 'es'): string {
  if (tipo == null || tipo === '') return idioma === 'es' ? 'Actividad' : 'Activity';

  const tabla = idioma === 'es' ? NOMBRE_ES : NOMBRE_EN;
  return tabla[tipo as TipoDeporte] ?? tipo;
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
