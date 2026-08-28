import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Bienvenida } from './src/pantallas/Bienvenida';
import { estadoPermisos } from './src/salud/permisos';
import { tema } from './src/tema';

/**
 * Flujo de arranque.
 *
 * 1. Se comprueba si ya se pregunto por los permisos.
 * 2. Si no, pantalla de bienvenida que explica que se lee y para que. Requisito de Apple,
 *    no cortesia: rechazan apps que usan HealthKit sin identificar la funcion en la interfaz.
 * 3. Luego la hoja del sistema, que la pinta iOS.
 * 4. A partir de ahi, los datos. Y si algo viene vacio se muestra SinDatos, que no afirma
 *    si es falta de permiso o falta de pulsera, porque iOS no lo cuenta.
 */

type Fase = 'comprobando' | 'bienvenida' | 'dentro';

export default function App() {
  const [fase, setFase] = useState<Fase>('comprobando');

  useEffect(() => {
    estadoPermisos()
      .then((estado) => setFase(estado.tipo === 'preguntado' ? 'dentro' : 'bienvenida'))
      .catch(() => setFase('bienvenida'));
  }, []);

  return (
    <View style={s.fondo}>
      <StatusBar style="light" />
      {fase === 'comprobando' && (
        <View style={s.centro}>
          <ActivityIndicator color={tema.color.marca} />
        </View>
      )}
      {fase === 'bienvenida' && (
        <Bienvenida onListo={() => setFase('dentro')} onSaltar={() => setFase('dentro')} />
      )}
      {fase === 'dentro' && (
        <View style={s.centro}>
          <Text style={s.provisional}>Compety</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: tema.color.fondo },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  provisional: { ...tema.tipo.titulo, color: tema.color.texto },
});
