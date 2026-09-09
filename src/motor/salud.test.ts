import {
  AGREGACION,
  DIAS_MINIMOS_BANDA,
  METRICAS,
  agrupa,
  banda,
  estadoDe,
  procesaMetrica,
  procesaSalud,
  tendencia,
  type Muestra,
} from './salud';
import { FACTOR_VIGOROSA, OBJETIVO_MINUTOS, calculaOms } from './oms';
import type { Zonas } from './zonas';

/**
 * Tests del motor de salud.
 *
 * El más importante es el de `mejorSubir`: sin él la app pintaría de rojo una mejora, porque en
 * el HRV subir es bueno y en el pulso en reposo es malo.
 */

const H = 3_600_000;
const DIA = 86_400_000;

/** Muestras de un valor por día, hacia atrás desde una fecha fija. */
function serieDiaria(valores: readonly number[], desde = new Date(2026, 7, 1)): Muestra[] {
  return valores.map((valor, i) => ({
    inicio: desde.getTime() + i * DIA,
    valor,
  }));
}

describe('banda', () => {
  it('no se pronuncia con pocos días: la sigma sería ruido', () => {
    expect(banda([50, 55])).toBeNull();
    expect(banda(Array.from({ length: DIAS_MINIMOS_BANDA - 1 }, () => 50))).toBeNull();
  });

  it('calcula media y sigma con días suficientes', () => {
    const b = banda([10, 20, 30, 40, 50]);
    expect(b).not.toBeNull();
    expect(b!.media).toBe(30);
    expect(b!.sigma).toBeCloseTo(14.14, 1);
    expect(b!.n).toBe(5);
  });
});

describe('estadoDe', () => {
  const b = { media: 50, sigma: 10, n: 30 };

  it('dentro de una sigma es "dentro", en cualquier métrica', () => {
    expect(estadoDe(50, b, true)).toBe('dentro');
    expect(estadoDe(59, b, true)).toBe('dentro');
    expect(estadoDe(41, b, false)).toBe('dentro');
  });

  it('⭐ subir es MEJOR en HRV y PEOR en pulso en reposo', () => {
    // Es el test que evita pintar de rojo una mejora.
    expect(estadoDe(70, b, true)).toBe('mejor');
    expect(estadoDe(70, b, false)).toBe('peor');
    expect(estadoDe(30, b, true)).toBe('peor');
    expect(estadoDe(30, b, false)).toBe('mejor');
  });

  it('sin banda no se afirma nada', () => {
    expect(estadoDe(50, null, true)).toBe('sin-banda');
    expect(estadoDe(50, { media: 50, sigma: 0, n: 9 }, true)).toBe('sin-banda');
  });
});

describe('agrupa', () => {
  it('⭐ los pasos del día se SUMAN, porque llegan en tramos', () => {
    const base = new Date(2026, 7, 1, 8, 0).getTime();
    const muestras: Muestra[] = [
      { inicio: base, valor: 2000 },
      { inicio: base + 2 * H, valor: 3000 },
      { inicio: base + 5 * H, valor: 1500 },
    ];
    const p = agrupa(muestras, 'suma', 0);
    expect(p).toHaveLength(1);
    expect(p[0].valor).toBe(6500);
  });

  it('las lecturas del mismo dato se PROMEDIAN', () => {
    const base = new Date(2026, 7, 1, 8, 0).getTime();
    const p = agrupa(
      [
        { inicio: base, valor: 50 },
        { inicio: base + H, valor: 60 },
      ],
      'media',
      0,
    );
    expect(p[0].valor).toBe(55);
  });

  it('el VO2max se queda con el último del día, porque se recalcula', () => {
    const base = new Date(2026, 7, 1, 8, 0).getTime();
    const p = agrupa(
      [
        { inicio: base, valor: 52 },
        { inicio: base + H, valor: 54 },
      ],
      'ultimo',
      1,
    );
    expect(p[0].valor).toBe(54);
  });

  it('separa los días y los devuelve en orden', () => {
    const p = agrupa(serieDiaria([1, 2, 3]), 'media', 0);
    expect(p).toHaveLength(3);
    expect(p.map((x) => x.valor)).toEqual([1, 2, 3]);
    expect(p[0].dia < p[2].dia).toBe(true);
  });

  it('cada métrica declara cómo se agrega', () => {
    for (const m of METRICAS) {
      expect(AGREGACION[m.clave]).toBeDefined();
    }
    expect(AGREGACION.pasos).toBe('suma');
    expect(AGREGACION.fcReposo).toBe('media');
  });
});

describe('tendencia', () => {
  it('no se pronuncia con pocos días', () => {
    expect(tendencia(agrupa(serieDiaria([50, 51, 52]), 'media', 0))).toBeNull();
  });

  it('detecta una subida comparando mitades', () => {
    const t = tendencia(agrupa(serieDiaria([50, 50, 50, 50, 60, 60, 60, 60]), 'media', 0));
    expect(t).not.toBeNull();
    expect(t!.delta).toBeCloseTo(10, 1);
    expect(t!.pct).toBeCloseTo(20, 1);
  });
});

describe('procesaMetrica', () => {
  const definicion = METRICAS.find((m) => m.clave === 'fcReposo')!;

  it('declara no disponible cuando no hay muestras', () => {
    const m = procesaMetrica(definicion, []);
    expect(m.disponible).toBe(false);
  });

  it('⚠️ un día sin dato NO entra como cero', () => {
    // Dos días con dato y un hueco de una semana en medio.
    const base = new Date(2026, 7, 1).getTime();
    const m = procesaMetrica(definicion, [
      { inicio: base, valor: 55 },
      { inicio: base + 7 * DIA, valor: 57 },
    ]);
    if (!m.disponible) throw new Error('deberia estar disponible');

    expect(m.serie).toHaveLength(2);
    expect(m.serie.some((p) => p.valor === 0)).toBe(false);
    expect(m.diasConDato).toBe(2);
  });

  it('la banda usa todo el histórico y la serie se recorta a la ventana', () => {
    const m = procesaMetrica(definicion, serieDiaria(Array.from({ length: 60 }, () => 55)), {
      dias: 10,
    });
    if (!m.disponible) throw new Error('deberia estar disponible');

    expect(m.serie).toHaveLength(10);
    // 60 valores iguales: sigma 0, así que no hay banda utilizable.
    expect(m.media).toBe(55);
    expect(m.estado).toBe('sin-banda');
  });

  it('marca el estado del último valor contra la banda', () => {
    // Serie estable y un último día muy alto. En pulso en reposo, subir es peor.
    const m = procesaMetrica(definicion, serieDiaria([54, 55, 56, 55, 54, 56, 55, 75]));
    if (!m.disponible) throw new Error('deberia estar disponible');

    expect(m.ultimo).toBe(75);
    expect(m.estado).toBe('peor');
  });

  it('el VO2max va declarado como estimado por un modelo', () => {
    const vo2 = METRICAS.find((m) => m.clave === 'vo2max')!;
    expect(vo2.estimada).toBe(true);
    const m = procesaMetrica(vo2, serieDiaria([52, 53, 52.5, 53.5, 54]));
    if (!m.disponible) throw new Error('deberia estar disponible');
    expect(m.estimada).toBe(true);
  });

  it('procesaSalud devuelve las seis métricas aunque falten datos', () => {
    const todas = procesaSalud({ pasos: serieDiaria([8000, 9000, 7000, 10000, 8500]) });
    expect(todas).toHaveLength(6);
    expect(todas.filter((m) => m.disponible)).toHaveLength(1);
  });
});

describe('calculaOms', () => {
  /** Sesión con minutos en zona moderada y vigorosa. */
  function sesion(tipo: string, modMin: number, vigMin: number, dia = 1) {
    const zonas: Zonas = {
      segundos: [0, modMin * 60, vigMin * 60, 0],
      trimp: 0,
      intensidad: 1,
      maximoUsado: 180,
    };
    return { inicio: new Date(2026, 7, dia, 10, 0).getTime(), tipo, zonas };
  }

  it('⭐ un minuto vigoroso vale dos moderados, que es la equivalencia de la guía', () => {
    const o = calculaOms([sesion('RUNNING', 0, 50)]);
    expect(o.vigorosa).toBe(50);
    expect(o.equivalente).toBe(50 * FACTOR_VIGOROSA);
  });

  it('el objetivo es 150 minutos equivalentes', () => {
    expect(OBJETIVO_MINUTOS).toBe(150);
    const o = calculaOms([sesion('WALKING', 150, 0)]);
    expect(o.cumple).toBe(true);
    expect(o.faltan).toBe(0);
    expect(o.progreso).toBe(100);
  });

  it('dice cuántos minutos faltan sin pasarse de 100 en el progreso', () => {
    const corto = calculaOms([sesion('WALKING', 60, 0)]);
    expect(corto.cumple).toBe(false);
    expect(corto.faltan).toBe(90);

    const pasado = calculaOms([sesion('RUNNING', 0, 200)]);
    expect(pasado.progreso).toBe(100);
    expect(pasado.faltan).toBe(0);
  });

  it('cuenta días de fuerza sin duplicar, y estudio también cuenta', () => {
    const o = calculaOms([
      sesion('STRENGTH_TRAINING', 20, 0, 1),
      sesion('STRENGTH_TRAINING', 20, 0, 1),
      sesion('BARRE', 20, 0, 3),
    ]);
    // Dos sesiones el mismo día son un solo día de fuerza.
    expect(o.diasFuerza).toBe(2);
    expect(o.objetivoFuerza).toBe(2);
  });

  it('⚠️ las sesiones sin zonas no suman: el objetivo va en minutos de intensidad medida', () => {
    const o = calculaOms([{ inicio: Date.now(), tipo: 'BARRE', zonas: null }]);
    expect(o.equivalente).toBe(0);
    expect(o.moderada).toBe(0);
  });

  it('la zona suave no cuenta como esfuerzo', () => {
    const zonas: Zonas = { segundos: [3600, 0, 0, 0], trimp: 0, intensidad: 1, maximoUsado: 180 };
    const o = calculaOms([{ inicio: Date.now(), tipo: 'WALKING', zonas }]);
    expect(o.equivalente).toBe(0);
  });
});
