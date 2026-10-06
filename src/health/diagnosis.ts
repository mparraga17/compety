import { activityTypeOf, computeZones, measuredLoad, referenceMax, type ReferenceMax } from '../engine';
import { readHeartRateBetween, readWorkoutHeartRate, readWorkouts, type Workout } from './reading';

/**
 * Measures whether heart rate reaches HealthKit with enough detail.
 *
 * ⭐ This measurement decides whether the product can exist. The whole metric relies on time in
 * heart-rate zones, and that can only be computed with frequent samples.
 *
 *   median gap <= 5 min    viable, load can be computed
 *   median gap <= 15 min   borderline, fine for rankings but not for detailed analysis
 *   more than 15 min       the metric has to be rethought
 *
 * Method note: the plan was to measure this by exporting the Health app XML and analysing it
 * on Windows. Measuring from the app is better: the XML says what is in the database, the app
 * says what it can READ, and those are not the same thing.
 */

export type Verdict = 'viable' | 'borderline' | 'insufficient' | 'no-data';

export type WorkoutDiagnosis = {
  /** Numeric HealthKit code. The readable name is resolved in the interface. */
  type: number | string;
  start: Date;
  minutes: number;
  source: string;
  /** Samples linked to the workout through the { workout } filter. */
  samples: number;
  /** Samples inside the workout's time range, without requiring a link. */
  samplesByRange: number;
  medianGap: number | null;
  maxGap: number | null;
  verdict: Verdict;
  /** Raw Edwards TRIMP. */
  trimp: number | null;
  intensity: number | null;
  /** Load as the engine computes it. This is what scores. */
  load: number | null;
  minutesInZone: number | null;
};

export type Diagnosis = {
  workouts: number;
  workoutsWithHeartRate: number;
  detail: readonly WorkoutDiagnosis[];
  /** Overall verdict, the reasonable worst case: the median of workouts with heart rate. */
  verdict: Verdict;
  overallMedianGap: number | null;
  /** Sources that wrote workouts, to see who contributes what. */
  sources: readonly string[];
  /**
   * Heart-rate samples in the last 7 days, not filtered by workout. It tells the problems
   * apart: 0 here means the band's bridge writes no heart rate at all. Many here but none in
   * workouts means the problem is only the link.
   */
  totalHeartRateSamples: number;
  gapOutsideWorkouts: number | null;
  /** Reference maximum, flagged as provisional when history is short. */
  max: ReferenceMax;
};

function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function verdictOf(gapMinutes: number | null, samples: number): Verdict {
  if (gapMinutes === null || samples < 2) return 'no-data';
  if (gapMinutes <= 5) return 'viable';
  if (gapMinutes <= 15) return 'borderline';
  return 'insufficient';
}

/**
 * Name of the app or device that wrote the workout.
 *
 * ⚠️ `sourceRevision.source` is a nitro SourceProxy, not a plain object. Reading it directly
 * gives "SourceProxy" instead of the name. You have to go down to `name`, and several paths
 * are tried in case the shape changes.
 */
function sourceOf(workout: Workout): string {
  const w = workout as unknown as {
    sourceRevision?: { source?: { name?: string; bundleIdentifier?: string } };
    device?: { name?: string; manufacturer?: string };
  };
  const src = w.sourceRevision?.source;
  return src?.name ?? src?.bundleIdentifier ?? w.device?.name ?? w.device?.manufacturer ?? 'unknown';
}

export async function diagnose(days = 30, maxWorkouts = 12): Promise<Diagnosis> {
  const all = await readWorkouts(days);

  // Most recent first, and only sessions that last a while: a 2-minute session says nothing.
  const candidates = [...all]
    .filter((w) => (w.endDate.getTime() - w.startDate.getTime()) / 60000 >= 10)
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
    .slice(0, maxWorkouts);

  // Reference maximum from 90 days of history, not from 220 minus age.
  // Without enough history it comes out provisional and the interface says so.
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const history = await readHeartRateBetween(ninetyDaysAgo, new Date());
  const max = referenceMax(history.map((p) => p.quantity));

  const detail: WorkoutDiagnosis[] = [];

  for (const workout of candidates) {
    const minutes = (workout.endDate.getTime() - workout.startDate.getTime()) / 60000;

    // Two reads, because they separate two different problems:
    // by workout requires HealthKit to link heart rate to the workout, by range does not.
    const byWorkout = await readWorkoutHeartRate(workout);
    const byRange = await readHeartRateBetween(workout.startDate, workout.endDate);

    // Measure on whichever read has more data.
    const samples = byWorkout.length >= byRange.length ? byWorkout : byRange;

    const gaps: number[] = [];
    for (let i = 1; i < samples.length; i++) {
      gaps.push((samples[i].startDate.getTime() - samples[i - 1].endDate.getTime()) / 60000);
    }

    // The acid test: compute zones and load from the raw samples.
    const zones = computeZones(
      samples.map((p) => ({ value: p.quantity, start: p.startDate, end: p.endDate })),
      max.value,
    );

    const load =
      zones?.intensity != null
        ? measuredLoad({
            sport: activityTypeOf(workout.workoutActivityType) ?? '',
            minutes,
            intensity: zones.intensity,
          })
        : null;

    const med = median(gaps);
    detail.push({
      // Note: HealthKit returns the type as a numeric code, not as text.
      type: workout.workoutActivityType ?? 'unknown',
      start: workout.startDate,
      minutes: Math.round(minutes),
      source: sourceOf(workout),
      samples: byWorkout.length,
      samplesByRange: byRange.length,
      medianGap: med === null ? null : +med.toFixed(2),
      maxGap: gaps.length > 0 ? +Math.max(...gaps).toFixed(2) : null,
      verdict: verdictOf(med, samples.length),
      trimp: zones?.trimp ?? null,
      intensity: zones?.intensity ?? null,
      load: load?.value ?? null,
      minutesInZone:
        zones === null ? null : Math.round(zones.seconds.reduce((a, b) => a + b, 0) / 60),
    });
  }

  const withHeartRate = detail.filter((d) => Math.max(d.samples, d.samplesByRange) >= 2);
  const overall = median(withHeartRate.map((d) => d.medianGap ?? 0));

  // Independent check: is there heart rate at all, even outside workouts?
  // This separates "the band sends no heart rate" from "heart rate is not linked to workouts".
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const loose = await readHeartRateBetween(weekAgo, new Date());

  const looseGaps: number[] = [];
  for (let i = 1; i < loose.length; i++) {
    looseGaps.push((loose[i].startDate.getTime() - loose[i - 1].endDate.getTime()) / 60000);
  }
  const looseMedian = median(looseGaps);

  return {
    workouts: all.length,
    workoutsWithHeartRate: withHeartRate.length,
    detail,
    verdict: verdictOf(overall, withHeartRate.length >= 1 ? 2 : 0),
    overallMedianGap: overall === null ? null : +overall.toFixed(2),
    sources: [...new Set(detail.map((d) => d.source))],
    totalHeartRateSamples: loose.length,
    gapOutsideWorkouts: looseMedian === null ? null : +looseMedian.toFixed(2),
    max,
  };
}
