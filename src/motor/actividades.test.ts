import { ACTIVIDAD, TIPOS, esTipoDeporte, nombreDeTipo, tipoDe } from './actividades';

/**
 * Tests de la tabla de actividades.
 *
 * ⛔ Nacen de un bug que llego a la pantalla del usuario: el codigo **21 estaba mapeado a
 * ciclismo cuando es GOLF**, asi que la app mostraba *"BIKING, 305,6 min"* de una vuelta de golf.
 * Y peor que el nombre: el MET aplicado era el del deporte equivocado, o sea que **la puntuacion
 * tambien salia mal**.
 *
 * ⚠️ Nada automatico lo detecta, porque un codigo mal traducido produce una sesion perfectamente
 * valida con el deporte equivocado. No hay excepcion ni error de tipos. Estos tests son la unica
 * red: fijan los codigos contra la enumeracion oficial de `HKWorkoutActivityType`, asi que si
 * alguien los vuelve a tocar de memoria, caen.
 */

describe('codigos de HealthKit', () => {
  /**
   * Los que han aparecido en datos reales del usuario. Si alguno cambia, la app volveria a mentir
   * sobre lo que hizo.
   */
  it('fija los codigos vistos en datos reales', () => {
    expect(tipoDe(21)).toBe('GOLF');
    expect(tipoDe(37)).toBe('RUNNING');
    expect(tipoDe(50)).toBe('STRENGTH_TRAINING');
    expect(tipoDe(52)).toBe('WALKING');
    expect(tipoDe(13)).toBe('BIKING');
  });

  it('21 NO es ciclismo: es el bug que vio el usuario', () => {
    expect(tipoDe(21)).not.toBe('BIKING');
  });

  it('el tenis es 48, no 63', () => {
    expect(tipoDe(48)).toBe('TENNIS');
    // 63 es highIntensityIntervalTraining.
    expect(tipoDe(63)).not.toBe('TENNIS');
  });

  it('pilates es 66 y barre 58: son el nicho del producto', () => {
    expect(tipoDe(66)).toBe('PILATES');
    expect(tipoDe(58)).toBe('BARRE');
    // 59 es coreTraining, no pilates.
    expect(tipoDe(59)).not.toBe('PILATES');
  });

  it('un codigo desconocido da null, no un deporte inventado', () => {
    expect(tipoDe(9999)).toBeNull();
    expect(tipoDe(null)).toBeNull();
    expect(tipoDe(undefined)).toBeNull();
  });

  it('todos los codigos son enteros positivos', () => {
    for (const clave of Object.keys(ACTIVIDAD)) {
      const n = Number(clave);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });
});

describe('nombreDeTipo', () => {
  /**
   * ⛔ El otro bug de la misma tarde: se llamaba a `nombreDe`, que espera el CODIGO numerico, con
   * el tipo ya traducido. `Number('BIKING')` da NaN y salia **"Actividad BIKING"** en pantalla.
   */
  it('traduce el tipo del motor, no el codigo', () => {
    expect(nombreDeTipo('GOLF', 'es')).toBe('Golf');
    expect(nombreDeTipo('STRENGTH_TRAINING', 'es')).toBe('Fuerza');
    expect(nombreDeTipo('STRENGTH_TRAINING', 'en')).toBe('Strength');
  });

  it('nunca devuelve el codigo interno en pantalla', () => {
    for (const tipo of Object.values(ACTIVIDAD)) {
      const es = nombreDeTipo(tipo, 'es');
      const en = nombreDeTipo(tipo, 'en');
      // Ni MAYUSCULAS_CON_GUION ni la palabra "Actividad" seguida del codigo.
      expect(es).not.toMatch(/^[A-Z_]+$/);
      expect(en).not.toMatch(/^[A-Z_]+$/);
      expect(es).not.toContain('_');
      expect(en).not.toContain('_');
    }
  });

  it('sin tipo no revienta', () => {
    expect(nombreDeTipo(null, 'es')).toBe('Actividad');
    expect(nombreDeTipo(null, 'en')).toBe('Activity');
  });
});

describe('esTipoDeporte y TIPOS: el corrector de deporte', () => {
  /**
   * ⭐ El corrector existe por un hecho medido (8 sep): Fitbit escribe las pesas en Apple
   * Health como "otro" (codigo 3000) aunque en la app de Fitbit esten guardadas como Pesas.
   * El valor corregido vuelve del almacen como string y esta guarda decide si se aplica.
   */
  it('acepta todos los tipos del motor y rechaza lo demas', () => {
    for (const tipo of TIPOS) {
      expect(esTipoDeporte(tipo)).toBe(true);
    }
    expect(esTipoDeporte('PESAS')).toBe(false); // el nombre humano no es el tipo
    expect(esTipoDeporte('')).toBe(false);
    expect(esTipoDeporte(null)).toBe(false);
    expect(esTipoDeporte(undefined)).toBe(false);
  });

  it('el caso real: la sesion de pesas llega como 3000 y se corrige a fuerza', () => {
    // Lo que escribio Fitbit:
    expect(tipoDe(3000)).toBe('SPORT');
    // Lo que elige la persona en el corrector, validado antes de aplicarse:
    expect(esTipoDeporte('STRENGTH_TRAINING')).toBe(true);
  });

  it('TIPOS cubre todos los nombres, para que el corrector no ofrezca huecos', () => {
    for (const tipo of TIPOS) {
      expect(nombreDeTipo(tipo, 'es')).not.toBe(tipo);
      expect(nombreDeTipo(tipo, 'en')).not.toBe(tipo);
    }
  });
});

describe('la tabla completa (8 sep): lo que escriben Garmin, Whoop y Apple Watch', () => {
  /** Los 84 codigos del enum oficial, sacados de healthkit.generated.ts de kingstinct. */
  const ENUM_COMPLETO = [...Array.from({ length: 80 }, (_, i) => i + 1), 82, 83, 84, 3000];

  it('⭐ cubre el enum ENTERO: ningun codigo real cae a "Actividad N"', () => {
    for (const codigo of ENUM_COMPLETO) {
      expect(tipoDe(codigo)).not.toBeNull();
    }
  });

  it('⛔ el sexto bug: 24 es senderismo y 26 es caza, no al reves', () => {
    expect(tipoDe(24)).toBe('HIKING');
    expect(tipoDe(26)).not.toBe('HIKING');
  });

  it('los deportes nuevos del analisis quedan fijados', () => {
    expect(tipoDe(41)).toBe('SOCCER');
    expect(tipoDe(6)).toBe('BASKETBALL');
    expect(tipoDe(35)).toBe('ROWING');
    expect(tipoDe(9)).toBe('CLIMBING');
    expect(tipoDe(8)).toBe('MARTIAL_ARTS'); // boxeo
    expect(tipoDe(61)).toBe('SKIING');
    expect(tipoDe(39)).toBe('SKATING');
  });

  it('un codigo fuera del enum sigue dando null: 81 no existe y el futuro tampoco se inventa', () => {
    expect(tipoDe(81)).toBeNull();
    expect(tipoDe(85)).toBeNull();
  });
});
