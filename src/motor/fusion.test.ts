import { UMBRAL_SOLAPE, agrupa, deduplica, esWearable, fusiona, type SesionCruda } from './fusion';

/**
 * Tests de la deduplicación entre fuentes. Es el módulo que evita contar un entreno dos veces
 * cuando la pulsera y una app (o dos pulseras) lo escriben a la vez en HealthKit, y hasta hoy
 * era el único central del motor sin un solo test. Un duplicado infla el ranking de quien lo
 * sufre Y su base personal, así que aquí se juega la equidad de la liga.
 */

const MIN = 60_000;
/** Un instante cualquiera. Los tests trabajan con desplazamientos relativos. */
const T0 = new Date(2026, 8, 14, 18, 0).getTime();

function sesion(p: Partial<SesionCruda> & { id: string }): SesionCruda {
  const inicio = p.inicio ?? T0;
  const fin = p.fin ?? inicio + 45 * MIN;
  return {
    tipo: 'RUNNING',
    fuente: 'Nike Run Club',
    inicio,
    fin,
    segundos: (fin - inicio) / 1000,
    pulsos: [],
    ...p,
  };
}

/** Pulsos de relleno: lo que importa es que haya, no cuántos. */
function conPulsos(n = 10): SesionCruda['pulsos'] {
  return Array.from({ length: n }, (_, i) => ({
    valor: 140 + i,
    inicio: new Date(T0 + i * MIN),
    fin: new Date(T0 + i * MIN),
  }));
}

describe('esWearable', () => {
  it('reconoce las marcas con sensor propio y nada más', () => {
    for (const f of ['Fitbit', 'Google Fitbit Air', 'Garmin Connect', 'WHOOP', 'Apple Watch', 'Oura', 'Polar Flow']) {
      expect(esWearable(f)).toBe(true);
    }
    for (const f of ['Nike Run Club', 'Strava', 'Peloton', 'Salud', '', null, undefined]) {
      expect(esWearable(f)).toBe(false);
    }
  });
});

describe('agrupa: qué es la misma sesión', () => {
  it('dos registros del mismo entreno que solapan casi al 100 % van juntos', () => {
    // El caso medido: 5 carreras de Nike solapaban al 98-100 % con la pulsera.
    const grupos = agrupa([
      sesion({ id: 'nike' }),
      sesion({ id: 'fitbit', fuente: 'Fitbit', inicio: T0 + MIN, fin: T0 + 45 * MIN, pulsos: conPulsos() }),
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].map((s) => s.id).sort()).toEqual(['fitbit', 'nike']);
  });

  it('es N:1 y transitivo: Nike parte la carrera en dos y la pulsera la ve entera', () => {
    // Los dos trozos de Nike no se solapan entre sí; los une la pulsera. Comparar por pares
    // habría dejado un trozo suelto, que es el bug que costó la unión-búsqueda.
    const grupos = agrupa([
      sesion({ id: 'nike-1', inicio: T0, fin: T0 + 20 * MIN }),
      sesion({ id: 'nike-2', inicio: T0 + 25 * MIN, fin: T0 + 45 * MIN }),
      sesion({ id: 'fitbit', fuente: 'Fitbit', inicio: T0, fin: T0 + 45 * MIN, pulsos: conPulsos() }),
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]).toHaveLength(3);
  });

  it('dos sesiones seguidas que apenas se rozan son dos sesiones', () => {
    // Calentamiento y sesión, con 5 min de solape sobre 30: un 17 %, por debajo del umbral.
    const grupos = agrupa([
      sesion({ id: 'a', inicio: T0, fin: T0 + 30 * MIN }),
      sesion({ id: 'b', inicio: T0 + 25 * MIN, fin: T0 + 70 * MIN }),
    ]);
    expect(grupos).toHaveLength(2);
  });

  it('el umbral se mide sobre la MÁS CORTA, así que un tramo parcial sí se une al total', () => {
    // 10 min de Nike dentro de 60 de pulsera: 10/60 sería un 17 % sobre la larga, pero es el
    // 100 % de la corta. Es un tramo de la misma sesión, y así se trata.
    const grupos = agrupa([
      sesion({ id: 'tramo', inicio: T0 + 20 * MIN, fin: T0 + 30 * MIN }),
      sesion({ id: 'entera', fuente: 'Fitbit', inicio: T0, fin: T0 + 60 * MIN }),
    ]);
    expect(grupos).toHaveLength(1);
    expect(UMBRAL_SOLAPE).toBe(0.5);
  });

  it('deportes DISTINTOS y concretos no se mezclan aunque solapen', () => {
    // Un registro de bici y otro de carrera a la misma hora no son el mismo entreno: alguien
    // ha etiquetado mal, y fusionarlos borraría una de las dos actividades.
    const grupos = agrupa([
      sesion({ id: 'correr', tipo: 'RUNNING' }),
      sesion({ id: 'bici', tipo: 'BIKING', fuente: 'Strava' }),
    ]);
    expect(grupos).toHaveLength(2);
  });

  it('una sesión de duración cero no rompe nada ni se une a nadie', () => {
    const grupos = agrupa([
      sesion({ id: 'vacia', inicio: T0, fin: T0 }),
      sesion({ id: 'normal', inicio: T0, fin: T0 + 30 * MIN }),
    ]);
    expect(grupos).toHaveLength(2);
  });
});

/**
 * ⛔⛔ El escape de tipos, reproducido.
 *
 * El puente de Fitbit escribe las pesas en Apple Health como "otro" (código 3000 → 'SPORT'),
 * y el Apple Watch las escribe como 'STRENGTH_TRAINING' (50). Es el MISMO entreno, pero la regla
 * exigía tipo idéntico, así que no se agrupaban: contaba dos veces en el ranking y contaminaba
 * la base personal. Y la corrección manual del deporte llega DESPUÉS de deduplicar, así que no
 * lo reparaba. 'SPORT' y null no son deportes: son "no sé qué deporte era", y eso no puede
 * impedir reconocer un solape del 90 % como lo que es.
 */
describe('tipos genéricos: "otro" no impide reconocer la misma sesión', () => {
  const fitbitOtro = sesion({
    id: 'fitbit',
    tipo: 'SPORT',
    fuente: 'Fitbit',
    inicio: T0,
    fin: T0 + 50 * MIN,
    pulsos: conPulsos(),
  });
  const watchPesas = sesion({
    id: 'watch',
    tipo: 'STRENGTH_TRAINING',
    fuente: 'Apple Watch',
    inicio: T0 + 2 * MIN,
    fin: T0 + 48 * MIN,
    pulsos: conPulsos(8),
  });

  it('Fitbit "otro" + Watch "fuerza" a la misma hora es UNA sesión, y de fuerza', () => {
    const [f] = deduplica([fitbitOtro, watchPesas]);
    expect(deduplica([fitbitOtro, watchPesas])).toHaveLength(1);
    expect(f.fusionada).toBe(true);
    // El deporte concreto manda sobre el genérico: el MET, el descuento y la liga salen de él.
    expect(f.tipo).toBe('STRENGTH_TRAINING');
    expect([...f.ids].sort()).toEqual(['fitbit', 'watch']);
  });

  it('un tipo desconocido (null) tampoco bloquea la fusión, y el concreto gana', () => {
    const sinTipo = sesion({ id: 'x', tipo: null, fuente: 'Salud' });
    const [f] = deduplica([sinTipo, sesion({ id: 'y', tipo: 'YOGA', fuente: 'Peloton' })]);
    expect(f.tipo).toBe('YOGA');
    expect(f.ids).toHaveLength(2);
  });

  it('dos registros genéricos de la misma hora siguen siendo uno (y siguen siendo genéricos)', () => {
    const [f] = deduplica([fitbitOtro, sesion({ id: 'otro2', tipo: 'SPORT', fuente: 'Salud' })]);
    expect(f.tipo).toBe('SPORT');
    expect(f.ids).toHaveLength(2);
  });

  it('el genérico no hace de puente entre dos deportes concretos distintos', () => {
    // Si un "otro" solapa con una carrera Y con una bici, hay algo mal etiquetado. Se prefiere
    // el concreto de la sesión más larga, que es la que vio el entreno entero, y nunca se
    // inventa un tercer tipo.
    const [f] = deduplica([
      sesion({ id: 'otro', tipo: 'SPORT', fuente: 'Salud', inicio: T0, fin: T0 + 60 * MIN }),
      sesion({ id: 'correr', tipo: 'RUNNING', inicio: T0, fin: T0 + 50 * MIN }),
      sesion({ id: 'bici', tipo: 'BIKING', fuente: 'Strava', inicio: T0 + 30 * MIN, fin: T0 + 60 * MIN }),
    ]);
    expect(f.tipo).toBe('RUNNING');
  });
});

describe('fusiona: cada campo lo aporta quien lo mide mejor', () => {
  const nike = sesion({ id: 'nike', metros: 4130, ritmo: 0.36, pasos: null, kcal: 320 });
  const fitbit = sesion({
    id: 'fitbit',
    fuente: 'Fitbit',
    inicio: T0 + MIN,
    fin: T0 + 46 * MIN,
    pulsos: conPulsos(),
    metros: 3900,
    pasos: 5200,
    kcal: 350,
  });

  it('una sola sesión sale tal cual, marcada como no fusionada', () => {
    const f = fusiona([nike]);
    expect(f.fusionada).toBe(false);
    expect(f.fuentes).toEqual(['Nike Run Club']);
    expect(f.ids).toEqual(['nike']);
    expect(f.tipo).toBe('RUNNING');
  });

  it('el corazón lo pone el wearable, la distancia es el máximo y el ritmo el del GPS', () => {
    const f = fusiona([nike, fitbit]);
    expect(f.pulsos).toBe(fitbit.pulsos);
    expect(f.metros).toBe(4130);
    // Nike tiene la distancia ganadora, así que su ritmo es del recorrido entero y se respeta.
    expect(f.ritmo).toBe(0.36);
    expect([...f.fuentes].sort()).toEqual(['Fitbit', 'Nike Run Club']);
    expect(f.fusionada).toBe(true);
  });

  it('el ritmo se recalcula cuando el GPS solo vio un tramo', () => {
    // Visto real: tomar el ritmo de Nike daba 2,09 km cuando eran 4,13. Si la distancia de la
    // fuente con GPS NO es la ganadora, su ritmo es parcial y se recalcula sobre el total.
    const tramo = sesion({ id: 'nike', inicio: T0, fin: T0 + 20 * MIN, metros: 2090, ritmo: 0.5 });
    const entera = sesion({ id: 'fitbit', fuente: 'Fitbit', pulsos: conPulsos(), metros: 4130 });
    const f = fusiona([tramo, entera]);
    expect(f.metros).toBe(4130);
    expect(f.ritmo).toBeCloseTo((45 * 60) / 4130, 4);
  });

  it('la duración es la MAYOR, no la suma: sumar duplicaría el tiempo solapado', () => {
    const f = fusiona([nike, fitbit]);
    expect(f.inicio).toBe(T0);
    expect(f.fin).toBe(T0 + 46 * MIN);
    expect(f.segundos).toBe(45 * 60);
  });

  it('pasos y calorías: los del corazón, y si no los tiene, los de quien los tenga', () => {
    const f = fusiona([nike, fitbit]);
    expect(f.pasos).toBe(5200);
    expect(f.kcal).toBe(350); // El corazón (Fitbit) los trae.
    const sinKcalEnWearable = fusiona([nike, { ...fitbit, kcal: null }]);
    expect(sinKcalEnWearable.kcal).toBe(320); // Se toman de Nike.
  });

  it('sin wearable, el corazón es quien tenga pulso; sin pulso, el primero', () => {
    const conPulso = sesion({ id: 'b', fuente: 'Strava', inicio: T0 + MIN, pulsos: conPulsos(3) });
    expect(fusiona([nike, conPulso]).pulsos).toBe(conPulso.pulsos);
    expect(fusiona([nike, sesion({ id: 'c', fuente: 'Salud', inicio: T0 + MIN })]).id).toBe('nike');
  });
});

/**
 * ⛔ Entrenos tecleados a mano en Salud (`HKWasUserEntered`). Regla de producto (15 sep): un
 * manual cuenta SOLO cuando ningún dispositivo grabó ese rato. Sin ella, teclear "3 h de carrera"
 * encima de una carrera real de 45 min la fusionaba (mismo tipo) y `segundos = max` la convertía
 * en 3 h con la intensidad REAL del pulso: el camino más barato para inflar la puntuación.
 */
describe('entrenos a mano', () => {
  const real = sesion({
    id: 'fitbit',
    fuente: 'Fitbit',
    inicio: T0,
    fin: T0 + 45 * MIN,
    pulsos: conPulsos(),
    metros: 8000,
  });
  const tecleada = sesion({
    id: 'salud',
    fuente: 'Salud',
    manual: true,
    inicio: T0 - 30 * MIN,
    fin: T0 + 150 * MIN, // "3 h", encima de la real.
    metros: 30000,
  });

  it('un manual encima de un registro real no alarga, no suma distancia y no cambia nada', () => {
    const [f] = deduplica([real, tecleada]);
    expect(deduplica([real, tecleada])).toHaveLength(1);
    expect(f.manual).toBe(false);
    expect(f.inicio).toBe(T0);
    expect(f.fin).toBe(T0 + 45 * MIN);
    expect(f.segundos).toBe(45 * 60);
    expect(f.metros).toBe(8000);
    expect(f.pulsos).toBe(real.pulsos);
    // Pero queda constancia: su id no vuelve a tratarse y su fuente se ve.
    expect([...f.ids].sort()).toEqual(['fitbit', 'salud']);
    expect([...f.fuentes].sort()).toEqual(['Fitbit', 'Salud']);
    expect(f.fusionada).toBe(true);
  });

  it('un manual solo sí cuenta, y se marca como manual', () => {
    const [f] = deduplica([tecleada]);
    expect(f.manual).toBe(true);
    expect(f.fusionada).toBe(false);
    expect(f.segundos).toBe(180 * 60);
  });

  it('dos manuales solapados se fusionan entre sí como cualquier par, y siguen siendo manuales', () => {
    const otra = sesion({ id: 'salud-2', fuente: 'Salud', manual: true, inicio: T0, fin: T0 + 60 * MIN });
    const [f] = deduplica([tecleada, otra]);
    expect(f.manual).toBe(true);
    expect(f.ids).toHaveLength(2);
  });

  it('el manual tampoco decide el tipo cuando hay registro real', () => {
    // Fitbit lo grabó como "otro" y la persona tecleó "correr" encima: el tipo concreto del
    // manual NO se impone. Mejor un "otro" corregible a mano que un tipo dictado por quien
    // podría estar inflando.
    const otro = sesion({ id: 'fitbit', tipo: 'SPORT', fuente: 'Fitbit', pulsos: conPulsos() });
    const [f] = deduplica([otro, sesion({ id: 'salud', tipo: 'RUNNING', fuente: 'Salud', manual: true })]);
    expect(f.tipo).toBe('SPORT');
  });
});

describe('deduplica', () => {
  it('devuelve de la más reciente a la más antigua', () => {
    const r = deduplica([
      sesion({ id: 'ayer', inicio: T0 - 24 * 60 * MIN, fin: T0 - 23 * 60 * MIN }),
      sesion({ id: 'hoy' }),
    ]);
    expect(r.map((s) => s.id)).toEqual(['hoy', 'ayer']);
  });

  it('con una lista vacía devuelve una lista vacía', () => {
    expect(deduplica([])).toEqual([]);
  });
});
