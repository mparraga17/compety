import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Recarga } from '../componentes/Recarga';
import { Aparece } from '../componentes/Aparece';
import { Barra } from '../componentes/Barra';
import {
  BarraCompacta,
  Cabecera,
  useScrollCabecera,
  type PerfilCabecera,
} from '../componentes/Cabecera';
import { Ciencia } from '../componentes/Ciencia';
import { Halo } from '../componentes/Halo';
import { Medidor } from '../componentes/Medidor';
import { huecoBarra } from '../componentes/Pestanas';
import { SinDatos } from '../componentes/SinDatos';
import { CURVA, MS, escalonDe, useReducirMovimiento } from '../movimiento';
import type { ClaveCiencia } from '../motor/ciencia';
import { OBJETIVO_HORAS, type Componente, type Dia, type Sueno as DatosSueno } from '../motor/sueno';
import { conValores, idiomaActual, textos, type Textos } from '../i18n/textos';
import { BAJO_RGB, MARCA_RGB, tema } from '../tema';

/**
 * Nombre visible de cada componente.
 *
 * ⚠️ Función y no un objeto en `textos.ts`: el tipo `Textos` es `Record<clave, string>`, así que
 * anidar un objeto ahí rompe la comprobación en todas las pantallas que lo consumen.
 */
function nombreComponente(clave: Componente['clave'], t: Textos): string {
  if (clave === 'regularidad') return t.suenoRegularidad;
  if (clave === 'eficiencia') return t.suenoEficiencia;
  return t.suenoDuracion;
}

/**
 * Frase de cada componente, armada AQUÍ con las cifras que da el motor.
 *
 * ⛔ El motor ya no devuelve la frase hecha. Antes sí, y estaba escrita en español, así que con
 * la app en inglés salía en español. Misma regla que costó el bug del `nombre: 'Tú'`: un dato
 * nunca lleva texto traducible dentro.
 */
function formulaDe(c: Componente, t: Textos): string {
  if (c.clave === 'regularidad') {
    return c.datos.acostarse === undefined
      ? conValores(t.suenoPocasNoches, { n: c.datos.minimo })
      : conValores(t.suenoFormulaRegularidad, c.datos);
  }
  if (c.clave === 'eficiencia') {
    return c.datos.porcentaje === undefined
      ? t.suenoSinTiempoEnCama
      : conValores(t.suenoFormulaEficiencia, c.datos);
  }
  return conValores(t.suenoFormulaDuracion, c.datos);
}

/**
 * Pestaña Sueño. Portada de la maqueta `app-preview/`, en su mismo orden.
 *
 * ⭐ El orden no es casual, lo pidió el usuario el 26 ago: el gráfico de las últimas noches va
 * JUSTO debajo de la cifra, porque es lo primero que se quiere ver. Y el desglose de los tres
 * componentes va compacto, etiqueta y barra y cifra en una línea, en vez de tres líneas con
 * párrafo debajo.
 *
 * ⭐ Y la cifra no es "cuánto duermes". Es regularidad 45, eficiencia 30 y duración 25, porque
 * en UK Biobank la regularidad de horarios predijo la mortalidad mejor que la duración. La
 * frase de contexto habla de tu hora de acostarte por ese motivo, no del total de horas.
 *
 * ⛔ Las fases se muestran al final y con su aviso de que NO puntúan. El consenso de la
 * National Sleep Foundation no las respalda como indicador de calidad, y los wearables fallan
 * justo al repartirlas.
 */

type Props = {
  datos: DatosSueno | null;
  cargando: boolean;
  onRecargar: () => void;
  /** Avatar de la cabecera, que abre el perfil. null sin cuenta. */
  perfil?: PerfilCabecera | null;
  onPerfil?: () => void;
};

const FUENTES: readonly ClaveCiencia[] = [
  'regularidad',
  'regularidad2',
  'eficienciaSueno',
  'duracion',
  'fasesSinConsenso',
  'precisionSueno',
];

/** Noches que entran en el gráfico. Las mismas que la maqueta. */
const NOCHES_EN_GRAFICO = 14;

/** Alto del lienzo del gráfico, en puntos. Lo necesita el anclaje del crecimiento. */
const ALTO_LIENZO = 120;

/** Noches mínimas para que la banda de "tu normal" signifique algo. */
const NOCHES_MINIMAS_BANDA = 5;

/** Degradados de las noches: tenue en la base y pleno en la punta (regla 9d del tema). */
const DEGRADADO_NOCHE = `linear-gradient(to top, rgba(${MARCA_RGB},0.5) 0%, rgb(${MARCA_RGB}) 100%)`;
// Noche corta en coral, pero suavizado: el coral pleno satura y una noche corta no es una alarma.
const DEGRADADO_CORTA = `linear-gradient(to top, rgba(${BAJO_RGB},0.3) 0%, rgba(${BAJO_RGB},0.7) 100%)`;

/** "6 h 40" a partir de horas decimales. Sin `Intl`, como todo lo que pinta el teléfono. */
function horasTexto(h: number): string {
  const enteras = Math.floor(h);
  const minutos = Math.round((h - enteras) * 60);
  return `${enteras} h ${String(minutos).padStart(2, '0')}`;
}

/** Media ± una desviación típica de las horas dormidas, para la banda del gráfico. */
function bandaDeNoches(noches: readonly Dia[]): { min: number; max: number } | null {
  if (noches.length < NOCHES_MINIMAS_BANDA) return null;
  const horas = noches.map((n) => n.totalDormido / 60);
  const media = horas.reduce((a, b) => a + b, 0) / horas.length;
  const sd = Math.sqrt(horas.reduce((a, b) => a + (b - media) ** 2, 0) / horas.length);
  if (sd <= 0) return null;
  return { min: Math.max(0, media - sd), max: media + sd };
}

/**
 * Ancla una columna del gráfico al suelo mientras crece con `scaleY`.
 *
 * ⭐ Sueño era la ÚNICA pestaña sin capa de movimiento: sus barras aparecían ya puestas mientras
 * en Hoy y Competi crecen. Y es justo el caso que la doc de `Barra` bendice: la barra ES la
 * comparación (¿llegó la noche a las 7 h?), así que el recorrido informa.
 *
 * ⚠️ El mismo patrón de `Columna`: translate PRIMERO en la lista (capa exterior) y compensación
 * de la mitad del alto, porque `scaleY` escala desde el centro. Aquí se escala el carril entero
 * (con la noche y la siesta dentro): el hueco vacío es transparente, así que escalar el conjunto
 * anclado abajo se ve como las barras brotando del suelo, sin tocar sus alturas en porcentaje.
 */
function CreceDelSuelo({ retardo, children }: { retardo: number; children: ReactNode }) {
  const reducir = useReducirMovimiento();
  const v = useRef(new Animated.Value(reducir ? 1 : 0)).current;

  useEffect(() => {
    if (reducir) {
      v.setValue(1);
      return;
    }
    Animated.timing(v, {
      toValue: 1,
      duration: MS.crece,
      delay: retardo,
      easing: CURVA.sale,
      useNativeDriver: true,
    }).start();
  }, [v, retardo, reducir]);

  return (
    <Animated.View
      style={[
        s.columna,
        {
          transform: [
            {
              translateY: v.interpolate({
                inputRange: [0, 1],
                outputRange: [ALTO_LIENZO / 2, 0],
              }),
            },
            { scaleY: v },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Gráfico de noches con barras de horas, la línea de las 7 h y las siestas encima.
 *
 * ⚠️ Con vistas y no con SVG: `react-native-svg` es un módulo nativo y obligaría a recompilar.
 * Es el mismo criterio del halo y de los iconos, que van con emojis por lo mismo.
 */
function GraficoNoches({ noches, siestas }: { noches: readonly Dia[]; siestas: number }) {
  const t = textos(idiomaActual());
  if (noches.length === 0) return null;

  // Techo con un 8 % de aire, como la maqueta, y nunca por debajo de 9 h para que la línea de
  // las 7 quede dentro del gráfico incluso en una semana de noches cortas.
  const techo = Math.max(9, ...noches.map((n) => n.totalDormido / 60)) * 1.08;
  // ⭐ Tu normal: media ± una desviación de estas noches, pintada detrás (regla 9d). Es la
  // referencia propia que el estudio JAMIA echaba en falta, junto a la línea de las 7 h.
  const banda = bandaDeNoches(noches);
  const ultima = noches.length - 1;

  return (
    <View style={s.grafico}>
      <View style={s.lienzo}>
        {banda !== null && (
          <View
            pointerEvents="none"
            style={[
              s.banda,
              {
                bottom: `${(banda.min / techo) * 100}%`,
                height: `${((banda.max - banda.min) / techo) * 100}%`,
              },
            ]}
          />
        )}
        {/* Línea de las 7 h: la referencia que hace legible el gráfico. Sin ella son barras
            sueltas, que es el pain point nº1 del estudio JAMIA. */}
        <View style={[s.objetivo, { bottom: `${(OBJETIVO_HORAS / techo) * 100}%` }]} />

        {noches.map((n, i) => {
          const horas = n.totalDormido / 60;
          const nocheHoras = n.noche.dormidoMinutos / 60;
          const siestaHoras = n.siestaMinutos / 60;

          return (
            // ⭐ Las noches crecen en cascada de izquierda a derecha, en orden temporal: mismo
            // criterio que el gráfico de Hoy, contar el recorrido en vez de plantar el resultado.
            // Medio escalón por noche: con 14 columnas el escalón entero alargaría demasiado.
            <CreceDelSuelo key={n.fecha} retardo={escalonDe(i) / 2}>
              {siestaHoras > 0 && (
                <View
                  style={[
                    s.siesta,
                    { height: `${Math.max(1, (siestaHoras / techo) * 100)}%` },
                  ]}
                />
              )}
              {/* Con cuerpo (rediseño del 15 sep): degradado de la base a la punta, remate
                  redondo, y las noches pasadas a 0,7 para que la última destaque sin otro color.
                  El coral solo cuando la noche fue corta: regla de la v2 del panel. */}
              <View
                style={[
                  s.barraNoche,
                  {
                    height: `${Math.max(2, (nocheHoras / techo) * 100)}%`,
                    experimental_backgroundImage:
                      horas < OBJETIVO_HORAS ? DEGRADADO_CORTA : DEGRADADO_NOCHE,
                    opacity: i === ultima ? 1 : 0.7,
                  },
                ]}
              />
            </CreceDelSuelo>
          );
        })}
      </View>
      {banda !== null && (
        <Text style={s.bandaEtiqueta} pointerEvents="none">
          {conValores(t.suenoBanda, { min: horasTexto(banda.min), max: horasTexto(banda.max) })}
        </Text>
      )}
      <Text style={s.leyenda}>{conValores(t.suenoLeyendaNoches, { n: siestas })}</Text>
    </View>
  );
}

export function Sueno({ datos, cargando, onRecargar, perfil, onPerfil }: Props) {
  const t = textos(idiomaActual());
  const r = datos?.resumen;
  const insets = useSafeAreaInsets();
  const { y, onScroll } = useScrollCabecera();
  // La línea de contexto de la cabecera: la última noche en horas, cuando la hay.
  const anoche = datos?.ventana[0];
  const contexto =
    anoche !== undefined && r !== undefined && r.disponible
      ? `${t.anoche} · ${horasTexto(anoche.totalDormido / 60)}`
      : undefined;

  return (
    <View style={s.fondo}>
    <BarraCompacta titulo={t.tabSueno} y={y} />
    <Animated.ScrollView
      style={s.fondo}
      contentContainerStyle={[s.contenido, { paddingBottom: huecoBarra(insets.bottom) }]}
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={<Recarga cargando={cargando} onRecargar={onRecargar} />}
    >
      <Halo />
      <Cabecera
        titulo={t.tabSueno}
        contexto={contexto}
        perfil={perfil}
        onPerfil={onPerfil}
        etiquetaPerfil={t.abrirPerfil}
      />

      {cargando && r === undefined && <ActivityIndicator color={tema.color.marca} style={s.espera} />}

      {!cargando && (r === undefined || !r.disponible) && (
        <SinDatos titulo={t.suenoSinDatos} texto={t.suenoSinDatosTexto} />
      )}

      {r !== undefined && r.disponible && (
        <>
          <Text style={s.sub}>{conValores(t.suenoSubtitulo, { n: r.noches })}</Text>

          {/*
            La puntuación de sueño SÍ tiene techo real en 100, así que aquí la barra nunca se pasa.
            La frase habla de la HORA de acostarse, no de las horas dormidas: es lo que más pesa en
            la puntuación y donde está el margen de mejora real.
          */}
          <Medidor
            valor={String(r.puntos)}
            etiqueta={t.suenoDeCien}
            progreso={r.puntos / 100}
            frase={
              r.regularidad.disponible
                ? conValores(t.suenoFrase, {
                    hora: r.regularidad.horaTipicaAcostarse,
                    variacion: r.regularidad.sdAcostarseMin,
                    cortas: r.nochesCortas,
                    total: r.noches,
                  })
                : conValores(t.suenoPocasNoches, { n: r.regularidad.minimo })
            }
          />

          {/* El gráfico va aquí a propósito: es lo primero que se quiere ver tras la cifra. */}
          <GraficoNoches
            noches={[...(datos?.ventana ?? [])].slice(0, NOCHES_EN_GRAFICO).reverse()}
            siestas={r.siestas}
          />

          {/* Desglose compacto. Cada componente en una línea, sin párrafo debajo.
              ⭐ Con `Barra`, que crece hasta su valor y viene escalonada: mismo componente y
              misma física que las barras de la clasificación. Antes eran vistas estáticas con
              `width: %`, la tercera copia del mismo trozo que `Barra` existe para eliminar. */}
          <View style={s.mini}>
            {r.componentes.map((c, i) => (
              <Aparece key={c.clave} indice={i} style={s.componente}>
                <Text style={s.compEtiqueta}>{nombreComponente(c.clave, t)}</Text>
                <View style={s.compPista}>
                  <Barra
                    valor={c.valor / c.maximo}
                    alto={3}
                    fondo={tema.color.linea}
                    retardo={escalonDe(i) + 80}
                  />
                </View>
                <Text style={s.compValor}>
                  {c.valor}
                  <Text style={s.compMaximo}>/{c.maximo}</Text>
                </Text>
              </Aparece>
            ))}
          </View>

          {/* Las fórmulas en lenguaje llano: es el desglose explicable que pide el estudio
              JAMIA, donde los scores opacos son el mayor problema de confianza. */}
          {r.componentes.map((c) => (
            <Text key={c.clave} style={s.formula}>
              {nombreComponente(c.clave, t)}: {formulaDe(c, t)}
            </Text>
          ))}

          <View style={s.datos}>
            <View>
              <Text style={s.datoClave}>{t.suenoMedia}</Text>
              <Text style={s.datoValor}>{r.mediaHoras} h</Text>
            </View>
            <View>
              <Text style={s.datoClave}>{t.suenoEficiencia}</Text>
              <Text style={s.datoValor}>
                {r.eficienciaMedia === null ? '·' : `${r.eficienciaMedia} %`}
              </Text>
            </View>
            <View>
              <Text style={s.datoClave}>{t.suenoSiestas}</Text>
              <Text style={s.datoValor}>{r.siestas}</Text>
            </View>
          </View>

          {/* ⛔ Fases: informativas y con el aviso puesto, nunca puntuando. */}
          {r.fases !== null && (
            <>
              <Text style={s.seccion}>{t.suenoFases}</Text>
              <Text style={s.avisoFases}>{t.suenoFasesNoPuntuan}</Text>
              <View style={s.datos}>
                <View>
                  <Text style={s.datoClave}>{t.suenoProfundo}</Text>
                  <Text style={s.datoValor}>{r.fases.profundoPct} %</Text>
                </View>
                <View>
                  <Text style={s.datoClave}>{t.suenoRem}</Text>
                  <Text style={s.datoValor}>{r.fases.remPct} %</Text>
                </View>
              </View>
            </>
          )}

          {/* ⚠️ Aviso obligado: lo que calculamos NO es el SRI validado del paper, es una
              aproximación con los datos que da HealthKit. Va en la interfaz, no solo en el
              código, porque afirmar precisión que no existe es justo lo que se quiere evitar. */}
          {r.regularidad.disponible && <Text style={s.avisoFases}>{t.suenoAproximado}</Text>}
        </>
      )}

      <Ciencia ids={FUENTES} />
    </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: tema.color.fondo },
  // El hueco de arriba lo pone la `Cabecera` con el inset real; el de abajo, `huecoBarra`.
  contenido: { paddingHorizontal: tema.espacio.l },
  sub: { ...tema.tipo.sub, color: tema.color.textoTenue, marginBottom: tema.espacio.m },

  grafico: { marginTop: tema.espacio.l },
  lienzo: { flexDirection: 'row', height: ALTO_LIENZO, alignItems: 'flex-end', gap: 4 },
  // La banda de "tu normal": un bloque sutil detrás, sin borde. Regla de la v2.
  banda: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: tema.color.superficieSutil,
    borderRadius: 6,
  },
  bandaEtiqueta: {
    ...tema.tipo.micro,
    fontSize: 10,
    color: tema.color.textoTenue,
    textAlign: 'right',
    marginTop: 4,
    ...tema.cifras,
  },
  // Línea discontinua imitada con opacidad baja: `borderStyle: 'dashed'` se pinta distinto en
  // iOS y Android, y aquí basta una referencia tenue.
  objetivo: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: `rgba(230,236,233,0.28)`,
  },
  // Altura completa del lienzo: la necesita el anclaje del `scaleY` de `CreceDelSuelo`.
  columna: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  // Al 78 % del hueco con remate redondo: cuerpo sin parecer un bloque. El relleno lo pone el
  // degradado en línea (noche normal o corta).
  barraNoche: { width: '78%', borderTopLeftRadius: 4, borderTopRightRadius: 4, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  // Siesta en gris claro y encima de la noche. ⚠️ En el panel v2 se anotó que el blanco menta
  // se confundía con las barras: aquí va con opacidad baja para que no compita.
  siesta: {
    width: '78%',
    backgroundColor: `rgba(230,236,233,0.30)`,
    borderRadius: 2,
    marginBottom: 1.5,
  },
  leyenda: { ...tema.tipo.micro, color: tema.color.textoTenue, marginTop: tema.espacio.s },

  mini: { marginTop: tema.espacio.l, gap: 10 },
  componente: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  compEtiqueta: { ...tema.tipo.detalle, color: tema.color.textoSuave, width: 92 },
  // Solo el hueco: la pista y el relleno los dibuja `Barra`, que además los anima.
  compPista: { flex: 1 },
  compValor: {
    fontSize: 14,
    color: tema.color.texto,
    minWidth: 44,
    textAlign: 'right',
    ...tema.cifras,
  },
  compMaximo: { color: tema.color.textoTenue, fontSize: 11 },

  formula: { ...tema.tipo.micro, color: tema.color.textoTenue, marginTop: 6 },

  datos: {
    flexDirection: 'row',
    gap: 26,
    paddingVertical: 18,
    marginTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.color.linea,
  },
  datoClave: { ...tema.tipo.micro, color: tema.color.textoTenue },
  datoValor: { ...tema.tipo.valor, color: tema.color.texto },

  seccion: {
    ...tema.tipo.seccion,
    color: tema.color.textoSuave,
    marginTop: tema.espacio.l,
    marginBottom: 2,
  },
  avisoFases: { ...tema.tipo.micro, color: tema.color.textoTenue, marginTop: tema.espacio.s },
  espera: { marginVertical: tema.espacio.l },
});
