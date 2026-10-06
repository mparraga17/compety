import {
  queryCategorySamples,
  queryQuantitySamples,
  queryWorkoutSamples,
} from '@kingstinct/react-native-healthkit';

import { prepare } from './permissions';
import { HEALTH_METRICS, type ReadableType } from './types';

/**
 * Every read goes through here, and every read starts with `await prepare()`. That await is
 * what makes the "queried before authorizing" crash impossible.
 *
 * API note: the functions without an anchor return the array directly. The ...WithAnchor
 * variants return { samples, deletedSamples, newAnchor } and are the ones to use in the
 * background, to catch up on missed workouts without gaps.
 */

/** Types derived from the API itself, so nothing depends on the library's internal names. */
export type Workout = Awaited<ReturnType<typeof queryWorkoutSamples>>[number];
export type QuantitySample = Awaited<ReturnType<typeof queryQuantitySamples>>[number];

/** Workouts since a date. This is the engine's read: a season, or 90 days if that is longer. */
export async function readWorkoutsSince(since: Date): Promise<readonly Workout[]> {
  await prepare();

  return queryWorkoutSamples({
    limit: 0,
    filter: { date: { startDate: since } },
  });
}

/** Workouts from the last N days. */
export async function readWorkouts(days = 90): Promise<readonly Workout[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return readWorkoutsSince(since);
}

/**
 * Heart rate for ONE workout. This is the metric's path: it gives time in heart-rate zones,
 * and Edwards TRIMP comes from that.
 *
 * ⭐ MEASURED ON A REAL IPHONE (28 Aug 2026), and it overturned what looked obvious: the
 * `{ workout }` filter returns ZERO samples with Fitbit data. Measured on a 29-minute session:
 * 0 samples by link, 30 by time range.
 *
 * Reason: HealthKit only links samples to a workout if the app that wrote them created that
 * link explicitly, and the Google Health bridge does not. It writes loose heart-rate samples
 * and the workouts separately.
 *
 * ⇒ Read by TIME RANGE, and try the link only as a backup. This happens with any source other
 * than Apple Watch, so the range is the main path.
 *
 * Returns [] both when there was no band and when permission is missing: iOS does not let you
 * tell them apart. Callers must NOT conclude "there is no data".
 */
export async function readWorkoutHeartRate(workout: Workout) {
  await prepare();

  const [byLink, byRange] = await Promise.all([
    queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
      limit: 0,
      filter: { workout },
      ascending: true,
    }),
    queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
      limit: 0,
      filter: { date: { startDate: workout.startDate, endDate: workout.endDate } },
      ascending: true,
    }),
  ]);

  // The link is more precise when it exists, but it almost never exists outside Apple Watch.
  return byLink.length >= byRange.length ? byLink : byRange;
}

/**
 * Heart rate between two dates, not filtered by workout.
 *
 * It separates two cases that are easy to confuse: no heart rate at all, or heart rate that
 * HealthKit has not LINKED to the workout. The `{ workout }` filter only returns samples linked
 * to that session, and not every source creates the link.
 *
 * If the range has samples and the workout does not, load can still be computed: match by
 * start and end time.
 */
export async function readHeartRateBetween(from: Date, to: Date) {
  await prepare();

  return queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
    limit: 0,
    filter: { date: { startDate: from, endDate: to } },
    ascending: true,
  });
}

/** Samples for one Health tab metric. */
export async function readMetric(type: ReadableType, days = 90) {
  await prepare();

  const since = new Date();
  since.setDate(since.getDate() - days);

  return queryQuantitySamples(type as 'HKQuantityTypeIdentifierRestingHeartRate', {
    limit: 0,
    filter: { date: { startDate: since } },
    ascending: true,
  });
}

/**
 * The six Health tab metrics in one go.
 *
 * ⚠️ Each one is read separately and with `Promise.all`, not one after another: six queries
 * in sequence would be noticeable. The API limit is 300 requests per minute, so six in
 * parallel is fine.
 *
 * ⚠️ A metric that fails or is not authorised returns an empty list instead of taking the
 * screen down. That matters here more than anywhere: HRV is known NOT to arrive from Fitbit,
 * so "this metric does not exist for you" is the normal case, not the exception.
 *
 * 📌 And iOS cannot tell "no permission" from "no data", so the screen can never claim you have
 * no data. Only that none is arriving.
 */
export async function readHealthMetrics(days = 90) {
  await prepare();

  const pairs = await Promise.all(
    HEALTH_METRICS.map(async (m) => {
      try {
        const samples = await readMetric(m.type, days);
        return [
          m.key,
          samples.map((x) => ({ start: new Date(x.startDate).getTime(), value: x.quantity })),
        ] as const;
      } catch {
        return [m.key, []] as const;
      }
    }),
  );

  return Object.fromEntries(pairs) as Record<
    (typeof HEALTH_METRICS)[number]['key'],
    readonly { start: number; value: number }[]
  >;
}

/**
 * Sleep segments from the last N days.
 *
 * ⚠️ HealthKit does NOT return one session per night. It returns one category sample per
 * segment, each with its value (in bed, awake, core, deep, REM), so one night is dozens of
 * samples. Grouping them into periods is the engine's job.
 *
 * They are normalised here to our own type so the engine does not depend on the library's
 * shape and can be tested entirely on Windows without HealthKit.
 */
export async function readSleep(days = 30) {
  await prepare();

  const since = new Date();
  since.setDate(since.getDate() - days);

  const samples = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
    limit: 0,
    filter: { date: { startDate: since } },
    ascending: true,
  });

  return samples.map((s) => ({
    start: new Date(s.startDate).getTime(),
    end: new Date(s.endDate).getTime(),
    value: s.value as number,
    source: s.sourceRevision?.source?.name,
  }));
}
