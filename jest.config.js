/**
 * Tests que corren en Windows sin iPhone.
 *
 * Se prueban `src/motor` y `src/i18n`: los dos son JS puro sin dependencias nativas, asi que no
 * hace falta mockear HealthKit. Cuando haya que probar la capa de lectura se anadira el mock de la
 * libreria, siguiendo el patron del jest.setup.js de SparkyFitness.
 *
 * ⚠️ `src/i18n` se anadio despues de un crash en el iPhone: el fichero tenia un test escrito y
 * jest **no lo estaba recogiendo**, porque el patron solo miraba `src/motor`. Un test que no corre
 * es peor que ninguno, porque da sensacion de cobertura. Al anadir un test fuera de estas dos
 * carpetas, ampliar este patron.
 *
 * `src/datos` entro despues (8 sep) por `distritos.test.ts`: el catalogo y la fusion son JS puro.
 * Los demas ficheros de datos hablan con Supabase y no tienen tests todavia.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Zona horaria fija para toda la suite. Ver el porque en el propio fichero.
  globalSetup: '<rootDir>/jest.zona-horaria.js',
  // `src/avisos` entro el 11 sep por `destino.test.ts`: el destino de un aviso al tocarlo es JS puro.
  // `src/componentes` entro el 16 sep por `repartoEstilo.test.ts`: el reparto del estilo de un
  // Pulsable es una funcion pura (solo importa TIPOS de react-native), asi que corre aqui sin
  // renderizar nada. Los componentes en si siguen sin tests: exigirian un renderer.
  // `supabase/functions` entro el 16 sep por `borrar-cuenta/apple.test.ts`: la parte pura de la
  // Edge Function (firmar el client_secret de Apple, canjear y revocar) usa solo WebCrypto y fetch,
  // que Node 24 y Deno comparten. El `index.ts` con `Deno.serve` no se importa desde ningun test.
  testMatch: [
    '**/src/(motor|i18n|datos|avisos|componentes)/**/*.test.ts',
    '**/supabase/functions/**/*.test.ts',
  ],
};
