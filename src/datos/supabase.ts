import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, isAuthRetryableFetchError } from '@supabase/supabase-js';

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

/**
 * Id de la persona con sesion. LANZA si no la hay.
 *
 * ⛔ Sustituye al patron `if (usuario === undefined) return;` que habia en cinco sitios. Ese
 * `return` silencioso era el fallo: con la sesion muerta, subir una puntuacion "terminaba bien"
 * sin subir nada, el contador de subidas seguia sumando y el segundo plano daba por buena una
 * sincronizacion que no habia hecho nada. Una escritura que no puede hacerse tiene que fallar
 * donde se ve.
 *
 * Distingue dos causas, porque `mensajeDe` las cuenta distinto:
 *   - sin red al renovar el token (`getSession` devuelve la sesion a null CON un error
 *     reintentable, verificado en supabase-js): se propaga ese error → "Sin conexión".
 *   - sin sesion de verdad: "hace falta sesion", el mismo texto que usan las funciones SQL, que
 *     `mensajeDe` ya traduce a "Tienes que entrar de nuevo".
 */
export async function usuarioActual(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (id !== undefined) return id;
  if (error !== null && isAuthRetryableFetchError(error)) throw error;
  throw new Error('hace falta sesion');
}
