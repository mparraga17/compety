import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/**
 * ⭐⭐ CAPA DE MOVIMIENTO. El sistema de diseño tenía color y tipografía, y le faltaba esto.
 *
 * Y era la pieza que más se notaba, porque explica la parte de "la app se siente tosca" que NO se
 * arreglaba tocando estilos: la maqueta corre en un navegador, donde el `:active`, los
 * `transition` y el `@starting-style` los da el motor gratis. En React Native no existe nada de
 * eso. Cada respuesta al tacto hay que escribirla.
 *
 * Las dos skills de diseño coinciden en el diagnóstico:
 *
 *   Apple (`apple-design`): *"An interface feels alive when motion starts from the current
 *   on-screen value, inherits the user's velocity, projects momentum forward, and can be grabbed
 *   and reversed at any instant."* Y antes que nada: *"Respond on pointer-down, not on release."*
 *
 *   Emil (`emil-design-eng`): *"Every animation must have a clear answer to 'why does this
 *   animate?'"* — y si la respuesta es "porque queda bien" y se ve a diario, no se anima.
 *
 * ⚠️ TODO lo de aquí funciona con `Animated` de React Native y CERO dependencias nuevas. Es el
 * mismo criterio que ya llevaba el halo (sin `expo-linear-gradient`) y los iconos (sin
 * `@expo/vector-icons`): un módulo nativo obligaría a recompilar y a gastar uno de los 15 builds
 * de iOS al mes. `Animated` viene en el núcleo, así que no cuesta ningún build.
 */

/* ────────────────────────────────────────────────────────────────────────────
   Duraciones
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * ⭐ Tabla de duraciones de la skill de Emil, tal cual. No son números redondos por gusto: cada
 * rango sale de cuántas veces al día ve el usuario esa animación.
 *
 * ⛔ El techo de 300 ms es la regla dura: *"UI animations should stay under 300ms."* Por encima de
 * ahí la interfaz deja de sentirse rápida, y el efecto es de percepción, no de rendimiento: un
 * desplegable de 180 ms se siente más ágil que el mismo de 400 aunque los datos lleguen igual.
 */
export const MS = {
  /** Acuse de recibo al pulsar. Tiene que ser lo más inmediato de la app. */
  pulso: 90,
  /** Vuelta al soltar. Puede relajarse: aquí ya no espera nadie. */
  suelta: 160,
  /** Aparición de un elemento: entrada de una fila, de una tarjeta. */
  entra: 220,
  /** Cambio de estado a la vista: color de pestaña, valor de una cifra. */
  cambia: 200,
  /** Barra o gráfico que crece hasta su valor. Es lo único que puede pasar de 300. */
  crece: 480,
} as const;

/**
 * ⭐ Retardo entre elementos de una lista que entra a la vez.
 *
 * Emil: *"Keep stagger delays short (30-80ms between items). Long delays make the interface feel
 * slow."* 40 ms cae en medio: se percibe la cascada y siete filas terminan en 280 ms, o sea dentro
 * del presupuesto de una sola animación.
 */
export const ESCALON = 40;

/** Tope de elementos que escalonan. Del noveno en adelante entran ya con el octavo. */
const ESCALON_TOPE = 8;

/** Retardo del elemento `i` de una lista. Se satura para que una lista larga no tarde en pintar. */
export function escalonDe(i: number): number {
  return Math.min(i, ESCALON_TOPE) * ESCALON;
}

/* ────────────────────────────────────────────────────────────────────────────
   Curvas
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * ⭐ Curvas propias, NO las de serie.
 *
 * Emil: *"The built-in CSS easings are too weak. They lack the punch that makes animations feel
 * intentional."* Lo mismo vale para `Easing.ease` de React Native, que es la bezier suave de
 * siempre y se queda blanda.
 *
 * ⛔⛔ `Easing.in` NO SE USA NUNCA en interfaz. Empieza despacio, y eso retrasa el movimiento en
 * el instante exacto en que el usuario está mirando: *"A dropdown with `ease-in` at 300ms FEELS
 * slower than `ease-out` at the same 300ms."* Es el error que hace que una animación correcta en
 * papel se sienta pesada.
 */
export const CURVA = {
  /**
   * Todo lo que ENTRA o SALE. Arranca rápido, así que se siente instantáneo.
   * Es `cubic-bezier(0.23, 1, 0.32, 1)` de la skill.
   */
  sale: Easing.bezier(0.23, 1, 0.32, 1),
  /**
   * Algo que se MUEVE de un sitio a otro ya estando a la vista. Acelera y frena, como una cosa
   * con masa. Es `cubic-bezier(0.77, 0, 0.175, 1)`.
   */
  mueve: Easing.bezier(0.77, 0, 0.175, 1),
  /**
   * Curva de hoja de iOS, tomada de Ionic. La que usa Apple para lo que se arrastra desde abajo.
   * Es `cubic-bezier(0.32, 0.72, 0, 1)`.
   */
  hoja: Easing.bezier(0.32, 0.72, 0, 1),
} as const;

/* ────────────────────────────────────────────────────────────────────────────
   Resortes
   ──────────────────────────────────────────────────────────────────────────── */

type Resorte = {
  stiffness: number;
  damping: number;
  mass: number;
  useNativeDriver: true;
};

/**
 * ⭐⭐ Resorte descrito como lo describe Apple, no como lo pide React Native.
 *
 * Este helper existe por una razón concreta: los dos vocabularios no coinciden y traducir a mano
 * cada vez es donde se cuelan los valores inventados.
 *
 *   Apple habla de **respuesta** (en segundos, lo rápido que llega) y **rebote** (cuánto se pasa).
 *   Son dos números que un diseñador puede razonar. La skill lo dice explícito: Apple *"replaced
 *   the physics triplet (mass/stiffness/damping) with two designer-friendly parameters"*.
 *
 *   React Native pide `stiffness`, `damping` y `mass`, que son la física cruda.
 *
 * La conversión es cerrada, no aproximada. Para masa 1:
 *
 *   ω = 2π / respuesta            (frecuencia natural)
 *   stiffness = ω²
 *   damping   = 2 · ζ · ω         con ζ = 1 − rebote  (el coeficiente de amortiguamiento)
 *
 * Con `rebote = 0` sale ζ = 1, o sea amortiguamiento crítico: llega y se para, sin pasarse.
 *
 * ⚠️ Y `rebote` va a 0 POR DEFECTO a propósito. La skill de Apple es tajante en cuándo se permite
 * el rebote: *"Add bounce only when the gesture itself carried momentum."* Un menú que solo
 * aparece no traía inercia de ningún sitio, así que si se pasa del sitio se ve como un error, no
 * como algo vivo. El rebote se lo gana un dedo que lanza algo, no un `setState`.
 */
export function resorte(respuesta: number, rebote = 0): Resorte {
  const w = (2 * Math.PI) / respuesta;
  return {
    stiffness: Math.round(w * w),
    damping: Math.round(2 * (1 - rebote) * w * 100) / 100,
    mass: 1,
    useNativeDriver: true,
  };
}

/**
 * Los tres resortes que usa la app, con los valores exactos que publica Apple en la tabla de
 * *Designing Fluid Interfaces*. No se inventa ninguno.
 *
 *   mover / recolocar   amortiguamiento 1,0   respuesta 0,4
 *   rotar               amortiguamiento 0,8   respuesta 0,4
 *   hoja / cajón        amortiguamiento 0,8   respuesta 0,3
 */
export const RESORTE = {
  /** El de siempre. Sin rebote, para cualquier cosa que cambie de sitio o de tamaño. */
  normal: resorte(0.4),
  /** Rápido, para lo que responde a un toque directo. */
  vivo: resorte(0.3),
  /** Con inercia. SOLO donde el gesto del usuario traía impulso. */
  impulso: resorte(0.3, 0.2),
} as const;

/* ────────────────────────────────────────────────────────────────────────────
   Accesibilidad
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * ⭐ Caché de módulo del ajuste, para arrancar los hooks con el valor REAL.
 *
 * Sin esto había una carrera: `useReducirMovimiento` arrancaba en `false` y se corregía async,
 * así que las barras y columnas capturaban `reducir ? destino : 0` en su `useRef` ANTES de saber
 * la verdad. Resultado: en el primer pintado tras abrir la app podía haber animación con el
 * ajuste puesto, que es justo lo que Apple revisa a mano.
 *
 * La lectura async se lanza al cargar el módulo, o sea durante la fase de 'comprobando' de
 * App.tsx, que es tiempo de sobra antes de que se monte ninguna pantalla de datos. La
 * suscripción de módulo no se limpia nunca a propósito: la caché tiene que vivir lo que la app.
 */
let reducirConocido = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    reducirConocido = v;
  })
  .catch(() => undefined);
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
  reducirConocido = v;
});

/**
 * ⭐⭐ ¿Tiene el usuario "Reducir movimiento" activado en Ajustes?
 *
 * Esto NO es un extra opcional, y hay dos motivos para tratarlo como parte del sistema:
 *
 *   1. Las animaciones provocan mareo real en gente con trastornos vestibulares. Es la razón por
 *      la que iOS tiene el ajuste.
 *   2. Apple revisa la app a mano. Ignorar un ajuste de accesibilidad del sistema es motivo de
 *      rechazo, y llegados ahí cuesta una semana de calendario.
 *
 * ⚠️ Reducir NO es apagar. La skill de Apple lo deja claro: *"Reduced motion doesn't mean no
 * feedback — it means a gentler, non-vestibular equivalent."* Lo que se quita es el DESPLAZAMIENTO
 * (translate, scale, resortes); lo que se queda es la opacidad y el color, porque esos ayudan a
 * entender qué ha cambiado y no marean a nadie.
 *
 * Se escucha el cambio en vivo: el usuario puede activarlo con la app abierta. Y arranca con la
 * caché de módulo, no con `false`, para que el primer render ya acierte.
 */
export function useReducirMovimiento(): boolean {
  const [reducir, setReducir] = useState(reducirConocido);

  useEffect(() => {
    // Por si el valor de la caché cambió entre el render inicial y la suscripción.
    setReducir(reducirConocido);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducir);
    return () => {
      sub.remove();
    };
  }, []);

  return reducir;
}

/* ────────────────────────────────────────────────────────────────────────────
   Aparición
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Progreso de 0 a 1 que arranca al montar. Es la base de toda entrada de la app.
 *
 * ⚠️ Devuelve el `Animated.Value` en crudo, no el estilo, porque cada sitio interpola lo que le
 * toca: una fila sube un poco, una cifra escala un poco, un halo solo aparece.
 *
 * ⛔ Y NUNCA se anima desde `scale(0)`. Emil: *"Nothing in the real world disappears and reappears
 * completely. Elements animating from scale(0) look like they come out of nowhere."* Por eso las
 * escalas de esta app arrancan en 0,96-0,98, nunca en 0.
 */
export function useAparicion(retardo = 0, ms: number = MS.entra): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  const reducir = useReducirMovimiento();

  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      // Con movimiento reducido la opacidad sigue, y va más corta: sin desplazamiento no hace
      // falta tiempo para leer un recorrido que no existe.
      duration: reducir ? 140 : ms,
      delay: reducir ? 0 : retardo,
      easing: CURVA.sale,
      useNativeDriver: true,
    }).start();
  }, [v, retardo, ms, reducir]);

  return v;
}

/**
 * Estilo de entrada listo para usar: aparece subiendo unos píxeles.
 *
 * Es el patrón `opacity: 0; translateY(8px)` → `opacity: 1; translateY(0)` de la skill, que es el
 * mínimo que hace que algo se sienta colocado en vez de pegado.
 */
export function useEntrada(retardo = 0, desde = 8) {
  const v = useAparicion(retardo);
  const reducir = useReducirMovimiento();

  return {
    opacity: v,
    // Con movimiento reducido se queda SOLO el fundido. Es exactamente lo que pide el ajuste.
    transform: reducir
      ? []
      : [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [desde, 0] }) }],
  };
}

/**
 * Sigue un número con un resorte, para que una cifra o una barra no salte a su valor nuevo.
 *
 * ⭐ La clave está en de dónde arranca, y es el principio que Apple pone por encima de todos:
 * *"Always animate from the presentation (current) value, never the target value."* Un resorte lo
 * hace por construcción, porque conserva la posición y la velocidad que llevaba. Así, si llegan
 * dos datos seguidos, el segundo redirige el movimiento en vez de cortarlo y empezar de cero, que
 * es el salto visible que delata una interfaz mal montada.
 *
 * ⚠️ El primer valor NO se anima: entra ya puesto. Ver una barra crecer desde cero al abrir la
 * pantalla es ruido, no información, y encima retrasa la lectura del dato.
 *
 * ⚠️ `nativo = false` cuando el valor se va a LEER con `addListener` para pintar texto (el caso
 * de `Cifra`): un valor sin vista nativa enganchada no gana nada con el driver nativo, y así el
 * listener recibe cada fotograma sin depender del puente de eventos.
 */
export function useNumero(destino: number, nativo = true): Animated.Value {
  const v = useRef(new Animated.Value(destino)).current;
  const primero = useRef(true);
  const reducir = useReducirMovimiento();

  useEffect(() => {
    if (primero.current) {
      primero.current = false;
      return;
    }
    if (reducir) {
      v.setValue(destino);
      return;
    }
    Animated.spring(v, { toValue: destino, ...RESORTE.normal, useNativeDriver: nativo }).start();
  }, [v, destino, reducir, nativo]);

  return v;
}
