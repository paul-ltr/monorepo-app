/**
 * Client-side file downloads for the mock/demo build. Real exports will stream
 * from the API (S3 pre-signed URLs); until then these produce the same shape of
 * file from the fixtures so the export buttons are genuinely functional.
 */

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the click has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Escape a value for CSV (RFC 4180): quote when it contains a comma/quote/newline. */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Download a `;`-delimited CSV (Excel-fr friendly) with a BOM for accents. */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]): void {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(';'));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

/** Download an arbitrary text file (used for the FEC / report stubs). */
export function downloadText(filename: string, content: string, mime = 'text/plain'): void {
  triggerDownload(new Blob([content], { type: `${mime};charset=utf-8;` }), filename);
}
