import {
  EFICIENCIA_BUENA,
  FASE,
  OBJETIVO_HORAS,
  PESOS,
  agrupaEnPeriodos,
  agrupaPorDia,
  calculaRegularidad,
  formateaHora,
  procesaSueno,
  puntuaSueno,
  type TramoSueno,
} from './sueno';

/**
 * Tests del motor de sueño.
 *
 * Cubren las tres cosas que ya fallaron una vez en el panel y no pueden volver a fallar:
 * que una siesta no sustituya a la noche, que la hora media sea circular, y que la duración
 * cuente noches en vez de promediarlas.
 */

const H = 3_600_000;
const M = 60_000;

/** Noche con fases, en hora local para que las fechas coincidan con lo que ve el usuario. */
function noche(
  dia: number,
  horaInicio: number,
  horasDormidas: number,
  { minuto = 0, despiertoMin = 0 } = {},
): TramoSueno[] {
  // Antes de las 12 se entiende que la noche empieza ese mismo día; si no, el día anterior.
  const arranque = new Date(2026, 7, dia, horaInicio, minuto).getTime();
  const finDormido = arranque + horasDormidas * H;

  const tramos: TramoSueno[] = [
    { inicio: arranque, fin: arranque + horasDormidas * 0.55 * H, valor: FASE.ligero, fuente: 'Fitbit' },
    {
      inicio: arranque + horasDormidas * 0.55 * H,
      fin: arranque + horasDormidas * 0.8 * H,
      valor: FASE.profundo,
      fuente: 'Fitbit',
    },
    { inicio: arranque + horasDormidas * 0.8 * H, fin: finDormido, valor: FASE.rem, fuente: 'Fitbit' },
  ];

  if (despiertoMin > 0) {
    tramos.push({ inicio: finDormido, fin: finDormido + despiertoMin * M, valor: FASE.despierto, fuente: 'Fitbit' });
  }
  return tramos;
}

describe('agrupaEnPeriodos', () => {
  it('une los tramos contiguos de una noche en un solo periodo', () => {
    const p = agrupaEnPeriodos(noche(25, 0, 7));
    expect(p).toHaveLength(1);
    expect(p[0].dormidoMinutos).toBeCloseTo(420, 0);
    expect(p[0].conFases).toBe(true);
  });

  it('separa la siesta de la noche cuando hay un hueco largo', () => {
    const tarde = new Date(2026, 7, 25, 16, 0).getTime();
    const p = agrupaEnPeriodos([
      ...noche(25, 0, 7),
      { inicio: tarde, fin: tarde + 40 * M, valor: FASE.ligero, fuente: 'Fitbit' },
    ]);
    expect(p).toHaveLength(2);
  });

  it('no cuenta dos veces el tiempo cuando dos fuentes escriben la misma noche', () => {
    const ini = new Date(2026, 7, 25, 0, 0).getTime();
    const p = agrupaEnPeriodos([
      { inicio: ini, fin: ini + 7 * H, valor: FASE.ligero, fuente: 'Fitbit' },
      { inicio: ini, fin: ini + 7 * H, valor: FASE.ligero, fuente: 'iPhone' },
    ]);
    // Sumar duraciones daría 14 h. La unión da 7.
    expect(p[0].dormidoMinutos).toBeCloseTo(420, 0);
    expect(p[0].fuentes).toHaveLength(2);
  });

  it('atribuye la noche a la fecha de DESPERTAR, no a la de acostarse', () => {
    // Se acuesta el 25 a las 23:30 y se levanta el 26.
    const ini = new Date(2026, 7, 25, 23, 30).getTime();
    const p = agrupaEnPeriodos([{ inicio: ini, fin: ini + 7 * H, valor: FASE.ligero }]);
    expect(p[0].fecha).toBe('2026-08-26');
  });
});

describe('agrupaPorDia', () => {
  it('⭐ la sesion mas larga del dia es la noche y el resto son siestas', () => {
    // Es el bug del panel v2: una siesta de 40 min sustituia una noche de 7 h.
    const tarde = new Date(2026, 7, 25, 16, 0).getTime();
    const dias = agrupaPorDia(
      agrupaEnPeriodos([
        ...noche(25, 1, 7),
        { inicio: tarde, fin: tarde + 40 * M, valor: FASE.ligero },
      ]),
    );

    expect(dias).toHaveLength(1);
    expect(dias[0].noche.dormidoMinutos).toBeCloseTo(420, 0);
    expect(dias[0].siestas).toHaveLength(1);
    expect(dias[0].siestaMinutos).toBeCloseTo(40, 0);
    expect(dias[0].totalDormido).toBeCloseTo(460, 0);
  });
});

describe('calculaRegularidad', () => {
  it('no se pronuncia con menos de 3 noches', () => {
    const dias = agrupaPorDia(agrupaEnPeriodos([...noche(25, 1, 7), ...noche(26, 1, 7)]));
    const r = calculaRegularidad(dias);
    expect(r.disponible).toBe(false);
  });

  it('da indice alto con horarios constantes', () => {
    const dias = agrupaPorDia(
      agrupaEnPeriodos([...noche(24, 1, 7), ...noche(25, 1, 7), ...noche(26, 1, 7), ...noche(27, 1, 7)]),
    );
    const r = calculaRegularidad(dias);
    if (!r.disponible) throw new Error('deberia estar disponible');
    expect(r.indice).toBeGreaterThan(90);
    expect(r.sdAcostarseMin).toBeLessThan(10);
  });

  it('baja el indice con horarios dispersos', () => {
    // ⚠️ Las noches van en dias alternos A PROPOSITO. Acostarse el 24 a las 22:00 y el 25 a
    // las 02:00 se SOLAPA (la primera acaba a las 05:00 del 25), asi que el motor las une en
    // un solo periodo, que es lo correcto. Para probar dispersion hacen falta noches que no
    // se pisen y que despierten en fechas distintas.
    const dias = agrupaPorDia(
      agrupaEnPeriodos([...noche(24, 22, 7), ...noche(26, 2, 7), ...noche(27, 23, 7), ...noche(29, 4, 7)]),
    );
    expect(dias).toHaveLength(4);

    const r = calculaRegularidad(dias);
    if (!r.disponible) throw new Error('deberia estar disponible');
    expect(r.indice).toBeLessThan(70);
  });

  it('⭐ la media de horas es CIRCULAR: 23:50 y 00:10 distan 20 min, no 23 h', () => {
    const dias = agrupaPorDia(
      agrupaEnPeriodos([
        ...noche(24, 23, 7, { minuto: 50 }),
        ...noche(26, 0, 7, { minuto: 10 }),
        ...noche(26, 23, 7, { minuto: 50 }),
        ...noche(28, 0, 7, { minuto: 10 }),
      ]),
    );
    const r = calculaRegularidad(dias);
    if (!r.disponible) throw new Error('deberia estar disponible');

    // Una media aritmetica daria las 11:00, la mitad del dia equivocada.
    const hora = Number(r.horaTipicaAcostarse.slice(0, 2));
    expect(hora === 0 || hora === 23).toBe(true);
    expect(r.sdAcostarseMin).toBeLessThan(30);
  });

  it('declara siempre que es una aproximacion y no el SRI del paper', () => {
    const dias = agrupaPorDia(
      agrupaEnPeriodos([...noche(24, 1, 7), ...noche(25, 1, 7), ...noche(26, 1, 7)]),
    );
    const r = calculaRegularidad(dias);
    if (!r.disponible) throw new Error('deberia estar disponible');
    expect(r.aproximado).toBe(true);
  });
});

describe('puntuaSueno', () => {
  it('los pesos suman 100 y son los decididos', () => {
    expect(PESOS.regularidad + PESOS.eficiencia + PESOS.duracion).toBe(100);
    expect(PESOS.regularidad).toBe(45);
    expect(PESOS.eficiencia).toBe(30);
    expect(PESOS.duracion).toBe(25);
  });

  it('⭐ la regularidad pesa mas que la duracion, que es la tesis de la pestaña', () => {
    expect(PESOS.regularidad).toBeGreaterThan(PESOS.duracion);
  });

  it('⭐ la duracion cuenta NOCHES, no promedia', () => {
    // Media de 7,1 h pero la mitad de las noches por debajo de 7. Promediando daria el maximo.
    const dias = agrupaPorDia(
      agrupaEnPeriodos([
        ...noche(24, 1, 9),
        ...noche(25, 1, 5.2),
        ...noche(26, 1, 9),
        ...noche(27, 1, 5.2),
      ]),
    );
    const r = puntuaSueno(dias);
    if (!r.disponible) throw new Error('deberia estar disponible');

    expect(r.mediaHoras).toBeGreaterThan(OBJETIVO_HORAS);
    expect(r.nochesCortas).toBe(2);
    const dur = r.componentes.find((c) => c.clave === 'duracion')!;
    expect(dur.valor).toBe(Math.round(0.5 * PESOS.duracion));
  });

  it('⛔ las fases se informan pero NUNCA puntuan', () => {
    const dias = agrupaPorDia(
      agrupaEnPeriodos([...noche(24, 1, 7), ...noche(25, 1, 7), ...noche(26, 1, 7)]),
    );
    const r = puntuaSueno(dias);
    if (!r.disponible) throw new Error('deberia estar disponible');

    expect(r.fases).not.toBeNull();
    expect(r.fases!.puntua).toBe(false);
    // La suma de los tres componentes es el total: no hay un cuarto sumando oculto.
    expect(r.componentes.reduce((a, c) => a + c.valor, 0)).toBe(r.puntos);
    expect(r.componentes.map((c) => c.clave)).toEqual(['regularidad', 'eficiencia', 'duracion']);
  });

  it('la puntuacion nunca pasa de 100 ni baja de 0', () => {
    const dias = agrupaPorDia(
      agrupaEnPeriodos([...noche(24, 1, 8), ...noche(25, 1, 8), ...noche(26, 1, 8), ...noche(27, 1, 8)]),
    );
    const r = puntuaSueno(dias);
    if (!r.disponible) throw new Error('deberia estar disponible');
    expect(r.puntos).toBeGreaterThanOrEqual(0);
    expect(r.puntos).toBeLessThanOrEqual(100);
  });

  it('la eficiencia se reescala en 85-100, donde la pulsera distingue', () => {
    // Con 30 min despierto sobre 7 h la eficiencia ronda el 93 %: ni 0 ni el maximo.
    const dias = agrupaPorDia(
      agrupaEnPeriodos([
        ...noche(24, 1, 7, { despiertoMin: 30 }),
        ...noche(25, 1, 7, { despiertoMin: 30 }),
        ...noche(26, 1, 7, { despiertoMin: 30 }),
      ]),
    );
    const r = puntuaSueno(dias);
    if (!r.disponible) throw new Error('deberia estar disponible');

    expect(r.eficienciaMedia).not.toBeNull();
    expect(r.eficienciaMedia!).toBeGreaterThan(EFICIENCIA_BUENA);
    const ef = r.componentes.find((c) => c.clave === 'eficiencia')!;
    expect(ef.valor).toBeGreaterThan(0);
    expect(ef.valor).toBeLessThan(PESOS.eficiencia);
  });

  it('sin noches no se inventa una puntuacion', () => {
    expect(puntuaSueno([]).disponible).toBe(false);
    expect(procesaSueno([]).resumen.disponible).toBe(false);
  });
});

describe('formateaHora', () => {
  it('formatea minutos desde medianoche', () => {
    expect(formateaHora(0)).toBe('00:00');
    expect(formateaHora(113)).toBe('01:53');
    expect(formateaHora(1439)).toBe('23:59');
  });

  it('da la vuelta al pasar de medianoche en vez de romperse', () => {
    expect(formateaHora(1445)).toBe('00:05');
    expect(formateaHora(-10)).toBe('23:50');
  });

  // ⛔ Hermes no implementa Intl.PluralRules y el crash del 31 ago vino de ahi. Los tests
  // corren en Node, que si tiene Intl completo, asi que se comprueba la IMPLEMENTACION.
  it('no usa Intl, que es lo que revento la app en el iPhone', () => {
    expect(formateaHora.toString()).not.toContain('Intl');
  });
});
