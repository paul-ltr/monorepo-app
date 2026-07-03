import type { ConnectorHistory, ConsumptionPoint, EnedisMeterKind, EnergyProvider } from './schemas/connectors';
import type { EnergyMeter, EnergySummary } from './schemas/energy';

/**
 * Shared helpers for the energy connectors, used by both the NestJS services
 * (graceful simulation when live credentials are absent) and the in-browser
 * mock client (so the onboarding wizard is fully exercisable offline). Keeping
 * them here guarantees the simulated shape matches on both sides of the wire.
 */

/** Strip spaces and any non-digit separators from a meter identifier. */
export function cleanDigits(raw: string): string {
  return raw.replace(/[^\d]/g, '');
}

/** True when a PRM/PDL (14 digits) or C4 reference (6–20 chars) is well-formed. */
export function isValidEnedisRef(raw: string, kind: EnedisMeterKind): boolean {
  const d = cleanDigits(raw);
  return kind === 'pdl' ? /^\d{14}$/.test(d) : d.length >= 6 && d.length <= 20;
}

/** ISO YYYY-MM-DD window ending today, `n` days back. */
export function lastNDays(n: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - n * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

/**
 * Deterministic synthetic daily history seeded by the usage-point id, so the
 * same meter always yields the same curve — a weekly rhythm around `baseKwh`
 * (laundromats peak on weekends) with `swingKwh` of noise.
 */
export function buildDailyHistory(
  provider: EnergyProvider,
  usagePointId: string,
  from: string,
  to: string,
  baseKwh: number,
  swingKwh: number,
): Omit<ConnectorHistory, 'simulated'> {
  let seed = 0;
  for (const c of usagePointId || provider) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  const points: ConsumptionPoint[] = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    const weekend = dow === 0 || dow === 6 ? 1.25 : 1;
    const kwh = Math.max(0, baseKwh * weekend + (rand() - 0.5) * 2 * swingKwh);
    points.push({ date: d.toISOString().slice(0, 10), kwh: Math.round(kwh * 100) / 100 });
  }
  const total = Math.round(points.reduce((s, p) => s + p.kwh, 0) * 100) / 100;
  return { provider, usagePointId, unit: 'kWh', from, to, total, points };
}

/** Deterministic 14-digit pseudo-PRM from a seed (simulated consent). */
export function simulatedPrm(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (BigInt(h) * 100000000n + 25846349301465n).toString().slice(-14).padStart(14, '2');
}

// ──────────────── Feeding the Énergie / OPERAT dashboard ────────────────────

/** A connected meter's first history, joined to its site for OPERAT intensity. */
export interface ConnectedMeter {
  provider: EnergyProvider;
  siteId: string;
  siteName: string;
  surfaceM2: number | null;
  history: ConnectorHistory;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** Downsample a daily series into `buckets` averaged bars for the meter card. */
function sparkline(points: ConsumptionPoint[], buckets = 6): number[] {
  if (points.length === 0) return [];
  const size = Math.ceil(points.length / buckets);
  const out: number[] = [];
  for (let i = 0; i < points.length; i += size) {
    out.push(round1(avg(points.slice(i, i + size).map((p) => p.kwh))));
  }
  return out;
}

/** Week-over-week delta (%) from the tail of the daily series — a real trend. */
function weekDeltaPct(points: ConsumptionPoint[]): number {
  if (points.length < 14) return 0;
  const last = avg(points.slice(-7).map((p) => p.kwh));
  const prev = avg(points.slice(-14, -7).map((p) => p.kwh));
  if (prev === 0) return 0;
  return Math.round(((last - prev) / prev) * 100);
}

/** Rebuild an electricity/gas meter card from one or more connected histories. */
function liveMeter(base: EnergyMeter, conns: ConnectedMeter[]): EnergyMeter {
  const value = Math.round(conns.reduce((s, c) => s + c.history.total, 0));
  // Aggregate all connected sites' daily curves index-by-index for the sparkline.
  const maxLen = Math.max(...conns.map((c) => c.history.points.length));
  const merged: ConsumptionPoint[] = [];
  for (let i = 0; i < maxLen; i++) {
    const day = conns[0]?.history.points[i]?.date ?? String(i);
    const kwh = conns.reduce((s, c) => s + (c.history.points[i]?.kwh ?? 0), 0);
    merged.push({ date: day, kwh });
  }
  return {
    ...base,
    value,
    deltaPct: weekDeltaPct(merged),
    anomaly: null,
    series: sparkline(merged),
    live: true,
  };
}

/**
 * Overlay live connector data onto the base Énergie summary. Pure: builds new
 * objects, leaving the fixture untouched. Updates the electricity/gas meter
 * cards, the OPERAT trajectory (real kWh/m²/an = annualised consumption ÷ site
 * surface), and the latest heat-map cell of each connected site.
 */
export function applyConnectorHistories(base: EnergySummary, connections: ConnectedMeter[]): EnergySummary {
  if (connections.length === 0) return base;

  const elec = connections.filter((c) => c.provider === 'enedis');
  const gas = connections.filter((c) => c.provider === 'grdf');

  const meters = base.meters.map((m) => {
    if (m.kind === 'electricity' && elec.length) return liveMeter(m, elec);
    if (m.kind === 'gas' && gas.length) return liveMeter(m, gas);
    return m;
  });

  // OPERAT trajectory — annualise each connected site's energy and divide by its
  // declared surface, then average the resulting kWh/m²/an intensities.
  const withArea = connections.filter((c) => (c.surfaceM2 ?? 0) > 0);
  let trajectory = base.trajectory;
  if (withArea.length) {
    const bySite = new Map<string, { annual: number; area: number }>();
    for (const c of withArea) {
      const days = Math.max(1, c.history.points.length);
      const annual = (c.history.total / days) * 365;
      const cur = bySite.get(c.siteId);
      if (cur) cur.annual += annual;
      else bySite.set(c.siteId, { annual, area: c.surfaceM2! });
    }
    const intensities = [...bySite.values()].map((v) => v.annual / v.area);
    const currentKwhM2Year = Math.round(avg(intensities));
    const base0 = base.trajectory.baseKwhM2Year || currentKwhM2Year || 1;
    const reductionPct = Math.round(((currentKwhM2Year - base0) / base0) * 100);
    const targets = base.trajectory.targets.map((tg) => {
      const gap = reductionPct - tg.reductionPct; // ≤0 means target met
      return {
        ...tg,
        status: (gap <= 0 ? 'reached' : reductionPct <= 0 ? 'behind' : 'behind') as typeof tg.status,
        gapPts: gap <= 0 ? null : Math.round(gap),
      };
    });
    trajectory = { ...base.trajectory, currentKwhM2Year, reductionPct, onTrack: reductionPct <= -40, targets };
  }

  // Heat map — set each connected site's latest month cell to its measured
  // monthly intensity, normalised against a nominal high of 6 kWh/m²/month.
  const NOMINAL_MAX = 6;
  const monthlyBySite = new Map<string, number>();
  for (const c of withArea) {
    if (!c.surfaceM2) continue;
    monthlyBySite.set(c.siteId, (monthlyBySite.get(c.siteId) ?? 0) + c.history.total / c.surfaceM2);
  }
  const heatmap = base.heatmap.map((row) => {
    const conn = withArea.find(
      (c) => c.siteName.startsWith(row.siteName) || row.siteName.startsWith(c.siteName),
    );
    if (!conn) return row;
    const intensity = monthlyBySite.get(conn.siteId) ?? 0;
    const norm = Math.min(0.98, Math.max(0.05, intensity / NOMINAL_MAX));
    const cells = [...row.cells];
    cells[cells.length - 1] = round1(norm);
    return { ...row, cells };
  });

  return { ...base, meters, trajectory, heatmap, freshness: { asOf: new Date().toISOString(), stale: false } };
}
