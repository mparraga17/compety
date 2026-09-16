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
 * ⭐ Rediseño del 15 sep (regla 9c de `tema.ts`): el halo era el único color ambiental de la app
 * y casi no se veía. La causa era GEOMÉTRICA, no de alpha: el centro de la elipse quedaba 140 pt
 * por encima de la pantalla, así que al borde superior llegaba ~0,12 y al primer texto ~0,08.
 * Ahora el centro queda a 40 pt del borde y la caída es empinada (cinco paradas): al borde llega
 * ~0,9 de la intensidad, al primer texto (y≈70) ~0,4 y a la cifra (y≈180) ~0,1. El color vive en
 * la franja segura, donde no hay texto, y a la altura del texto la intensidad es la misma que
 * antes. Comprobado con la fórmula de luminancia de WCAG: el texto suave de la línea de contexto
 * de la cabecera queda por encima de 5:1 en el punto más claro.
 *
 * 📌 El color lo pone quien lo usa, porque en Competi **toma el metal del podio** y en Hoy el
 * estado de la semana (`haloDeEstado`): así el color ambiental dice algo y no es una nota suelta.
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
   * Opacidad en el CENTRO de la elipse, que queda 40 pt por encima de la pantalla. Al borde
   * superior llega ~0,9 de este valor y al primer texto ~0,4. El criterio se mantiene desde la
   * v2: un brillo, nunca un foco.
   */
  intensidad?: number;
};

/** Periwinkle de marca, `#c6cbf0` en rgb. */
const MARCA_RGB = '198,203,240';

/** Intensidad del halo de marca, en el centro de la elipse. */
const INTENSIDAD_MARCA = 0.3;

/**
 * El gradiente de un color. Separado para poder apilar dos durante el fundido.
 *
 * ⚠️ La sintaxis del gradiente es LA VAINILLA a propósito: forma + tamaño por palabra clave,
 * posición por palabras clave (`ellipse farthest-side at center top`) y paradas en porcentaje.
 * La primera versión usaba radio explícito en px y centro en posición negativa; el parser de JS
 * los aceptaba (leído en `processBackgroundImage.js`) pero en el iPhone no se pintaba NADA: el
 * rechazo silencioso estaba en la capa nativa. Regla que queda: con una API experimental,
 * quedarse en el centro del estándar y mover lo exótico a geometría de vistas.
 *
 * El "centro justo encima del borde de pantalla" lo pone la VISTA: es más alta que la caja y
 * sube 40px por encima (la caja recorta). Lo visible es la falda cayendo hacia el contenido.
 */
function Degradado({ rgb, intensidad }: { rgb: string; intensidad: number }) {
  const a = (f: number) => (intensidad * f).toFixed(3);
  return (
    <View
      style={[
        s.lienzo,
        {
          experimental_backgroundImage:
            `radial-gradient(ellipse farthest-side at center top, ` +
            `rgba(${rgb},${a(1)}) 0%, ` +
            `rgba(${rgb},${a(0.72)}) 12%, ` +
            `rgba(${rgb},${a(0.3)}) 30%, ` +
            `rgba(${rgb},${a(0.1)}) 55%, ` +
            `rgba(${rgb},0) 85%)`,
        },
      ]}
    />
  );
}

export function Halo({ rgb = MARCA_RGB, intensidad = INTENSIDAD_MARCA }: Props) {
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
    height: 360,
    // Con el gradiente ya no hay hijos que se salgan (era el fallo del hero de 435px en la v2),
    // pero el recorte se queda: es la garantía de que el halo JAMÁS empuja el layout.
    overflow: 'hidden',
    zIndex: -1,
  },
  // El lienzo del gradiente: desborda la caja por arriba y por los lados para que el centro
  // del brillo quede justo fuera de pantalla y la elipse no muera en los bordes. La caja recorta.
  lienzo: {
    position: 'absolute',
    top: -40,
    left: -60,
    right: -60,
    height: 400,
  },
});

/**
 * Halos del podio, con los metales del tema. El orden relativo (oro por encima de bronce y
 * plata) se conserva; las cifras subieron con la geometría nueva del 15 sep, porque ahora miden
 * el centro de la elipse y no lo que llegaba a la pantalla.
 */
export const HALO_PODIO = {
  oro: { rgb: '217,192,122', intensidad: 0.26 },
  plata: { rgb: '194,200,204', intensidad: 0.24 },
  bronce: { rgb: '192,139,98', intensidad: 0.25 },
  marca: { rgb: MARCA_RGB, intensidad: INTENSIDAD_MARCA },
} as const;

/** Qué halo toca según el puesto. Del cuarto en adelante, el de marca. */
export function haloDePuesto(puesto: number): { rgb: string; intensidad: number } {
  if (puesto === 1) return HALO_PODIO.oro;
  if (puesto === 2) return HALO_PODIO.plata;
  if (puesto === 3) return HALO_PODIO.bronce;
  return HALO_PODIO.marca;
}

/**
 * ⭐ Halo de Hoy según cómo quedó tu última sesión contra tu banda (regla 9c): es lo que hacía
 * el panel v2 (`body::before` con color según estado) y la app había perdido. Periwinkle por
 * encima de lo habitual, menta neutro dentro, y coral MUY bajo por debajo: el coral satura, y
 * una sesión floja no es una alarma, es información. Sin base, el de marca.
 */
export function haloDeEstado(z: number | null): { rgb: string; intensidad: number } {
  if (z === null || z > 1) return HALO_PODIO.marca;
  if (z < -1) return { rgb: '249,64,79', intensidad: 0.12 };
  return { rgb: '230,236,233', intensidad: 0.14 };
}
