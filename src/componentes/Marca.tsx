import { Animated, Image, type StyleProp, type ImageStyle } from 'react-native';

import { useEntrada } from '../movimiento';
import { tema } from '../tema';

/**
 * La marca: la C atravesada por el rayo, la variante A monocroma que eligió el usuario.
 *
 * Es un PNG blanco sobre transparente (assets/marca.png, generado desde el SVG aprobado de
 * marca/logo.html) tintado con `tintColor`. PNG y no SVG porque `react-native-svg` es un
 * módulo nativo: obligaría a recompilar y a gastar un build. El mismo criterio del halo,
 * los iconos y el movimiento: cero dependencias nuevas.
 *
 * ⚠️ `accessible={false}`: la marca es decorativa. Donde aparece, el texto de al lado ya
 * dice "Compety", y un lector de pantalla no gana nada oyéndolo dos veces.
 */

export const IMAGEN_MARCA = require('./../../assets/marca.png') as number;

type Props = {
  /** Lado en puntos. La marca es cuadrada. */
  lado?: number;
  color?: string;
  /** true = entra con el fundido y la subida estándar de la app (para pantallas que se ven poco). */
  entra?: boolean;
  estilo?: StyleProp<ImageStyle>;
};

export function Marca({ lado = 72, color = tema.color.marca, entra = false, estilo }: Props) {
  const entrada = useEntrada(0);
  const base: StyleProp<ImageStyle> = [
    { width: lado, height: lado, tintColor: color },
    estilo,
  ];

  if (!entra) {
    return <Image source={IMAGEN_MARCA} style={base} accessible={false} resizeMode="contain" />;
  }
  return (
    <Animated.Image
      source={IMAGEN_MARCA}
      style={[base, entrada]}
      accessible={false}
      resizeMode="contain"
    />
  );
}
