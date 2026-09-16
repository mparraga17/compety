import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Reparte el `style` de un `Pulsable` entre sus dos capas: el `Pressable` de fuera, que es el
 * hijo que su padre coloca, y la `Animated.View` de dentro, que es la que se ve y se hunde al pulsar.
 *
 * ⭐ El bug que lo motiva (16 sep). En Competi, el fondo gris del periodo no caía sobre "7 días":
 * `Segmentado` calculaba el fondo en quintos de la pista, pero cada pestaña medía lo que medía su
 * texto. `Pulsable` ponía TODO el estilo, `flex: 1` incluido, en la vista de dentro, y Yoga solo lee
 * el `flex`, el `alignSelf` o los márgenes del HIJO DIRECTO de un contenedor. El `Pressable` iba
 * sin estilo, así que en una fila medía su contenido y el `flex: 1` de dentro no tenía dónde crecer.
 * Lo mismo pasaba con las dos cápsulas de Competi, las siete columnas del gráfico de Hoy, la escala
 * de esfuerzo y la fila de persona en Amigos: cinco sitios con la misma trampa.
 *
 * La regla del reparto: **fuera va lo que coloca la caja en su padre** (flex, alineación propia,
 * tamaños, márgenes y posición); **dentro se queda lo que se ve y lo que ordena a los hijos**
 * (fondo, bordes, relleno, `alignItems`, `justifyContent`, dirección, opacidad, transformaciones).
 * La escala del pulso vive dentro, y por eso el fondo y los bordes tienen que quedarse con ella: si
 * se fueran fuera, al pulsar se hundiría el texto pero no el botón.
 *
 * ⚠️ Los tamaños (`width`, `minHeight`…) van FUERA y no en las dos capas: un `width: '62%'` en las
 * dos sería el 62 % del 62 %. La vista de dentro llena la de fuera con `flexGrow` y `flexShrink`
 * (ver `Pulsable`), así que un `minHeight: 44` fuera sigue centrando el texto dentro.
 *
 * Sin dependencias de react-native en tiempo de ejecución (solo tipos): así se prueba en jest sin
 * renderizar nada. El aplanado imita a `StyleSheet.flatten`: arrays anidados, falsos fuera, el
 * último gana, y lo que no sea un objeto se ignora.
 */

/** Propiedades que Yoga lee del hijo para colocarlo en su padre. Todas las de `FlexStyle` que lo hacen. */
const COLOCACION: ReadonlySet<string> = new Set([
  // Cuánto crece o encoge, y cómo se alinea a sí mismo en el eje cruzado.
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  // Tamaño de la caja.
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'aspectRatio',
  'boxSizing',
  // Márgenes: espacio fuera de la caja, lo reparte el padre.
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'marginStart',
  'marginEnd',
  'marginBlock',
  'marginBlockStart',
  'marginBlockEnd',
  'marginInline',
  'marginInlineStart',
  'marginInlineEnd',
  // Posición.
  'position',
  'top',
  'bottom',
  'left',
  'right',
  'start',
  'end',
  'inset',
  'insetBlock',
  'insetBlockStart',
  'insetBlockEnd',
  'insetInline',
  'insetInlineStart',
  'insetInlineEnd',
  'zIndex',
  'display',
]);

export type Reparto = { externo: ViewStyle; interno: ViewStyle };

export function repartirEstilo(style: StyleProp<ViewStyle>): Reparto {
  const externo: Record<string, unknown> = {};
  const interno: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(aplanar(style))) {
    if (valor === undefined) continue;
    (COLOCACION.has(clave) ? externo : interno)[clave] = valor;
  }
  return { externo, interno };
}

// `unknown` a propósito: dentro de un `StyleProp` caben arrays anidados de varias formas, y aquí
// solo importa si cada pieza es un objeto, un array o nada.
function aplanar(style: unknown): Record<string, unknown> {
  // `false`, `null`, `undefined` y los ids numéricos antiguos de StyleSheet: nada que aplanar.
  if (style === null || typeof style !== 'object') return {};
  if (!Array.isArray(style)) return style as Record<string, unknown>;
  const resultado: Record<string, unknown> = {};
  for (const parte of style) Object.assign(resultado, aplanar(parte));
  return resultado;
}
