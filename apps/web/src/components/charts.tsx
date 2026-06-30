/**
 * Lightweight SVG chart primitives matching the design (sparkline, OPERAT gauge,
 * mini bars, heatmap cell). Kept dependency-free; Recharts is reserved for the
 * richer trend views wired to the API later.
 */

export function Sparkline({
  points,
  stroke = 'var(--ok)',
  width = 120,
  height = 30,
}: {
  points: number[];
  stroke?: string;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width, height }}>
      <polyline
        points={coords}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MiniBars({
  values,
  color = 'var(--warn-soft)',
  lastColor = 'var(--warn)',
}: {
  values: number[];
  color?: string;
  lastColor?: string;
}) {
  const max = Math.max(...values, 1);
  return (
    <div className="mt-2.5 flex h-[30px] items-end gap-[3px]">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-[2px]"
          style={{
            height: `${(v / max) * 100}%`,
            background: i === values.length - 1 ? lastColor : color,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Half-circle OPERAT gauge. `value`/`max` in the same unit; the needle points to
 * the current consumption and the arc fills proportionally (design parity).
 */
export function Gauge({ value, max }: { value: number; max: number }) {
  const cx = 170;
  const cy = 188;
  const r = 130;
  const pt = (deg: number, rad: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [cx + rad * Math.cos(a), cy - rad * Math.sin(a)];
  };
  const sweep = (d0: number, d1: number, rad: number, step: number) => {
    let s = '';
    const up = d0 < d1;
    for (let d = d0; up ? d <= d1 : d >= d1; d += up ? step : -step) {
      const [x, y] = pt(d, rad);
      s += `${x.toFixed(1)},${y.toFixed(1)} `;
    }
    return s.trim();
  };
  const valDeg = 180 - (value / max) * 180;
  const [nx, ny] = pt(valDeg, r - 18);
  const ticks = [40, 50, 60]
    .filter((tv) => tv <= max)
    .map((tv) => {
      const dg = 180 - (tv / max) * 180;
      const [ix, iy] = pt(dg, r + 6);
      const [ox, oy] = pt(dg, r - 6);
      return { ix, iy, ox, oy };
    });
  return (
    <svg viewBox="0 0 340 215" style={{ width: '100%', display: 'block' }}>
      <polyline points={sweep(180, 0, r, 3)} fill="none" stroke="var(--surface-3)" strokeWidth={18} strokeLinecap="round" />
      <polyline points={sweep(180, valDeg, r, 2)} fill="none" stroke="var(--energy)" strokeWidth={18} strokeLinecap="round" />
      {ticks.map((tk, i) => (
        <line key={i} x1={tk.ix} y1={tk.iy} x2={tk.ox} y2={tk.oy} stroke="var(--surface)" strokeWidth={3} />
      ))}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--fg)" strokeWidth={3.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={7} fill="var(--fg)" />
      <circle cx={cx} cy={cy} r={3} fill="var(--surface)" />
    </svg>
  );
}

/** Map a 0..1 intensity to the energy heatmap cell background. */
export function heatCellStyle(v: number): { background: string; color: string } {
  return {
    background: `rgba(12,133,121,${(0.1 + v * 0.85).toFixed(2)})`,
    color: v > 0.55 ? '#fff' : 'var(--fg-muted)',
  };
}
