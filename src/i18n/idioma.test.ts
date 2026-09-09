/**
 * ⚠️ `expo-localization` se mockea porque es ESM y jest lo carga como CommonJS. Solo se usa para
 * detectar el idioma del sistema, que en un test no aporta nada: aquí se pide el idioma explícito.
 * Es el mismo patrón del `jest.setup.js` de SparkyFitness con la librería de HealthKit.
 */
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es' }],
}));

import { fichaDe, hayFicha } from '../motor/ciencia';
import { puntuaCarga, baseDeCarga } from '../motor/base';
import { cargaMedida, cargaDeclarada, cargaEstimada } from '../motor/cargaSinFc';
import { procesaSueno, FASE, type TramoSueno } from '../motor/sueno';
import { textos } from './textos';

/**
 * Red de seguridad contra el bug que vio el usuario: con la app en inglés, la hoja
 * "What this is based on" salía entera en español.
 *
 * ⚠️ POR QUÉ NO LO CAZÓ NADA. Es el mismo patrón que el crash de `Intl.PluralRules`:
 *   `tsc` no avisa, porque un string en español es un string válido.
 *   Los tests tampoco avisaban, porque comprobaban cifras y no idioma.
 *
 * ⇒ Estos tests comprueban la ESTRUCTURA, no el resultado: que las dos tablas de idioma tengan
 * las mismas claves, que las fichas cambien de texto al cambiar de idioma, y que ningún dato
 * del motor lleve texto dentro. Es lo único que evita que vuelva.
 */

/** Fichas que existen. Se derivan de la tabla española, que es la de referencia. */
const CLAVES = [
  'edwards',
  'intervalico',
  'isometrico',
  'fuerzaSalud',
  'compendium',
  'dosisRespuesta',
  'basePropia',
  'fcReposo',
  'eficiencia',
  'oms',
  'competicion',
  'tope',
  'volumen',
  'constancia',
  'regularidad',
  'regularidad2',
  'eficienciaSueno',
  'duracion',
  'fasesSinConsenso',
  'precisionSueno',
  'banda',
  'hrv',
  'spo2',
  'respiracion',
  'vo2max',
  'pasos',
  'vilpa',
] as const;

describe('fichas científicas en los dos idiomas', () => {
  it('todas las claves esperadas existen', () => {
    for (const clave of CLAVES) {
      expect(hayFicha(clave)).toBe(true);
    }
  });

  it('⭐ el texto CAMBIA al cambiar de idioma, que es el bug que se arregló', () => {
    for (const clave of CLAVES) {
      const es = fichaDe(clave, 'es');
      const en = fichaDe(clave, 'en');

      expect(en.dato).not.toBe(es.dato);
      expect(en.detalle).not.toBe(es.detalle);
    }
  });

  it('ninguna ficha se queda con el texto vacío en inglés', () => {
    for (const clave of CLAVES) {
      const en = fichaDe(clave, 'en');
      expect(en.dato.length).toBeGreaterThan(0);
      expect(en.detalle.length).toBeGreaterThan(0);
      expect(en.fuente.length).toBeGreaterThan(0);
    }
  });

  it('la url es la misma en los dos idiomas: el paper no cambia', () => {
    for (const clave of CLAVES) {
      expect(fichaDe(clave, 'en').url).toBe(fichaDe(clave, 'es').url);
    }
  });

  // Los acentos son la señal más simple de texto español colado en la tabla inglesa.
  it('el inglés no arrastra acentos del español', () => {
    for (const clave of CLAVES) {
      const en = fichaDe(clave, 'en');
      expect(`${en.dato} ${en.detalle}`).not.toMatch(/[áéíóúñ¿¡]/i);
    }
  });
});

describe('las dos tablas de textos tienen las mismas claves', () => {
  it('ninguna clave falta en un idioma', () => {
    const es = Object.keys(textos('es')).sort();
    const en = Object.keys(textos('en')).sort();
    expect(en).toEqual(es);
  });

  it('ningún texto se quedó sin traducir con el mismo valor literal', () => {
    const es = textos('es') as Record<string, string>;
    const en = textos('en') as Record<string, string>;

    // Se permiten los que son iguales por naturaleza: siglas, símbolos y palabras que coinciden
    // en los dos idiomas. La lista es corta a propósito: cada añadido hay que justificarlo.
    // 'Madrid' y 'Chamberí' son los placeholders de ejemplo de la pantalla de zona: nombres
    // propios de lugar, que no se traducen. Y 'Div.' abrevia igual Division y División.
    const iguales = Object.keys(es).filter((k) => es[k] === en[k]);
    const permitidos = ['REM', 'No', 'Total', 'Madrid', 'Chamberí', 'Div. %{n}'];

    for (const clave of iguales) {
      const valor = es[clave];
      // Los placeholders se quitan antes de juzgar: `'‹ %{donde}'` no tiene texto propio que
      // traducir, solo un símbolo y un hueco que rellena la interfaz.
      const sinHuecos = valor.replace(/%\{\w+\}/g, '');
      const esSimbolo = !/[a-zA-Z]/.test(sinHuecos);
      if (esSimbolo || permitidos.includes(valor)) continue;
      throw new Error(`la clave "${clave}" tiene el mismo texto en los dos idiomas: "${valor}"`);
    }
  });
});

describe('⛔ los datos del motor no llevan texto traducible dentro', () => {
  // Es la regla que costó el bug del `nombre: 'Tú'` en el build.js, y ahora este.

  it('los pasos de la carga llevan clave y cifras, nunca frases', () => {
    const medida = cargaMedida({ tipo: 'RUNNING', minutos: 30, intensidad: 2.8 });
    const declarada = cargaDeclarada(7, 45, 'BARRE');
    const estimada = cargaEstimada('WALKING', 60);

    for (const carga of [medida, declarada, estimada]) {
      expect(carga).not.toBeNull();
      for (const paso of carga!.pasos) {
        expect(typeof paso.clave).toBe('string');
        expect(typeof paso.datos).toBe('object');
        // Si alguien vuelve a meter la frase hecha, esto lo caza.
        expect(JSON.stringify(paso)).not.toMatch(/[áéíóúñ]/i);
      }
    }
  });

  it('la puntuación devuelve cifras, no una fórmula escrita', () => {
    const base = baseDeCarga([10, 20, 30, 40]);
    const p = puntuaCarga(35, base);

    expect(p).not.toHaveProperty('formula');
    expect(p.datos).not.toBeNull();
    expect(typeof p.datos!.media).toBe('number');
    expect(typeof p.datos!.z).toBe('number');
  });

  it('sin historial los datos van a null en vez de a una frase', () => {
    const p = puntuaCarga(35, baseDeCarga([]));
    expect(p.datos).toBeNull();
  });

  it('los componentes del sueño llevan cifras, no frases', () => {
    const H = 3_600_000;
    const tramos: TramoSueno[] = [24, 25, 26, 27].map((dia) => {
      const ini = new Date(2026, 7, dia, 1, 0).getTime();
      return { inicio: ini, fin: ini + 7 * H, valor: FASE.ligero, fuente: 'Fitbit' };
    });

    const r = procesaSueno(tramos).resumen;
    if (!r.disponible) throw new Error('deberia estar disponible');

    for (const c of r.componentes) {
      expect(c).not.toHaveProperty('formula');
      expect(typeof c.datos).toBe('object');
      expect(JSON.stringify(c.datos)).not.toMatch(/[áéíóúñ]/i);
    }
  });
});
