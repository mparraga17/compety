import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { Feed, type PersonaRef } from './Feed';
import { Recarga } from '../componentes/Recarga';
import { Aparece } from '../componentes/Aparece';
import { tonoAvatar } from '../componentes/Avatar';
import { Barra } from '../componentes/Barra';
import { Ciencia } from '../componentes/Ciencia';
import { HALO_PODIO, Halo, haloDePuesto } from '../componentes/Halo';
import { escalonDe, useEntrada } from '../movimiento';
import { Pulsable } from '../componentes/Pulsable';
import { ChipRacha } from '../componentes/Racha';
import { Selector } from '../componentes/Selector';
import { enlaceDeLiga } from '../datos/enlaces';
import { mensajeDe } from '../datos/errores';
import {
  clasificacion,
  palmares,
  semanasGanadas,
  type LigaRemota,
  type Movimiento,
  type Puesto,
  type PuestoCerrado,
} from '../datos/ligas';
import { sincroniza } from '../datos/sincroniza';
import { HAY_SERVIDOR } from '../datos/supabase';
import { etiquetaPersona, inicialPersona, nombreHorizonte, nombreLiga, ordinal } from '../i18n/ligas';
import { conValores, idiomaActual, textos, type Idioma, type Textos } from '../i18n/textos';
import { nombreDeTipo } from '../motor/actividades';
import { zDe } from '../motor/base';
import type { ClaveCiencia } from '../motor/ciencia';
import { cuantosMueven, franjaDe, type FranjaDivision } from '../motor/divisiones';
import { calculaRacha, type Racha } from '../motor/racha';
import type { IdLiga } from '../motor/ligas';
import { HORIZONTES, HORIZONTE_POR_DEFECTO, type IdHorizonte } from '../motor/ranking';
import type { Resultado } from '../motor/sesiones';
import { metalDe, tema } from '../tema';

/**
 * Fuentes de esta pestaña. Responden a "por qué es justo": el handicap primero, porque es lo
 * que explica que barre y correr compitan en la misma tabla.
 */
const FUENTES: readonly ClaveCiencia[] = [
  'basePropia',
  'competicion',
  'compendium',
  'volumen',
  'tope',
  'constancia',
];

/**
 * Clasificacion de las ligas.
 *
 * Criterio visual heredado del panel v2, que el usuario aprobo despues de rechazar la v1:
 * cero bordes de color, la jerarquia la hace el tamano tipografico, y el color solo aparece
 * cuando un dato sale de lo habitual. La seleccion se marca con peso y un punto, no con un
 * borde de color saturado.
 */

type Props = {
  ligas: readonly LigaRemota[];
  /**
   * ⭐ La liga que se enseña la decide App, no esta pantalla. Antes era un `useState` inicializado
   * con `ligas[0]` al montar, y App monta las pestañas UNA vez: quien entraba sin ligas y se unía
   * a la primera se quedaba con `null` para siempre (tabla vacía, "invita a alguien", como si la
   * liga a la que acababa de entrar no existiera), y quien creaba una nueva seguía viendo la
   * primera de la lista. Fue el primer bug reportado por los amigos en TestFlight.
   */
  ligaActiva: string | null;
  onLigaActiva: (id: string) => void;
  /** Vuelve a leer la LISTA de ligas (miembros, nombres). Se llama en cada recarga. */
  onRecargarLigas?: () => Promise<void>;
  /**
   * Contador que sube cuando un aviso (reacción, comentario) pide ir al feed. La pantalla se
   * desliza a la segunda página y el feed se recarga.
   */
  irAlFeed?: number;
  /** Abre la ficha de una persona (sus entrenos), desde la tabla o desde el feed. */
  onPersona?: (persona: PersonaRef) => void;
  yo: string | null;
  onCrear: () => void;
  onEntrar: () => void;
  /** Abre la pantalla de unirse a la liga pública de tu ciudad y distrito. */
  onZona: () => void;
  /** Avisa de tus ascensos y descensos al cerrarse una jornada de zona. */
  onMovimientos?: (movimientos: readonly Movimiento[]) => void;
  /**
   * Avisa de que vas PRIMERO en la liga activa, con la ventana por defecto. Lo celebra App,
   * que es quien decide si ese momento ya se celebró esta semana.
   */
  onPrimero?: (ligaId: string, puntos: number) => void;
  onAmigos: () => void;
  onPerfil: () => void;
  /** Inicial para el boton de perfil. Sale del nombre visible. */
  inicial: string;
  /**
   * Resultado del motor, para poder mostrar tu progreso contra TI MISMO junto al puesto.
   *
   * ⭐ No es un extra. Un estudio de 2025 sobre leaderboards encontró que el ranking sube la
   * motivación y la presión percibida a la vez, y que reduce la implicación de quien no valora
   * competir. La regla que sale de ahí: nunca mostrar una posición absoluta sin mostrar también el
   * progreso propio.
   */
  resultado: Resultado | null;
};

/**
 * Cabecera comun: titulo a la izquierda, agregar amigos y perfil a la derecha.
 *
 * ⭐ Va en las dos ramas de la pantalla (con ligas y sin ellas) porque el caso de "todavia no
 * tienes liga" es justo cuando mas falta hace poder buscar a alguien. En la primera version los
 * accesos solo existian cuando ya habia ligas, que es al reves de lo que hace falta.
 */
function Cabecera({
  t,
  onAmigos,
  onPerfil,
  inicial,
  racha,
}: {
  t: Textos;
  onAmigos: () => void;
  onPerfil: () => void;
  inicial: string;
  /** La racha semanal, para el chip 🔥. null mientras el motor no ha devuelto sesiones. */
  racha?: Racha | null;
}) {
  return (
    <View style={s.cabecera}>
      <Text style={s.marca}>{t.competi}</Text>
      {/*
        ⛔ EL SELECTOR ES/EN YA NO ESTÁ AQUÍ. Se movió a Perfil, a la sección de ajustes.

        El usuario dijo que quedaba "bastante feo" y suelto, y el motivo de fondo es de reparto de
        espacio: esta cabecera es donde vive la acción que hace crecer el producto (agregar amigos),
        y el idioma se cambia una vez en la vida de la app. Con las dos cosas juntas el idioma tenía
        que ir a 10px para caber, que es la señal de que no era su sitio.

        Se llega con un toque en tu inicial, que es el mismo camino que usan Twitter o Instagram.
      */}
      <View style={s.cabeceraBotones}>
        {/*
          ⭐ La racha vive en la cabecera y no dentro de ninguna liga, porque es la competición
          contra TI MISMO: funciona sin servidor y sin amigos, y por eso está también en la rama
          de "todavía no tienes liga", que es justo cuando más hace falta tener algo propio que
          mantener vivo.
        */}
        {racha != null && <ChipRacha racha={racha} />}
        {/*
          ⛔ ANTES ERA UN "+" SUELTO, y el usuario dijo que no era intuitivo. Tenía razón: un "+"
          en la cabecera de una app de ligas puede significar crear liga, añadir amigo o registrar
          sesión. Un icono sin etiqueta obliga a adivinar, y aquí la acción es la que hace crecer
          el producto, así que es la última que puede quedar escondida.

          ⇒ Ahora lleva la palabra al lado. Ocupa más, y merece la pena.
        */}
        <Pulsable
          style={s.botonAmigos}
          accessibilityRole="button"
          accessibilityLabel={t.agregarAmigos}
          onPress={onAmigos}
        >
          <Text style={s.botonAmigosMas}>+</Text>
          <Text style={s.botonAmigosTexto}>{t.amigos}</Text>
        </Pulsable>
        {/* Escala más marcada: es un objetivo redondo y pequeño, así que 0,97 no se vería. */}
        <Pulsable
          escala={0.92}
          style={s.iconoBoton}
          accessibilityRole="button"
          accessibilityLabel={t.tuPerfil}
          onPress={onPerfil}
        >
          <Text style={s.iconoInicial}>{inicial}</Text>
        </Pulsable>
      </View>
    </View>
  );
}

/**
 * Una fila de la clasificación.
 *
 * ⭐ Extraída a componente para que cada una tenga su propio retardo de entrada. Con todas en el
 * mismo `map` no había forma de escalonarlas, y el escalonado no es adorno aquí: la tabla se lee
 * DE ARRIBA ABAJO, así que hacer que llegue en ese orden es decirle al ojo por dónde empezar.
 * Emil: *"When multiple elements enter together, stagger their appearance. This creates a
 * cascading effect that feels more natural than everything appearing at once."*
 *
 * ⚠️ Con 40 ms por fila y tope en la octava, la tabla entera está puesta en 320 ms. El tope existe
 * para que una liga de treinta personas no tarde más de un segundo en acabar de pintarse.
 */
/**
 * ⭐ Retardo base de la tabla, para que la cifra del hero llegue ANTES que las filas.
 *
 * El comentario del hero prometía "la cifra entra un poco antes que la tabla", pero el hero iba
 * con retardo 0 y la fila 0 también (`escalonDe(0) = 0`): entraban a la vez y la jerarquía
 * temporal descrita no existía. Con 60 ms de base la promesa se cumple de verdad.
 */
const RETARDO_TABLA = 60;

/** El rgb de cada metal del podio, para los degradados de las barras. Mismos valores que el halo. */
const RGB_METAL: readonly string[] = [HALO_PODIO.oro.rgb, HALO_PODIO.plata.rgb, HALO_PODIO.bronce.rgb];

function Fila({
  p,
  i,
  tope,
  esYo,
  idioma,
  t,
  franja = null,
  corona = false,
  onPersona,
}: {
  p: Puesto;
  i: number;
  tope: number;
  esYo: boolean;
  idioma: Idioma;
  t: Textos;
  /** Solo en ligas de zona: si este puesto sube, baja o se queda el lunes. null = liga privada. */
  franja?: FranjaDivision | null;
  /** La corona del líder. La decide el padre: solo cuando hay al menos dos compitiendo. */
  corona?: boolean;
  /** Tocar la fila abre la ficha de esa persona con sus entrenos. */
  onPersona?: () => void;
}) {
  const entrada = useEntrada(RETARDO_TABLA + escalonDe(i));
  const etiqueta = etiquetaPersona(p.nombre, esYo, idioma);
  // El metal marca el PUESTO; el periwinkle del avatar sigue marcando "eres tu". Dos señales que
  // no se pisan: puedes ser segundo y reconocerte igual.
  const metal = metalDe(i + 1);
  const enPodio = i < 3;
  // Identidad de la persona: mismo nombre, mismo tono. "Eres tú" lo sobreescribe con la marca.
  const tinte = tonoAvatar(p.nombre);

  return (
    <Animated.View style={entrada}>
    {/*
      ⭐ La fila entera es pulsable y abre la ficha de la persona (sus entrenos). Es la petición
      de los amigos de la beta: "si estás en la liga con alguien y le pulsas, ves sus entrenos".
      `fila` en el Pulsable: solo cambia el fondo, sin hundirse, que es lo que toca a una fila.
    */}
    <Pulsable
      fila
      style={s.fila}
      onPress={onPersona}
      disabled={onPersona === undefined}
      accessibilityRole="button"
      accessibilityLabel={`${etiqueta} · ${p.puntos} ${t.puntos}`}
    >
      <Text style={[s.puesto, enPodio && { color: metal, fontWeight: '600' }]}>{i + 1}</Text>
      {/*
        ⭐ La franja de división: un glifo pequeño junto al puesto, no un fondo de color. Regla
        de la v2: el color solo aparece cuando significa algo, y aquí significa "este puesto se
        mueve el lunes". Sube en marca (periwinkle) y baja en el coral de "peor", los dos
        significados que esos colores ya tienen en toda la app.

        ⚠️ El hueco se reserva SIEMPRE en ligas de zona (texto vacío cuando no hay movimiento),
        para que las filas con y sin flecha no desalineen las columnas.
      */}
      {franja !== null && (
        <Text
          style={[s.franja, franja === 'sube' ? s.franjaSube : s.franjaBaja]}
          accessibilityLabel={
            franja === 'sube' ? t.zonaSube : franja === 'baja' ? t.zonaBaja : undefined
          }
        >
          {franja === 'sube' ? '▲' : franja === 'baja' ? '▼' : ''}
        </Text>
      )}
      {/*
        ⭐ El avatar lleva el tono de la PERSONA y la inicial en ese tono pleno. Tu tinte de marca
        sigue mandando: los estilos `Yo` van después en el array y pisan al tinte de identidad.
      */}
      <View style={[s.avatar, { backgroundColor: `rgba(${tinte},0.15)` }, esYo && s.avatarYo]}>
        <Text style={[s.avatarTexto, { color: `rgb(${tinte})` }, esYo && s.avatarTextoYo]}>
          {inicialPersona(p.nombre, esYo, idioma)}
        </Text>
      </View>
      <View style={s.filaMedio}>
        <View style={s.nombreFila}>
          <Text style={[s.nombre, esYo && s.negrita]} numberOfLines={1}>
            {etiqueta}
          </Text>
          {/*
            ⭐ La corona del líder: la ceremonia que faltaba en el podio. Un emoji pequeño junto
            al nombre, no un fondo ni un borde, que son los recursos que las reglas de la v2
            prohíben. Es la misma familia que 🏆 y 🎯: lo lúdico va en glifos, no en cajas.
          */}
          {corona && <Text style={s.corona}>{'\u{1F451}'}</Text>}
        </View>
        <Text style={s.filaDetalle}>
          {p.sesiones === 1 ? t.unaSesion : conValores(t.nSesiones, { n: p.sesiones })}
          {p.tono === 'fuerte' ? ` · ${t.semanaFuerte}` : ''}
        </Text>
        {/*
          Barra de proporción, relativa al primero. Es la señal que hace la tabla legible de un
          vistazo: sin ella son siete números que hay que comparar a mano.

          ⭐ Ahora CRECE hasta su valor, y con el mismo retardo que la fila más un poco, así el
          número llega primero y la barra lo confirma. Antes aparecía ya llena, que es un dato
          correcto y una comparación que hay que reconstruir a mano.
        */}
        <View style={s.pistaCaja}>
          {/*
            ⭐ En el podio la barra lleva un degradado del metal, de tenue a pleno: el destello
            apunta a la punta, que es donde está el dato. Del cuarto en adelante, marca plana:
            el brillo es ceremonia del podio, no decoración de toda la tabla.
          */}
          <Barra
            valor={p.puntos / tope}
            color={enPodio ? metal : tema.color.marca}
            degradado={enPodio ? [`rgba(${RGB_METAL[i]},0.4)`, `rgb(${RGB_METAL[i]})`] : undefined}
            fondo={tema.color.superficieSutil}
            retardo={RETARDO_TABLA + escalonDe(i) + 80}
          />
        </View>
      </View>
      <Text style={[s.puntos, enPodio && { color: metal }, esYo && s.negrita]}>{p.puntos}</Text>
    </Pulsable>
    </Animated.View>
  );
}

/** Ancho de cada etiqueta del indicador de páginas. Fijo, para que el subrayado sepa dónde ir. */
const ANCHO_PESTANITA = 104;

/**
 * ⭐ Las dos páginas de Competi: "Para ti" (tu clasificación) y "Amigos" (el feed). Se cambia
 * deslizando, como en TikTok, o tocando la etiqueta. El subrayado sigue al dedo: va atado al
 * desplazamiento real del pager con `Animated.event`, no a un estado discreto, así que a mitad
 * de gesto está a mitad de camino. Es lo que hace que el gesto se sienta físico y no como dos
 * pantallas que se alternan.
 */
function Pestanitas({
  scrollX,
  ancho,
  pagina,
  etiquetas,
  onIr,
}: {
  scrollX: Animated.Value;
  ancho: number;
  pagina: number;
  etiquetas: readonly string[];
  onIr: (pagina: number) => void;
}) {
  const desplazamiento = scrollX.interpolate({
    inputRange: [0, Math.max(ancho, 1)],
    outputRange: [0, ANCHO_PESTANITA],
    extrapolate: 'clamp',
  });
  return (
    <View style={s.pestanitas} accessibilityRole="tablist">
      {etiquetas.map((etiqueta, i) => (
        <Pulsable
          key={etiqueta}
          style={s.pestanita}
          onPress={() => onIr(i)}
          accessibilityRole="tab"
          accessibilityState={{ selected: pagina === i }}
        >
          <Text style={[s.pestanitaTexto, pagina === i && s.pestanitaActiva]}>{etiqueta}</Text>
        </Pulsable>
      ))}
      <Animated.View style={[s.subrayado, { transform: [{ translateX: desplazamiento }] }]} />
    </View>
  );
}

/**
 * El pager horizontal con las dos páginas. Cada página ocupa el ancho de la ventana; la primera
 * lleva dentro su propio scroll vertical (o el estado vacío), la segunda el feed.
 */
function Paginas({
  ancho,
  scrollX,
  pagerRef,
  onPagina,
  children,
}: {
  ancho: number;
  scrollX: Animated.Value;
  pagerRef: React.RefObject<ScrollView | null>;
  onPagina: (pagina: number) => void;
  children: readonly [ReactNode, ReactNode];
}) {
  // Altura medida: cada página la recibe explícita, así los scrolls verticales de dentro saben
  // cuánto miden sin depender de cómo estire el contenedor horizontal.
  const [alto, setAlto] = useState(0);
  return (
    <Animated.ScrollView
      ref={pagerRef}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      bounces={false}
      scrollEventThrottle={16}
      /*
        ⛔⛔ BUG DEL DOBLE TOQUE EN "ENVIAR" (15 sep). En la hoja de comentarios del feed, con el
        teclado abierto, el primer toque en Enviar solo cerraba el teclado y hacía falta un
        segundo toque para enviar. La hoja tenía su `FlatList` con `keyboardShouldPersistTaps`
        bien puesto y el botón fuera de ella, así que el culpable no estaba en la hoja.

        Estaba AQUÍ. El sistema de responders de React Native recorre el árbol de REACT, no el
        nativo: aunque la hoja es un `Modal` (otra ventana nativa), sus hijos siguen siendo
        descendientes de este pager en el árbol de componentes. Y `ScrollView` implementa
        `onStartShouldSetResponderCapture` así (leído en `ScrollView.js` de la 0.86): si hay un
        `TextInput` con foco, `keyboardShouldPersistTaps` es `never` (el valor por defecto) y el
        toque no cae en el propio TextInput, el scroll CAPTURA el toque y al soltar hace
        `blurTextInput`. El botón nunca recibía el primer toque. La segunda vez ya no había foco
        y el toque llegaba.

        Con `handled`, un toque sobre algo que lo maneja (un botón) pasa, y un toque en el vacío
        sigue cerrando el teclado. Es lo mismo que ya se aplicó en Entrar y NuevaLiga por el
        mismo síntoma; aquí costó más verlo porque el ancestro estaba a dos pantallas.
      */
      keyboardShouldPersistTaps="handled"
      onLayout={(ev) => setAlto(ev.nativeEvent.layout.height)}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
      })}
      onMomentumScrollEnd={(ev) => onPagina(Math.round(ev.nativeEvent.contentOffset.x / ancho))}
      style={s.pager}
    >
      <View style={{ width: ancho, height: alto > 0 ? alto : undefined }}>{children[0]}</View>
      <View style={{ width: ancho, height: alto > 0 ? alto : undefined }}>{children[1]}</View>
    </Animated.ScrollView>
  );
}

export function Ligas({
  ligas,
  ligaActiva,
  onLigaActiva,
  onRecargarLigas,
  irAlFeed = 0,
  onPersona,
  yo,
  onCrear,
  onEntrar,
  onZona,
  onMovimientos,
  onPrimero,
  onAmigos,
  onPerfil,
  inicial,
  resultado,
}: Props) {
  const idioma = idiomaActual();
  const t = textos(idioma);
  const [horizonte, setHorizonte] = useState<IdHorizonte>(HORIZONTE_POR_DEFECTO);

  // Las dos páginas: 0 = Para ti, 1 = Amigos. El pager es la fuente de verdad del gesto.
  const { width: ancho } = useWindowDimensions();
  const [pagina, setPagina] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const pager = useRef<ScrollView | null>(null);
  const irA = useCallback(
    (p: number) => {
      pager.current?.scrollTo({ x: p * ancho, animated: true });
      setPagina(p);
    },
    [ancho],
  );
  // Un aviso de reacción o comentario trae aquí: a la página del feed.
  useEffect(() => {
    if (irAlFeed > 0) irA(1);
  }, [irAlFeed, irA]);
  const [tabla, setTabla] = useState<readonly Puesto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Semanas ganadas por persona este año: la clasificación de la temporada. */
  const [temporada, setTemporada] = useState<readonly { usuario: string; nombre: string; ganadas: number }[]>([]);
  /** Cierres de jornadas semanales, para el resultado de la última. */
  const [cierres, setCierres] = useState<readonly PuestoCerrado[]>([]);

  /**
   * ⭐ La racha se calcula del resultado del motor, EN el teléfono: no necesita servidor ni
   * cuenta, así que existe aunque no tengas ninguna liga. Es la mecánica que compensa el
   * ranking: la evidencia de leaderboards dice que la posición absoluta desmotiva a quien no
   * valora competir, y la racha es competición contra uno mismo.
   */
  const racha = useMemo<Racha | null>(
    () => (resultado === null ? null : calculaRacha(resultado.sesiones)),
    [resultado],
  );

  /**
   * ⛔⛔ Número de secuencia de la carga. Solo la petición MÁS RECIENTE puede pintar.
   *
   * Sin esto, cambiar rápido de liga o de ventana dejaba dos peticiones en vuelo y ganaba la que
   * llegara última, no la última pedida: la tabla de la liga A podía quedarse bajo el nombre de
   * la liga B, en la pantalla principal del producto. El efecto de la temporada, veinte líneas
   * más abajo, ya llevaba este candado (`vivo`) y explicaba el riesgo; el de la tabla no. Un
   * arreglo que no se propaga a la función de al lado es medio arreglo.
   */
  const secuencia = useRef(0);

  /**
   * Lee la tabla de una liga en una ventana. Con `sincronizar`, antes sube la puntuación propia.
   *
   * ⚠️ `liga` y `ventana` van por PARÁMETRO y no por cierre: así el efecto de abajo puede decidir
   * qué pedir sin arrastrar una versión vieja de `horizonte`, y `cargar` no cambia de identidad
   * cada vez que cambia el desplegable.
   */
  const cargar = useCallback(
    async (liga: string, ventana: IdHorizonte, sincronizar: boolean) => {
      const mia = ++secuencia.current;
      const vigente = () => mia === secuencia.current;
      setCargando(true);
      setError(null);
      try {
        if (sincronizar) {
          // Se sincroniza primero para que la propia puntuacion este al dia antes de leer la
          // tabla. Sube TODAS las ventanas de golpe, así que solo hace falta al cambiar de liga
          // o al tirar para refrescar, no al cambiar de ventana.
          const r = await sincroniza();
          // Ascensos y descensos de la jornada recien cerrada. Los celebra App, que es quien
          // tiene la Celebracion montada encima de todo. No se filtra por `vigente`: son un
          // hecho del servidor, no un estado de esta tabla, y App ya los celebra una sola vez.
          if (r.movimientos.length > 0) onMovimientos?.(r.movimientos);
        }
        // La lista de ligas se refresca a la vez que la tabla: el "N miembros" del título salía
        // de la lista y no se enteraba de que alguien había entrado hasta reabrir la app.
        const [tablaNueva] = await Promise.all([
          clasificacion(liga, ventana),
          sincronizar ? onRecargarLigas?.() : undefined,
        ]);
        if (!vigente()) return;
        setTabla(tablaNueva);
        /*
          ⭐ Celebración de liderato: se avisa a App cuando vas PRIMERO con al menos un rival.
          Solo en la ventana por defecto, que es la que ve todo el mundo: celebrar también el
          liderato del año al cambiar de desplegable convertiría el momento pico en confeti de
          fondo. El candado de "una vez por semana y liga" lo pone App, igual que con la OMS.
        */
        if (
          ventana === HORIZONTE_POR_DEFECTO &&
          tablaNueva.length > 1 &&
          yo !== null &&
          tablaNueva[0].usuario === yo
        ) {
          onPrimero?.(liga, tablaNueva[0].puntos);
        }
      } catch (e) {
        if (vigente()) setError(mensajeDe(e));
      } finally {
        // El spinner lo apaga solo la petición vigente: si una vieja lo apagara, la nueva
        // seguiría cargando con la rueda parada.
        if (vigente()) setCargando(false);
      }
    },
    [onMovimientos, onPrimero, onRecargarLigas, yo],
  );

  /**
   * Qué pedir y cuándo, en un solo efecto:
   *
   *   cambio de liga (y el arranque)   sincronizar + tabla. La liga nueva puede ser una a la que
   *                                    acabas de entrar y aún no tiene tu puntuación.
   *   cambio de ventana                solo la tabla. La sincronización ya subió las cinco
   *                                    ventanas; repetirla era releer 30 días de HealthKit y hacer
   *                                    treinta escrituras por tocar un desplegable.
   *
   * ⚠️ Al cambiar de liga la tabla se VACÍA antes de pedir, como hace la temporada: enseñar la
   * gente de la liga anterior bajo el nombre de la nueva sería mentir. Al cambiar de ventana no:
   * es la misma gente y los números se actualizan en su sitio, con la rueda encima.
   */
  const ligaAnterior = useRef<string | null>(null);
  useEffect(() => {
    if (ligaActiva === null) {
      ligaAnterior.current = null;
      setTabla([]);
      return;
    }
    const cambioDeLiga = ligaAnterior.current !== ligaActiva;
    ligaAnterior.current = ligaActiva;
    if (cambioDeLiga) setTabla([]);
    void cargar(ligaActiva, horizonte, cambioDeLiga);
  }, [ligaActiva, horizonte, cargar]);

  /** Tirar para refrescar: sincroniza y relee, siempre. */
  const refrescar = useCallback(() => {
    if (ligaActiva !== null) void cargar(ligaActiva, horizonte, true);
  }, [cargar, ligaActiva, horizonte]);

  /**
   * ⭐ La TEMPORADA de la liga activa: semanas ganadas y el último cierre. Aparte de `cargar`
   * porque no depende de la ventana temporal, y con su candado `vivo` porque el cambio rápido
   * de liga podría dejar llegar tarde los datos de la anterior.
   *
   * ⚠️ Al cambiar de liga se vacía ANTES de pedir: enseñar el palmarés de la liga anterior
   * bajo el nombre de la nueva sería mentir. Y si el servidor falla se queda vacío, que aquí
   * no afirma nada: la sección simplemente no se pinta.
   */
  useEffect(() => {
    setTemporada([]);
    setCierres([]);
    if (ligaActiva === null) return;
    let vivo = true;
    void (async () => {
      const [ganadas, ultimos] = await Promise.all([
        semanasGanadas(ligaActiva).catch(() => []),
        palmares(ligaActiva, 'wtd').catch(() => []),
      ]);
      if (!vivo) return;
      setTemporada(ganadas);
      setCierres(ultimos);
    })();
    return () => {
      vivo = false;
    };
  }, [ligaActiva]);

  if (!HAY_SERVIDOR) {
    return (
      <View style={[s.fondo, s.centro]}>
        <Text style={s.titulo}>{t.sinServidor}</Text>
        <Text style={s.suave}>{t.sinServidorTexto}</Text>
      </View>
    );
  }

  const feedPagina = (
    <Feed yo={yo} activo={pagina === 1} senal={irAlFeed} onAmigos={onAmigos} onPersona={onPersona} />
  );
  const pestanitas = (
    <Pestanitas
      scrollX={scrollX}
      ancho={ancho}
      pagina={pagina}
      etiquetas={[t.paraTi, t.feedAmigos]}
      onIr={irA}
    />
  );

  if (ligas.length === 0) {
    return (
      <View style={s.fondo}>
        <Halo />
        <Cabecera
          t={t}
          onAmigos={onAmigos}
          onPerfil={onPerfil}
          inicial={inicial}
          racha={racha}
        />
        {pestanitas}
        <Paginas ancho={ancho} scrollX={scrollX} pagerRef={pager} onPagina={setPagina}>
          <View style={s.centro}>
            <Text style={s.titulo}>{t.sinLiga}</Text>
            <Text style={s.suave}>{t.sinLigaTexto}</Text>
            <Pulsable style={s.boton} accessibilityRole="button" onPress={onCrear}>
              <Text style={s.botonTexto}>{t.crearLiga}</Text>
            </Pulsable>
            <Pulsable style={s.secundario} accessibilityRole="button" onPress={onEntrar}>
              <Text style={s.secundarioTexto}>{t.tengoCodigo}</Text>
            </Pulsable>
            {/*
              ⭐ La zona en el estado vacío es la vía que NO exige conocer a nadie: quien llega
              sin amigos en la app puede competir desde el primer día. Es justo el arranque en
              frío que las ligas privadas no resuelven.
            */}
            <Pulsable style={s.secundario} accessibilityRole="button" onPress={onZona}>
              <Text style={s.secundarioTexto}>{t.zonaTitulo}</Text>
            </Pulsable>
          </View>
          {feedPagina}
        </Paginas>
      </View>
    );
  }

  const liga = ligas.find((l) => l.id === ligaActiva) ?? ligas[0];
  const miPuesto = tabla.findIndex((p) => p.usuario === yo);

  /**
   * ⭐ Datos de división de la liga activa, si es de zona.
   *
   * La franja de cada puesto (sube/baja/queda) se calcula AQUÍ con `franjaDe`, que es la
   * réplica de la regla del servidor. La app solo la pinta: los movimientos reales los decide
   * el servidor al cerrar la jornada, así que no hay dos verdades que puedan discrepar.
   */
  const zona = liga?.zona ?? null;
  const mueven = zona !== null ? cuantosMueven(tabla.length) : 0;
  const bordes = zona !== null
    ? { primera: zona.division === 1, ultima: zona.division === zona.divisiones }
    : null;

  /** Frase que explica la jornada. Depende de si hay división arriba y abajo. */
  const fraseJornada = ((): string | null => {
    if (zona === null || bordes === null) return null;
    if (mueven === 0) return t.zonaPocos;
    const sube = !bordes.primera;
    const baja = !bordes.ultima;
    if (sube && baja) return conValores(t.zonaJornada, { s: mueven, b: mueven });
    if (sube) {
      return mueven === 1 ? t.zonaJornadaUnoSube : conValores(t.zonaJornadaSoloSube, { s: mueven });
    }
    if (baja) {
      return mueven === 1 ? t.zonaJornadaUnoBaja : conValores(t.zonaJornadaSoloBaja, { b: mueven });
    }
    // Una sola división en la zona: todavía no hay a dónde subir ni bajar.
    return null;
  })();

  /**
   * ⭐ Compartir la INVITACIÓN, no solo el código: el mensaje lleva el enlace que abre la app
   * con el código puesto (o la página que ofrece TestFlight si no está instalada), y el código
   * escrito por si el mensajero rompe la URL. Es la acción de la que depende que el producto
   * exista, así que vive en dos sitios: el bloque de "compites solo" y la fila del código.
   */
  const compartirLiga = () => {
    // El nombre REAL de la liga (el mismo bug de "General" en vez del nombre vivía aquí: la
    // invitación por WhatsApp decía "te invito a General"). Solo se comparte en ligas privadas
    // (zona === null en los tres puntos de entrada), así que no hay caso de zona.
    const nombre = liga.nombre;
    void Share.share({
      message: conValores(t.invitacion, {
        liga: nombre,
        codigo: liga.codigo,
        enlace: enlaceDeLiga(liga.codigo, nombre),
      }),
    });
  };

  /**
   * Nombre visible de una liga en el selector: la de zona lleva el 📍 y su división.
   *
   * El prefijo lo pidió el usuario (11 sep): "Madrid" y "Chamberí" salían en el desplegable
   * igual que una liga privada más, y no se veía que eran las públicas de su zona. Mismo
   * criterio que el 🔥 de la racha o la 👑 del líder: un glifo del sistema, sin librería de iconos.
   */
  const nombreDe = (l: LigaRemota): string => {
    if (l.zona !== null) {
      return `📍 ${l.zona.distrito ?? l.zona.ciudad} · ${conValores(t.divisionCorta, { n: l.zona.division })}`;
    }
    /*
      ⛔⛔ AQUÍ HABÍA `l.deporte === null ? nombreLiga('global') : l.nombre`, y pintaba "General" u
      "Overall" en vez del NOMBRE de cualquier liga privada que aceptara todos los deportes. En
      TestFlight (11 sep) el usuario abrió el selector y vio "Madrid · Div. 1, Chamberí · Div. 1,
      Overall": su liga "Chavales Z72" estaba ahí, disfrazada. Una liga se llama como la bautizó
      quien la creó; el deporte, si lo tiene, va detrás como apellido.
    */
    return l.deporte === null ? l.nombre : `${l.nombre} · ${nombreLiga(l.deporte as IdLiga, idioma)}`;
  };

  /**
   * ⭐ Tu progreso contra TU propia base, para acompañar al puesto.
   *
   * Compara tu última sesión de esta liga con tu media personal. Es lo que le da algo que mirar a
   * quien va quinto, y responde al problema nº1 del estudio JAMIA: la gente no sabe qué es normal
   * para sí misma, así que un puesto malo sin contexto solo desanima.
   *
   * null cuando no hay base suficiente. No se inventa nada: sin historial no se puede decir si una
   * sesión fue buena o mala.
   */
  const miProgreso = ((): string | null => {
    if (resultado === null || resultado.base.sigma <= 0) return null;

    const deLaLiga = resultado.sesiones.filter(
      (s) => liga?.deporte == null || s.liga === liga.deporte,
    );
    const ultima = [...deLaLiga].sort((a, b) => b.inicio - a.inicio)[0];
    if (ultima === undefined) return null;

    const z = zDe(ultima.carga, resultado.base);
    const clave = z > 1 ? t.progresoMejor : z < -1 ? t.progresoPeor : t.progresoIgual;

    return conValores(clave, {
      deporte: nombreDeTipo(ultima.tipo, idioma),
      min: Math.round(resultado.base.media - resultado.base.sigma),
      max: Math.round(resultado.base.media + resultado.base.sigma),
    });
  })();
  // Referencia de las barras: la puntuacion del primero.
  const tope = Math.max(1, tabla[0]?.puntos ?? 1);

  /**
   * Frase que explica el puesto. Cuatro casos, y el de "primero solo" hacia falta: sin el, la
   * frase quedaba cortada hablando de un segundo que no existe.
   */
  const frase = ((): string => {
    if (miPuesto < 0) return t.noParticipas;
    const yoP = tabla[miPuesto];
    if (miPuesto === 0) {
      const segundo = tabla[1];
      return segundo === undefined
        ? conValores(t.vasPrimeroSolo, { p: yoP.puntos })
        : conValores(t.vasPrimero, { p: yoP.puntos, quien: segundo.nombre });
    }
    return conValores(t.teFaltan, {
      p: tabla[miPuesto - 1].puntos - yoP.puntos,
      quien: tabla[miPuesto - 1].nombre,
    });
  })();

  /**
   * ⭐ La CAZA: qué parte del camino hasta el de delante llevas hecho, en barra.
   *
   * La frase ya dice "te faltan 12 puntos para alcanzar a Perico"; la barra convierte esa resta
   * en distancia que se VE. Es la mecánica que engancha de las divisiones de Duolingo, el
   * objetivo alcanzable siempre delante, aplicada a la persona concreta que tienes que cazar.
   *
   * null cuando vas primero (tu premio es la corona, no una barra de miedo por el de atrás)
   * y cuando el de delante todavía no tiene puntos: 0/0 no es una proporción.
   */
  const caza = ((): number | null => {
    if (miPuesto <= 0) return null;
    const delante = tabla[miPuesto - 1].puntos;
    if (delante <= 0) return null;
    return tabla[miPuesto].puntos / delante;
  })();

  /**
   * La última jornada cerrada: el ganador y tu resultado. Es lo que hace LIGA a la liga: sin
   * resultado que consultar el lunes, la clasificación fluctúa para siempre y nadie gana nunca.
   */
  const jornada = ((): { ganador: PuestoCerrado; mio: PuestoCerrado | null } | null => {
    if (cierres.length === 0) return null;
    const ultima = cierres.reduce(
      (max, c) => (c.inicio > max ? c.inicio : max),
      cierres[0].inicio,
    );
    const filas = cierres.filter((c) => c.inicio === ultima);
    const ganador = filas.find((c) => c.puesto === 1);
    if (ganador === undefined) return null;
    return { ganador, mio: filas.find((c) => c.usuario === yo) ?? null };
  })();

  return (
    <View style={s.fondo}>
      {/*
        ⭐ El halo toma el color del METAL del puesto, así el oro del primero no queda como una
        nota de color suelta. Es el detalle que el usuario echó en falta: "el brillito difuminado
        que se veía en círculo encima".
      */}
      <Halo {...(miPuesto >= 0 ? haloDePuesto(miPuesto + 1) : {})} />
      {/*
        La cabecera y las pestañitas quedan FIJAS y las dos páginas se deslizan debajo: es lo que
        hace que el gesto se lea como cambiar de página y no como que la pantalla se va.
      */}
      <Cabecera
        t={t}
        onAmigos={onAmigos}
        onPerfil={onPerfil}
        inicial={inicial}
        racha={racha}
      />
      {pestanitas}
      <Paginas ancho={ancho} scrollX={scrollX} pagerRef={pager} onPagina={setPagina}>
    <ScrollView
      style={s.fondo}
      contentContainerStyle={s.contenido}
      // `pegado`: la cabecera ya no va dentro del scroll, así que la rueda no necesita bajar.
      refreshControl={<Recarga cargando={cargando} onRecargar={refrescar} pegado />}
    >
      {/*
        ⭐ Dos desplegables, no tiras horizontales. Con 8 ligas las últimas quedaban fuera del
        borde y había que arrastrar para verlas, que es lo que hacía que la pantalla pareciera
        desalineada. La maqueta ya usaba `picker` con chevron por este motivo.
      */}
      <View style={s.selectores}>
        <Selector
          etiqueta={t.liga}
          valor={liga.id}
          onCambio={onLigaActiva}
          opciones={ligas.map((l) => ({
            id: l.id,
            nombre: nombreDe(l),
          }))}
        />
        {/* Ventana temporal. Las de calendario y las moviles responden preguntas distintas. */}
        <Selector
          suave
          etiqueta={t.periodo}
          valor={horizonte}
          onCambio={setHorizonte}
          opciones={HORIZONTES.map((h) => ({
            id: h.id,
            nombre: nombreHorizonte(h.id, idioma),
          }))}
        />
      </View>

      {/*
        ⭐ El protagonista es el PUESTO, no los puntos. Corregido tras revisar la maqueta que el
        usuario aprobo: alli la cifra enorme es "1º" y los puntos van en la frase de al lado.
        Tiene fundamento, no es gusto: el estudio JAMIA con 18 usuarios de Fitbit encontro que el
        problema numero uno es no saber que es normal, y "88 puntos" no dice nada sin referencia.
        "Vas primero de 7" se entiende sin aprender ninguna escala.
      */}
      <View style={s.bloque}>
        {/*
          ⛔ EL NOMBRE DE LA LIGA NO SE VEIA, y el usuario lo dijo. Solo existia dentro del
          desplegable, asi que para saber en que liga estabas habia que abrirlo.
        
          Es un fallo de orientacion, no de estetica. La skill de Apple lo nombra: toda pantalla
          tiene que responder "donde estoy". Y el nombre de la liga es justo eso aqui, porque la
          misma pantalla sirve para ocho ligas distintas y la clasificacion cambia entera.
        
          Va como titulo, encima del puesto, con el numero de miembros al lado.
        */}
        <View style={s.tituloLiga}>
          <Text style={s.tituloLigaNombre}>
            {/*
              El 📍 también en el título: la misma señal en el selector y en la pantalla. Y el
              NOMBRE de la liga privada siempre (mismo bug que en `nombreDe`: aquí también salía
              "General" en vez de "Chavales Z72").
            */}
            {zona !== null ? `📍 ${zona.distrito ?? zona.ciudad}` : liga.nombre}
          </Text>
          <Text style={s.tituloLigaMiembros}>
            {/*
              En zona, la división ES parte de "dónde estoy": va junto a los miembros. En una liga
              de deporte concreto, el deporte hace el mismo papel.
            */}
            {zona !== null
              ? `${conValores(t.division, { n: zona.division })} · ${conValores(
                  tabla.length === 1 ? t.unMiembro : t.nMiembros,
                  { n: tabla.length },
                )}`
              : liga.deporte !== null
                ? `${nombreLiga(liga.deporte as IdLiga, idioma)} · ${conValores(
                    tabla.length === 1 ? t.unMiembro : t.nMiembros,
                    { n: tabla.length },
                  )}`
                : conValores(tabla.length === 1 ? t.unMiembro : t.nMiembros, { n: tabla.length })}
          </Text>
        </View>

        {/*
          ⭐ Protagonista EN PARALELO: la cifra a la izquierda y la frase que la explica al lado.
          Es el formato de la maqueta, y la frase no es decoracion: el estudio JAMIA encontro que
          el problema nº1 de estos usuarios es no saber si un numero es bueno para ellos. "1º de 7"
          mas "Perico te sigue de cerca" se entiende sin aprender ninguna escala.
        */}
        {miPuesto >= 0 && (
          /*
            ⭐ La cifra entra un poco antes que la tabla, no a la vez.
       
            No es un detalle suelto, es jerarquía en el tiempo: el puesto es lo que se ha venido a
            ver, así que llega primero y la tabla lo justifica después. Apple lo llama telegrafiar
            el resultado, *"intermediate motion should telegraph where things are going"*, aplicado
            al orden de llegada en vez de a la trayectoria.
          */
          <Aparece style={s.hero} desde={12}>
            <View style={s.heroCifraCaja}>
              <Text style={[s.heroCifra, { color: metalDe(miPuesto + 1) }]}>
                {ordinal(miPuesto + 1, idioma)}
              </Text>
              <Text style={s.heroUnidad}>
                {t.deN} {tabla.length}
              </Text>
            </View>
            <View style={s.heroLado}>
              <Text style={s.heroFrase}>{frase}</Text>
              {/* La barra de caza, debajo de la frase que explica a quién persigues. */}
              {caza !== null && (
                <View style={s.cazaCaja}>
                  <Barra valor={caza} alto={3} retardo={RETARDO_TABLA + 160} />
                </View>
              )}
            </View>
          </Aparece>
        )}

        {/*
          ⭐⭐ TU PROGRESO CONTRA TI MISMO, junto al puesto. No es decoración: lo pide la evidencia.
       
          Un estudio de 2025 sobre leaderboards encontró que el ranking sube la motivación Y la
          presión percibida a la vez, y que reduce la implicación de quien no valora competir
          (https://link.springer.com/article/10.1007/s12528-025-09438-4).
       
          ⇒ Regla de diseño: nunca mostrar una posición absoluta sin mostrar también el progreso
          propio. Así quien va quinto tiene algo suyo que mirar en vez de solo un puesto malo, que
          es el mecanismo por el que la gente abandona.
       
          La banda ±1σ ya existía en el motor y esta pantalla no la usaba.
        */}
        {miProgreso !== null && (
          <View style={s.progresoPropio}>
            <Text style={s.progresoTexto}>{miProgreso}</Text>
          </View>
        )}

        {error !== null && <Text style={s.error}>{error}</Text>}

        {cargando && tabla.length === 0 && (
          <ActivityIndicator color={tema.color.marca} style={s.espera} />
        )}

        {!cargando && tabla.length === 0 && <Text style={s.suaveIzq}>{t.nadiePuntua}</Text>}

        {/*
          ⭐ La frase de la jornada va ANTES de la tabla en las ligas de zona. Responde a la
          pregunta que hace competitiva la división ("¿qué me juego esta semana?") y explica
          las flechas antes de que aparezcan. Un ranking con ascensos sin anunciar sería un
          score opaco, el problema nº1 de confianza del estudio JAMIA.
        */}
        {fraseJornada !== null && <Text style={s.jornada}>{fraseJornada}</Text>}

        {tabla.map((p, i) => (
          <Fila
            key={p.usuario}
            p={p}
            i={i}
            tope={tope}
            esYo={p.usuario === yo}
            idioma={idioma}
            t={t}
            franja={
              zona !== null && bordes !== null ? franjaDe(i + 1, tabla.length, bordes) : null
            }
            // La corona solo cuando hay a quién ganar: coronarte solo en tu liga sería burla.
            corona={i === 0 && tabla.length > 1}
            onPersona={
              onPersona === undefined ? undefined : () => onPersona({ id: p.usuario, nombre: p.nombre })
            }
          />
        ))}

        {/*
          ⭐ Cuando estás SOLO en la liga, invitar es la única acción que importa, así que se
          pone delante y con la palabra. Antes había que descubrir el "+" de la cabecera, entrar
          en Amigos y buscar por nombre exacto, y eso es demasiado camino para la acción de la que
          depende que el producto exista.

          Y va con las dos vías, porque sirven para cosas distintas: el código es lo rápido para
          un grupo de WhatsApp, y buscar por nombre es lo que sirve para uno a uno.
        */}
        {/*
          ⚠️ El código y la llamada a invitar solo tienen sentido en ligas PRIVADAS. En las de
          zona el código no abre nada (se entra por reparto de divisiones) y estar "solo" se
          arregla esperando vecinos, no invitando: enseñar un código que no funciona sería
          prometer una puerta que no existe.
        */}
        {zona === null && tabla.length <= 1 && (
          <View style={s.invitaVacio}>
            <Text style={s.invitaTitulo}>{t.ligaVaciaTitulo}</Text>
            <Text style={s.invitaTexto}>
              {conValores(t.ligaVaciaTexto, { codigo: liga.codigo })}
            </Text>
            {/*
              ⭐ Compartir es la acción PRIMARIA cuando estás solo: un toque y la invitación
              (enlace + código) está en WhatsApp. Buscar amigos por nombre baja a secundaria,
              porque exige que la otra persona ya tenga la app.
            */}
            <Pulsable style={s.boton} accessibilityRole="button" onPress={compartirLiga}>
              <Text style={s.botonTexto}>{t.compartirCodigo}</Text>
            </Pulsable>
            <Pulsable style={s.secundario} accessibilityRole="button" onPress={onAmigos}>
              <Text style={s.secundarioTexto}>{t.agregarAmigos}</Text>
            </Pulsable>
          </View>
        )}

        {zona === null && (
          /* La fila del código comparte al tocarla: donde ves el código, lo mandas. */
          <Pulsable
            fila
            style={s.codigoFila}
            accessibilityRole="button"
            accessibilityLabel={t.compartirCodigo}
            onPress={compartirLiga}
          >
            <Text style={s.codigo}>
              {conValores(t.codigoDe, { liga: liga.nombre, codigo: liga.codigo })}
            </Text>
            <Text style={s.codigoCompartir}>{t.compartirLiga}</Text>
          </Pulsable>
        )}

        {/*
          ⭐⭐ LA TEMPORADA: semanas ganadas y el resultado de la última jornada.

          `palmares()` y `semanasGanadas()` llevaban meses en la capa de datos sin que ninguna
          pantalla los pintara. Sin esto, ganar una semana no dejaba huella: el ciclo
          semana → resultado → semana es el mecanismo del modelo Duolingo que cita el análisis
          de producto, y es lo que da un motivo para volver el lunes. La sala de trofeos que
          faltaba.
        */}
        {(jornada !== null || temporada.length > 0) && (
          <Aparece style={s.temporadaCaja} desde={8}>
            <Text style={s.temporadaTitulo}>
              {conValores(t.temporada, { anio: new Date().getFullYear() })}
            </Text>

            {jornada !== null && (
              <View style={s.cierreCaja}>
                <Text style={s.cierreEtiqueta}>{t.cierreSemana}</Text>
                <Text style={s.cierreGanador}>
                  {jornada.ganador.usuario === yo
                    ? t.cierreGanaste
                    : conValores(t.cierreGano, { quien: jornada.ganador.nombre })}
                </Text>
                {jornada.mio !== null && jornada.mio.puesto !== 1 && (
                  <Text style={s.cierreMio}>
                    {conValores(t.cierreTuPuesto, {
                      puesto: ordinal(jornada.mio.puesto, idioma),
                      p: jornada.mio.puntos,
                    })}
                  </Text>
                )}
              </View>
            )}

            {/* El ranking del año: quién ganó más jornadas. El líder lleva el trofeo en oro. */}
            {temporada.map((g, i) => (
              <View key={g.usuario} style={s.temporadaFila}>
                <Text style={s.temporadaPuesto}>{i + 1}</Text>
                <Text
                  style={[s.temporadaNombre, g.usuario === yo && s.negrita]}
                  numberOfLines={1}
                >
                  {etiquetaPersona(g.nombre, g.usuario === yo, idioma)}
                </Text>
                <Text
                  style={[s.temporadaTrofeos, i === 0 && s.temporadaLider]}
                  accessibilityLabel={
                    g.ganadas === 1
                      ? t.unaSemanaGanada
                      : conValores(t.semanasGanadas, { n: g.ganadas })
                  }
                >
                  {'\u{1F3C6}'} {g.ganadas}
                </Text>
              </View>
            ))}
          </Aparece>
        )}

        <View style={s.acciones}>
          {/*
            ⭐ La puerta a las ligas de zona vive aquí, con las otras dos formas de competir.
            Con etiqueta específica, no un genérico: "Compite en tu zona" dice qué hay detrás,
            que es la regla de Apple sobre labels directos frente a umbrella vagos.
          */}
          {!ligas.some((l) => l.zona !== null) && (
            <Pulsable style={s.secundario} accessibilityRole="button" onPress={onZona}>
              <Text style={s.secundarioTexto}>{t.zonaTitulo}</Text>
            </Pulsable>
          )}
          <Pulsable style={s.secundario} accessibilityRole="button" onPress={onCrear}>
            <Text style={s.secundarioTexto}>{t.crearOtra}</Text>
          </Pulsable>
          <Pulsable style={s.secundario} accessibilityRole="button" onPress={onEntrar}>
            <Text style={s.secundarioTexto}>{t.entrarConCodigo}</Text>
          </Pulsable>
          {ligas.some((l) => l.zona !== null) && (
            <Pulsable style={s.secundario} accessibilityRole="button" onPress={onZona}>
              <Text style={s.secundarioTexto}>{t.cambiarZona}</Text>
            </Pulsable>
          )}
        </View>

        {/* Por qué el ranking es justo. Es la pregunta que se hace cualquiera al verse abajo. */}
        <Ciencia ids={FUENTES} />
      </View>
    </ScrollView>
        {feedPagina}
      </Paginas>
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: tema.color.fondo },
  // Sin padding lateral ni superior: la cabecera trae el suyo y el resto lo pone `bloque`.
  contenido: { paddingBottom: tema.espacio.xl * 2 },
  pager: { flex: 1 },
  // El indicador de páginas: dos etiquetas de ancho fijo y un subrayado de marca que se desliza.
  // Selección por peso y color del texto, más el subrayado. Sin cajas ni fondos.
  pestanitas: {
    flexDirection: 'row',
    paddingHorizontal: tema.espacio.l,
    marginBottom: tema.espacio.s,
    position: 'relative',
  },
  pestanita: { width: ANCHO_PESTANITA, minHeight: 36, justifyContent: 'center' },
  pestanitaTexto: { ...tema.tipo.cuerpo, color: tema.color.textoTenue, fontWeight: '600' },
  pestanitaActiva: { color: tema.color.texto },
  subrayado: {
    position: 'absolute',
    left: tema.espacio.l,
    bottom: 0,
    width: 28,
    height: 2,
    borderRadius: 1,
    backgroundColor: tema.color.marca,
  },
  bloque: { paddingHorizontal: tema.espacio.l },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: tema.espacio.l },
  // Título de estado vacío: aquí SÍ es grande, porque no compite con ninguna cifra.
  titulo: { fontSize: 22, fontWeight: '600', color: tema.color.texto, marginBottom: tema.espacio.s },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tema.espacio.m,
    paddingHorizontal: tema.espacio.l,
    // ⚠️ Un poco mas de aire que `seguroArriba`: en el Development Build el menu de desarrollo
    // pinta un engranaje flotante arriba a la derecha que se comia el boton de perfil. En
    // produccion ese engranaje no existe, pero el margen extra no molesta.
    paddingTop: tema.seguroArriba + tema.espacio.s,
  },
  // Nombre del producto en la cabecera. Discreto: la protagonista es la clasificación.
  marca: { fontSize: 17, fontWeight: '600', color: tema.color.texto, letterSpacing: -0.3 },
  cabeceraBotones: { flexDirection: 'row', gap: tema.espacio.s },
  iconoBoton: {
    width: tema.tactil,
    height: tema.tactil,
    borderRadius: tema.tactil / 2,
    backgroundColor: tema.color.superficie,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconoTexto: { fontSize: 24, color: tema.color.marca, fontWeight: '400', lineHeight: 28 },
  // Botón de amigos CON etiqueta: un "+" solo obligaba a adivinar qué añadía.
  botonAmigos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: tema.tactil,
    paddingHorizontal: 12,
    borderRadius: tema.radio.m,
    backgroundColor: 'rgba(198,203,240,0.14)',
  },
  botonAmigosMas: { fontSize: 17, color: tema.color.marca, lineHeight: 20 },
  botonAmigosTexto: { fontSize: 13, fontWeight: '600', color: tema.color.marca },
  iconoInicial: { ...tema.tipo.cuerpo, color: tema.color.marca, fontWeight: '600' },
  suave: {
    ...tema.tipo.cuerpo,
    color: tema.color.textoSuave,
    textAlign: 'center',
    marginBottom: tema.espacio.l,
  },
  suaveIzq: { ...tema.tipo.cuerpo, color: tema.color.textoSuave, marginBottom: tema.espacio.l },
  // Los dos desplegables en una fila. Sustituyen a las tiras horizontales, que con 8 ligas se
  // salían por el borde.
  selectores: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tema.espacio.l,
    marginBottom: tema.espacio.s,
  },
  // Cifra y frase en paralelo, como en la maqueta.
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tema.espacio.m,
    marginBottom: tema.espacio.l,
  },
  heroCifraCaja: { minWidth: 84 },
  heroCifra: { ...tema.tipo.cifraPar },
  heroUnidad: { ...tema.tipo.micro, color: tema.color.textoSuave, marginTop: 2 },
  // El lado derecho del hero: la frase y, debajo, la barra de caza. El flex vive aquí.
  heroLado: { flex: 1 },
  heroFrase: { fontSize: 14, lineHeight: 20, color: tema.color.texto, opacity: 0.9 },
  cazaCaja: { marginTop: 8 },
  // Solo el hueco: la pista y el relleno los dibuja `Barra`, que además los anima.
  pistaCaja: { marginTop: 6 },
  // Cada fila separada por una línea de un pixel, como el `.lb .p` de la maqueta.
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.color.linea,
  },
  puesto: {
    fontSize: 13,
    color: tema.color.textoTenue,
    width: 16,
    ...tema.cifras,
  },
  /**
   * Flecha de división. Ancho fijo SIEMPRE (también vacía) para que las filas con y sin
   * movimiento no desalineen la columna del avatar. 9px: acompaña, no compite con el nombre.
   */
  franja: { fontSize: 9, width: 12, textAlign: 'center' },
  franjaSube: { color: tema.color.marca },
  franjaBaja: { color: tema.color.bajo },
  // Frase de la jornada, encima de la tabla. Discreta: explica, no protagoniza.
  jornada: { ...tema.tipo.detalle, color: tema.color.textoSuave, marginBottom: tema.espacio.s },
  avatar: {
    // 34px como la maqueta: con 30 el avatar quedaba pequeño al lado del nombre.
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: tema.color.superficieSutil,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 13,
    marginRight: 13,
  },
  // "Eres tu" se marca con relleno, no con borde de color: la regla de la v2.
  avatarYo: { backgroundColor: 'rgba(198,203,240,0.16)' },
  avatarTexto: { fontSize: 13, fontWeight: '600', color: tema.color.textoSuave },
  avatarTextoYo: { color: tema.color.marca },
  filaMedio: { flex: 1, minWidth: 0 },
  // Nombre y corona en línea. `flexShrink` en el nombre para que la corona nunca se salga.
  nombreFila: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  nombre: { ...tema.tipo.cuerpo, color: tema.color.texto, flexShrink: 1 },
  // Pequeña a propósito: acompaña al nombre, no compite con él.
  corona: { fontSize: 11 },
  filaDetalle: { ...tema.tipo.micro, color: tema.color.textoTenue, marginTop: 2 },
  puntos: { ...tema.tipo.valor, color: tema.color.texto },
  negrita: { fontWeight: '600' },
  // Nombre de la liga. Responde a "dónde estoy", que faltaba por completo.
  tituloLiga: { marginBottom: tema.espacio.s },
  tituloLigaNombre: {
    fontSize: 22,
    fontWeight: '600',
    color: tema.color.texto,
    letterSpacing: -0.4,
  },
  tituloLigaMiembros: { ...tema.tipo.micro, color: tema.color.textoTenue, marginTop: 2 },
  // Llamada a invitar cuando estás solo en la liga. Es la acción que hace crecer el producto.
  invitaVacio: {
    backgroundColor: tema.color.superficieSutil,
    borderRadius: tema.radio.m,
    padding: tema.espacio.m,
    marginTop: tema.espacio.l,
    gap: 6,
  },
  invitaTitulo: { ...tema.tipo.cuerpo, color: tema.color.texto, fontWeight: '600' },
  invitaTexto: {
    ...tema.tipo.detalle,
    color: tema.color.textoSuave,
    lineHeight: 19,
    marginBottom: 6,
  },
  // Tu progreso propio: fondo apenas perceptible, sin borde. Acompaña al puesto sin competir.
  progresoPropio: {
    backgroundColor: tema.color.superficieSutil,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: tema.espacio.m,
  },
  progresoTexto: { ...tema.tipo.detalle, color: tema.color.textoSuave, lineHeight: 19 },
  // La fila del código: el dato a la izquierda y la acción de compartir a la derecha.
  codigoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tema.espacio.s,
    minHeight: tema.tactil,
    marginTop: tema.espacio.s,
  },
  codigo: {
    ...tema.tipo.micro,
    color: tema.color.textoTenue,
    flexShrink: 1,
  },
  codigoCompartir: { ...tema.tipo.detalle, color: tema.color.marca, fontWeight: '600' },
  // ── Temporada: semanas ganadas y el último cierre ──────────────────────────
  temporadaCaja: { marginTop: tema.espacio.l },
  temporadaTitulo: { ...tema.tipo.seccion, color: tema.color.texto, marginBottom: tema.espacio.s },
  // El resultado de la jornada, con el fondo apenas perceptible de `progresoPropio`.
  cierreCaja: {
    backgroundColor: tema.color.superficieSutil,
    borderRadius: tema.radio.m,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: tema.espacio.s,
    gap: 2,
  },
  cierreEtiqueta: { ...tema.tipo.micro, color: tema.color.textoTenue },
  cierreGanador: { ...tema.tipo.cuerpo, color: tema.color.texto, fontWeight: '600' },
  cierreMio: { ...tema.tipo.detalle, color: tema.color.textoSuave },
  temporadaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tema.espacio.s,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.color.linea,
  },
  temporadaPuesto: { fontSize: 13, color: tema.color.textoTenue, width: 16, ...tema.cifras },
  temporadaNombre: { ...tema.tipo.cuerpo, color: tema.color.texto, flex: 1 },
  temporadaTrofeos: { ...tema.tipo.valor, color: tema.color.texto },
  // El que más jornadas lleva va en oro: es el campeón provisional de la temporada.
  temporadaLider: { color: tema.color.oro },
  acciones: { marginTop: tema.espacio.m, gap: tema.espacio.s },
  boton: {
    backgroundColor: tema.color.marca,
    minHeight: tema.tactil,
    justifyContent: 'center',
    paddingHorizontal: tema.espacio.l,
    borderRadius: tema.radio.m,
    marginBottom: tema.espacio.s,
  },
  botonTexto: { ...tema.tipo.cuerpo, color: tema.color.fondo, fontWeight: '600' },
  secundario: { minHeight: tema.tactil, justifyContent: 'center' },
  secundarioTexto: { ...tema.tipo.cuerpo, color: tema.color.marca },
  error: { ...tema.tipo.detalle, color: tema.color.bajo, marginBottom: tema.espacio.m },
  espera: { marginVertical: tema.espacio.l },
});
