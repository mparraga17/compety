import type { ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

import { escalonDe, useEntrada } from '../movimiento';

/**
 * Envoltorio que hace aparecer a sus hijos al montarse.
 *
 * ⭐⭐ Existe por un motivo técnico concreto, y es el que decide que sea un componente y no un hook
 * usado en la pantalla: un hook se ejecuta cuando se monta LA PANTALLA, y casi todo lo interesante
 * de esta app aparece más tarde, cuando vuelve HealthKit o el servidor. Puesto en la pantalla, la
 * animación se habría gastado en un `null` y el dato entraría de golpe, que es justo lo que se
 * quería evitar.
 *
 * ⛔ Y no se puede arreglar llamando al hook dentro del `if`: las reglas de hooks lo prohíben, así
 * que el intento evidente ni compila. La solución es que el que se monte sea el envoltorio, porque
 * entonces montarse y aparecer son el mismo instante por construcción.
 *
 * ⚠️ Respeta "Reducir movimiento" a través de `useEntrada`, así que con ese ajuste puesto queda un
 * fundido corto sin desplazamiento.
 */

type Props = {
  children: ReactNode;
  /**
   * Posición en una lista. Se convierte en retardo para que los elementos lleguen en cascada.
   * Se satura en el octavo, para que una lista larga no tarde en acabar de pintarse.
   */
  indice?: number;
  /** Retardo explícito en ms, cuando no viene de una lista. Manda sobre `indice`. */
  retardo?: number;
  /** Cuántos píxeles sube al entrar. 8 es el valor de la skill; 0 deja solo el fundido. */
  desde?: number;
  style?: StyleProp<ViewStyle>;
};

export function Aparece({ children, indice, retardo, desde = 8, style }: Props) {
  const entrada = useEntrada(retardo ?? (indice === undefined ? 0 : escalonDe(indice)), desde);

  return <Animated.View style={[style, entrada]}>{children}</Animated.View>;
}
