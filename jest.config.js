/**
 * Tests that run on any machine, no iPhone needed. Only pure JS is tested here: the example
 * engine and the notification routing. Code that talks to HealthKit or Expo native modules
 * would need mocks.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts'],
};
