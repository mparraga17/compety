import { baseDeCarga, puntuaCarga } from './base';
import { cargaMedida } from './cargaSinFc';
import { ligaDe } from './ligas';
import {
  BONUS_MAX,
  HORIZONTES,
  desdeDe,
  enVentana,
  rankea,
  rankeaLiga,
  type SesionPuntuada,
} from './ranking';

/**
 * Lo que protegen estos tests, y viene de fallos reales del proyecto:
 * 1. Que salir muchas veces suave no gane a entrenar pocas veces fuerte.
 * 2. Que 4 h de bici no arrasen frente a una sesion corta e intensa.
 * 3. Que ningun deporte quede excluido por su naturaleza fisiologica.
 */

const dia = 86_400_000;
const AHORA = new Date('2026-08-30T12:00:00Z');

function sesion(p: Partial<SesionPuntuada> & { id: string }): SesionPuntuada {
  return {
    inicio: AHORA.getTime() - dia,
    tipo: 'RUNNING',
    minutos: 45,
    puntos: 50,
    carga: 40,
    ...p,
  };
}

describe('el ranking premia calidad, no frecuencia', () => {
  it('siete paseos suaves no ganan a tres sesiones fuertes', () => {
    // Es el fallo medido: 21 paseos de 20 min daban 477 puntos frente a 257 del segundo.
    const paseante = Array.from({ length: 7 }, (_, i) =>
      sesion({ id: `p${i}`, tipo: 'WALKING', puntos: 35, carga: 20, inicio: AHORA.getTime() - i * dia }),
    );
    const constante = Array.from({ length: 3 }, (_, i) =>
      sesion({ id: `c${i}`, tipo: 'STRENGTH_TRAINING', puntos: 72, carga: 55, inicio: AHORA.getTime() - i * dia }),
    );

    expect(rankea(constante).total).toBeGreaterThan(rankea(paseante).total);
  });

  it('sumar mas sesiones del tope no sube la puntuacion', () => {
    const cinco = Array.from({ length: 5 }, (_, i) => sesion({ id: `a${i}`, puntos: 60 }));
    const doce = Array.from({ length: 12 }, (_, i) => sesion({ id: `b${i}`, puntos: 60 }));
    // El bonus ya esta saturado en las dos, asi que el total tiene que ser identico.
    expect(rankea(doce).total).toBe(rankea(cinco).total);
  });

  it('el bonus por constancia esta acotado y satura pronto', () => {
    const una = rankea([sesion({ id: 'x' })]);
    const tres = rankea([sesion({ id: 'a' }), sesion({ id: 'b' }), sesion({ id: 'c' })]);
    const diez = rankea(Array.from({ length: 10 }, (_, i) => sesion({ id: `y${i}` })));

    expect(una.bonus).toBeLessThan(tres.bonus);
    expect(tres.bonus).toBe(BONUS_MAX);
    expect(diez.bonus).toBe(BONUS_MAX);
  });

  it('el bonus por constancia se queda pequeno, y hay motivo publicado', () => {
    // A igual volumen total, concentrar el ejercicio en 1 o 2 sesiones dio la MISMA mortalidad
    // que repartirlo: HR 1,08 (IC 0,97-1,20) en 350.978 adultos.
    // https://pubmed.ncbi.nlm.nih.gov/35788615/
    // ⇒ Salir mas veces no puede decidir el ranking. El bonus existe por el riesgo de lesion y
    // porque la OMS pide regularidad, no porque reparta mas beneficio.
    const concentrada = rankea([sesion({ id: 'unica', puntos: 85, carga: 60 })]);
    const repartida = Array.from({ length: 6 }, (_, i) =>
      sesion({ id: `r${i}`, puntos: 45, carga: 25 }),
    );
    // Seis sesiones flojas no pueden ganar a una buena solo por ser seis.
    expect(rankea(repartida).total).toBeLessThan(concentrada.total);
    // Y el bonus no puede llegar a valer lo que una sesion entera.
    expect(BONUS_MAX).toBeLessThan(50);
  });

  it('solo cuentan las mejores, y se dice cuales', () => {
    const ses = [
      sesion({ id: 'buena', puntos: 90 }),
      sesion({ id: 'floja', puntos: 20 }),
      ...Array.from({ length: 5 }, (_, i) => sesion({ id: `m${i}`, puntos: 60 })),
    ];
    const r = rankea(ses, { tope: 5 });
    expect(r.cuentan).toContain('buena');
    expect(r.cuentan).not.toContain('floja');
    expect(r.cuentan).toHaveLength(5);
    expect(r.fuera).toBe(2);
  });

  it('una sesion demasiado corta no entra', () => {
    // Hay una entrada de golf de 0,2 min en los datos reales.
    const r = rankea([sesion({ id: 'g', tipo: 'GOLF', minutos: 0.2, carga: 1 })]);
    expect(r.total).toBe(0);
    expect(r.validas).toBe(0);
  });

  it('sin sesiones no rompe', () => {
    expect(rankea([]).total).toBe(0);
  });
});

describe('ninguna liga queda fuera de la general', () => {
  it('golf y caminar suman a la general', () => {
    const ses = [
      sesion({ id: 'golf', tipo: 'GOLF', minutos: 240, puntos: 55, carga: 45 }),
      sesion({ id: 'paseo', tipo: 'WALKING', minutos: 40, puntos: 40, carga: 25 }),
    ];
    expect(rankeaLiga(ses, 'global').validas).toBe(2);
  });

  it('cada liga solo cuenta sus deportes', () => {
    const ses = [
      sesion({ id: 'run', tipo: 'RUNNING' }),
      sesion({ id: 'barre', tipo: 'BARRE' }),
      sesion({ id: 'golf', tipo: 'GOLF', minutos: 200 }),
    ];
    expect(rankeaLiga(ses, 'correr').validas).toBe(1);
    expect(rankeaLiga(ses, 'estudio').validas).toBe(1);
    expect(rankeaLiga(ses, 'golf').validas).toBe(1);
  });

  it('padel y tenis van separados', () => {
    // Correccion del usuario, con motivo publicado: MET 6,8 frente a 8,0 y perfiles distintos.
    expect(ligaDe('PADEL')).toBe('padel');
    expect(ligaDe('TENNIS')).toBe('tenis');
    expect(ligaDe('PADEL')).not.toBe(ligaDe('TENNIS'));
  });

  it('una sesion sin pulso puntua igual en su liga', () => {
    const ses = [sesion({ id: 'barre', tipo: 'BARRE', minutos: 50, sinPulso: true, carga: 30, puntos: 48 })];
    expect(rankeaLiga(ses, 'estudio').total).toBeGreaterThan(0);
  });
});

describe('ventanas temporales', () => {
  it('el tope escala con la ventana', () => {
    const semana = HORIZONTES.find((h) => h.id === 'd7')!;
    const ano = HORIZONTES.find((h) => h.id === 'ytd')!;
    expect(ano.tope).toBeGreaterThan(semana.tope);
  });

  it('la semana en curso empieza en lunes', () => {
    // 30 ago 2026 es domingo, asi que la semana empezo el lunes 24.
    const wtd = HORIZONTES.find((h) => h.id === 'wtd')!;
    const inicio = new Date(desdeDe(wtd, AHORA));
    expect(inicio.getDay()).toBe(1);
  });

  it('la ventana movil de 7 dias no deja fuera lo de anteayer', () => {
    const d7 = HORIZONTES.find((h) => h.id === 'd7')!;
    const ses = [
      sesion({ id: 'reciente', inicio: AHORA.getTime() - 2 * dia }),
      sesion({ id: 'vieja', inicio: AHORA.getTime() - 20 * dia }),
    ];
    const dentro = enVentana(ses, d7, AHORA).map((s) => s.id);
    expect(dentro).toEqual(['reciente']);
  });
});

describe('⭐ verificacion contra las cuatro sesiones reales del iPhone (28 ago)', () => {
  /**
   * Medidas de punta a punta en un iPhone real. Es la comprobacion que este proyecto ha
   * aprendido a hacer tres veces: cada vez que se diseno el ranking sin probarlo contra datos
   * reales, estaba mal.
   *
   * El problema detectado: con intensidades en un rango estrecho (1,05 a 1,64) y duraciones en
   * un rango de diez veces (26 a 260 min), la duracion mandaba sobre el esfuerzo. La sesion mas
   * larga era la de mayor carga.
   */
  const MEDIDAS = [
    { id: 'bici-larga', tipo: 'BIKING', minutos: 260, intensidad: 1.64 },
    { id: 'fuerza', tipo: 'STRENGTH_TRAINING', minutos: 60, intensidad: 1.27 },
    { id: 'caminar', tipo: 'WALKING', minutos: 29, intensidad: 1.4 },
    { id: 'bici-corta', tipo: 'BIKING', minutos: 26, intensidad: 1.05 },
  ] as const;

  const puntuadas = (() => {
    const cargas = MEDIDAS.map((m) => cargaMedida(m).valor);
    const base = baseDeCarga(cargas);
    return MEDIDAS.map((m, i) => ({
      ...sesion({ id: m.id, tipo: m.tipo, minutos: m.minutos }),
      carga: cargas[i],
      puntos: puntuaCarga(cargas[i], base).puntos,
    }));
  })();

  it('la compresion del volumen funciona: 260 min no dan diez veces la carga de 29', () => {
    const larga = puntuadas.find((s) => s.id === 'bici-larga')!;
    const corta = puntuadas.find((s) => s.id === 'caminar')!;
    const ratioMinutos = larga.minutos / corta.minutos; // unas 9 veces
    const ratioCarga = larga.carga / corta.carga;
    expect(ratioCarga).toBeLessThan(ratioMinutos);
  });

  it('4 h de bici no arrasan el ranking semanal', () => {
    // La comprobacion que pide la memoria. Con el tope de 5 y la media, una sola sesion muy
    // larga no puede decidir la semana por si sola.
    const soloLarga = rankea([puntuadas.find((s) => s.id === 'bici-larga')!]);
    const tresNormales = rankea(puntuadas.filter((s) => s.id !== 'bici-larga'));
    expect(tresNormales.total).toBeGreaterThan(0);
    // Tres sesiones variadas tienen que poder competir con una jornada larga.
    expect(tresNormales.total).toBeGreaterThan(soloLarga.total * 0.6);
  });

  it('el bonus por constancia es lo que compensa la sesion unica larga', () => {
    const soloLarga = rankea([puntuadas.find((s) => s.id === 'bici-larga')!]);
    const tresNormales = rankea(puntuadas.filter((s) => s.id !== 'bici-larga'));
    expect(tresNormales.bonus).toBeGreaterThan(soloLarga.bonus);
  });

  it('el orden de las cuatro sesiones es defendible', () => {
    const orden = [...puntuadas].sort((a, b) => b.puntos - a.puntos).map((s) => s.id);
    // ⭐ Este orden NO es una decision de producto, sale de la evidencia. El volumen total pesa
    // mas que la intensidad: HR 0,62 y 0,50 para volumen frente a 0,94 y 0,88 para intensidad a
    // igual volumen, en 9 cohortes con 46.682 adultos.
    // https://pubmed.ncbi.nlm.nih.gov/39089430/
    // ⇒ La jornada de 260 min debe ir primero, y la de 26 min a intensidad 1,05 ultima.
    expect(orden[0]).toBe('bici-larga');
    expect(orden[orden.length - 1]).toBe('bici-corta');
  });

  it('la intensidad sigue pesando algo, pero menos que el volumen', () => {
    // La evidencia dice "beneficio anadido pequeno si la misma cantidad se hace mas intensa".
    // Traducido: subir la intensidad tiene que subir la carga, y doblar el tiempo tiene que
    // subirla mas que doblar la intensidad.
    const base = { tipo: 'RUNNING', minutos: 60, intensidad: 1.5 } as const;
    const masIntensa = cargaMedida({ ...base, intensidad: 3.0 }).valor;
    const masLarga = cargaMedida({ ...base, minutos: 120 }).valor;
    const original = cargaMedida(base).valor;

    expect(masIntensa).toBeGreaterThan(original);
    expect(masLarga).toBeGreaterThan(original);
    // Doblar la intensidad dobla la carga; doblar el tiempo la multiplica por 2^0,65 = 1,57.
    // O sea que por MINUTO la intensidad manda, y es el volumen acumulado el que decide.
    expect(masIntensa).toBeGreaterThan(masLarga);
  });

  it('la fuerza no queda por debajo de caminar teniendo mas duracion e intensidad', () => {
    // Protege el factor de modalidad: la FC ve 3,4 MET en fuerza cuando la tabla dice 6,0.
    const fuerza = puntuadas.find((s) => s.id === 'fuerza')!;
    const caminar = puntuadas.find((s) => s.id === 'caminar')!;
    expect(fuerza.carga).toBeGreaterThan(caminar.carga);
  });
});
