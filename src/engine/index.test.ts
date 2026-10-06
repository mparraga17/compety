import { activityTypeOf, computeZones, measuredLoad, referenceMax } from './index';

/** One sample per minute at a constant heart rate. */
function steady(bpm: number, minutes: number) {
  const t0 = new Date('2026-10-06T08:00:00Z').getTime();
  return Array.from({ length: minutes + 1 }, (_, i) => ({
    value: bpm,
    start: new Date(t0 + i * 60_000),
    end: new Date(t0 + i * 60_000 + 1000),
  }));
}

describe('example engine', () => {
  test('HealthKit activity codes map to sports, unknown codes to null', () => {
    expect(activityTypeOf(37)).toBe('running');
    expect(activityTypeOf('80')).toBe('barre');
    expect(activityTypeOf(9999)).toBeNull();
    expect(activityTypeOf(undefined)).toBeNull();
  });

  test('with little history the maximum is provisional and never below the fallback', () => {
    const max = referenceMax([150, 160, 170]);
    expect(max.provisional).toBe(true);
    expect(max.value).toBe(190);
  });

  test('below 50% of maximum, time does not count', () => {
    expect(computeZones(steady(80, 30), 200)?.trimp).toBe(0);
  });

  test('harder effort for the same time gives more TRIMP', () => {
    const easy = computeZones(steady(120, 30), 200)!; // 60% -> zone 2
    const hard = computeZones(steady(170, 30), 200)!; // 85% -> zone 4
    expect(hard.trimp).toBeGreaterThan(easy.trimp);
    expect(easy.trimp).toBe(60);
    expect(hard.trimp).toBe(120);
  });

  test('load is intensity times minutes', () => {
    expect(measuredLoad({ sport: 'tennis', minutes: 60, intensity: 3 }).value).toBe(180);
  });
});
