import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { useNumero } from '../movimiento';

/**
 * Número que SIGUE su valor con un resorte en vez de saltar.
 *
 * ⭐ Da cuerpo al principio que Apple pone por encima de todos: *"always animate from the
 * presentation (current) value"*. Cuando el motor recalcula (tirar para refrescar, declarar un
 * esfuerzo), la cifra protagonista viajaba de golpe al valor nuevo. Con el resorte el número
 * recorre el camino, y si llega otro dato a mitad, redirige sin cortar.
 *
 * ⚠️ El primer valor NO se anima (lo garantiza `useNumero`): ver la cifra contar desde cero al
 * abrir la pantalla sería ruido. Esto solo se nota al REFRESCAR, que es cuando informa.
 *
 * ⚠️ `useNumero(..., false)`: el valor se lee con `addListener` para pintar texto, así que el
 * driver nativo no aporta nada y sin él el listener recibe todos los fotogramas.
 *
 * ⚠️ Los dígitos ya van tabulares en `tema.tipo.cifra*`, así que el texto no baila de ancho
 * mientras cuenta.
 */

type Props = {
  valor: number;
  style?: StyleProp<TextStyle>;
};

export function Cifra({ valor, style }: Props) {
  const v = useNumero(valor, false);
  const [visible, setVisible] = useState(valor);

  useEffect(() => {
    const id = v.addListener(({ value }) => setVisible(Math.round(value)));
    return () => v.removeListener(id);
  }, [v]);

  return <Text style={style}>{visible}</Text>;
}
