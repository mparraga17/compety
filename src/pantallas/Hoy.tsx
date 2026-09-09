import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Recarga } from '../componentes/Recarga';
import { Aparece } from '../componentes/Aparece';
import { Columna } from '../componentes/Barra';
import { Ciencia } from '../componentes/Ciencia';
import { Cifra } from '../componentes/Cifra';
import { Hoja } from '../componentes/Hoja';
import { iconoDe } from '../motor/actividades';
import { Halo } from '../componentes/Halo';
import { Pulsable } from '../componentes/Pulsable';
import { escalonDe } from '../movimiento';
import type { ClaveCiencia } from '../motor/ciencia';
import { zDe } from '../motor/base';
import { nombreDeTipo } from '../motor/actividades';
import { HORIZONTES, enVentana, rankeaVentana, type SesionPuntuada } from '../motor/ranking';
import type { Resultado, Sesion } from '../motor/sesiones';
import { conValores, idiomaActual, textos } from '../i18n/textos';
import { tema } from '../tema';

/**
 * Pestaña Hoy: tu semana de un vistazo.
 *
 * Portada de la maqueta `app-preview/`, en el mismo orden: título, resumen, cifra y frase en
 * paralelo, fila de datos, gráfico de barras y las últimas sesiones.
 *
 * ⭐ El criterio que ordena la pantalla viene del estudio JAMIA 2023 con 18 usuarios reales de
 * Fitbit: su problema nº1 no es estético, es que **no saben qué es normal para ellos mismos**. Un
 * gráfico sin referencia les parecía inútil (*"no me da información más allá de lo que ya sé"*).
 *
 * De ahí las dos decisiones: la cifra grande va acompañada de una FRASE que la sitúa contra la base
 * propia, y las barras se comparan con tu rango habitual, no con una escala general.
 *
 * ⚠️ Sin datos no se inventa nada: se dice que no hay sesiones y por qué.
 */

type Props = {
  resultado: Resultado | null;
  cargando: boolean;
  onRecargar: () => void;
};

/** Ventana de la pestaña: la semana en curso, que es la que se compite. */
const SEMANA = HORIZONTES.find((h) => h.id === 'wtd')!;

type Barra = { dia: number; puntos: number; sesiones: readonly Sesion[] };

/** Barras del gráfico: una por día de la semana, no una por sesión. */
function barrasPorDia(sesiones: readonly Sesion[]): Barra[] {
  const porDia = new Map<number, Sesion[]>();
  for (const s of sesiones) {
    const d = new Date(s.inicio);
    // Lunes primero, que es la convención en España y la que usa el ranking.
    const indice = (d.getDay() + 6) % 7;
    const lista = porDia.get(indice);
    if (lista === undefined) porDia.set(indice, [s]);
    else lista.push(s);
  }

  return Array.from({ length: 7 }, (_, i) => {
    const delDia = porDia.get(i) ?? [];
    return {
      dia: i,
      puntos: delDia.reduce((a, s) => a + s.puntos, 0),
      sesiones: delDia,
    };
  });
}

/**
 * Alto del carril de las columnas, en puntos.
 *
 * ⚠️ Constante y no porcentaje porque `Columna` anima con `scaleY`, que corre en GPU pero escala
 * desde el centro: para anclar la columna al suelo hay que compensar con un `translateY` de la
 * mitad, y esa mitad son puntos. Con `height: '40%'` no habría número que compensar.
 */
const ALTO_GRAFICO = 96;

const INICIALES_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const INICIALES_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * Nombres de día, con el lunes primero para que cuadren con los índices del gráfico.
 *
 * ⛔ Escritos a mano y NO con `Intl.DateTimeFormat`, aunque Hermes lo soporte. Es la regla del
 * proyecto desde que `Intl.PluralRules` reventó la app: nada de `Intl` en código del teléfono.
 */
const DIAS_ES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const DIAS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Días cortos con domingo primero, el orden de `Date.getDay()`. Para las filas de sesión. */
const DIA_CORTO_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DIA_CORTO_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * "hoy 19:30", "ayer 08:12" o "lun 7 · 19:30", para situar cada sesión de la lista.
 *
 * Petición del usuario (8 sep): las filas decían "45 min · 132 lpm" y no había forma de saber
 * CUÁNDO fue cada una. Hoy y ayer van con palabra porque es como habla la gente; de ahí para
 * atrás, día corto y número. Hora en formato 24 h, sin `Intl` (regla del proyecto).
 */
function diaYHora(ms: number, idioma: 'es' | 'en'): string {
  const d = new Date(ms);
  const hora = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const mismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (mismoDia(d, hoy)) return `${idioma === 'es' ? 'hoy' : 'today'} ${hora}`;
  if (mismoDia(d, ayer)) return `${idioma === 'es' ? 'ayer' : 'yesterday'} ${hora}`;

  const dia = (idioma === 'es' ? DIA_CORTO_ES : DIA_CORTO_EN)[d.getDay()];
  return `${dia} ${d.getDate()} · ${hora}`;
}

/**
 * Fuentes de esta pestaña, en el mismo orden que la maqueta.
 * Empieza por el tope, que es la regla que más extraña al ver la cifra, y acaba en la
 * competición, que es la tesis del producto.
 */
const FUENTES: readonly ClaveCiencia[] = [
  'tope',
  'edwards',
  'compendium',
  'volumen',
  'dosisRespuesta',
  'basePropia',
  'competicion',
];

export function Hoy({ resultado, cargando, onRecargar }: Props) {
  const idioma = idiomaActual();
  const t = textos(idioma);
  // Índice del día abierto en el desglose. null cierra la hoja.
  const [diaAbierto, setDiaAbierto] = useState<number | null>(null);

  const todas = resultado?.sesiones ?? [];
  const dentro = enVentana(todas as readonly SesionPuntuada[], SEMANA) as readonly Sesion[];
  const r = rankeaVentana(todas as readonly SesionPuntuada[], SEMANA);

  const minutos = Math.round(dentro.reduce((a, s) => a + s.minutos, 0));
  const ultima = [...dentro].sort((a, b) => b.inicio - a.inicio)[0];
  const deportes = [...new Set(dentro.map((s) => s.tipo).filter((x): x is string => x !== null))];

  // ⭐ La frase. Compara la ULTIMA sesion con la base personal, que es lo que responde a
  // "¿esto es normal para mi?". Sin base suficiente no se afirma nada.
  const base = resultado?.base;
  let frase: string | null = null;
  if (ultima !== undefined && base !== undefined && base.sigma > 0) {
    const z = zDe(ultima.carga, base);
    const donde = z > 1 ? t.porEncima : z < -1 ? t.porDebajo : t.dentroDeRango;
    frase = conValores(t.fraseHoy, {
      deporte: nombreDeTipo(ultima.tipo, idioma),
      donde,
      min: Math.round(base.media - base.sigma),
      max: Math.round(base.media + base.sigma),
    });
  }

  const barras = barrasPorDia(dentro);
  const topeBarra = Math.max(1, ...barras.map((b) => b.puntos));
  const iniciales = idioma === 'es' ? INICIALES_ES : INICIALES_EN;
  const hoyIndice = (new Date().getDay() + 6) % 7;

  return (
    <ScrollView
      style={s.fondo}
      contentContainerStyle={s.contenido}
      refreshControl={<Recarga cargando={cargando} onRecargar={onRecargar} />}
    >
      <Halo />
      <Text style={s.titulo}>{t.hoyTitulo}</Text>
      <Text style={s.sub}>
        {conValores(t.hoyResumen, { n: r.cuentan.length, s: r.validas, m: minutos })}
      </Text>

      {cargando && todas.length === 0 && (
        <ActivityIndicator color={tema.color.marca} style={s.espera} />
      )}

      {!cargando && dentro.length === 0 && (
        <>
          <Text style={s.vacioTitulo}>{t.sinSesiones}</Text>
          <Text style={s.sub}>{t.sinSesionesTexto}</Text>
        </>
      )}

      {dentro.length > 0 && (
        <>
          {/* Cifra y frase en paralelo. Gana altura de pantalla, que es lo que hacia la maqueta. */}
          <Aparece style={s.hero} desde={12}>
            <View style={s.cifra}>
              {/* ⭐ La cifra SIGUE el valor con resorte al refrescar, en vez de saltar. El primer
                  pintado entra ya puesto: contar desde cero al abrir sería ruido. */}
              <Cifra valor={r.total} style={s.n} />
              <Text style={s.u}>{t.puntosEsfuerzo}</Text>
            </View>
            {frase !== null && <Text style={s.frase}>{frase}</Text>}
          </Aparece>

          {/* Fila de datos sin cajas: la jerarquia la hace el tamaño, no los bordes. */}
          <Aparece style={s.datos} retardo={70}>
            <View style={s.dato}>
              <Text style={s.datoClave}>{t.tabSesiones}</Text>
              <Text style={s.datoValor}>{r.validas}</Text>
            </View>
            <View style={s.dato}>
              <Text style={s.datoClave}>{t.deportes}</Text>
              <Text style={s.datoValor}>{deportes.length}</Text>
            </View>
            <View style={s.dato}>
              <Text style={s.datoClave}>{t.minutos}</Text>
              <Text style={s.datoValor}>{minutos}</Text>
            </View>
          </Aparece>

          {/*
            Gráfico por DÍA de la semana, no por sesión. Con una barra por sesión, una sola
            actividad ocupaba el ancho entero y no se leía nada, que es lo que el usuario vio.
            Los días sin actividad se pintan como hueco, porque un día vacío es información.
          */}
          <View style={s.grafico}>
            {barras.map((b) => (
              // Al tocar un día se abre su desglose, como en la maqueta. Los días vacíos no se
              // pueden tocar: no hay nada que abrir.
              <Pulsable
                key={b.dia}
                fila
                style={s.columna}
                disabled={b.sesiones.length === 0}
                onPress={() => setDiaAbierto(b.dia)}
                accessibilityRole="button"
                // ⚠️ El nombre COMPLETO del día, no la inicial: VoiceOver leería "ele" con "L".
                accessibilityLabel={`${(idioma === 'es' ? DIAS_ES : DIAS_EN)[b.dia]}, ${b.puntos} ${t.puntos}`}
              >
                <View style={s.pistaBarra}>
                  {/*
                    ⭐ Las columnas CRECEN de izquierda a derecha, un día detrás de otro.
                
                    La cascada dice algo real: el gráfico es la semana en orden, así que llegar en
                    ese orden es contar el recorrido en vez de plantar el resultado. Y con 40 ms
                    por día la semana entera está puesta en 240 ms, dentro del presupuesto de una
                    sola animación.
                
                    ⚠️ La altura va en PUNTOS y no en porcentaje, porque `Columna` usa `scaleY` (que
                    corre en GPU) y necesita saber cuánto mide el carril para anclarse al suelo.
                  */}
                  <Columna
                    valor={b.puntos / topeBarra}
                    alto={ALTO_GRAFICO}
                    fondo={tema.color.linea}
                    retardo={escalonDe(b.dia)}
                  />
                </View>
                <Text style={[s.inicial, b.dia === hoyIndice && s.inicialHoy]}>
                  {iniciales[b.dia]}
                </Text>
              </Pulsable>
            ))}
          </View>

          <Text style={s.leyenda}>{deportes.map((d) => nombreDeTipo(d, idioma)).join(' · ')}</Text>

          {/*
            Últimas sesiones, un resumen corto. La lista completa vive en su pestaña.
            La cabecera «Puntos» sobre la columna de cifras (petición del usuario, 8 sep): la
            cifra pelada a la derecha no decía qué era. Va en micro y tenue, alineada a la
            columna, no como un titular.
          */}
          <View style={s.seccionFila}>
            <Text style={[s.seccion, s.enFila]}>{t.ultimasSesiones}</Text>
            <Text style={s.cabeceraPuntos}>{t.cabeceraPuntos}</Text>
          </View>
          {[...dentro]
            .sort((a, b) => b.inicio - a.inicio)
            .slice(0, 5)
            .map((ses, i) => (
              <Aparece key={ses.id} style={s.fila} indice={i}>
                <View style={s.filaMedio}>
                  <Text style={s.filaNombre}>{nombreDeTipo(ses.tipo, idioma)}</Text>
                  <Text style={s.filaDetalle}>
                    {diaYHora(ses.inicio, idioma)} · {ses.minutos} min
                    {ses.fcMedia !== null ? ` · ${ses.fcMedia} lpm` : ` · ${t.sinPulsoEtiqueta}`}
                  </Text>
                </View>
                <Text style={s.filaPuntos}>{ses.puntos}</Text>
              </Aparece>
            ))}
        </>
      )}

      {/* Al final del todo, por petición del usuario. Se muestra incluso sin sesiones: explica
          cómo se puntúa antes de tener datos, que es cuando más dudas hay. */}
      <Ciencia ids={FUENTES} />

      {/*
        Desglose del día al tocar su barra. En la maqueta se abre igual.

        ⭐ Con el componente `Hoja` compartido, no con un Modal a mano. `Hoja` existe justamente
        porque el mismo bloque (agarre, título, cerrar) estaba copiado en cinco sitios con
        medidas ligeramente distintas, y esta pantalla seguía siendo una de las copias.
      */}
      <Hoja
        visible={diaAbierto !== null}
        onCerrar={() => setDiaAbierto(null)}
        titulo={diaAbierto === null ? undefined : (idioma === 'es' ? DIAS_ES : DIAS_EN)[diaAbierto]}
        sub={
          diaAbierto === null
            ? undefined
            : conValores(
                barras[diaAbierto].sesiones.length === 1 ? t.diaResumenUna : t.diaResumen,
                { n: barras[diaAbierto].sesiones.length },
              )
        }
      >
        {diaAbierto !== null && (
          <>
            {[...barras[diaAbierto].sesiones]
              .sort((a, b) => b.puntos - a.puntos)
              .map((ses) => (
                <View key={ses.id} style={s.hojaFila}>
                  <Text style={s.hojaIcono}>{iconoDe(ses.tipo)}</Text>
                  <View style={s.hojaMedio}>
                    <Text style={s.hojaNombre}>{nombreDeTipo(ses.tipo, idioma)}</Text>
                    <Text style={s.hojaDetalle}>{ses.minutos} min</Text>
                  </View>
                  <Text style={s.hojaPuntos}>{ses.puntos}</Text>
                </View>
              ))}

            <View style={s.hojaTotal}>
              <Text style={s.hojaNombre}>{t.total}</Text>
              <Text style={s.hojaPuntos}>{barras[diaAbierto].puntos}</Text>
            </View>
          </>
        )}
      </Hoja>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: tema.color.fondo },
  contenido: {
    paddingHorizontal: tema.espacio.l,
    // Un poco mas de aire: en el Development Build el engranaje del menu de desarrollo flota
    // arriba a la derecha y se comia el titulo.
    paddingTop: tema.seguroArriba + tema.espacio.s,
    paddingBottom: tema.espacio.xl,
  },
  // ⭐ Título de 15px y TENUE, como el `h1` de la maqueta. La protagonista es la cifra.
  titulo: { ...tema.tipo.titulo, color: tema.color.textoSuave },
  sub: { ...tema.tipo.sub, color: tema.color.textoTenue, marginBottom: tema.espacio.m },
  vacioTitulo: { ...tema.tipo.cuerpo, color: tema.color.texto, marginBottom: tema.espacio.xs },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: tema.espacio.m },
  cifra: { minWidth: 96 },
  n: { ...tema.tipo.cifraPar, color: tema.color.texto },
  u: { ...tema.tipo.micro, color: tema.color.textoSuave, marginTop: 2, maxWidth: 88 },
  frase: { fontSize: 14, lineHeight: 20, color: tema.color.texto, flex: 1, opacity: 0.9 },
  // Fila de datos separada por una línea de un pixel, como la `.row` de la maqueta.
  datos: {
    flexDirection: 'row',
    gap: 26,
    paddingVertical: 18,
    marginTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.color.linea,
  },
  dato: { gap: 3 },
  datoClave: { ...tema.tipo.micro, color: tema.color.textoTenue },
  datoValor: { ...tema.tipo.valor, color: tema.color.texto },
  grafico: { flexDirection: 'row', gap: 6, marginTop: tema.espacio.l },
  columna: { flex: 1, alignItems: 'center' },
  // Alto fijo, el que necesita `Columna` para anclarse al suelo. `justifyContent` ya no hace
  // falta: la columna ocupa el carril entero y la proporción la pone el `scaleY`.
  pistaBarra: { height: ALTO_GRAFICO, width: '100%' },
  inicial: { fontSize: 11, color: tema.color.textoTenue, marginTop: tema.espacio.xs },
  inicialHoy: { color: tema.color.marca, fontWeight: '600' },
  leyenda: { ...tema.tipo.micro, color: tema.color.textoTenue, marginTop: tema.espacio.s },

  hojaFila: { flexDirection: 'row', alignItems: 'center', paddingVertical: tema.espacio.s },
  hojaIcono: { fontSize: 20, width: 30 },
  hojaMedio: { flex: 1 },
  hojaNombre: { ...tema.tipo.cuerpo, color: tema.color.texto },
  hojaDetalle: { ...tema.tipo.micro, color: tema.color.textoTenue },
  hojaPuntos: { ...tema.tipo.valor, color: tema.color.texto },
  hojaTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: tema.espacio.m,
    marginTop: tema.espacio.s,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.color.linea,
  },
  seccion: {
    ...tema.tipo.seccion,
    color: tema.color.textoSuave,
    marginTop: tema.espacio.l,
    marginBottom: 2,
  },
  // La fila que junta el título de sección con la cabecera de la columna de puntos.
  seccionFila: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: tema.espacio.l,
    marginBottom: 2,
  },
  enFila: { marginTop: 0, marginBottom: 0 },
  cabeceraPuntos: { ...tema.tipo.micro, color: tema.color.textoTenue },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.color.linea,
  },
  filaMedio: { flex: 1 },
  filaNombre: { ...tema.tipo.cuerpo, color: tema.color.texto },
  filaDetalle: { ...tema.tipo.micro, color: tema.color.textoTenue, marginTop: 2 },
  filaPuntos: { ...tema.tipo.valor, color: tema.color.texto },
  espera: { marginVertical: tema.espacio.l },
});
