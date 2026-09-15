import {
  MAXIMO_MINIMO,
  RESUMEN_VACIO,
  calculaZonas,
  fcMediaDe,
  maximoDeReferencia,
  resumenDePulsos,
  zonasDeResumen,
} from './zonas';

/** Construye muestras con un pulso fijo cada minuto, como las que da Fitbit. */
function muestras(valores: readonly number[], minutosEntre = 1) {
  const base = new Date('2026-08-28T18:00:00Z').getTime();
  return valores.map((valor, i) => ({
    valor,
    inicio: new Date(base + i * minutosEntre * 60000),
    fin: new Date(base + i * minutosEntre * 60000 + 1000),
  }));
}

describe('maximo de referencia', () => {
  it('sale del percentil 99 observado cuando hay historico de sobra', () => {
    // 1000 muestras repartidas de 100 a 195 lpm.
    const pulsos = Array.from({ length: 1000 }, (_, i) => 100 + (i % 96));
    const m = maximoDeReferencia(pulsos);
    expect(m.provisional).toBe(false);
    expect(m.valor).toBeGreaterThan(MAXIMO_MINIMO);
  });

  it('con poco historico se marca provisional y se aplica el suelo', () => {
    // Este es el caso real medido el 28 ago: una semana de datos dio 109,88 lpm de
    // percentil 99, que es imposible como maximo y inflaba todas las intensidades.
    const pulsos = Array.from({ length: 100 }, () => 105);
    const m = maximoDeReferencia(pulsos);
    expect(m.provisional).toBe(true);
    expect(m.valor).toBe(MAXIMO_MINIMO);
    expect(m.observado).toBe(105);
  });

  it('sin muestras devuelve el suelo, no rompe', () => {
    const m = maximoDeReferencia([]);
    expect(m.valor).toBe(MAXIMO_MINIMO);
    expect(m.provisional).toBe(true);
  });

  it('muchas muestras pero todas suaves tambien es provisional', () => {
    // Alguien que solo camina: hay historico, pero su percentil 99 no es su maximo.
    const pulsos = Array.from({ length: 2000 }, () => 110);
    expect(maximoDeReferencia(pulsos).provisional).toBe(true);
  });
});

describe('reparto en zonas', () => {
  const MAX = 190;

  it('un esfuerzo intenso pesa mas que uno suave a igual duracion', () => {
    const suave = calculaZonas(muestras(Array(30).fill(105)), MAX)!;
    const intenso = calculaZonas(muestras(Array(30).fill(170)), MAX)!;
    expect(intenso.trimp).toBeGreaterThan(suave.trimp);
  });

  it('lo que va por debajo del 50 por ciento no cuenta como esfuerzo', () => {
    const paseo = calculaZonas(muestras(Array(30).fill(80)), MAX);
    expect(paseo!.trimp).toBe(0);
  });

  it('la intensidad no depende de la duracion, solo del esfuerzo', () => {
    const corta = calculaZonas(muestras(Array(15).fill(150)), MAX)!;
    const larga = calculaZonas(muestras(Array(60).fill(150)), MAX)!;
    expect(corta.intensidad).toBeCloseTo(larga.intensidad!, 1);
    expect(larga.trimp).toBeGreaterThan(corta.trimp);
  });

  it('una sesion interválica reparte tiempo en varias zonas', () => {
    // Padel: el 40 por ciento es juego efectivo, asi que alterna picos y pausas.
    const picos = Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 170 : 110));
    const z = calculaZonas(muestras(picos), MAX)!;
    const conTiempo = z.segundos.filter((s) => s > 0).length;
    expect(conTiempo).toBeGreaterThan(1);
  });

  it('un hueco largo sin medir no cuenta como esfuerzo sostenido', () => {
    // Dos muestras separadas 30 min: no se pueden contar 30 min de trabajo.
    const z = calculaZonas(muestras([160, 160], 30), MAX)!;
    const total = z.segundos.reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(240);
  });

  it('sin muestras suficientes no se calcula nada', () => {
    expect(calculaZonas(muestras([150]), MAX)).toBeNull();
  });
});

/**
 * El resumen de pulsos (segundos por lpm) es lo que se guarda para no releer HealthKit. Tiene
 * que dar EXACTAMENTE las mismas zonas que las muestras crudas, para cualquier máximo.
 */
describe('resumen de pulsos', () => {
  it('da las mismas zonas que las muestras crudas, con cualquier máximo', () => {
    const m = muestras([120, 130, 150, 165, 178, 182, 140, 110]);
    const r = resumenDePulsos(m);
    for (const maximo of [170, 185, 200]) {
      expect(zonasDeResumen(r, maximo)).toEqual(calculaZonas(m, maximo));
    }
  });

  it('acumula el tiempo por pulso y respeta el tope de hueco', () => {
    // Tres muestras a 150 con 1 min entre ellas y la última de 1 s: 60 + 60 + 1 segundos.
    const r = resumenDePulsos(muestras([150, 150, 150]));
    expect(r.n).toBe(3);
    expect(r.suma).toBe(450);
    expect(r.hist).toEqual([[150, 121]]);
    // Con 20 min entre muestras, cada una cuenta solo el tope de 120 s: el hueco no es esfuerzo.
    const conHueco = resumenDePulsos(muestras([150, 150], 20));
    expect(conHueco.hist).toEqual([[150, 121]]);
  });

  it('redondea el pulso al entero: la resolución del resumen es 1 lpm', () => {
    const r = resumenDePulsos(muestras([149.6, 150.2]));
    expect(r.hist.map(([lpm]) => lpm)).toEqual([150]);
    // Pero la media conserva los decimales de origen antes de redondear.
    expect(fcMediaDe(r)).toBe(150);
  });

  it('sin muestras: resumen vacío, sin zonas y sin media', () => {
    expect(resumenDePulsos([])).toEqual(RESUMEN_VACIO);
    expect(zonasDeResumen(RESUMEN_VACIO, 190)).toBeNull();
    expect(fcMediaDe(RESUMEN_VACIO)).toBeNull();
    // Con una sola muestra tampoco hay zonas: no hay intervalo que repartir.
    expect(zonasDeResumen(resumenDePulsos(muestras([150])), 190)).toBeNull();
  });

  it('un resumen recompuesto desde JSON sigue dando las mismas zonas (es lo que se guarda)', () => {
    const m = muestras([120, 140, 160, 175, 190]);
    const viaje = JSON.parse(JSON.stringify(resumenDePulsos(m)));
    expect(zonasDeResumen(viaje, 190)).toEqual(calculaZonas(m, 190));
  });
});
