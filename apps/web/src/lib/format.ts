import { formatMoney, type Money } from '@pilotage/shared';

/** fr-FR money without decimals (the design shows "4 287 €"). */
export const money0 = (m: Money) =>
  formatMoney(m, 'fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** fr-FR money with cents (the design shows "4,40 €"). */
export const money2 = (m: Money) => formatMoney(m, 'fr-FR');

/** Signed percentage, fr-FR (e.g. "+8,2 %" / "−6,2 %"). */
export const pct = (n: number, signed = true) => {
  const s = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 1,
    maximumFractionDigits: 1,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(n);
  return `${s} %`.replace('-', '−');
};

export const num = (n: number) => new Intl.NumberFormat('fr-FR').format(n);

/** Relative time in French, coarse ("il y a 12 min", "hier"). */
export function relativeTime(iso: string, now = Date.now()): string {
  const diffMin = Math.round((now - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  return diffD === 1 ? 'hier' : `il y a ${diffD} j`;
}
