/**
 * Tests del motor, que corren en Windows sin iPhone.
 *
 * Solo se prueba src/motor: es JS puro sin dependencias nativas, asi que no hace falta
 * mockear HealthKit para probar la logica de puntuacion. Cuando haya que probar la capa
 * de lectura se anadira el mock de la libreria, siguiendo el patron del jest.setup.js
 * de SparkyFitness.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/motor/**/*.test.ts'],
};
