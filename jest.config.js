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
  testMatch: ['**/src/(motor|i18n|datos|avisos)/**/*.test.ts'],
};
