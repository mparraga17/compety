import { alternaReaccion, entrenosParaPublicar, tiempoRelativo, type Entreno } from './feed';
import { textos } from '../i18n/textos';
import type { Resultado } from '../motor/sesiones';

// `feed.ts` importa el cliente de Supabase, que arrastra AsyncStorage, y los textos, que arrastran
// `expo-localization` (ESM). Aquí solo se prueba lo puro. Mismo patrón que `idioma.test.ts`.
jest.mock('./supabase', () => ({ HAY_SERVIDOR: false, supabase: {} }));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es' }],
}));

const t = textos('es');
const AHORA = Date.parse('2026-09-11T12:00:00Z');

function entreno(extra: Partial<Entreno> = {}): Entreno {
  return {
    id: 'E1',
    usuario: 'U1',
    nombre: 'Sergio',
    deporte: 'RUNNING',
    puntos: 70,
    tono: 'normal',
    fin: AHORA,
    reacciones: {},
    miReaccion: null,
    comentarios: 0,
    ...extra,
  };
}

describe('tiempoRelativo', () => {
  test('habla como una persona: ahora, minutos, horas, ayer, días', () => {
    const min = 60_000;
    expect(tiempoRelativo(AHORA - 20_000, AHORA, t)).toBe('ahora');
    expect(tiempoRelativo(AHORA - 5 * min, AHORA, t)).toBe('hace 5 min');
    expect(tiempoRelativo(AHORA - 3 * 60 * min, AHORA, t)).toBe('hace 3 h');
    expect(tiempoRelativo(AHORA - 30 * 60 * min, AHORA, t)).toBe('ayer');
    expect(tiempoRelativo(AHORA - 4 * 24 * 60 * min, AHORA, t)).toBe('hace 4 días');
  });

  test('un reloj adelantado no da tiempos negativos', () => {
    expect(tiempoRelativo(AHORA + 90_000, AHORA, t)).toBe('ahora');
  });
});

describe('alternaReaccion (optimista)', () => {
  test('sin reacción previa, tocar pone la tuya y suma uno', () => {
    const r = alternaReaccion(entreno({ reacciones: { '🔥': 2 } }), '🔥');
    expect(r.miReaccion).toBe('🔥');
    expect(r.reacciones).toEqual({ '🔥': 3 });
  });

  test('tocar la tuya la quita y resta uno, sin dejar ceros', () => {
    const r = alternaReaccion(entreno({ reacciones: { '🔥': 1 }, miReaccion: '🔥' }), '🔥');
    expect(r.miReaccion).toBeNull();
    expect(r.reacciones).toEqual({});
  });

  test('tocar otra la cambia: resta a la vieja y suma a la nueva', () => {
    const r = alternaReaccion(
      entreno({ reacciones: { '🔥': 2, '💪': 1 }, miReaccion: '🔥' }),
      '💪',
    );
    expect(r.miReaccion).toBe('💪');
    expect(r.reacciones).toEqual({ '🔥': 1, '💪': 2 });
  });

  test('no muta el entreno original', () => {
    const original = entreno({ reacciones: { '👏': 1 } });
    alternaReaccion(original, '👏');
    expect(original.reacciones).toEqual({ '👏': 1 });
    expect(original.miReaccion).toBeNull();
  });
});

describe('entrenosParaPublicar', () => {
  const base = { media: 100, sigma: 20, n: 30, fiable: true };
  const sesion = (id: string, inicio: number, carga: number, puntos: number, tipo: string | null) =>
    ({ id, inicio, fin: inicio + 45 * 60_000 + 17_000, carga, puntos, tipo }) as Resultado['sesiones'][number];

  const resultado = {
    sesiones: [
      sesion('a', AHORA - 3 * 86_400_000, 100, 60.4, 'RUNNING'),
      sesion('b', AHORA - 1 * 86_400_000, 130, 88, 'BARRE'),
      sesion('c', AHORA - 2 * 86_400_000, 70, 30, null),
    ],
    base,
  } as unknown as Resultado;

  test('solo viaja lo permitido: id, tipo, puntos, tono y el fin al minuto', () => {
    const lote = entrenosParaPublicar(resultado);
    expect(Object.keys(lote[0]).sort()).toEqual(['deporte', 'fin', 'id', 'puntos', 'tono']);
    // Ni minutos, ni carga, ni pulsos.
    expect(JSON.stringify(lote)).not.toMatch(/carga|minutos|pulsos|fcMedia/);
  });

  test('el tono sale de comparar la carga con la base propia', () => {
    const porId = Object.fromEntries(entrenosParaPublicar(resultado).map((e) => [e.id, e]));
    expect(porId.a.tono).toBe('normal'); // z = 0
    expect(porId.b.tono).toBe('fuerte'); // z = 1,5
    expect(porId.c.tono).toBe('suave'); // z = -1,5
  });

  test('puntos redondeados, deporte nulo respetado y segundos fuera', () => {
    const porId = Object.fromEntries(entrenosParaPublicar(resultado).map((e) => [e.id, e]));
    expect(porId.a.puntos).toBe(60);
    expect(porId.c.deporte).toBeNull();
    expect(porId.a.fin.endsWith(':00.000Z')).toBe(true);
  });

  test('del más reciente al más antiguo', () => {
    expect(entrenosParaPublicar(resultado).map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });
});
