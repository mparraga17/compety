/**
 * Ubicación para sugerir la zona. UN uso, UNA vez: al configurar las ligas locales.
 *
 * ⭐ Reglas de esta pieza, y son de producto, no técnicas:
 *
 *   1. La coordenada NO SALE DE AQUÍ. Se convierte en nombres ("Madrid", "Chamberí") y se
 *      tira. Al servidor viaja el nombre que la persona CONFIRME, nunca lat/lon. Es la
 *      versión de la regla de HealthKit aplicada a ubicación: el servidor no puede filtrar
 *      lo que nunca recibe.
 *   2. Es una SUGERENCIA editable, no una asignación. El GPS te dice "¿Chamberí?" y tú
 *      decides. Verificado en código real (NeighborhoodPicker de Neighborhood-Meet, vía
 *      GitHub MCP): el patrón que funciona es GPS como atajo dentro del selector manual,
 *      nunca como única vía, porque el permiso se puede negar y el geocoder puede fallar.
 *   3. Precisión `Balanced` (~100 m). Para saber el barrio sobra, y evita encender el GPS
 *      fino, que tarda y gasta.
 *
 * ⛔⛔ `expo-location` es módulo nativo y en el Development Build viejo (e4e7555f) NO existe.
 * Dos intentos fallidos antes de la solución, los dos vistos en el iPhone el 8 sep:
 *
 *   1. Import estático → la app entera revienta AL ARRANCAR con "Cannot find native module".
 *   2. `require` dentro de un try/catch → revienta IGUAL al tocar el botón, y el porqué está
 *      en la traza: `guardedLoadModule` de Metro no relanza el error hacia el catch, lo
 *      captura él y lo reporta como fatal global (`ErrorUtils.reportFatalError`). Un
 *      try/catch alrededor de un require de Metro NO protege nada.
 *
 * ⇒ La única vía segura: preguntar si el módulo NATIVO existe sin evaluar el paquete JS,
 * con `requireOptionalNativeModule` de expo-modules-core, que devuelve null en vez de
 * lanzar. El `require('expo-location')` solo se ejecuta cuando ya se sabe que el nativo
 * está, así que su evaluación no puede fallar.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

/** true si el contenedor nativo trae ExpoLocation. En el build e4e7555f es false. */
export function hayUbicacion(): boolean {
  return requireOptionalNativeModule('ExpoLocation') !== null;
}

export type ZonaSugerida = {
  ciudad: string;
  distrito: string | null;
};

export type ResultadoUbicacion =
  | { tipo: 'ok'; zona: ZonaSugerida }
  | { tipo: 'sin-permiso' }
  | { tipo: 'sin-resultado' };

/**
 * Pide permiso, lee la posición una vez y la convierte en ciudad y distrito.
 *
 * ⚠️ Los campos del geocoder CAMBIAN según el país (visto en el código real: en Corea
 * `district` va vacío y el barrio llega en `subregion` o en `name`). Por eso se prueban
 * varios candidatos en orden, del más específico al más general, en vez de fiarse de uno.
 */
export async function sugerirZona(): Promise<ResultadoUbicacion> {
  // Sin el módulo nativo no se toca el paquete JS: evaluarlo es lo que revienta (ver arriba).
  if (!hayUbicacion()) return { tipo: 'sin-resultado' };

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Location = require('expo-location') as typeof import('expo-location');

  const permiso = await Location.requestForegroundPermissionsAsync();
  if (!permiso.granted) return { tipo: 'sin-permiso' };

  const posicion = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const direcciones = await Location.reverseGeocodeAsync({
    latitude: posicion.coords.latitude,
    longitude: posicion.coords.longitude,
  });

  for (const d of direcciones) {
    const ciudad = limpia(d.city) ?? limpia(d.subregion) ?? limpia(d.region);
    if (ciudad === null) continue;

    // El distrito es opcional: mejor sin él que con un dato dudoso. `name` se descarta si
    // parece una dirección postal (números), que es lo que trae en zonas sin distritos.
    const distrito =
      limpia(d.district) ?? (pareceLugar(d.name) ? limpia(d.name) : null);

    return {
      tipo: 'ok',
      zona: { ciudad, distrito: distrito === ciudad ? null : distrito },
    };
  }

  return { tipo: 'sin-resultado' };
}

/** Recorta y descarta vacíos. Los nombres van tal cual: la normalización la hace el servidor. */
function limpia(valor: string | null | undefined): string | null {
  const v = valor?.trim() ?? '';
  return v.length > 0 && v.length <= 40 ? v : null;
}

/** true si parece nombre de lugar y no una dirección con número. */
function pareceLugar(valor: string | null | undefined): boolean {
  if (valor == null) return false;
  return !/\d/.test(valor);
}
