import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SinDatos } from '../componentes/SinDatos';
import { mensajeDe } from '../datos/errores';
import { nombreDe } from '../motor/actividades';
import { diagnostica, type Diagnostico as Datos, type Veredicto } from '../salud/granularidad';
import { nombreCorto, sondea, type Sonda } from '../salud/sonda';
import { tema } from '../tema';

/**
 * Pantalla de diagnostico, temporal. Mide si los pulsos llegan con detalle suficiente para
 * calcular tiempo en zonas de frecuencia cardiaca.
 *
 * Es el paso que decide si el producto existe. Se quita cuando la respuesta este confirmada.
 */

const COLOR: Record<Veredicto, string> = {
  viable: tema.color.marca,
  justo: '#e0c46c',
  insuficiente: tema.color.bajo,
  'sin-datos': tema.color.textoSuave,
};

const TEXTO: Record<Veredicto, string> = {
  viable: 'Se puede calcular la carga',
  justo: 'Sirve para el ranking, no para analisis fino',
  insuficiente: 'Hay que replantear la metrica',
  'sin-datos': 'No vemos muestras de pulso',
};

export function Diagnostico() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [sondas, setSondas] = useState<readonly Sonda[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    diagnostica(30)
      .then(setDatos)
      .catch((e: unknown) => setError(mensajeDe(e)));
    sondea(30).then(setSondas).catch(() => setSondas([]));
  }, []);

  if (error !== null) {
    return (
      <ScrollView style={s.fondo} contentContainerStyle={s.contenido}>
        <Text style={s.titulo}>Error al leer</Text>
        <Text style={s.error}>{error}</Text>
      </ScrollView>
    );
  }

  if (datos === null) {
    return (
      <View style={[s.fondo, s.centro]}>
        <ActivityIndicator color={tema.color.marca} />
        <Text style={s.cargando}>Leyendo tus ultimos 30 dias</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.fondo} contentContainerStyle={s.contenido}>
      <Text style={s.etiqueta}>Hueco entre pulsos</Text>
      <Text style={[s.cifra, { color: COLOR[datos.veredicto] }]}>
        {datos.huecoMedianoGlobal === null ? 'sin datos' : `${datos.huecoMedianoGlobal} min`}
      </Text>
      <Text style={[s.veredicto, { color: COLOR[datos.veredicto] }]}>
        {TEXTO[datos.veredicto]}
      </Text>

      <Text style={s.resumen}>
        {datos.sesiones} sesiones en 30 dias · {datos.sesionesConPulso} de{' '}
        {datos.detalle.length} analizadas tienen pulso
      </Text>

      {datos.fuentes.length > 0 && (
        <Text style={s.resumen}>Fuentes: {datos.fuentes.join(' · ')}</Text>
      )}

      <Text style={s.resumen}>
        Maximo de referencia: {datos.maximo.valor} lpm
        {datos.maximo.observado !== null &&
          datos.maximo.observado !== datos.maximo.valor &&
          ` (observado ${datos.maximo.observado})`}
      </Text>
      {datos.maximo.provisional && (
        <Text style={[s.resumen, { color: '#e0c46c' }]}>
          Provisional. Con {datos.maximo.muestras} muestras de pulso todavia no hay historico
          para fijar tu maximo, asi que las intensidades pueden salir altas. Se afina solo con
          los dias.
        </Text>
      )}

      <View style={s.control}>
        <Text style={s.controlTitulo}>Pulsos sueltos, ultimos 7 dias</Text>
        <Text style={[s.controlCifra, { color: datos.pulsosEnTotal > 0 ? tema.color.marca : tema.color.bajo }]}>
          {datos.pulsosEnTotal} muestras
          {datos.huecoFueraDeSesion !== null && ` · cada ${datos.huecoFueraDeSesion} min`}
        </Text>
        <Text style={s.controlNota}>
          {datos.pulsosEnTotal === 0
            ? 'La pulsera no esta escribiendo frecuencia cardiaca en Salud. Revisa el puente en Google Health.'
            : datos.sesionesConPulso === 0
              ? 'Si hay pulsos, pero HealthKit no los vincula a los entrenos. Se pueden cruzar por hora.'
              : 'Hay pulsos y estan vinculados a las sesiones.'}
        </Text>
      </View>

      {sondas.length > 0 && (
        <View style={s.control}>
          <Text style={s.controlTitulo}>Que ve la app, tipo por tipo</Text>
          {sondas.map((so) => (
            <View key={so.tipo} style={s.sonda}>
              <Text style={s.sondaNombre}>{nombreCorto(so.tipo)}</Text>
              <Text
                style={[
                  s.sondaValor,
                  { color: so.muestras > 0 ? tema.color.marca : tema.color.textoSuave },
                ]}
              >
                {so.error !== null ? 'error' : so.muestras}
              </Text>
            </View>
          ))}
          <Text style={s.controlNota}>
            {sondas.every((so) => so.muestras === 0)
              ? 'Nada de nada. O el permiso no se concedio, o HealthKit esta vacio.'
              : 'Los tipos con numero tienen permiso y datos. Los que estan a cero pueden no tener permiso.'}
          </Text>
        </View>
      )}

      {datos.detalle.length > 0 && (
        <Text style={s.leyenda}>
          Por sesion / por rango de horas. Si el segundo numero es mayor, el pulso existe pero
          no esta vinculado al entreno.
        </Text>
      )}

      {datos.detalle.length === 0 && <SinDatos />}

      {datos.detalle.map((d, i) => (
        <View key={`${d.inicio.toISOString()}-${i}`} style={s.fila}>
          <View style={s.filaCabecera}>
            <Text style={s.filaTipo}>{nombreDe(d.tipo)}</Text>
            <Text style={[s.filaHueco, { color: COLOR[d.veredicto] }]}>
              {d.huecoMediano === null ? 'sin pulso' : `${d.huecoMediano} min`}
            </Text>
          </View>
          <Text style={s.filaDetalle}>
            {d.inicio.toLocaleDateString()} · {d.minutos} min · pulsos {d.muestras} /{' '}
            {d.muestrasPorRango}
            {d.huecoMaximo !== null && ` · maximo ${d.huecoMaximo} min`}
          </Text>
          {d.trimp !== null && d.trimp > 0 && (
            <Text style={s.filaCarga}>
              carga {d.carga} · trimp {d.trimp} · intensidad {d.intensidad} ·{' '}
              {d.minutosEnZona} min en zona
            </Text>
          )}
          <Text style={s.filaFuente}>{d.fuente}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: tema.color.fondo },
  centro: { alignItems: 'center', justifyContent: 'center', gap: tema.espacio.m },
  // ⚠️ Sin el doble hueco de antes: la pantalla vive ahora dentro de una hoja `pageSheet` y el
  // botón de volver de App.tsx ya pone la cabecera. El paddingTop grande dejaba un vacío doble.
  contenido: { padding: tema.espacio.l, paddingTop: tema.espacio.s, gap: tema.espacio.s },
  cargando: { ...tema.tipo.detalle, color: tema.color.textoSuave },
  titulo: { ...tema.tipo.titulo, color: tema.color.texto },
  error: { ...tema.tipo.detalle, color: tema.color.bajo, lineHeight: 19 },
  etiqueta: { ...tema.tipo.seccion, color: tema.color.textoSuave },
  cifra: { fontSize: 52, fontWeight: '600', letterSpacing: -1.5 },
  veredicto: { ...tema.tipo.cuerpo, fontWeight: '600' },
  resumen: {
    ...tema.tipo.detalle,
    color: tema.color.textoSuave,
    lineHeight: 19,
    marginTop: tema.espacio.xs,
  },
  control: {
    gap: tema.espacio.xs,
    padding: tema.espacio.m,
    borderRadius: tema.radio.m,
    backgroundColor: '#1d1f26',
    marginTop: tema.espacio.s,
  },
  controlTitulo: { ...tema.tipo.seccion, color: tema.color.textoSuave },
  controlCifra: { ...tema.tipo.cuerpo, fontWeight: '600' },
  controlNota: { ...tema.tipo.detalle, color: tema.color.textoSuave, fontSize: 12, lineHeight: 17 },
  sonda: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sondaNombre: { ...tema.tipo.detalle, color: tema.color.textoSuave, fontSize: 12 },
  sondaValor: { ...tema.tipo.detalle, fontSize: 12, fontWeight: '600' },
  leyenda: {
    ...tema.tipo.detalle,
    color: tema.color.textoSuave,
    fontSize: 11,
    lineHeight: 15,
    marginTop: tema.espacio.s,
  },
  fila: { gap: 2, paddingVertical: tema.espacio.s, borderTopWidth: 1, borderTopColor: '#24262e' },
  filaCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  filaTipo: { ...tema.tipo.cuerpo, color: tema.color.texto, flex: 1 },
  filaHueco: { ...tema.tipo.cuerpo, fontWeight: '600' },
  filaDetalle: { ...tema.tipo.detalle, color: tema.color.textoSuave, fontSize: 12 },
  filaCarga: { ...tema.tipo.detalle, color: tema.color.marca, fontSize: 12, fontWeight: '600' },
  filaFuente: { ...tema.tipo.detalle, color: tema.color.textoSuave, fontSize: 11 },
});
