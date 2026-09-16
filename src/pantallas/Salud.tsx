import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useState } from 'react';

import { Recarga } from '../componentes/Recarga';
import { Aparece } from '../componentes/Aparece';
import {
  BarraCompacta,
  Cabecera,
  useScrollCabecera,
  type PerfilCabecera,
} from '../componentes/Cabecera';
import { Ciencia } from '../componentes/Ciencia';
import { Halo } from '../componentes/Halo';
import { Ficha } from '../componentes/Ficha';
import { Medidor } from '../componentes/Medidor';
import { huecoBarra } from '../componentes/Pestanas';
import { Pulsable } from '../componentes/Pulsable';
import type { ClaveCiencia } from '../motor/ciencia';
import type { Forma } from '../motor/forma';
import type { Oms } from '../motor/oms';
import type { Base } from '../motor/base';
import type { Metrica } from '../motor/salud';
import { nombreLiga } from '../i18n/ligas';
import { conValores, idiomaActual, textos, type Textos } from '../i18n/textos';
import { tema } from '../tema';

/**
 * Pestaña Salud. Recupera el panel de la etapa 1 y lo trae a la app, en el orden de la maqueta:
 * objetivo de la OMS, eje de forma, las seis métricas del cuerpo y tu base de carga.
 *
 * ⭐ El protagonista es el objetivo de la OMS y no una métrica de la pulsera. Es deliberado: es el
 * único objetivo del producto que no nos hemos inventado, así que da propósito a la pantalla en
 * vez de dejarla como una lista de cifras.
 *
 * ⭐ Cada métrica se compara con TU banda de más y menos una sigma, nunca con una tabla general.
 * Responde al hallazgo del estudio JAMIA 2023: el problema número uno de los usuarios de
 * wearables es no saber qué es normal para ellos mismos.
 *
 * ⛔ NADA de esto puntúa ni entra en ninguna clasificación, y se dice en pantalla. Dos motivos: el
 * HRV no llega de Fitbit ni de WHOOP, así que puntuarlo premiaría tener una marca concreta; y la
 * FDA sancionó a Whoop por una función de bienestar que cruzó a dispositivo médico. La app
 * describe, no diagnostica.
 */

type Props = {
  oms: Oms | null;
  forma: Forma | null;
  metricas: readonly Metrica[];
  base: Base | null;
  cargando: boolean;
  onRecargar: () => void;
  /** Lleva al diagnóstico, que dice qué métricas llegan de verdad de la pulsera. */
  onDiagnostico: () => void;
  /** Avatar de la cabecera, que abre el perfil. null sin cuenta. */
  perfil?: PerfilCabecera | null;
  onPerfil?: () => void;
};

const FUENTES: readonly ClaveCiencia[] = [
  'oms',
  'banda',
  'eficiencia',
  'fcReposo',
  'hrv',
  'spo2',
  'respiracion',
  'vo2max',
  'pasos',
];

/** Nombre visible de cada métrica. Función y no objeto: `Textos` es plano. */
function nombreMetrica(clave: Metrica['clave'], t: Textos): string {
  switch (clave) {
    case 'hrv':
      return t.metricaHrv;
    case 'fcReposo':
      return t.metricaFcReposo;
    case 'spo2':
      return t.metricaSpo2;
    case 'respiracion':
      return t.metricaRespiracion;
    case 'vo2max':
      return t.metricaVo2max;
    case 'pasos':
      return t.metricaPasos;
  }
}

/** Unidad de cada métrica. Los pasos no llevan unidad detrás del número. */
function unidadDe(clave: Metrica['clave'], t: Textos): string {
  switch (clave) {
    case 'hrv':
      return 'ms';
    case 'fcReposo':
      return t.lpm;
    case 'spo2':
      return '%';
    case 'respiracion':
      return t.rpm;
    default:
      return '';
  }
}

/** Miles con separador, sin `Intl`: Hermes no es fiable y ya reventó una vez. */
function conMiles(n: number, idioma: 'es' | 'en'): string {
  const [entero, decimal] = String(n).split('.');
  const sep = idioma === 'es' ? '.' : ',';
  const agrupado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return decimal === undefined ? agrupado : `${agrupado}${idioma === 'es' ? ',' : '.'}${decimal}`;
}

/**
 * Línea de la métrica con la banda de fondo.
 *
 * ⭐ La banda pintada de fondo es LA pieza de esta pantalla. Sin ella una línea de 30 días no
 * comunica nada, que es exactamente lo que decían los usuarios del estudio JAMIA: *"no me da
 * información más allá de lo que ya sé"*.
 *
 * ⚠️ Con vistas y no con SVG. `react-native-svg` es nativo y obligaría a recompilar. Una polilínea
 * no se puede dibujar con vistas, así que se usan columnas finas por día: se lee igual de bien y
 * cuesta cero dependencias.
 */
function LineaConBanda({ m }: { m: Extract<Metrica, { disponible: true }> }) {
  if (m.serie.length < 2) return null;

  const valores = m.serie.map((p) => p.valor);
  // La escala incluye la banda para que no se salga del gráfico.
  const lo = Math.min(...valores, m.min ?? Math.min(...valores));
  const hi = Math.max(...valores, m.max ?? Math.max(...valores));
  const rango = hi - lo || 1;
  const pct = (v: number) => ((v - lo) / rango) * 100;

  const color =
    m.estado === 'mejor'
      ? tema.color.marca
      : m.estado === 'peor'
        ? tema.color.bajo
        : 'rgba(230,236,233,0.55)';

  return (
    <View style={s.linea}>
      {m.min !== null && m.max !== null && (
        <View
          style={[
            s.banda,
            { bottom: `${pct(m.min)}%`, height: `${Math.max(1, pct(m.max) - pct(m.min))}%` },
          ]}
        />
      )}
      <View style={s.columnas}>
        {m.serie.map((p, i) => (
          <View key={p.dia} style={s.columnaDia}>
            <View
              style={[
                s.punto,
                {
                  bottom: `${pct(p.valor)}%`,
                  backgroundColor: color,
                  // El último día se marca más grueso, como el círculo de la maqueta.
                  opacity: i === m.serie.length - 1 ? 1 : 0.55,
                },
                i === m.serie.length - 1 && s.puntoUltimo,
              ]}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Una métrica: nombre, valor, estado en palabras y línea con su banda. */
function FilaMetrica({
  m,
  t,
  idioma,
  onFicha,
}: {
  m: Metrica;
  t: Textos;
  idioma: 'es' | 'en';
  onFicha: (clave: ClaveCiencia) => void;
}) {
  if (!m.disponible) {
    return (
      <View style={s.metrica}>
        <View style={s.metricaTitulo}>
          <Text style={s.metricaNombre}>{nombreMetrica(m.clave, t)}</Text>
          <Text style={s.metricaSinDatos}>{t.sinDatosMetrica}</Text>
        </View>
      </View>
    );
  }

  const unidad = unidadDe(m.clave, t);
  const colorValor =
    m.estado === 'mejor'
      ? tema.color.marca
      : m.estado === 'peor'
        ? tema.color.bajo
        : tema.color.texto;

  // Estado en palabras, que es lo que hace legible la cifra.
  const estado =
    m.estado === 'mejor'
      ? t.estadoMejor
      : m.estado === 'peor'
        ? t.estadoPeor
        : m.estado === 'dentro'
          ? t.estadoDentro
          : t.estadoSinBanda;

  const rango =
    m.min === null || m.max === null
      ? null
      : conValores(t.rangoHabitual, {
          min: conMiles(m.min, idioma),
          max: conMiles(m.max, idioma),
        });

  // Tendencia solo si el cambio es apreciable. Por debajo del 2 % es ruido.
  const dir =
    m.tendencia === null
      ? null
      : Math.abs(m.tendencia.pct) < 2
        ? t.estable
        : conValores(m.tendencia.delta > 0 ? t.subiendo : t.bajando, {
            n: `${conMiles(Math.abs(m.tendencia.delta), idioma)}${unidad === '' ? '' : ` ${unidad}`}`,
          });

  return (
    /*
      ⚠️ Con `fila`: es un bloque a todo lo ancho, así que se atenúa en vez de escalar. Una fila
      ancha que se hunde deja ver el fondo por los lados y se lee como un fallo de dibujo, que es
      lo que hace iOS al distinguir botones de filas de tabla.
    */
    <Pulsable
      fila
      style={s.metrica}
      onPress={() => onFicha(m.ciencia)}
      accessibilityRole="button"
      accessibilityLabel={`${nombreMetrica(m.clave, t)} ${m.ultimo}${unidad}`}
    >
      <View style={s.metricaTitulo}>
        <Text style={s.metricaNombre}>{nombreMetrica(m.clave, t)}</Text>
        <Text style={[s.metricaValor, { color: colorValor }]}>
          {conMiles(m.ultimo, idioma)}
          {unidad !== '' && <Text style={s.metricaUnidad}> {unidad}</Text>}
        </Text>
      </View>

      <Text style={s.metricaEstado}>
        {estado}
        {rango !== null && ` · ${rango}`}
        {dir !== null && ` · ${dir}`}
      </Text>

      <LineaConBanda m={m} />

      {/* ⚠️ Aviso obligado: el VO2max lo calcula un modelo en la nube, no lo mide el sensor. */}
      {m.estimada && <Text style={s.metricaAviso}>{t.avisoModelo}</Text>}
    </Pulsable>
  );
}

export function Salud({
  oms,
  forma,
  metricas,
  base,
  cargando,
  onRecargar,
  onDiagnostico,
  perfil,
  onPerfil,
}: Props) {
  const idioma = idiomaActual();
  const t = textos(idioma);
  const [ficha, setFicha] = useState<ClaveCiencia | null>(null);
  const insets = useSafeAreaInsets();
  const { y, onScroll } = useScrollCabecera();

  const conDatos = metricas.filter((m) => m.disponible).length;

  return (
    <View style={s.fondo}>
    <BarraCompacta titulo={t.tabSalud} y={y} />
    <Animated.ScrollView
      style={s.fondo}
      contentContainerStyle={[s.contenido, { paddingBottom: huecoBarra(insets.bottom) }]}
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={<Recarga cargando={cargando} onRecargar={onRecargar} />}
    >
      <Halo />
      <Cabecera
        titulo={t.tabSalud}
        contexto={t.saludContexto}
        perfil={perfil}
        onPerfil={onPerfil}
        etiquetaPerfil={t.abrirPerfil}
      />
      <Text style={s.sub}>{t.saludSubtitulo}</Text>

      {cargando && oms === null && <ActivityIndicator color={tema.color.marca} style={s.espera} />}

      {/* ── Objetivo de la OMS: el protagonista ─────────────────────────────── */}
      {oms !== null && (
        <>
          {/*
            ⚠️ El progreso se pasa SIN acotar a 100, a propósito. `oms.progreso` ya viene acotado
            desde el motor para la barra, pero aquí interesa el valor real para poder decir "×2,7"
            cuando alguien triplica el objetivo. Es el caso de la captura: 412 sobre 150.
          */}
          <Medidor
            valor={String(oms.equivalente)}
            etiqueta={t.minEquivalentes}
            progreso={oms.equivalente / oms.objetivo}
            frase={oms.cumple ? t.omsCumplido : conValores(t.omsFaltan, { n: oms.faltan })}
          />

          <View style={s.datos}>
            <View>
              <Text style={s.datoClave}>{t.moderada}</Text>
              <Text style={s.datoValor}>{oms.moderada} min</Text>
            </View>
            <View>
              <Text style={s.datoClave}>{t.vigorosa}</Text>
              <Text style={s.datoValor}>{oms.vigorosa} min</Text>
            </View>
            <View>
              <Text style={s.datoClave}>{t.diasFuerza}</Text>
              <Text style={s.datoValor}>
                {oms.diasFuerza} / {oms.objetivoFuerza}
              </Text>
            </View>
          </View>
        </>
      )}

      {/* ── Eje de forma: hacer lo mismo con menos pulso ────────────────────── */}
      {forma !== null && (
        <>
          <Text style={s.seccion}>{t.formaTitulo}</Text>
          {forma.disponible ? (
            <>
              <View style={s.hero}>
                <View style={s.cifra}>
                  <Text style={s.nMedio}>
                    {forma.mejoraPct > 0 ? '+' : ''}
                    {forma.mejoraPct} %
                  </Text>
                </View>
                <Text style={s.frase}>
                  {Math.abs(forma.mejoraPct) < 2
                    ? t.formaIgual
                    : conValores(forma.mejoraPct > 0 ? t.formaMejora : t.formaPeor, {
                        pct: Math.abs(forma.mejoraPct),
                      })}
                </Text>
              </View>
              <Text style={s.notaForma}>
                {conValores(t.formaDetalle, {
                  liga: nombreLiga(forma.liga, idioma),
                  antes: forma.fcAntes,
                  ahora: forma.fcAhora,
                  unidad: t.lpm,
                })}
              </Text>
              {/* ⚠️ Con pocas sesiones la señal es débil, y se dice. */}
              {!forma.fiable && (
                <Text style={s.metricaAviso}>
                  {conValores(t.formaPocoFiable, {
                    n: forma.sesiones.antes + forma.sesiones.ahora,
                  })}
                </Text>
              )}
            </>
          ) : (
            <Text style={s.sub}>
              {conValores(t.formaPocasSesiones, {
                n: forma.encontradas,
                minimo: forma.minimo,
              })}
            </Text>
          )}
        </>
      )}

      {/* ── Las seis métricas del cuerpo ────────────────────────────────────── */}
      <Text style={s.seccion}>{t.tuCuerpo}</Text>
      <Text style={s.sub}>{t.tuCuerpoSub}</Text>

      {/* Las seis métricas entran en cascada, de arriba abajo, que es el orden en que se leen. */}
      {metricas.map((m, i) => (
        <Aparece key={m.clave} indice={i}>
          <FilaMetrica m={m} t={t} idioma={idioma} onFicha={setFicha} />
        </Aparece>
      ))}

      {/*
        ⚠️ Aviso doble, y los dos importan. Un día sin dato no es un cero, significa que no
        llevabas la pulsera. Y si una métrica no aparece puede ser que tu pulsera no la escriba en
        Salud: el HRV de Fitbit es el caso conocido. iOS no permite distinguirlo de un permiso
        denegado, así que la app NUNCA afirma que no tienes datos.
      */}
      <Text style={s.metricaAviso}>{t.coberturaAviso}</Text>
      {conDatos < metricas.length && (
        <Pulsable style={s.enlaceDiag} onPress={onDiagnostico} accessibilityRole="button">
          <Text style={s.enlaceDiagTexto}>{t.verDiagnostico}</Text>
        </Pulsable>
      )}

      {/* ── Tu base de carga: el handicap, explicado ────────────────────────── */}
      {base !== null && base.n > 0 && (
        <>
          <Text style={s.seccion}>{t.tuBase}</Text>
          <Text style={s.sub}>{conValores(t.baseCalculada, { n: base.n })}</Text>
          <View style={s.datos}>
            <View>
              <Text style={s.datoClave}>{t.cargaMedia}</Text>
              <Text style={s.datoValor}>{base.media}</Text>
            </View>
            <View>
              <Text style={s.datoClave}>{t.tuRangoCarga}</Text>
              <Text style={s.datoValor}>
                {Math.round(base.media - base.sigma)} a {Math.round(base.media + base.sigma)}
              </Text>
            </View>
          </View>
          {!base.fiable && <Text style={s.metricaAviso}>{t.basePocoFiable}</Text>}
        </>
      )}

      <Ciencia ids={FUENTES} />

      {/* Ficha de una métrica concreta, al tocarla. */}
      <Ficha clave={ficha} onCerrar={() => setFicha(null)} />
    </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: tema.color.fondo },
  // El hueco de arriba lo pone la `Cabecera` con el inset real; el de abajo, `huecoBarra`.
  contenido: { paddingHorizontal: tema.espacio.l },
  sub: { ...tema.tipo.sub, color: tema.color.textoTenue, marginBottom: tema.espacio.m },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: tema.espacio.m },
  cifra: { minWidth: 96 },
  nMedio: {
    fontSize: 46,
    // 200 y no 300: React Native solo acepta múltiplos de 100 y 200 es el que se parece al 250
    // de la maqueta. Con 300 la cifra sale gorda.
    fontWeight: '200',
    color: tema.color.texto,
    letterSpacing: -1.5,
    ...tema.cifras,
  },
  frase: { fontSize: 14, lineHeight: 20, color: tema.color.texto, flex: 1, opacity: 0.9 },

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
  notaForma: { ...tema.tipo.micro, color: tema.color.textoTenue, marginTop: tema.espacio.s },

  // Una métrica. Sin caja ni borde: la separa una línea de un pixel, como la v2 del panel.
  metrica: {
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.color.linea,
  },
  metricaTitulo: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  metricaNombre: { ...tema.tipo.cuerpo, color: tema.color.texto },
  // 24px con peso 300, como el `.met .mt i` de la maqueta. Estaba a 22 y 600, que pesaba mucho.
  metricaValor: { ...tema.tipo.valorMetrica },
  metricaUnidad: { fontSize: 12, fontWeight: '400', color: tema.color.textoSuave },
  metricaEstado: { ...tema.tipo.micro, color: tema.color.textoTenue, marginTop: 3 },
  metricaSinDatos: { ...tema.tipo.detalle, color: tema.color.textoTenue },
  metricaAviso: { ...tema.tipo.micro, color: tema.color.textoTenue, marginTop: tema.espacio.s },

  linea: { height: 44, marginTop: tema.espacio.s, justifyContent: 'flex-end' },
  // La banda de "tu normal", pintada de fondo. Es la pieza que hace legible la línea.
  banda: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: tema.color.superficieSutil,
    borderRadius: 2,
  },
  columnas: { flexDirection: 'row', height: '100%', gap: 1 },
  columnaDia: { flex: 1, height: '100%' },
  // 3 pt y no 2: a 2 los puntos de la serie apenas se veían en el iPhone (rediseño del 15 sep).
  punto: { position: 'absolute', left: 0, right: 0, height: 3, borderRadius: 1.5 },
  puntoUltimo: { height: 5, borderRadius: 2.5 },

  enlaceDiag: { minHeight: tema.tactil, justifyContent: 'center' },
  enlaceDiagTexto: { ...tema.tipo.detalle, color: tema.color.marca },
  espera: { marginVertical: tema.espacio.l },
});
