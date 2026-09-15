/**
 * Fija la zona horaria de TODOS los tests a Europe/Madrid.
 *
 * Por que hace falta: el motor calcula semanas y dias con la hora LOCAL del dispositivo, asi que
 * los tests dependen de la zona del proceso que los corre. Sin fijarla, el mismo test da
 * resultados distintos en el portatil (Madrid), en CI (UTC) y en un ordenador de viaje. Y peor:
 * un runner en UTC, que no tiene cambio de hora, JAMAS veria un bug de horario de verano, que es
 * justo lo que le pasa a la gente de verdad dos veces al año (ver racha.test.ts).
 *
 * Se hace en `globalSetup` porque corre en el proceso padre antes de lanzar los workers, y estos
 * heredan el entorno. Node relee `TZ` en caliente, asi que basta con asignarlo.
 */
module.exports = async () => {
  process.env.TZ = 'Europe/Madrid';
};
