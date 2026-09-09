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
import { Ciencia } from '../componentes/Ciencia';
import { Halo } from '../componentes/Halo';
import { Pulsable } from '../componentes/Pulsable';
import { DetalleSesion } from './DetalleSesion';
import { iconoDe, nombreDeTipo } from '../motor/actividades';
import type { ClaveCiencia } from '../motor/ciencia';
import { HORIZONTES, esValida, rankeaVentana } from '../motor/ranking';
import type { Resultado, Sesion } from '../motor/sesiones';
import { conValores, idiomaActual, textos } from '../i18n/textos';
import { tema } from '../tema';

/**
 * Lista de sesiones, agrupadas por día.
 *
 * Portada de la maqueta `app-preview/`, fila por fila. Lo que pinta sale entero de `procesa()`, que
 * ya estaba en la app: tipo, minutos, distancia, pulso medio, zonas y puntos.
 *
 * ⭐ La barra NO es una sola: está dividida en los cuatro tramos de zona de frecuencia cardíaca, y
 * su longitud total es proporcional a la carga frente a la sesión más alta. Las dos cosas a la vez,
 * que es lo que hace la maqueta. La primera versión de esta pantalla puso una barra plana de un
 * color, y el usuario dijo que no tenía nada que ver. Tenía razón: sin los tramos no se ve **dónde**
 * estuvo el esfuerzo, solo cuánto.
 *
 * 📌 De la maqueta, textual: *"Antes todas medían lo mismo y solo variaban los tramos internos, así
 * que no se entendía qué comparaba"*. Longitud = cuánta carga. Tramos = de qué tipo.
 *
 * ⚠️ Las sesiones sin pulso y las que no puntúan se muestran igual, en gris y con etiqueta.
 * Esconderlas sería mentir sobre lo que hiciste, y el estudio JAMIA señala la opacidad como el
 * mayor problema de confianza de estas apps.
 */

type Props = {
  resultado: Resultado | null;
  cargando: boolean;
  onRecargar: () => void;
  /** Guarda el esfuerzo declarado y vuelve a calcular. Lo resuelve App.tsx. */
  onDeclararEsfuerzo: (idSesion: string, rpe: number) => void;
  /** Corrige el deporte de una sesión y vuelve a calcular. Lo resuelve App.tsx. */
  onCorregirDeporte: (idSesion: string, tipo: string) => void;
};

/** Agrupa por fecha local, no UTC: la sesion pertenece al dia que esa persona vivio. */
function porDia(sesiones: readonly Sesion[]): { fecha: string; sesiones: Sesion[] }[] {
  const mapa = new Map<string, Sesion[]>();
  for (const s of sesiones) {
    const d = new Date(s.inicio);
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    const lista = mapa.get(clave);
    if (lista === undefined) mapa.set(clave, [s]);
    else lista.push(s);
  }
  return [...mapa.entries()]
    .map(([fecha, ss]) => ({ fecha, sesiones: ss }))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MESES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * "Martes 25 de agosto".
 *
 * ⛔ Escrito a mano y NO con `Intl.DateTimeFormat`, aunque Hermes lo soporte. La razón es una
 * lección del mismo día: `Intl.PluralRules` reventó la app en el iPhone porque Hermes no lo
 * implementa, y `tsc` no avisa porque los tipos describen la norma, no el motor.
 */
function tituloDia(fecha: string, idioma: 'es' | 'en'): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const cuando = new Date(a, m - 1, d);
  const dia = cuando.getDay();

  const texto =
    idioma === 'es'
      ? `${DIAS_ES[dia]} ${d} de ${MESES_ES[m - 1]}`
      : `${DIAS_EN[dia]} ${d} ${MESES_EN[m - 1]}`;

  /**
   * ⚠️ Se capitaliza AQUÍ y no con `toUpperCase()` en la pantalla, que es lo que hacía antes.
   *
   * Un texto de 11px en versales con `letter-spacing` positivo es de lo que peor se lee en un
   * móvil: se pierden las formas ascendentes y descendentes que el ojo usa para reconocer la
   * palabra. Y en español los días van en minúscula, así que las versales tapaban además que la
   * cadena estaba bien escrita. En inglés ya viene en mayúscula del array, así que esto no lo toca.
   */
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Fuentes de esta pestaña, en el mismo orden que la maqueta. */
const FUENTES: readonly ClaveCiencia[] = [
  'edwards',
  'intervalico',
  'compendium',
  'isometrico',
  'dosisRespuesta',
  'basePropia',
  'tope',
];

/**
 * Días de historial que trae el motor.
 *
 * ⚠️ Tiene que coincidir con el `calcula(30)` de `App.tsx`. Se declara aquí porque la pantalla lo
 * necesita para la frase de la cabecera, y `Resultado` no lleva la ventana consigo.
 * 📌 Si algún día se cambia el 30 de `cargarSalud`, hay que cambiarlo aquí también.
 */
const DIAS_HISTORIAL = 30;

/** Colores de las cuatro zonas, de suave a máxima. Mismo criterio que la maqueta. */
const COLOR_ZONA = [
  'rgba(198,203,240,0.30)',
  'rgba(198,203,240,0.55)',
  'rgba(198,203,240,0.80)',
  '#c6cbf0',
] as const;

export function Sesiones({ resultado, cargando, onRecargar, onDeclararEsfuerzo, onCorregirDeporte }: Props) {
  const idioma = idiomaActual();
  const t = textos(idioma);
  // Id y no la sesión: así el detalle se refresca solo cuando el motor recalcula tras declarar
  // el esfuerzo, en vez de quedarse con una copia vieja de los puntos.
  const [abierta, setAbierta] = useState<string | null>(null);

  const sesiones = resultado?.sesiones ?? [];
  const dias = porDia(sesiones);
  const fusionadas = sesiones.filter((s) => s.ids.length > 1).length;

  // Referencia de la longitud: la carga mas alta CON pulso, como en la maqueta. Usar las
  // estimadas desvirtuaria la escala, porque su carga no se midio.
  const maxCarga = Math.max(1, ...sesiones.filter((s) => !s.sinPulso).map((s) => s.carga));

  /**
   * ⭐ Sesiones que ENTRAN en el top de la semana, que es lo que de verdad puntúa.
   *
   * Faltaba, y es información que la maqueta sí da (`entraTop`). Sin ella el ranking parece
   * arbitrario: ves siete sesiones con puntos y una cifra que no es su suma. Con la marca se
   * entiende de un vistazo que cuentan las mejores y no todas.
   */
  const semana = HORIZONTES.find((h) => h.id === 'wtd')!;
  const cuentan = new Set(rankeaVentana(sesiones, semana).cuentan);

  // Datos de la cabecera nueva. Salen de lo que ya hay, sin ninguna lectura extra.
  const conPulso = sesiones.filter((x) => !x.sinPulso).length;
  const minutos = Math.round(sesiones.reduce((a, x) => a + x.minutos, 0));

  return (
    <ScrollView
      style={s.fondo}
      contentContainerStyle={s.contenido}
      refreshControl={<Recarga cargando={cargando} onRecargar={onRecargar} />}
    >
      {/*
        ⭐⭐ CABECERA REDISEÑADA. El usuario dijo que "la parte de arriba se ve súper pequeña", y la
        causa es concreta, no una cuestión de gusto.

        `tema.tipo.titulo` son 15px en color tenue, y eso es correcto: viene de medir la maqueta,
        donde el título es una ETIQUETA discreta y la protagonista es la cifra. Pero Sesiones era la
        única pantalla SIN cifra protagonista, así que aplicaba la mitad de la regla: el título
        pequeño, sin nada grande al lado que justificara que fuera pequeño. Quedaba una pantalla que
        empieza en gris de 15px y salta directa a una lista, o sea sin ancla para el ojo.

        ⇒ Se le da la cifra que le faltaba, con el mismo patrón que Hoy y Competi: número grande a
        la izquierda, frase que lo sitúa a la derecha, fila de datos debajo separada por una línea
        de un pixel. Ahora las cinco pestañas abren igual, que es lo que Apple llama consistencia:
        *"things that look the same must behave the same and live in the same place"*.

        ⚠️ Y el halo también faltaba: era la única pantalla sin él, así que arrancaba plana mientras
        las otras cuatro tienen el degradado de arriba. Ese detalle solo se nota comparando, que es
        justo lo que hizo el usuario.
      */}
      <Halo />
      <Text style={s.titulo}>{t.sesionesTitulo}</Text>

      {cargando && sesiones.length === 0 && (
        <ActivityIndicator color={tema.color.marca} style={s.espera} />
      )}

      {sesiones.length > 0 && (
        <>
          <Aparece style={s.hero} desde={12}>
            <View style={s.heroCifra}>
              <Text style={s.n}>{sesiones.length}</Text>
              <Text style={s.u}>{t.sesionesEnTotal}</Text>
            </View>
            <Text style={s.heroFrase}>
              {conValores(
                cuentan.size === 0
                  ? t.sesionesFraseNinguna
                  : cuentan.size === 1
                    ? t.sesionesFraseUna
                    : t.sesionesFrase,
                { dias: DIAS_HISTORIAL, cuentan: cuentan.size },
              )}
            </Text>
          </Aparece>

          {/* Fila de datos, igual que en Hoy: sin cajas, separada por una línea de un pixel. */}
          <Aparece style={s.datos} retardo={70}>
            <View style={s.dato}>
              <Text style={s.datoClave}>{t.sesionesConPulso}</Text>
              <Text style={s.datoValor}>{conPulso}</Text>
            </View>
            <View style={s.dato}>
              <Text style={s.datoClave}>{t.minutos}</Text>
              <Text style={s.datoValor}>{minutos}</Text>
            </View>
            <View style={s.dato}>
              <Text style={s.datoClave}>{t.sesionesFusionadas}</Text>
              <Text style={s.datoValor}>{fusionadas}</Text>
            </View>
          </Aparece>
        </>
      )}

      {!cargando && sesiones.length === 0 && (
        <>
          <Text style={s.vacioTitulo}>{t.sinSesiones}</Text>
          <Text style={s.sub}>{t.sinSesionesTexto}</Text>
        </>
      )}

      {/*
        ⭐ Cada DÍA entra en cascada, no cada sesión.
   
        Es deliberado y responde a la unidad de lectura: el día es el bloque que se lee de una vez,
        así que escalonar dentro de él rompería el raíl temporal, que es justo lo que conecta dos
        sesiones de la misma jornada. Escalonando por día, el raíl entra entero.
      */}
      {dias.map((dia, iDia) => (
        <Aparece key={dia.fecha} indice={iDia}>
          {/*
            ⭐ La cabecera del día ahora lleva el TOTAL de ese día a la derecha.
        
            Faltaba, y es la pregunta obvia al mirar un día con tres sesiones: cuánto sumé. Estaba
            solo en las filas individuales, así que había que sumar de cabeza. Apple lo llama
            *"sometimes adding context simplifies"*: el dato de más quita el trabajo mental.
        
            ⚠️ Y ya no va en MAYÚSCULAS. Un texto de 11px con `letter-spacing` positivo en versales
            es de lo que peor se lee en un móvil, y la propia skill de Apple lo señala: el tracking
            es específico del tamaño, y en texto pequeño hay que ir con cuidado. Se cambia por
            capitalizar la primera letra, que se lee de un vistazo, y la jerarquía la sigue haciendo
            el color tenue.
          */}
          <View style={s.diaFila}>
            <Text style={s.dia}>{tituloDia(dia.fecha, idioma)}</Text>
            <Text style={s.diaTotal}>
              {/* Suman TODAS las que puntúan, también las estimadas: es el mismo criterio del
                  motor. Antes se excluían las sin pulso y el total del día contradecía a las
                  filas de abajo. */}
              {dia.sesiones.reduce((a, x) => a + (esValida(x) ? x.puntos : 0), 0)}
              <Text style={s.diaTotalUnidad}> {t.puntos}</Text>
            </Text>
          </View>

          {dia.sesiones.map((ses, i) => {
            const cuenta = esValida(ses);
            /*
              ⛔⛔ ANTES: `gris = ses.sinPulso || !cuenta`, y era MENTIRA en la mitad de los casos.
         
              Una sesión sin pulso SÍ puntúa: el motor le calcula carga estimada con descuento
              0,95, y ese fue justo el arreglo que pidió el usuario cuando la primera versión las
              excluía ("sin esto se queda fuera todo el que no lleva pulsera"). Pero esta pantalla
              se quedó con el criterio viejo: las pintaba apagadas, con "·" en vez de sus puntos y
              con "no puntúa" debajo. El motor decía una cosa y la interfaz la contraria.
         
              Y es la mentira más cara de la app, porque va contra su propia tesis: el estudio
              JAMIA señala los scores opacos como el mayor problema de confianza, y aquí el score
              existía pero se ocultaba. Visto en el iPhone con una natación real.
         
              ⇒ El gris queda SOLO para lo que de verdad no puntúa (demasiado corta, sin carga).
              Lo estimado se muestra con su cifra y la etiqueta "estimada", que es exactamente lo
              que ya hacía el detalle al abrir la sesión. Mismo dato en la lista y en el detalle.
            */
            const gris = !cuenta;
            const ultima = i === dia.sesiones.length - 1;
            // Longitud proporcional a la carga; minimo del 8 % para que se vea que existe.
            const ancho = ses.sinPulso ? 0 : Math.max(8, (ses.carga / maxCarga) * 100);

            // Reparto de la barra entre las cuatro zonas de FC.
            // `segundos` ya son exactamente cuatro zonas, de suave a maxima: no se recorta nada.
            const z = ses.zonas?.segundos ?? null;
            const totalZ = z === null ? 0 : z.reduce((a, x) => a + x, 0);

            return (
              // Al tocar se abre el desglose. Es lo que hace la maqueta, y responde al hallazgo
              // del estudio JAMIA: cada puntuación tiene que poder justificarse.
              // ⭐ `Pulsable` da feedback al PULSAR, no al soltar. Sin esto la fila no acusa el
              // toque y la app se siente muerta, que es parte de lo que la separaba de la maqueta.
              <Pulsable
                key={ses.id}
                /*
                  ⚠️ `fila` en vez de una escala muy pequeña, que es lo que había.
              
                  Escalar una fila ancha al 0,99 tiene dos problemas: se ve tan poco que no llega a
                  cumplir su función de acusar el toque, y lo poco que se ve es el fondo asomando
                  por los lados, o sea que lo que se percibe es un defecto de dibujo. Atenuar
                  resuelve las dos cosas y es lo que hace iOS con las filas de una tabla.
              
                  Aquí importa además por el raíl: escalar la fila movería la línea vertical, y esa
                  línea tiene que alinearse con la de la fila de al lado.
                */
                fila
                style={s.fila}
                onPress={() => setAbierta(ses.id)}
                accessibilityRole="button"
                accessibilityLabel={`${nombreDeTipo(ses.tipo, idioma)}, ${ses.puntos} ${t.puntos}`}
              >
                {/*
                  ⭐ Raíl temporal: línea vertical continua dentro del día y un nodo por sesión.
                  Es el patrón de la agenda de LeonApostolico que la maqueta reutiliza, y lo que
                  hace que dos sesiones del mismo día se lean como una secuencia en vez de como
                  dos filas sueltas.

                  En la última sesión del día la línea se corta a la mitad, así el raíl no
                  invade la cabecera del día siguiente.
                */}
                <View style={s.rail}>
                  <View style={[s.railLinea, ultima && s.railCortado]} />
                  <View style={[s.nodo, gris && s.nodoVacio]} />
                </View>

                <Text style={[s.icono, gris && s.iconoGris]}>{iconoDe(ses.tipo)}</Text>

                <View style={s.medio}>
                  <View style={s.nombreFila}>
                    <Text style={[s.nombre, gris && s.apagado]}>
                      {nombreDeTipo(ses.tipo, idioma)}
                    </Text>
                    {cuentan.has(ses.id) && (
                      <Text style={[s.tag, s.tagCuenta]}>{t.tagCuenta}</Text>
                    )}
                    {ses.ids.length > 1 && (
                      <Text style={[s.tag, s.tagFusion]}>{t.tagFusionada}</Text>
                    )}
                    {ses.sinPulso && <Text style={[s.tag, s.tagAviso]}>{t.tagSinPulso}</Text>}
                  </View>

                  <Text style={s.detalle}>
                    {ses.minutos} min
                    {ses.metros !== null && ses.metros > 0
                      ? ` · ${(ses.metros / 1000).toFixed(2)} km`
                      : ''}
                    {ses.fcMedia !== null ? ` · ${ses.fcMedia} lpm` : ''}
                  </Text>

                  {/*
                    Barra en cuatro tramos. La longitud dice CUÁNTA carga; los tramos dicen DE QUÉ
                    TIPO. Sin pulso no se pinta: no habría nada que repartir.
                  */}
                  {!ses.sinPulso && totalZ > 0 && z !== null && (
                    // ⚠️ Los porcentajes van como `flex` y no como `width: '50%'`: TypeScript no
                    // acepta un porcentaje calculado como `DimensionValue`, y `flex` da el mismo
                    // reparto proporcional sin pelearse con los tipos.
                    <View style={[s.zonas, { width: `${Math.round(ancho)}%` as const }]}>
                      {z.map((seg, i) =>
                        seg === 0 ? null : (
                          <View key={i} style={{ flex: seg, backgroundColor: COLOR_ZONA[i] }} />
                        ),
                      )}
                    </View>
                  )}
                </View>

                <View style={s.derecha}>
                  {/*
                    ⭐ La cifra se muestra SIEMPRE que exista, también en las estimadas. Antes iba
                    un "·" y "no puntúa", que contradecía al motor: la sesión puntuaba con
                    descuento y la lista lo negaba. La unidad dice el origen cuando no es medido,
                    con la misma palabra que usa el detalle al abrirla.
                  */}
                  <Text style={[s.puntos, gris && s.apagado]}>
                    {cuenta ? ses.puntos : '·'}
                  </Text>
                  <Text style={s.unidad}>
                    {!cuenta
                      ? t.noPuntua
                      : ses.origen === 'declarada'
                        ? t.origenDeclarada
                        : ses.origen === 'estimada'
                          ? t.origenEstimada
                          : t.puntos}
                  </Text>
                </View>
              </Pulsable>
            );
          })}
        </Aparece>
      ))}

      <Ciencia ids={FUENTES} />

      <DetalleSesion
        sesion={sesiones.find((x) => x.id === abierta) ?? null}
        onCerrar={() => setAbierta(null)}
        onCorregirDeporte={onCorregirDeporte}
        onDeclararEsfuerzo={(id, rpe) => {
          onDeclararEsfuerzo(id, rpe);
          setAbierta(null);
        }}
      />
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

  /* ── Cabecera: mismas medidas que Hoy, para que las pestañas abran igual ─────────────────── */
  hero: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: tema.espacio.m },
  heroCifra: { minWidth: 96 },
  n: { ...tema.tipo.cifraPar, color: tema.color.texto },
  u: { ...tema.tipo.micro, color: tema.color.textoSuave, marginTop: 2, maxWidth: 88 },
  heroFrase: { fontSize: 14, lineHeight: 20, color: tema.color.texto, flex: 1, opacity: 0.9 },
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

  // Cabecera del día: fecha a la izquierda, total a la derecha.
  diaFila: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: tema.espacio.xs,
    paddingBottom: 6,
  },
  /**
   * ⚠️ 13px y sin `letter-spacing`, antes 11px con 0,6 y en VERSALES.
   *
   * El cambio no es de gusto: un texto pequeño en mayúsculas con tracking positivo pierde las
   * ascendentes y descendentes, que son las formas por las que el ojo reconoce una palabra sin
   * leerla letra a letra. La skill de Apple es explícita en que el tracking es específico del
   * tamaño, y aquí el valor venía copiado de un titular grande, donde sí tiene sentido.
   */
  dia: { fontSize: 13, fontWeight: '500', color: tema.color.textoSuave },
  diaTotal: { fontSize: 13, fontWeight: '500', color: tema.color.textoTenue, ...tema.cifras },
  diaTotalUnidad: { fontSize: 11, fontWeight: '400' },
  // `alignItems: 'stretch'` es lo que hace que el raíl ocupe la altura completa de la fila y
  // conecte con la siguiente. Con 'flex-start' quedaría un trozo de línea suelto.
  fila: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: tema.espacio.s + 2 },
  rail: { width: 9, alignItems: 'center' },
  railLinea: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: tema.color.linea,
  },
  railCortado: { bottom: '50%' },
  nodo: {
    position: 'absolute',
    top: 7,
    // ⚠️ 13px y no 7. La maqueta usa `box-shadow: 0 0 0 3px var(--bg)`, que crece HACIA FUERA,
    // pero en React Native `borderWidth` va hacia DENTRO. Con 7px y borde de 3 quedaría un punto
    // de 1px. Se compensa con 7 + 3 + 3 para que el círculo visible siga siendo de 7.
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: tema.color.marca,
    // Anillo del color del fondo: tapa la línea justo detrás del nodo. Sin esto la línea se ve
    // cruzando el punto.
    borderWidth: 3,
    borderColor: tema.color.fondo,
  },
  nodoVacio: { backgroundColor: tema.color.textoSuave },
  icono: { fontSize: 20, width: 30, marginTop: 2, paddingLeft: tema.espacio.xs },
  iconoGris: { opacity: 0.45 },
  medio: { flex: 1, paddingRight: tema.espacio.m },
  nombreFila: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  // ⚠️ Peso normal, no 600. La maqueta usa 15px regular en el nombre: el negrita lo reservaba
  // para tu propia fila del ranking, y ponerlo aquí en todas hacía la lista más pesada.
  nombre: { ...tema.tipo.cuerpo, color: tema.color.texto },
  apagado: { color: tema.color.textoSuave },
  // Etiquetas pequeñas: dicen por qué una sesión es distinta, sin ocupar una línea entera.
  tag: {
    fontSize: 9,
    fontWeight: '500',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagFusion: { color: tema.color.marca, backgroundColor: 'rgba(198,203,240,0.14)' },
  tagAviso: { color: '#f9808a', backgroundColor: 'rgba(249,64,79,0.14)' },
  // Verde apagado: dice "esta cuenta" sin competir con el periwinkle de marca.
  tagCuenta: { color: '#9ec9a8', backgroundColor: 'rgba(158,201,168,0.14)' },
  detalle: { ...tema.tipo.micro, color: tema.color.textoTenue, marginTop: 2 },
  zonas: {
    flexDirection: 'row',
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: tema.espacio.s,
  },
  derecha: { alignItems: 'flex-end', minWidth: 52 },
  // 17px y peso 500, como el `.ses .pt` de la maqueta. Estaba a 24 y 600, y con siete filas
  // seguidas esos números dominaban la pantalla entera.
  puntos: { fontSize: 17, fontWeight: '500', color: tema.color.texto, ...tema.cifras },
  unidad: { fontSize: 9, color: tema.color.textoTenue },
  espera: { marginVertical: tema.espacio.l },
});
