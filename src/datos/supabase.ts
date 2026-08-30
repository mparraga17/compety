import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase.
 *
 * ⚠️ Lo que sube aqui y lo que NO. Al servidor solo viaja la PUNTUACION, nunca pulsos, sueno
 * ni zonas. El calculo se hace en el telefono con el motor de `src/motor`. Motivos: RGPD,
 * menos dano en una filtracion, mas barato, y la guia 5.1.3 de Apple.
 *
 * Consecuencia buena y buscada: el servidor no tiene datos de salud que filtrar aunque
 * quisiera, asi que las notificaciones a terceros no pueden incumplir la regla de HealthKit
 * ni queriendo.
 *
 * La clave anonima es publica por diseno: no da acceso a nada sin pasar por RLS. Aun asi va en
 * variables de entorno para no fijarla en el repo publico.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const clave = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** false mientras no haya credenciales. La app funciona en solitario sin servidor. */
export const HAY_SERVIDOR = url.length > 0 && clave.length > 0;

export const supabase = createClient(url || 'http://localhost', clave || 'sin-clave', {
  auth: {
    // AsyncStorage para que la sesion sobreviva a cerrar la app.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // En React Native no hay URL con fragmento que detectar.
    detectSessionInUrl: false,
  },
});
