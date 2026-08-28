/**
 * Paleta de la propia Fitbit Air, elegida por el usuario en el panel v2.
 * Sustituyo al dorado heredado de LeonApostolico, que rechazo.
 *
 * Criterio del rediseno v2: cero bordes de color, la jerarquia la hace el tamano
 * tipografico, y el color solo aparece cuando un dato sale de lo habitual.
 */
export const tema = {
  color: {
    fondo: '#14151a',
    texto: '#e6ece9',
    textoSuave: '#8b9199',
    marca: '#c6cbf0',
    bajo: '#f9404f',
  },
  espacio: { xs: 4, s: 8, m: 16, l: 24, xl: 32 },
  radio: { s: 8, m: 12, l: 20 },
  tipo: {
    titulo: { fontSize: 30, fontWeight: '600' as const, letterSpacing: -0.5 },
    seccion: { fontSize: 13, fontWeight: '600' as const },
    cuerpo: { fontSize: 15, fontWeight: '400' as const },
    detalle: { fontSize: 13, fontWeight: '400' as const },
  },
};
