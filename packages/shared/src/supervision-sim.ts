import type {
  MachineDistPeriod,
  MachineStateCounts,
  MachineStateDistribution,
} from './schemas/supervision';

/**
 * Deterministic synthetic machine-state history for the "repartition over a
 * period" analytics on the Machines screen. Seeded by the fleet key so the same
 * fleet always yields the same curve; the most recent day equals the live
 * counts so the chart lines up with the snapshot counters. Lives in @shared so
 * the mock client and (later) the analytics-backed API produce the same shape.
 */
const STATES = ['free', 'running', 'finished', 'out_of_service', 'offline'] as const;
type StateKey = (typeof STATES)[number];

function daysFor(period: MachineDistPeriod): number {
  return period === '7d' ? 7 : period === '30d' ? 30 : 90;
}

/** Round floats to integers that still sum exactly to `total` (largest remainder). */
function largestRemainder(floats: number[], total: number): number[] {
  const floors = floats.map((f) => Math.floor(f));
  let rest = total - floors.reduce((s, f) => s + f, 0);
  const order = floats
    .map((f, i) => ({ i, frac: f - Math.floor(f) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (let k = 0; k < order.length && rest > 0; k++, rest--) {
    const i = order[k]!.i;
    out[i] = (out[i] ?? 0) + 1;
  }
  return out;
}

export function buildStateDistribution(
  period: MachineDistPeriod,
  latestCounts: MachineStateCounts,
  seedStr = 'fleet',
): MachineStateDistribution {
  const n = daysFor(period);
  const fleetSize = STATES.reduce((s, k) => s + latestCounts[k], 0);

  let seed = 2166136261;
  for (const c of seedStr || 'fleet') seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  // Base weights from the live snapshot; keep a floor so no state vanishes.
  const baseW = STATES.map((k) => Math.max(0.4, latestCounts[k]));

  const to = new Date();
  const points: MachineStateDistribution['points'] = [];
  const sums: Record<StateKey, number> = { free: 0, running: 0, finished: 0, out_of_service: 0, offline: 0 };

  for (let d = 0; d < n; d++) {
    const day = new Date(to.getTime() - (n - 1 - d) * 86400000);
    const iso = day.toISOString().slice(0, 10);
    const isToday = d === n - 1;

    let counts: number[];
    if (isToday || fleetSize === 0) {
      counts = STATES.map((k) => latestCounts[k]);
    } else {
      // Weekends push more running/finished (laundromats peak); weekdays freer.
      const dow = day.getUTCDay();
      const weekend = dow === 0 || dow === 6;
      const jitter = STATES.map((k, i) => {
        let w = baseW[i]! * (0.7 + rand() * 0.6);
        if (weekend && (k === 'running' || k === 'finished')) w *= 1.35;
        if (!weekend && k === 'free') w *= 1.15;
        return w;
      });
      const wSum = jitter.reduce((s, w) => s + w, 0) || 1;
      counts = largestRemainder(
        jitter.map((w) => (w / wSum) * fleetSize),
        fleetSize,
      );
    }

    const point = {
      date: iso,
      free: counts[0]!,
      running: counts[1]!,
      finished: counts[2]!,
      out_of_service: counts[3]!,
      offline: counts[4]!,
    };
    points.push(point);
    for (const k of STATES) sums[k] += point[k];
  }

  // Average share of time in each state over the window, in % (sums to 100).
  const denom = fleetSize * n || 1;
  const shareFloats = STATES.map((k) => (sums[k]! / denom) * 100);
  const shareInts = largestRemainder(shareFloats, 100);
  const averageShares: MachineStateCounts = {
    free: shareInts[0]!,
    running: shareInts[1]!,
    finished: shareInts[2]!,
    out_of_service: shareInts[3]!,
    offline: shareInts[4]!,
  };

  return { period, fleetSize, points, averageShares };
}
