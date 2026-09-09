import { useEffect, useRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Recarga } from '../componentes/Recarga';
import { Aparece } from '../componentes/Aparece';
import { Barra } from '../componentes/Barra';
import { Ciencia } from '../componentes/Ciencia';
import { Halo } from '../componentes/Halo';
import { Medidor } from '../componentes/Medidor';
import { CURVA, MS, escalonDe, useReducirMovimiento } from '../movimiento';
import type { ClaveCiencia } from '../motor/ciencia';
import { OBJETIVO_HORAS, type Componente, type Dia, type Sueno as DatosSueno } from '../motor/sueno';
import { conValores, idiomaActual, textos, type Textos } from '../i18n/textos';
import { tema } from '../tema';

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
const ALTO_LIENZO = 96;

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

  return (
    <View style={s.grafico}>
      <View style={s.lienzo}>
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
              <View
                style={[
                  s.barraNoche,
                  { height: `${Math.max(2, (nocheHoras / techo) * 100)}%` },
                  // Color solo cuando el dato sale de lo esperado. Regla de la v2 del panel.
                  horas < OBJETIVO_HORAS && s.barraCorta,
                ]}
              />
            </CreceDelSuelo>
          );
        })}
      </View>
      <Text style={s.leyenda}>{conValores(t.suenoLeyendaNoches, { n: siestas })}</Text>
    </View>
  );
}

export function Sueno({ datos, cargando, onRecargar }: Props) {
  const t = textos(idiomaActual());
  const r = datos?.resumen;

  return (
    <ScrollView
      style={s.fondo}
      contentContainerStyle={s.contenido}
      refreshControl={<Recarga cargando={cargando} onRecargar={onRecargar} />}
    >
      <Halo />
      <Text style={s.titulo}>{t.suenoTitulo}</Text>

      {cargando && r === undefined && <ActivityIndicator color={tema.color.marca} style={s.espera} />}

      {!cargando && (r === undefined || !r.disponible) && (
        <>
          <Text style={s.vacioTitulo}>{t.suenoSinDatos}</Text>
          <Text style={s.sub}>{t.suenoSinDatosTexto}</Text>
        </>
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
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: tema.color.fondo },
  contenido: {
    paddingHorizontal: tema.espacio.l,
    paddingTop: tema.seguroArriba + tema.espacio.s,
    paddingBottom: tema.espacio.xl,
  },
  titulo: { ...tema.tipo.titulo, color: tema.color.textoSuave },
  sub: { ...tema.tipo.sub, color: tema.color.textoTenue, marginBottom: tema.espacio.m },
  vacioTitulo: { ...tema.tipo.cuerpo, color: tema.color.texto, marginBottom: tema.espacio.xs },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: tema.espacio.m },
  cifra: { minWidth: 96 },
  n: { ...tema.tipo.cifraPar, color: tema.color.texto },
  u: { ...tema.tipo.micro, color: tema.color.textoSuave, marginTop: 2, maxWidth: 88 },
  frase: { fontSize: 14, lineHeight: 20, color: tema.color.texto, flex: 1, opacity: 0.9 },

  grafico: { marginTop: tema.espacio.l },
  lienzo: { flexDirection: 'row', height: 96, alignItems: 'flex-end', gap: 3 },
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
  columna: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  barraNoche: { width: '100%', backgroundColor: tema.color.marca, borderRadius: 2 },
  barraCorta: { backgroundColor: 'rgba(249,64,79,0.55)' },
  // Siesta en gris claro y encima de la noche. ⚠️ En el panel v2 se anotó que el blanco menta
  // se confundía con las barras: aquí va con opacidad baja para que no compita.
  siesta: {
    width: '100%',
    backgroundColor: `rgba(230,236,233,0.30)`,
    borderRadius: 1,
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
