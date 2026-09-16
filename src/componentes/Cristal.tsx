import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { tema } from '../tema';

/**
 * Material translúcido: el cristal de iOS 26 cuando lo hay, desenfoque cuando no.
 *
 * ⭐ Rediseño del 15 sep (regla 9b de `tema.ts`). La app era un solo plano opaco; Apple usa
 * materiales translúcidos como capa funcional flotante: *"build nav/toolbars/sheets as
 * translucent layers with content scrolling underneath — not opaque bars that consume a fixed
 * strip"*. Y desde iOS 26 el propio sistema pinta la barra de pestañas como una cápsula de
 * cristal, así que una barra opaca se ve de otra época al lado de las apps del sistema.
 *
 * Tres caminos, decididos UNA vez al cargar el módulo:
 *
 *   iOS 26+   `GlassView` de `expo-glass-effect`, que es `UIGlassEffect` de verdad (refracción,
 *             reacción al contenido que pasa por debajo). `colorScheme="dark"` fijo: la app es
 *             oscura siempre, y el cristal en modo claro sobre #14151a se vería lechoso.
 *   iOS < 26  `BlurView` con material oscuro del sistema y un tinte encima (`cristal`), que es
 *             la aproximación clásica: desenfoque + capa semitransparente.
 *   Android   una vista con el tinte, sin desenfoque. La app es de iOS; esto solo evita romper.
 *
 * ⚠️ Conocido y documentado por Expo: un `opacity: 0` en `GlassView` o en cualquier padre apaga el
 * efecto del todo. Nadie anima la opacidad de este componente; si hiciera falta, se anima la
 * del CONTENIDO, no la del material.
 *
 * El filo superior claro (`cristalFilo`) es la luz pegando en el material, el detalle que hace
 * que una superficie translúcida se lea como un objeto y no como un rectángulo gris.
 */

/** Hay cristal líquido de verdad (iOS 26+). Se evalúa una vez: no cambia en caliente. */
export const HAY_CRISTAL = Platform.OS === 'ios' && isLiquidGlassAvailable();

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Radio de la forma. El material se recorta a él. */
  radio: number;
  /** Cristal `clear` (más transparente, para chips pequeños) o `regular` (barras). */
  variante?: 'regular' | 'clear';
};

export function Cristal({ children, style, radio, variante = 'regular' }: Props) {
  if (HAY_CRISTAL) {
    return (
      <GlassView
        glassEffectStyle={variante}
        colorScheme="dark"
        style={[s.forma, { borderRadius: radio }, style]}
      >
        {children}
      </GlassView>
    );
  }

  if (Platform.OS === 'ios') {
    return (
      <View style={[s.forma, { borderRadius: radio }, style]}>
        <BlurView
          intensity={40}
          tint="systemThinMaterialDark"
          style={[StyleSheet.absoluteFill, { backgroundColor: tema.color.cristal }]}
        />
        <View style={s.filo} pointerEvents="none" />
        {children}
      </View>
    );
  }

  return (
    <View style={[s.forma, { borderRadius: radio, backgroundColor: tema.color.superficie }, style]}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  forma: { overflow: 'hidden' },
  filo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: tema.color.cristalFilo,
  },
});
