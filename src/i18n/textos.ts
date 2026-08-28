import { getLocales } from 'expo-localization';

/**
 * Textos de la interfaz. Patron de LeonApostolico: deteccion de sistema con override.
 *
 * Reglas de estilo del producto (peticion del usuario):
 * nada de guion largo, flechas ni construcciones tipo "no es X, es Y". Frases cortas
 * y desiguales. El punto medio (·) si vale, Apple lo usa en sus interfaces.
 *
 * Y una regla que costo un bug: un dato nunca lleva texto traducible dentro.
 */

export type Idioma = 'es' | 'en';

const ES = {
  // Bienvenida. Apple rechaza apps que usan HealthKit sin explicar la funcion en
  // la interfaz, asi que esta pantalla es requisito, no cortesia.
  bienvenidaTitulo: 'Compite por lo que te cuesta',
  bienvenidaEntrada:
    'Compety mide el esfuerzo de cada sesion y lo convierte en puntos. Una clase de barre exigente puede sumar mas que una carrera tranquila.',
  queLeemos: 'Qué vamos a leer',
  queLeemosSesiones: 'Tus entrenos',
  queLeemosSesionesDetalle: 'Tipo de actividad, duración y hora. De aquí sale qué has hecho.',
  queLeemosFc: 'Tu frecuencia cardiaca durante esos entrenos',
  queLeemosFcDetalle:
    'Es lo que permite comparar deportes distintos. Sin pulso también puntúas, con menos precisión.',
  queLeemosSalud: 'Sueño y métricas diarias',
  queLeemosSaludDetalle: 'Solo para tu propia vista. No entran en ninguna clasificación.',
  dondeVa: 'Dónde va',
  dondeVaDetalle:
    'El cálculo se hace en tu iPhone. Al servidor solo sube tu puntuación, nunca tus pulsos ni tu sueño.',
  dondeVaCompartido:
    'Los demás miembros de tu liga ven tu puntuación y tu posición. Nada más.',
  puedesCambiar: 'Puedes cambiar los permisos cuando quieras desde Ajustes.',
  continuar: 'Continuar',
  masTarde: 'Ahora no',

  // Permisos y datos ausentes. Nunca afirmar que no hay datos.
  sinDatosTitulo: 'No vemos datos',
  sinDatosCuerpo:
    'Puede ser que no llevaras la pulsera, o que falte el permiso. No podemos distinguirlo: iOS no nos lo cuenta, por privacidad.',
  sinDatosFc:
    'No vemos frecuencia cardiaca en esta sesión. Puede ser que no llevaras la pulsera, o que falte el permiso.',
  revisarPermisos: 'Revisar permisos',
  sinHealthKit: 'Este dispositivo no tiene datos de salud disponibles.',

  // Sesiones estimadas sin FC
  cargaEstimada: 'Puntuación estimada',
  cargaEstimadaCuerpo:
    'Sin frecuencia cardiaca hemos estimado esta sesión por el tipo de actividad y la duración. Si llevas pulsera o nos dices cómo de dura fue, la puntuación se ajusta a lo que hiciste de verdad.',
  comoDeDura: '¿Cómo de dura fue?',
  suave: 'Suave',
  muyDura: 'Muy dura',
  guardarEsfuerzo: 'Guardar',
  origenMedida: 'medida',
  origenDeclarada: 'según tú',
  origenEstimada: 'estimada',
} as const;

const EN: Record<keyof typeof ES, string> = {
  bienvenidaTitulo: 'Compete on what it costs you',
  bienvenidaEntrada:
    'Compety measures the effort of each session and turns it into points. A hard barre class can score more than an easy run.',
  queLeemos: 'What we read',
  queLeemosSesiones: 'Your workouts',
  queLeemosSesionesDetalle: 'Activity type, duration and time. This is what you did.',
  queLeemosFc: 'Your heart rate during those workouts',
  queLeemosFcDetalle:
    'This is what makes different sports comparable. Without heart rate you still score, with less precision.',
  queLeemosSalud: 'Sleep and daily metrics',
  queLeemosSaludDetalle: 'For your own view only. They never enter a ranking.',
  dondeVa: 'Where it goes',
  dondeVaDetalle:
    'The calculation happens on your iPhone. Only your score goes to the server, never your heart rate or your sleep.',
  dondeVaCompartido: 'Other members of your league see your score and your position. Nothing else.',
  puedesCambiar: 'You can change permissions any time in Settings.',
  continuar: 'Continue',
  masTarde: 'Not now',

  sinDatosTitulo: 'We see no data',
  sinDatosCuerpo:
    'You may not have been wearing your tracker, or the permission may be missing. We cannot tell which: iOS does not tell us, for privacy.',
  sinDatosFc:
    'We see no heart rate for this session. You may not have been wearing your tracker, or the permission may be missing.',
  revisarPermisos: 'Review permissions',
  sinHealthKit: 'This device has no health data available.',

  cargaEstimada: 'Estimated score',
  cargaEstimadaCuerpo:
    'Without heart rate we estimated this session from the activity type and duration. Wear a tracker, or tell us how hard it felt, and the score matches what you actually did.',
  comoDeDura: 'How hard was it?',
  suave: 'Easy',
  muyDura: 'Very hard',
  guardarEsfuerzo: 'Save',
  origenMedida: 'measured',
  origenDeclarada: 'your call',
  origenEstimada: 'estimated',
};

export function idiomaDelSistema(): Idioma {
  const codigo = getLocales()[0]?.languageCode;
  return codigo === 'es' ? 'es' : 'en';
}

export function textos(idioma: Idioma = idiomaDelSistema()) {
  return idioma === 'es' ? ES : EN;
}

export type Textos = typeof ES;
