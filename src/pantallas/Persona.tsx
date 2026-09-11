import { useCallback, useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { ListaEntrenos, type PersonaRef } from './Feed';
import { Avatar } from '../componentes/Avatar';
import { Pulsable } from '../componentes/Pulsable';
import { pedirAmistad } from '../datos/amigos';
import { mensajeDe } from '../datos/errores';
import { entrenosDe, puedoVer, type CargaEntrenos } from '../datos/feed';
import { idiomaActual, textos } from '../i18n/textos';
import { tema } from '../tema';

/**
 * La ficha de una persona: quién es y sus entrenos, con las mismas reacciones y comentarios que
 * el feed. Se abre tocando a alguien en la tabla de la liga, en el feed o en la lista de amigos.
 *
 * Pedida por los amigos de la beta (11 sep): el feed mezcla a todos; a veces quieres ver solo a
 * uno. Misma regla de visibilidad que el feed (`ve_entrenos_de`): si compartís solo una liga de
 * ZONA, la ficha lo dice y ofrece pedir amistad, en vez de enseñar una lista vacía que parece
 * un fallo.
 */

type Props = {
  persona: PersonaRef | null;
  yo: string | null;
  onCerrar: () => void;
};

export function Persona({ persona, yo, onCerrar }: Props) {
  const t = textos(idiomaActual());
  // null = comprobando; true/false = la respuesta del servidor.
  const [visible, setVisible] = useState<boolean | null>(null);
  const [pedida, setPedida] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esYo = persona !== null && persona.id === yo;

  useEffect(() => {
    setVisible(null);
    setPedida(false);
    setError(null);
    if (persona === null) return;
    let vivo = true;
    void puedoVer(persona.id)
      .then((v) => vivo && setVisible(v))
      .catch(() => vivo && setVisible(false));
    return () => {
      vivo = false;
    };
  }, [persona]);

  const cargar: CargaEntrenos = useCallback(
    (limite, antes) => (persona === null ? Promise.resolve([]) : entrenosDe(persona.id, limite, antes)),
    [persona],
  );

  const pedir = async () => {
    if (persona === null) return;
    try {
      await pedirAmistad(persona.id);
      setPedida(true);
    } catch (e) {
      setError(mensajeDe(e));
    }
  };

  if (persona === null) return null;

  const cabecera = (
    <View style={s.cabecera}>
      <View style={s.agarre} />
      <View style={s.fila}>
        <Avatar nombre={persona.nombre} esYo={esYo} tamano={52} />
        <View style={s.medio}>
          <Text style={s.nombre} numberOfLines={1}>
            {esYo ? t.feedTuEntreno : persona.nombre}
          </Text>
          <Text style={s.sub}>{esYo ? t.personaTusEntrenos : t.personaEntrenos}</Text>
        </View>
        <Pulsable onPress={onCerrar} accessibilityRole="button" hitSlop={8}>
          <Text style={s.cerrar}>{t.cerrar}</Text>
        </Pulsable>
      </View>
    </View>
  );

  return (
    // `key` por persona: cada ficha arranca con su lista limpia, sin restos de la anterior.
    <Modal
      key={persona.id}
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCerrar}
    >
      <View style={s.hoja}>
        {visible === false ? (
          <>
            {cabecera}
            <View style={s.oculta}>
              <Text style={s.ocultaTexto}>{pedida ? t.personaPedida : t.personaOculta}</Text>
              {!pedida && (
                <Pulsable style={s.boton} onPress={() => void pedir()} accessibilityRole="button">
                  <Text style={s.botonTexto}>{t.personaPedir}</Text>
                </Pulsable>
              )}
              {error !== null && <Text style={s.error}>{error}</Text>}
            </View>
          </>
        ) : (
          <ListaEntrenos
            yo={yo}
            activo={visible === true}
            cargar={cargar}
            cabecera={cabecera}
            vacio={<Text style={s.vacio}>{t.personaSinEntrenos}</Text>}
          />
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  hoja: { flex: 1, backgroundColor: tema.color.fondo, paddingTop: tema.espacio.m },
  cabecera: { paddingHorizontal: tema.espacio.l, paddingBottom: tema.espacio.m },
  agarre: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(230,236,233,0.18)',
    alignSelf: 'center',
    marginBottom: tema.espacio.l,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  medio: { flex: 1, minWidth: 0 },
  nombre: { fontSize: 22, fontWeight: '600', color: tema.color.texto, letterSpacing: -0.4 },
  sub: { ...tema.tipo.sub, color: tema.color.textoSuave, marginTop: 2 },
  cerrar: { ...tema.tipo.cuerpo, color: tema.color.marca, fontWeight: '600', paddingVertical: 4 },
  vacio: {
    ...tema.tipo.cuerpo,
    color: tema.color.textoSuave,
    textAlign: 'center',
    paddingHorizontal: tema.espacio.l,
    paddingVertical: tema.espacio.xl,
  },
  oculta: { paddingHorizontal: tema.espacio.l, gap: tema.espacio.m },
  ocultaTexto: { ...tema.tipo.cuerpo, color: tema.color.textoSuave },
  boton: {
    backgroundColor: tema.color.marca,
    minHeight: tema.tactil,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tema.espacio.l,
    borderRadius: tema.radio.m,
  },
  botonTexto: { ...tema.tipo.cuerpo, color: tema.color.fondo, fontWeight: '600' },
  error: { ...tema.tipo.detalle, color: tema.color.bajo },
});
