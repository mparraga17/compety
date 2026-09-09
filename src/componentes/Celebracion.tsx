import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';

import { HALO_PODIO, Halo } from './Halo';
import { Pulsable } from './Pulsable';
import { CURVA, RESORTE, resorte, useReducirMovimiento } from '../movimiento';
import { textos } from '../i18n/textos';
import { tema } from '../tema';

/**
 * Celebración de un momento pico: ganar la semana, cumplir la OMS, ascender, ir primero.
 *
 * ⭐⭐ Es de los POCOS sitios de la app donde una animación llamativa está justificada, y las
 * dos skills de diseño lo dicen con reglas distintas que aquí coinciden:
 *
 *   Emil, la tabla de frecuencia: *"Rare/first-time (onboarding, celebrations) → can add
 *   delight"*. Ganar una semana pasa como mucho una vez por semana, así que está en la fila
 *   donde el deleite es legítimo. La misma animación en el cambio de pestaña sería un error.
 *
 *   Apple, sobre el rebote: *"Add bounce only when the gesture itself carried momentum"*...
 *   y una celebración es la excepción explícita de Emil: *"Avoid bounce in most UI contexts.
 *   Use it for drag-to-dismiss and playful interactions."* Esto ES la interacción juguetona.
 *
 * Coreografía completa (la doc siempre la prometió; ahora el JSX la cumple):
 *   1. El velo aparece en fundido corto (nunca de golpe: un flash asusta), con un HALO del
 *      color del logro arriba: la misma pieza que colorea Competi según tu metal, subida de
 *      intensidad porque aquí es la protagonista del fondo.
 *   2. La tarjeta entra con un resorte CON rebote (damping ~0,7). Es el único rebote de toda
 *      la app, y por eso significa algo: la física distinta marca que este momento es distinto.
 *   3. La cifra entra 80 ms después, escalando desde 0,4 (⚠️ NO desde 0: *"nothing in the real
 *      world appears from nothing"*) y, si es un número puro, CONTANDO hasta su valor desde el
 *      40 %: el mismo principio aplicado al contenido, aterriza en vez de aparecer.
 *   4. Los RAYOS del fondo entran escalonados detrás del emoji, disparados hacia fuera.
 *      Decoración: nunca bloquean el toque.
 *   5. El CONFETI cae solo en los dos momentos más altos (ascenso y liderato). Una pasada y
 *      se acabó: el confeti en bucle deja de ser fiesta y pasa a ser ruido.
 *
 * ⚠️ Con "Reducir movimiento" TODO esto se convierte en un fundido simple: rayos quietos ya
 * puestos, sin confeti, cifra ya en su valor. La regla de Apple: *"Reduced motion doesn't mean
 * no feedback — it means a gentler, non-vestibular equivalent."* La celebración sigue
 * existiendo; lo que desaparece es el movimiento.
 *
 * 📌 Cuando llegue el rebuild con `expo-haptics`: un `notificationAsync(Success)` EXACTAMENTE
 * en el frame en que la tarjeta aterriza. Apple, sobre multimodalidad: *"the visual, the
 * sound, and the haptic must fire on the same frame"*.
 */

type Props = {
  visible: boolean;
  /** Qué se celebra. El emoji grande de arriba. */
  icono: string;
  /** La cifra o el dato protagonista: "1º", "×4 semanas", "150 min". */
  cifra: string;
  titulo: string;
  /** Frase que lo sitúa. Aquí también: un dato sin contexto no dice nada. */
  frase?: string;
  /** Color del momento en `r,g,b`: tiñe el halo, los rayos y la cifra. Sin él, la marca. */
  rgb?: string;
  /** Confeti. RESERVADO a ascenso y liderato: si cae siempre, no significa nada. */
  confetti?: boolean;
  onCerrar: () => void;
};

/** Resorte de la tarjeta: el ÚNICO con rebote de la app. Respuesta 0,45, rebote 0,3. */
const RESORTE_FIESTA = resorte(0.45, 0.3);

/** Rayos del fondo, detrás del emoji. Ocho, como las puntas de un destello clásico. */
const N_RAYOS = 8;

/** Piezas de confeti. Pocas: es una lluvia breve, no una tormenta que tape la tarjeta. */
const N_CONFETI = 18;

/**
 * Paleta del confeti: los colores que YA significan algo en la app (marca, metales, tinta).
 * Nada de arcoíris: la fiesta también es de la casa.
 */
const COLORES_CONFETI: readonly string[] = [
  tema.color.marca,
  tema.color.oro,
  tema.color.plata,
  tema.color.bronce,
  tema.color.texto,
];

type Pieza = {
  v: Animated.Value;
  /** Posición horizontal de salida, en % del ancho. */
  x: number;
  /** Deriva lateral durante la caída, en px. */
  deriva: number;
  /** Vueltas que da, con signo. */
  giro: string;
  tam: number;
  color: string;
  redonda: boolean;
  retardo: number;
  duracion: number;
};

/**
 * Lluvia de confeti en JS puro: 18 vistas con transform y opacidad, driver nativo.
 *
 * ⚠️ Dura más de 300 ms y arranca lenta (Easing.in), y las dos cosas son deliberadas: el techo
 * de 300 ms y el veto a `ease-in` son reglas de RESPUESTA de interfaz, donde el arranque lento
 * se lee como retraso. Esto no responde a nadie: es física decorativa, y una cosa que CAE
 * acelera, porque así funciona la gravedad. Un confeti a velocidad constante flota como nieve.
 *
 * Una sola pasada por montaje: cae, se desvanece al 75 % del recorrido y no vuelve.
 */
function Confeti() {
  const alto = Dimensions.get('window').height;

  // Las piezas se sortean UNA vez por montaje: posición, color, giro y tempo.
  const piezas = useMemo<readonly Pieza[]>(
    () =>
      Array.from({ length: N_CONFETI }, () => ({
        v: new Animated.Value(0),
        x: 6 + Math.random() * 88,
        deriva: (Math.random() - 0.5) * 90,
        giro: `${(Math.random() < 0.5 ? -1 : 1) * (180 + Math.round(Math.random() * 360))}deg`,
        tam: 5 + Math.round(Math.random() * 4),
        color: COLORES_CONFETI[Math.floor(Math.random() * COLORES_CONFETI.length)],
        redonda: Math.random() < 0.4,
        retardo: Math.round(Math.random() * 260),
        duracion: 1000 + Math.round(Math.random() * 450),
      })),
    [],
  );

  useEffect(() => {
    Animated.parallel(
      piezas.map((p) =>
        Animated.sequence([
          Animated.delay(p.retardo),
          Animated.timing(p.v, {
            toValue: 1,
            duration: p.duracion,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    ).start();
  }, [piezas]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {piezas.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            top: -16,
            left: `${p.x}%`,
            width: p.tam,
            height: p.tam * (p.redonda ? 1 : 1.6),
            borderRadius: p.redonda ? p.tam / 2 : 1,
            backgroundColor: p.color,
            opacity: p.v.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
            transform: [
              {
                translateY: p.v.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, alto * 0.72],
                }),
              },
              { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.deriva] }) },
              { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', p.giro] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

/**
 * Cifra que CUENTA hasta su valor, desde el 40 %.
 *
 * Es el principio de "nada aparece desde la nada" aplicado al contenido: el número aterriza en
 * su valor en vez de estar ya puesto, y el resorte con impulso hace que llegue con la física
 * de la tarjeta. Desde el 40 % y no desde 0: contar desde cero tarda y no informa, igual que
 * la escala mínima de 0,4 de la skill.
 *
 * ⚠️ Driver JS obligado: el valor se lee con `addListener` para pintar texto, exactamente el
 * mismo caso que `Cifra`. Y con "Reducir movimiento" el número entra ya puesto.
 */
function CifraQueSube({ hasta, reducir }: { hasta: number; reducir: boolean }) {
  const v = useRef(new Animated.Value(Math.round(hasta * 0.4))).current;
  const [visible, setVisible] = useState(reducir ? hasta : Math.round(hasta * 0.4));

  useEffect(() => {
    if (reducir) {
      setVisible(hasta);
      return;
    }
    const id = v.addListener(({ value }) => setVisible(Math.round(value)));
    Animated.sequence([
      Animated.delay(80),
      Animated.spring(v, { toValue: hasta, ...RESORTE.impulso, useNativeDriver: false }),
    ]).start();
    return () => {
      v.removeListener(id);
    };
  }, [v, hasta, reducir]);

  return <>{visible}</>;
}

export function Celebracion({
  visible,
  icono,
  cifra,
  titulo,
  frase,
  rgb = HALO_PODIO.marca.rgb,
  confetti = false,
  onCerrar,
}: Props) {
  const t = textos();
  const reducir = useReducirMovimiento();
  const velo = useRef(new Animated.Value(0)).current;
  const tarjeta = useRef(new Animated.Value(0)).current;
  const dato = useRef(new Animated.Value(0)).current;
  const rayos = useRef(
    Array.from({ length: N_RAYOS }, () => new Animated.Value(0)),
  ).current;

  // Si la cifra es un número puro, cuenta hasta su valor. "Div. 2" o "1º" entran como texto.
  const numero = /^\d+$/.test(cifra) ? parseInt(cifra, 10) : null;

  useEffect(() => {
    if (!visible) {
      velo.setValue(0);
      tarjeta.setValue(0);
      dato.setValue(0);
      for (const r of rayos) r.setValue(0);
      return;
    }
    if (reducir) {
      // Fundido simple y ya está: el contenido es la celebración, no el movimiento. Los rayos
      // quedan puestos de inicio: son parte del cuadro, lo que se quita es el desplazamiento.
      Animated.timing(velo, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      tarjeta.setValue(1);
      dato.setValue(1);
      for (const r of rayos) r.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.timing(velo, {
        toValue: 1,
        duration: 180,
        easing: CURVA.sale,
        useNativeDriver: true,
      }),
      Animated.spring(tarjeta, { toValue: 1, ...RESORTE_FIESTA }),
      // La cifra llega justo detrás de la tarjeta: jerarquía en el tiempo, el contenedor
      // primero y el protagonista después, como el hero de Competi.
      Animated.sequence([
        Animated.delay(80),
        Animated.spring(dato, { toValue: 1, ...RESORTE.impulso }),
      ]),
      // Los rayos salen disparados cuando la tarjeta ya aterrizó, uno detrás de otro.
      Animated.sequence([
        Animated.delay(200),
        Animated.stagger(
          30,
          rayos.map((r) => Animated.spring(r, { toValue: 1, ...RESORTE.vivo })),
        ),
      ]),
    ]).start();
  }, [visible, reducir, velo, tarjeta, dato, rayos]);

  if (!visible) return null;

  return (
    <Animated.View style={[s.velo, { opacity: velo }]}>
      {/*
        El halo del color del logro, la MISMA pieza que colorea Competi según tu metal. Más
        intenso que en pantalla porque aquí no compite con datos: es el ambiente de la fiesta.
      */}
      <Halo rgb={rgb} intensidad={0.3} />

      {/* El confeti cae DETRÁS de la tarjeta y nunca intercepta toques. */}
      {confetti && !reducir && <Confeti />}

      <Animated.View
        style={[
          s.tarjeta,
          {
            opacity: tarjeta,
            transform: reducir
              ? []
              : [
                  // Sube desde abajo Y escala desde 0,9: entra como una pieza física, no
                  // como un fundido. El resorte con rebote hace el "aterrizaje".
                  {
                    translateY: tarjeta.interpolate({
                      inputRange: [0, 1],
                      outputRange: [48, 0],
                    }),
                  },
                  { scale: tarjeta.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                ],
          },
        ]}
      >
        {/*
          El emoji con sus rayos detrás. La caja da el radio que los rayos necesitan; el
          transform de cada rayo es la receta de la órbita (rotate y después translate en la
          lista, que se aplica primero): colocado en su ángulo Y orientado hacia fuera.
        */}
        <View style={s.iconoCaja}>
          {rayos.map((r, i) => (
            <Animated.View
              key={i}
              style={[
                s.rayo,
                { backgroundColor: `rgba(${rgb},0.55)` },
                {
                  opacity: r,
                  transform: [
                    { rotate: `${i * (360 / N_RAYOS) + 22.5}deg` },
                    {
                      translateY: r.interpolate({ inputRange: [0, 1], outputRange: [-24, -34] }),
                    },
                    { scaleY: r.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                  ],
                },
              ]}
            />
          ))}
          <Text style={s.icono}>{icono}</Text>
        </View>

        <Animated.Text
          style={[
            s.cifra,
            { color: `rgb(${rgb})` },
            {
              opacity: dato,
              transform: reducir
                ? []
                : [{ scale: dato.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
            },
          ]}
        >
          {numero !== null ? <CifraQueSube hasta={numero} reducir={reducir} /> : cifra}
        </Animated.Text>
        <Text style={s.titulo}>{titulo}</Text>
        {frase !== undefined && <Text style={s.frase}>{frase}</Text>}

        <Pulsable style={s.boton} accessibilityRole="button" onPress={onCerrar}>
          <Text style={s.botonTexto}>{t.cerrar}</Text>
        </Pulsable>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  velo: {
    // ⚠️ `absoluteFill` y no `absoluteFillObject`: RN 0.86 solo tipa el primero.
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10,11,14,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tema.espacio.l,
    zIndex: 10,
  },
  tarjeta: {
    backgroundColor: tema.color.superficie,
    borderRadius: tema.radio.l,
    paddingVertical: tema.espacio.xl,
    paddingHorizontal: tema.espacio.l,
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: tema.espacio.s,
  },
  // Caja del emoji con margen para que los rayos quepan sin desbordar la tarjeta.
  iconoCaja: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  icono: { fontSize: 44 },
  // El rayo nace centrado en la caja; su transform lo coloca en el anillo.
  rayo: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -1.5,
    marginTop: -7,
    width: 3,
    height: 14,
    borderRadius: 1.5,
  },
  // La cifra en el tamaño protagonista del sistema: es EL dato del momento. El color lo pone
  // el logro (oro en las victorias, marca en el resto).
  cifra: { ...tema.tipo.cifraPar },
  titulo: { fontSize: 17, fontWeight: '600', color: tema.color.texto, textAlign: 'center' },
  frase: {
    ...tema.tipo.detalle,
    color: tema.color.textoSuave,
    textAlign: 'center',
    lineHeight: 19,
  },
  boton: {
    marginTop: tema.espacio.m,
    minHeight: tema.tactil,
    justifyContent: 'center',
    paddingHorizontal: tema.espacio.xl,
    borderRadius: tema.radio.m,
    backgroundColor: tema.color.marca,
  },
  botonTexto: { ...tema.tipo.cuerpo, color: tema.color.fondo, fontWeight: '600' },
});
