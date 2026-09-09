import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { CURVA, MS, useReducirMovimiento } from '../movimiento';

/**
 * Halo difuso de la parte de arriba de la pantalla.
 *
 * ⭐ Es una de las decisiones de diseño de la v2 del panel, la que el usuario aprobó tras rechazar
 * la v1: **halo difuso, nunca un contorno**. El borde de 1px de color saturado fue justo lo que
 * rechazó diciendo *"es lo que delata que claramente lo hemos hecho con claude"*.
 *
 * ⚠️ En la maqueta es una línea de CSS:
 * `background: radial-gradient(circle, var(--halo), transparent 68%)`.
 *
 * ⭐⭐ REESCRITO el 8 sep: ahora ES esa línea, con el `radial-gradient` del propio core de
 * React Native (`experimental_backgroundImage`, gradientes radiales desde la 0.80 según la
 * documentación oficial; verificado en los TIPOS de la 0.86.3 instalada: `RadialGradientValue`
 * existe). Cero dependencias y cero módulos nativos, como siempre.
 *
 * Historia: la primera versión imitaba el gradiente con seis círculos concéntricos de opacidad
 * decreciente, y el usuario vio EXACTAMENTE el defecto en el iPhone: *"no me encantan los
 * círculos difuminados de la parte de arriba"*. Las capas se leían como anillos, y además el
 * apilado sumaba alphas hasta ~0,34 en el centro cuando la maqueta pedía 0,16: por eso el oro
 * se veía marrón y sucio. El gradiente real recupera la maqueta aprobada tal cual.
 *
 * El fundido lleva una parada intermedia (55 % del alpha al 38 % del radio) porque el degradado
 * lineal puro corta seco al final; con ella la caída es la de un brillo, no la de un foco.
 *
 * 📌 El color lo pone quien lo usa, porque en Competi **toma el metal del podio**: así el oro del
 * primer puesto no queda como una nota de color suelta en la pantalla.
 *
 * ⭐ Y el CAMBIO de color se funde, no salta. Al cambiar de liga o de puesto, el halo pasaba de
 * oro a periwinkle de golpe, que era el único cambio de estado sin transición de la pantalla. Se
 * hace en fundido cruzado de 200 ms: la capa vieja queda debajo y la nueva aparece encima. Pasa
 * el filtro de "¿para qué se anima?" porque es indicación de estado (tu puesto ha cambiado) y se
 * ve poco, que es donde la tabla de frecuencia permite animar. Con "Reducir movimiento" el cambio
 * es instantáneo: un fundido de color no marea, pero la regla de ese ajuste ya la cumple el resto
 * de la app quitando transiciones, y aquí no hay información que se pierda sin él.
 */

type Props = {
  /** Color base en formato `r,g,b`. Se le aplica la opacidad de cada capa. */
  rgb?: string;
  /**
   * Opacidad de la capa más interna. La maqueta usaba 0,16 para el periwinkle; en la vuelta de
   * gamificación (9 sep) se subió un punto en toda la escala porque el halo es la única pieza
   * de color ambiental de la app y a 0,16 desaparecía con brillo automático. El criterio se
   * mantiene: un brillo, nunca un foco.
   */
  intensidad?: number;
};

/** Periwinkle de marca, `#c6cbf0` en rgb. */
const MARCA_RGB = '198,203,240';

/**
 * El gradiente de un color. Separado para poder apilar dos durante el fundido.
 *
 * ⚠️ La sintaxis del gradiente es LA VAINILLA a propósito: forma + tamaño por palabra clave y
 * posición por palabras clave (`ellipse farthest-side at center top`). La primera versión usaba
 * radio explícito en px y centro en posición negativa; el parser de JS los aceptaba (leído en
 * `processBackgroundImage.js`) pero en el iPhone no se pintaba NADA: el rechazo silencioso
 * estaba en la capa nativa. Regla que queda: con una API experimental, quedarse en el centro
 * del estándar y mover lo exótico a geometría de vistas, que es terreno pisado.
 *
 * El "centro arriba del borde de pantalla" lo pone la VISTA: es más alta que la caja y sube
 * 140px por encima (la caja recorta). Así el centro del brillo queda fuera y lo visible es la
 * falda cayendo hacia el contenido, que es lo que hacía bonito el efecto de la maqueta.
 */
function Degradado({ rgb, intensidad }: { rgb: string; intensidad: number }) {
  return (
    <View
      style={[
        s.lienzo,
        {
          experimental_backgroundImage:
            `radial-gradient(ellipse farthest-side at center top, ` +
            `rgba(${rgb},${intensidad}) 0%, ` +
            `rgba(${rgb},${(intensidad * 0.5).toFixed(3)}) 45%, ` +
            `rgba(${rgb},0) 78%)`,
        },
      ]}
    />
  );
}

export function Halo({ rgb = MARCA_RGB, intensidad = 0.18 }: Props) {
  const reducir = useReducirMovimiento();
  // El color en pantalla y el anterior, para el fundido cruzado.
  const [visible, setVisible] = useState({ rgb, intensidad });
  const [anterior, setAnterior] = useState<{ rgb: string; intensidad: number } | null>(null);
  const fundido = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (rgb === visible.rgb && intensidad === visible.intensidad) return;
    if (reducir) {
      setVisible({ rgb, intensidad });
      return;
    }
    // La capa vieja queda debajo; la nueva entra en fundido encima.
    setAnterior(visible);
    setVisible({ rgb, intensidad });
    fundido.setValue(0);
    Animated.timing(fundido, {
      toValue: 1,
      duration: MS.cambia,
      easing: CURVA.sale,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setAnterior(null);
    });
  }, [rgb, intensidad, visible, reducir, fundido]);

  return (
    <View style={s.caja} pointerEvents="none">
      {anterior !== null && <Degradado rgb={anterior.rgb} intensidad={anterior.intensidad} />}
      <Animated.View style={[StyleSheet.absoluteFill, anterior !== null && { opacity: fundido }]}>
        <Degradado rgb={visible.rgb} intensidad={visible.intensidad} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  caja: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    // Con el gradiente ya no hay hijos que se salgan (era el fallo del hero de 435px en la v2),
    // pero el recorte se queda: es la garantía de que el halo JAMÁS empuja el layout.
    overflow: 'hidden',
    zIndex: -1,
  },
  // El lienzo del gradiente: desborda la caja por arriba y por los lados para que el centro
  // del brillo quede fuera de pantalla y la elipse no muera en los bordes. La caja recorta.
  lienzo: {
    position: 'absolute',
    top: -140,
    left: -60,
    right: -60,
    height: 440,
  },
});

/**
 * Halos del podio, con los metales del tema. Las opacidades de la maqueta más el punto de la
 * vuelta de gamificación: el orden relativo (oro por encima de bronce y plata) se conserva.
 */
export const HALO_PODIO = {
  oro: { rgb: '217,192,122', intensidad: 0.16 },
  plata: { rgb: '194,200,204', intensidad: 0.14 },
  bronce: { rgb: '192,139,98', intensidad: 0.15 },
  marca: { rgb: MARCA_RGB, intensidad: 0.18 },
} as const;

/** Qué halo toca según el puesto. Del cuarto en adelante, el de marca. */
export function haloDePuesto(puesto: number): { rgb: string; intensidad: number } {
  if (puesto === 1) return HALO_PODIO.oro;
  if (puesto === 2) return HALO_PODIO.plata;
  if (puesto === 3) return HALO_PODIO.bronce;
  return HALO_PODIO.marca;
}
