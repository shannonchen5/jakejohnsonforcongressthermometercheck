/** Parse currency / number cells from the Sheet ("$1,234", "1234", "12.5%"). */
export function parseMoney(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const cleaned = value.replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parsePercent(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const cleaned = value.replace(/[%\s,]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value)}%`;
}
