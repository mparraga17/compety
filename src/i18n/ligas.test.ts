import { ordinal } from './ligas';

/**
 * Tests del ordinal.
 *
 * ⛔ Nacen de un crash real en el iPhone: la version anterior usaba `Intl.PluralRules`, que
 * **Hermes no implementa**, y la app moria con *"undefined cannot be used as a constructor"*.
 *
 * ⚠️ Y ojo con la falsa seguridad: estos tests corren en **Node**, que SI tiene `Intl` completo.
 * O sea que la version rota habria pasado los tests igual. Por eso el primer test no comprueba el
 * resultado, comprueba que **no se usa `Intl`** en la implementacion. Es el unico que habria
 * cazado el fallo desde Windows.
 */

describe('ordinal', () => {
  it('no usa Intl, que es lo que reventó en el iPhone', () => {
    // Hermes no trae PluralRules. Si alguien lo vuelve a meter, este test cae aunque en Node
    // funcione perfectamente.
    expect(ordinal.toString()).not.toContain('Intl');
  });

  it('en español siempre es º', () => {
    expect(ordinal(1, 'es')).toBe('1º');
    expect(ordinal(3, 'es')).toBe('3º');
    expect(ordinal(11, 'es')).toBe('11º');
  });

  it('en inglés usa st, nd, rd, th', () => {
    expect(ordinal(1, 'en')).toBe('1st');
    expect(ordinal(2, 'en')).toBe('2nd');
    expect(ordinal(3, 'en')).toBe('3rd');
    expect(ordinal(4, 'en')).toBe('4th');
  });

  it('11, 12 y 13 son th, que es la excepción que se olvida siempre', () => {
    expect(ordinal(11, 'en')).toBe('11th');
    expect(ordinal(12, 'en')).toBe('12th');
    expect(ordinal(13, 'en')).toBe('13th');
  });

  it('21, 22 y 23 vuelven a st, nd, rd', () => {
    expect(ordinal(21, 'en')).toBe('21st');
    expect(ordinal(22, 'en')).toBe('22nd');
    expect(ordinal(23, 'en')).toBe('23rd');
  });

  it('111, 112 y 113 son th: la excepción va por los dos últimos dígitos', () => {
    expect(ordinal(111, 'en')).toBe('111th');
    expect(ordinal(112, 'en')).toBe('112th');
    expect(ordinal(113, 'en')).toBe('113th');
  });
});
