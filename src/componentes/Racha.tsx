import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Aparece } from './Aparece';
import { Ficha } from './Ficha';
import { Hoja } from './Hoja';
import { Pulsable } from './Pulsable';
import { conValores, idiomaActual, textos } from '../i18n/textos';
import type { ClaveCiencia } from '../motor/ciencia';
import { OBJETIVO_MINUTOS } from '../motor/oms';
import { mensajeDe, type Racha } from '../motor/racha';
import { ESCALON } from '../movimiento';
import { tema } from '../tema';

/**
 * La racha semanal, POR FIN visible.
 *
 * ⭐⭐ `motor/racha.ts` llevaba terminado, testeado y con los textos escritos en dos idiomas...
 * y ningún .tsx lo importaba. Es la pieza de gamificación más barata de activar de toda la app,
 * y además la que equilibra el ranking: el estudio de leaderboards de 2025 encontró que la
 * posición absoluta desmotiva a quien no valora competir, y la racha es competición contra uno
 * mismo. Quien va quinto en su liga puede ir 6 semanas encendido, y eso es SUYO.
 *
 * Dos piezas:
 *
 *   `ChipRacha`  la llama con el número, en la cabecera de Competi. Siempre a la vista,
 *                incluso sin ligas: la racha se calcula en el teléfono y no necesita servidor.
 *   La hoja      historial de semanas que se encienden en cascada (el patrón del Medidor),
 *                el estado del comodín y el mensaje motivador CON su ficha de ciencia.
 *
 * ⭐ El número del chip cuenta la semana EN CURSO si ya está cumplida. No es trampa: los minutos
 * solo se acumulan, así que una semana cumplida no puede des-cumplirse. El motor la deja fuera
 * de `semanas` por la contabilidad del comodín, pero para la persona "llevo 4" incluye la que
 * acaba de asegurar. Duolingo cuenta el día de hoy en cuanto terminas la lección por lo mismo.
 *
 * ⭐ La llama APAGADA (opacidad baja) cuando la semana en curso aún no está cumplida es la señal
 * de un vistazo: "esta semana todavía no la tienes". El emoji trae su propio color, así que no
 * rompe la regla del acento único: es el mismo estatus que ya tienen 🏆 y 🎯 en Celebracion.
 */

type Props = {
  racha: Racha;
};

/** Semanas del historial que se pintan. Con 30 días de motor llegan ~5; el tope es por si crece. */
const SEMANAS_VISTA = 8;

/** Fecha corta del lunes de una semana: "1 sep" / "Sep 1". */
function fechaCorta(ms: number, idioma: 'es' | 'en'): string {
  return new Date(ms).toLocaleDateString(idioma === 'es' ? 'es-ES' : 'en-US', {
    day: 'numeric',
    month: 'short',
  });
}

export function ChipRacha({ racha }: Props) {
  const idioma = idiomaActual();
  const t = textos(idioma);
  const [abierta, setAbierta] = useState(false);
  const [ciencia, setCiencia] = useState<ClaveCiencia | null>(null);

  // La semana en curso cuenta en cuanto está asegurada. Ver el comentario de cabecera.
  const visibles = racha.semanas + (racha.actualCumplida ? 1 : 0);
  const encendida = racha.actualCumplida;

  const titulo =
    visibles === 0
      ? t.rachaCero
      : visibles === 1
        ? t.rachaUnaSemana
        : conValores(t.rachaSemanas, { n: visibles });

  // Historial en orden de lectura: la semana más vieja a la izquierda, la actual a la derecha.
  const semanas = [...racha.historial].slice(0, SEMANAS_VISTA).reverse();
  const actual = racha.historial[0];
  const faltan = actual === undefined ? OBJETIVO_MINUTOS : Math.max(0, Math.round(OBJETIVO_MINUTOS - actual.equivalente));

  const mensaje = mensajeDe(racha);

  return (
    <>
      <Pulsable
        style={s.chip}
        accessibilityRole="button"
        accessibilityLabel={`${t.rachaTitulo}. ${titulo}`}
        onPress={() => setAbierta(true)}
      >
        <Text style={[s.llama, !encendida && s.llamaApagada]}>{'\u{1F525}'}</Text>
        {visibles > 0 && <Text style={s.chipNumero}>{visibles}</Text>}
      </Pulsable>

      <Hoja visible={abierta} onCerrar={() => setAbierta(false)} titulo={t.rachaTitulo} sub={titulo}>
        {/*
          ⭐ Las semanas se ENCIENDEN una detrás de otra, de vieja a nueva, con el mismo medio
          escalón que los segmentos del Medidor: la cascada aquí es literalmente el dato (la
          racha es una secuencia en el tiempo) y verla encenderse en orden ES leerla.

          El relleno va DENTRO del punto, en absoluto, para que el hueco vacío siga debajo:
          mismo truco que el Medidor. `Aparece` ya respeta "Reducir movimiento".
        */}
        <View style={s.semanas} accessible={false}>
          {semanas.map((sem, i) => {
            const esActual = actual !== undefined && sem.inicio === actual.inicio;
            return (
              <View key={sem.inicio} style={s.semana}>
                <View style={[s.punto, esActual && s.puntoActual]}>
                  {sem.cumplida && (
                    <Aparece retardo={i * (ESCALON / 2)} desde={0} style={s.puntoLleno}>
                      <View />
                    </Aparece>
                  )}
                </View>
                <Text style={s.puntoFecha}>{fechaCorta(sem.inicio, idioma)}</Text>
              </View>
            );
          })}
        </View>

        {/* La semana en curso, en una frase: asegurada, o cuántos minutos le faltan. */}
        <Text style={s.estado}>
          {racha.actualCumplida ? t.rachaSemanaActual : conValores(t.omsFaltan, { n: faltan })}
        </Text>

        {/*
          El comodín, explicado SIEMPRE (con él y sin él). Es la pieza que hace humana la racha:
          JCR 49(6):1095 midió que una racha rota reduce la conducta siguiente incluso cuando se
          rompió por causas ajenas, y que el efecto se atenúa si se puede reparar.
        */}
        <View style={s.comodin}>
          <Text style={[s.comodinIcono, racha.comodines === 0 && s.llamaApagada]}>{'\u{1F6E1}\uFE0F'}</Text>
          <Text style={s.comodinTexto}>
            {racha.comodines > 0 ? t.rachaComodin : t.rachaSinComodin}
          </Text>
        </View>

        {/*
          Mensaje motivador CON su fuente, nunca un "¡sigue así!" vacío: se toca y se abre la
          ficha de ciencia que lo respalda, que es la tesis del producto contra el score opaco.
        */}
        <Pulsable
          fila
          style={s.mensaje}
          accessibilityRole="button"
          accessibilityLabel={t.rachaVerCiencia}
          onPress={() => setCiencia(mensaje.ciencia)}
        >
          <Text style={s.mensajeTexto}>{conValores(t[mensaje.clave], { n: mensaje.n })}</Text>
          <Text style={s.mensajeEnlace}>{t.rachaVerCiencia}</Text>
        </Pulsable>
      </Hoja>

      <Ficha clave={ciencia} onCerrar={() => setCiencia(null)} />
    </>
  );
}

const s = StyleSheet.create({
  // Pastilla al lado del botón de amigos, con su misma altura táctil y su mismo radio.
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: tema.tactil,
    paddingHorizontal: 10,
    borderRadius: tema.radio.m,
    backgroundColor: tema.color.superficieSutil,
  },
  llama: { fontSize: 15 },
  // Apagada = la semana en curso aún no está cumplida. La opacidad es la señal, no otro color.
  llamaApagada: { opacity: 0.45 },
  chipNumero: { fontSize: 14, fontWeight: '600', color: tema.color.texto, ...tema.cifras },

  semanas: {
    flexDirection: 'row',
    gap: tema.espacio.m,
    marginTop: tema.espacio.s,
    marginBottom: tema.espacio.m,
  },
  semana: { alignItems: 'center', gap: 5 },
  punto: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tema.color.superficieSutil,
    overflow: 'hidden',
  },
  // La semana en curso lleva un aro hairline, del color de línea (no es un borde de color).
  puntoActual: { borderWidth: 1, borderColor: tema.color.linea },
  puntoLleno: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tema.color.marca,
  },
  puntoFecha: { ...tema.tipo.micro, color: tema.color.textoTenue },

  estado: { ...tema.tipo.detalle, color: tema.color.textoSuave, marginBottom: tema.espacio.m },

  comodin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tema.espacio.s,
    marginBottom: tema.espacio.l,
  },
  comodinIcono: { fontSize: 15 },
  comodinTexto: { ...tema.tipo.detalle, color: tema.color.textoSuave, flex: 1, lineHeight: 19 },

  // El mensaje como bloque propio, con el fondo apenas perceptible de `progresoPropio`.
  mensaje: {
    backgroundColor: tema.color.superficieSutil,
    borderRadius: tema.radio.m,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  mensajeTexto: { ...tema.tipo.cuerpo, color: tema.color.texto },
  mensajeEnlace: { ...tema.tipo.micro, color: tema.color.marca, textDecorationLine: 'underline' },
});
