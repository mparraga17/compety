import type { FontVariant } from 'react-native';

/**
 * ⭐⭐ REGLAS DE DISENO DEL PROYECTO, y cada una viene de un fallo real que costo una iteracion.
 *
 * Contrastadas con tres skills publicas de diseno (`emilkowalski/skills` con `apple-design` y
 * `emil-design-eng`, y `nextlevelbuilder/ui-ux-pro-max-skill`). Se listan aqui y no en un
 * documento aparte para que quien toque un estilo las tenga delante.
 *
 * 1. ⛔ **NADA DE TEXTO DENTRO DE FORMAS REDONDAS.** El ancho util de un circulo es el diametro
 *    menos dos veces el grosor, asi que una etiqueta de dos palabras se sale. Paso con el anillo
 *    copiado de Whoop. La jerarquia se hace con TAMANO en linea, no metiendo texto en formas.
 *    (Apple: *"build hierarchy from weight + size + leading as a set, not size alone"*.)
 *
 * 2. ⛔ **UN MEDIDOR NECESITA UN TECHO REAL.** El objetivo de la OMS son 150 min y el usuario
 *    hacia 412, asi que la barra estaba siempre llena y no informaba de nada. Si el valor puede
 *    pasarse del objetivo, el exceso se DICE ("x2,7"), no se dibuja.
 *
 * 3. ⛔ **EL CONTRASTE SE VALIDA EN EL MOVIL, NO EN EL MONITOR.** Ver abajo, en `textoSuave`.
 *    WCAG AA pide 4,5:1 para texto normal, y las opacidades de la maqueta daban 1,9:1.
 *
 * 4. ⛔ **NO COPIAR LA FORMA DE UN COMPETIDOR.** El anillo es la marca de Whoop. Copiarlo nos
 *    hace parecer una imitacion peor, no una alternativa. Se copian los PRINCIPIOS (dar escala,
 *    contexto propio), no los recursos visuales.
 *
 * 5. ✅ **CADA PANTALLA RESPONDE "DONDE ESTOY".** El nombre de la liga solo vivia dentro del
 *    desplegable, asi que habia que abrirlo para saberlo. Es lo que Apple llama *wayfinding*.
 *
 * 6. ✅ **UN ICONO SIN ETIQUETA OBLIGA A ADIVINAR.** El "+" de amigos podia ser crear liga, anadir
 *    amigo o registrar sesion. Las acciones importantes llevan palabra.
 *
 * 7. ⛔⛔ **EL COLOR Y LA TIPOGRAFIA NO SON TODO EL DISENO. FALTA EL COMPORTAMIENTO.** Este archivo
 *    llego a tener seis reglas sobre como se VE la app y ninguna sobre como RESPONDE, y ahi estaba
 *    la mitad de lo que hacia que se sintiera "tosca" al lado de la maqueta.
 *
 *    Y no era una sensacion vaga, tiene una causa tecnica exacta: la maqueta corre en un navegador,
 *    donde el `:active`, los `transition` y el `@starting-style` los regala el motor. React Native
 *    no da NADA de eso. Cada respuesta al tacto hay que escribirla a mano, y donde no se escribe
 *    queda un elemento que no acusa que lo has tocado.
 *
 *    ⇒ Las reglas de movimiento viven en `movimiento.ts`, con sus duraciones, curvas y resortes.
 *    Tres que conviene tener presentes al tocar cualquier estilo:
 *
 *      a) **Todo lo tocable va en `Pulsable`, nunca en `Pressable` a pelo.** Apple: *"Respond on
 *         pointer-down, not on release. Waiting for touch-up to show feedback feels dead."*
 *      b) **Nada de interfaz pasa de 300 ms**, salvo una barra que crece, porque ahi el recorrido
 *         ES el dato. Emil: *"UI animations should stay under 300ms."*
 *      c) **Lo que se toca decenas de veces al dia NO se anima.** Cambiar de pestaña no lleva
 *         transicion a proposito: a esa frecuencia la animacion se lee como retraso, no como
 *         fluidez.
 *
 * 8. ✅ **REDUCIR MOVIMIENTO SE RESPETA, Y REDUCIR NO ES APAGAR.** Con el ajuste puesto se quita el
 *    DESPLAZAMIENTO (translate, scale, resortes) y se queda la opacidad, que ayuda a entender que
 *    ha cambiado y no marea. Quitar el feedback entero dejaria a esa persona sin saber si la app
 *    registro el toque, que es peor que el problema que se intentaba evitar. Y ademas: Apple revisa
 *    a mano, e ignorar un ajuste de accesibilidad del sistema es motivo de rechazo.
 *
 * 9. ⭐⭐ **LA V2 QUITO LO QUE DELATABA "HECHO CON IA" Y NO PUSO NADA EN SU LUGAR (rediseno del
 *    15 sep).** El usuario dijo que la app se veia "plana y aburrida", y el inventario lo
 *    confirmo: un solo plano, separadores de un pixel, bloques al 7 % como unica superficie, un
 *    halo al 0,18 que con brillo automatico desaparecia, y una escala tipografica con agujero
 *    (11/13/15 y luego 62/76, nada en medio). La respuesta NO es volver a los bordes de color:
 *    es lo que Apple usa para dar riqueza sin ruido, y por eso ahora hay:
 *
 *      a) **Cabecera grande de iOS** (`tituloGrande`, 28/700) con linea de contexto encima y el
 *         avatar a la derecha en TODAS las pestanas. Revisa la regla del titulo de 15 px, que
 *         era correcta para la maqueta (titulo de 30 px pegado a una cifra de 76) y se quedo
 *         corta en la app: la cifra sigue mandando, pero la pantalla tenia que decir donde estas
 *         (regla 5) y las cuatro pestanas de datos no tenian camino al perfil.
 *      b) **Materiales**: la barra de pestanas es una capsula flotante de cristal con el
 *         contenido pasando por debajo (`GlassView` en iOS 26, desenfoque en anteriores), y las
 *         cabeceras fijas separan con un borde de scroll en degradado, no con una linea.
 *      c) **Halo mas presente y con significado**: el centro sube hasta el borde de la pantalla
 *         y la caida es empinada, asi el color vive en la franja segura, donde no hay texto, y
 *         a la altura del primer texto la intensidad es LA MISMA que antes (contraste medido).
 *         En Hoy el color dice como va la semana contra tu banda; en Competi, tu metal.
 *      d) **Graficos con cuerpo**: columnas con remate redondo y degradado vertical, la banda de
 *         "sesion habitual" pintada detras, y un techo real (100 puntos) para que el grafico
 *         no este siempre lleno (regla 2 aplicada al grafico, que la incumplia).
 *      e) **Iconos del sistema** (SF Symbols) en vez de glifos dibujados y de emojis de interfaz.
 *         Los emojis de DEPORTE se quedan: los aprobo el usuario y llevan identidad.
 *
 *    Y lo que sigue prohibido, para que nadie lo reintroduzca por inercia: bordes de color,
 *    paleta multicolor, tarjetas en todo, mayusculas con tracking, el anillo de Whoop, engordar
 *    la cifra, animar el cambio de pestana y cualquier color de acento nuevo.
 *
 * ---
 *
 * Sistema de diseño. Paleta de la propia Fitbit Air, elegida por el usuario en el panel v2.
 *
 * Criterio del rediseno v2: cero bordes de color, la jerarquia la hace el tamano tipografico,
 * y el color solo aparece cuando un dato sale de lo habitual.
 *
 * ⭐⭐ REVISADO midiendo contra la maqueta `app-preview/`, porque el usuario dijo que la app se
 * veia "mas tosca, mas fea" y que "la letra no es la misma". Tenia razon y la causa NO era una
 * sensacion: eran cuatro diferencias concretas, todas visibles en el CSS de la maqueta.
 *
 *   1. ⛔ Los TITULOS eran cuatro veces mas grandes de lo que toca. La maqueta usa
 *      `h1{font-size:15px;font-weight:600;color:var(--dim)}`, o sea 15px y TENUE: el titulo es
 *      una etiqueta discreta y la protagonista es la cifra. La app tenia titulos de 30px en
 *      color pleno, que competian con la cifra y aplastaban la jerarquia entera.
 *
 *   2. ⛔ El gris no pertenecia a la paleta. La maqueta define el texto tenue como el MISMO
 *      color del texto con transparencia (`rgba(230,236,233,.45)`), asi que todo se ve de la
 *      misma familia. La app usaba `#8b9199`, un gris azulado ajeno que ensucia el conjunto.
 *      Y la maqueta tiene DOS niveles de tenue, no uno.
 *
 *   3. ⛔ Faltaban los numeros tabulares. La maqueta pone `font-variant-numeric: tabular-nums`
 *      en TODAS las cifras. Sin eso los digitos tienen anchos distintos, las columnas de
 *      puntos no se alinean y los numeros "bailan" al actualizarse. Es la diferencia entre una
 *      tabla que parece hecha y una que parece improvisada.
 *
 *   4. ⛔ Las cifras grandes iban demasiado gordas. La maqueta usa weight 250, la app 300, y en
 *      un numero de 76px eso se nota mucho: la maqueta se ve elegante y la app pesada.
 */

/** Blanco menta de la paleta, en rgb. El texto tenue sale de aqui con alpha. */
const TINTA = '230,236,233';
/** Periwinkle de marca, en rgb. Los tintes de marca (fondos de chip, avatar propio) salen de aqui. */
export const MARCA_RGB = '198,203,240';
/** Coral, en rgb. */
export const BAJO_RGB = '249,64,79';

export const tema = {
  color: {
    fondo: '#14151a',
    texto: '#e6ece9',
    /**
     * ⭐ Texto secundario: la MISMA tinta con transparencia, no un gris aparte.
     *
     * Es lo que hace que todo se vea de la misma familia. Son dos niveles: `textoSuave` para lo
     * que se lee (etiquetas, frases de apoyo) y `textoTenue` para lo que solo acompana (unidades,
     * leyendas, posiciones).
     *
     * ⛔⛔ SUBIDOS tras verlo en el iPhone. La maqueta usaba 0,45 y 0,22, yo los copie tal cual, y
     * el usuario dijo que las letras grises apenas se veian. Tenia razon, y es medible:
     *
     * Calculado con la formula de luminancia relativa de WCAG, no a ojo:
     *
     *   opacidad   color resultante   contraste sobre #14151a
     *   0,22       #424448            1,87:1   ⛔ ilegible, menos de la mitad del minimo
     *   0,45       #727677            3,97:1   ⚠️ por debajo del 4,5:1 que pide WCAG AA
     *   0,52       #818586            4,89:1   ✅ el nuevo `textoTenue`
     *   0,62       #969A9A            6,41:1   ✅ el nuevo `textoSuave`
     *
     * ⚠️ Y por que la maqueta enganaba: se veia en un monitor de escritorio con brillo alto y a
     * 30 cm. En un movil, con brillo automatico y a veces al sol, ese contraste desaparece. Un
     * diseno solo se valida en el dispositivo, que es la leccion que este proyecto lleva repitiendo.
     */
    textoSuave: `rgba(${TINTA},0.62)`,
    textoTenue: `rgba(${TINTA},0.52)`,
    /** Linea de separacion. Nunca un bloque de color. No es texto, asi que puede ser tenue. */
    linea: `rgba(${TINTA},0.14)`,
    /** Fondo de un control o de una barra vacia. Apenas perceptible. */
    superficieSutil: `rgba(${TINTA},0.07)`,

    marca: '#c6cbf0',
    bajo: '#f9404f',
    /**
     * ⭐ Tintes de marca y de coral para FONDOS (chip de amigos, avatar propio, etiquetas).
     *
     * Antes habia tres alphas distintos de marca repartidos por las pantallas (0,14 / 0,16 /
     * 0,18) y dos de coral: la misma idea con cinco valores. Un tinte de cada, y se acabo.
     */
    marcaTenue: `rgba(${MARCA_RGB},0.15)`,
    bajoTenue: `rgba(${BAJO_RGB},0.14)`,
    /** Tirador de las hojas. Mas visible que `linea` porque es un control, no un separador. */
    tirador: `rgba(${TINTA},0.18)`,
    /** Velo oscuro detras de la celebracion. */
    velo: 'rgba(10,11,14,0.86)',
    /**
     * Cristal de respaldo para la barra flotante cuando no hay `GlassView` (iOS < 26): el
     * desenfoque de `BlurView` con este tinte encima. Y el filo superior claro, que es la luz
     * pegando en el material (Apple: *"bright top edge = light catching the material"*).
     */
    cristal: 'rgba(28,30,38,0.58)',
    cristalFilo: 'rgba(255,255,255,0.07)',
    /** Fondo de campos y avatares. */
    superficie: '#1d1f27',
    /**
     * ⭐ Metales del podio, tomados de la maqueta que el usuario aprobo.
     *
     * ⚠️ Apagados A PROPOSITO: sobre un fondo casi negro un dorado saturado chilla, y ya se
     * rechazo una paleta por eso en la v1 del panel.
     *
     * Y hay una razon de producto, no solo estetica: el metal marca el PUESTO mientras el
     * periwinkle de marca sigue marcando "eres tu". Asi las dos senales no se pisan y puedes ser
     * segundo y seguir reconociendote. Del cuarto en adelante no se marca nada.
     */
    oro: '#d9c07a',
    plata: '#c2c8cc',
    bronce: '#c08b62',
  },
  espacio: { xs: 4, s: 8, m: 16, l: 24, xl: 32 },
  /**
   * ⭐ Cuatro radios y ninguno mas. Habia siete repartidos por las pantallas (4, 8, 9, 11, 12,
   * 17, 20), que es el tipo de descuido que no se sabe nombrar pero se nota.
   *   s  etiquetas y controles pequenos      m  botones, campos, bloques, filas destacadas
   *   l  tarjeta de celebracion               xl  la barra flotante de pestanas
   * Las capsulas (chips, pastillas) llevan `alto / 2`, no un radio del tema.
   */
  radio: { s: 8, m: 12, l: 20, xl: 32 },
  /** Altura minima de un objetivo tactil. La guia de Apple pide 44 puntos. */
  tactil: 44,
  /**
   * ⭐ La barra de pestanas flotante. Sus medidas viven aqui porque el CONTENIDO de cada pestana
   * las necesita para dejar hueco debajo (`paddingBottom`): la barra ya no ocupa una franja
   * fija, el contenido pasa por debajo del cristal.
   */
  barra: {
    alto: 64,
    /** Margen a los lados de la capsula. */
    margen: 16,
    /** Separacion minima con el borde inferior cuando no hay indicador de inicio. */
    abajoMinimo: 16,
    /** Aire que el contenido deja por debajo, sumado a la barra y al area segura. */
    aireContenido: 16,
  },

  /**
   * ⭐ Cifras tabulares. Va en TODO numero que se muestre.
   *
   * Sin esto cada digito tiene un ancho distinto, asi que las columnas de puntos no se alinean y
   * los numeros se mueven al actualizarse. Es el detalle que mas separa una interfaz que parece
   * de producto de una que parece de prototipo.
   *
   * ⚠️ SIN `as const`. React Native declara `fontVariant` como array mutable, asi que un
   * `readonly` no compila al extenderlo en un `StyleSheet.create`.
   */
  cifras: { fontVariant: ['tabular-nums'] as FontVariant[] },

  tipo: {
    /**
     * ⭐ Titulo de SECCION, no de pantalla. 15px y tenue, como el `h1` de la maqueta.
     *
     * ⚠️ Es contraintuitivo y por eso estaba mal: el titulo no es lo importante de la pantalla,
     * lo es la cifra. Un titulo grande le roba el protagonismo y es lo que hacia que la app se
     * viera tosca al lado de la maqueta.
     */
    titulo: { fontSize: 15, fontWeight: '600' as const },
    /**
     * ⭐ Titulo de PANTALLA DE TAREA: bienvenida, entrar, crear liga, perfil, amigos.
     *
     * ⚠️ Existe porque la regla del titulo de 15px es MEDIA regla: solo vale cuando hay una cifra
     * protagonista al lado que justifique que el titulo sea una etiqueta discreta. En una
     * pantalla de tarea no hay cifra, asi que un h1 de 15px deja la pantalla sin ancla. Es el
     * mismo diagnostico que ya se corrigio en Sesiones, aplicado a las pantallas de tarea.
     * Mismas medidas que el titulo de las hojas modales, para que todo lo que es tarea abra igual.
     */
    tituloPantalla: { fontSize: 22, fontWeight: '600' as const, letterSpacing: -0.4 },
    /**
     * ⭐ Titulo GRANDE de pestana, el "large title" de iOS (rediseno del 15 sep, regla 9a).
     *
     * 28 y no los 34 del sistema: la app es densa y oscura, y a 34 el titulo vuelve a competir
     * con la cifra, que es lo que la regla del titulo de 15 px queria evitar. Tracking negativo
     * porque el texto grande lo pide (Apple: *"tighten large text"*) y el interlineado justo.
     */
    tituloGrande: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.7, lineHeight: 34 },
    /** El mismo titulo cuando la cabecera se compacta al hacer scroll. Medidas de la barra de iOS. */
    tituloCompacto: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.3 },
    /** Titular de una fila de caracteristica (bienvenida) o de un nombre destacado. */
    destacado: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.2 },
    /** Texto de apoyo bajo el titulo. */
    sub: { fontSize: 13, lineHeight: 18 },
    seccion: { fontSize: 15, fontWeight: '600' as const },
    /** `lineHeight` explicito: la maqueta usa 1.45 en todo el cuerpo. */
    cuerpo: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
    detalle: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
    /** Etiqueta minima: unidades, leyendas, avisos al pie. */
    micro: { fontSize: 11, lineHeight: 15 },

    /**
     * Cifra protagonista.
     *
     * ⚠️ La maqueta usa `font-weight:250`, que en CSS es valido porque los pesos son un rango
     * continuo. React Native solo acepta multiplos de 100, asi que va a 200 y NO a 300: entre
     * los dos, 200 es el que se parece al 250 de la maqueta. Con 300 la cifra sale gorda, que
     * es justo lo que hacia que la app se viera pesada.
     *
     * El `lineHeight` por debajo del tamano es intencional: aprieta el numero contra su unidad.
     */
    cifra: {
      fontSize: 76,
      fontWeight: '200' as const,
      letterSpacing: -3.5,
      lineHeight: 76,
      fontVariant: ['tabular-nums'] as FontVariant[],
    },
    /** Cifra en la variante en paralelo, con la frase al lado. Ahorra altura. */
    cifraPar: {
      fontSize: 62,
      fontWeight: '200' as const,
      letterSpacing: -2.5,
      lineHeight: 62,
      fontVariant: ['tabular-nums'] as FontVariant[],
    },
    /** Cifra secundaria: valor de una metrica, puntos de una fila. */
    valor: {
      fontSize: 19,
      fontWeight: '500' as const,
      fontVariant: ['tabular-nums'] as FontVariant[],
    },
    /** Valor de metrica en la lista de Salud. */
    valorMetrica: {
      fontSize: 24,
      fontWeight: '300' as const,
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'] as FontVariant[],
    },
  },
};

/** Color del metal segun el puesto. Del cuarto en adelante, texto normal. */
export function metalDe(puesto: number): string {
  if (puesto === 1) return tema.color.oro;
  if (puesto === 2) return tema.color.plata;
  if (puesto === 3) return tema.color.bronce;
  return tema.color.texto;
}
