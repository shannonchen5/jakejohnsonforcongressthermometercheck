import { useCallback, useEffect, useRef, useState } from 'react';
import type { ThermometerLookup, ThermometerRow } from '../types';
import { parseMoney, parsePercent } from '../utils/money';

const DEFAULT_REFRESH_MS = 5 * 60 * 1000;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(cell.trim());
      cell = '';
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      if (ch === '\r') i++;
    } else if (ch !== '\r') {
      cell += ch;
    }
  }

  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

function isHeaderRow(row: string[]): boolean {
  const first = row[0]?.toLowerCase() ?? '';
  return first === 'form name' || first === 'formname';
}

function rowToEntry(row: string[]): ThermometerRow | null {
  const [
    formName = '',
    raisedRaw = '',
    goalRaw = '',
    percentRaw = '',
    thermometerLabel = '',
    lastUpdated = '',
  ] = row;

  const name = formName.trim();
  if (!name || isHeaderRow(row)) return null;

  const raised = parseMoney(raisedRaw);
  const goal = parseMoney(goalRaw);
  let percentOfGoal = parsePercent(percentRaw);
  if (percentOfGoal == null && raised != null && goal != null && goal > 0) {
    percentOfGoal = (raised / goal) * 100;
  }

  return {
    formName: name,
    raised,
    goal,
    percentOfGoal,
    thermometerLabel: thermometerLabel.trim(),
    lastUpdated: lastUpdated.trim(),
  };
}

function rowsToLookup(rows: string[][]): ThermometerLookup {
  const lookup: ThermometerLookup = {};
  for (const row of rows) {
    const entry = rowToEntry(row);
    if (!entry) continue;
    lookup[entry.formName] = entry;
  }
  return lookup;
}

async function fetchViaApi(
  sheetId: string,
  apiKey: string,
  range: string,
  signal: AbortSignal
): Promise<ThermometerLookup> {
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`
  );
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Google Sheets API request failed (${response.status})`);
  }

  const json = (await response.json()) as { values?: string[][] };
  if (!json.values?.length) return {};
  return rowsToLookup(json.values);
}

async function fetchViaPublicCsv(
  sheetId: string,
  sheetName: string,
  signal: AbortSignal
): Promise<ThermometerLookup> {
  // gviz CSV by tab name is more reliable than /export?gid= when the
  // Thermometer Dashboard tab is not gid=0.
  const url = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`);
  url.searchParams.set('tqx', 'out:csv');
  url.searchParams.set('sheet', sheetName);

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Public sheet export failed (${response.status})`);
  }

  const text = await response.text();
  const rows = parseCsv(text);
  if (!rows.length) return {};
  const start = isHeaderRow(rows[0]) ? 1 : 0;
  return rowsToLookup(rows.slice(start));
}

export function useThermometerData() {
  const [data, setData] = useState<ThermometerLookup>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'none' | 'sheet-api' | 'sheet-csv'>('none');
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async (signal: AbortSignal, { soft }: { soft: boolean }) => {
    const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY as string | undefined;
    const sheetId = import.meta.env.VITE_GOOGLE_SHEET_ID as string | undefined;
    const range =
      (import.meta.env.VITE_GOOGLE_SHEET_RANGE as string | undefined) ??
      'Thermometer Dashboard!A2:F';
    const sheetName =
      (import.meta.env.VITE_GOOGLE_SHEET_TAB as string | undefined) ?? 'Thermometer Dashboard';

    if (!sheetId?.trim()) {
      setError('Missing VITE_GOOGLE_SHEET_ID. Add it to your .env file.');
      setLoading(false);
      setSource('none');
      return;
    }

    if (!soft || !hasLoadedOnce.current) {
      setLoading(true);
    }
    setError(null);

    try {
      const lookup = apiKey?.trim()
        ? await fetchViaApi(sheetId.trim(), apiKey.trim(), range, signal)
        : await fetchViaPublicCsv(sheetId.trim(), sheetName, signal);

      if (signal.aborted) return;
      setData(lookup);
      setSource(apiKey?.trim() ? 'sheet-api' : 'sheet-csv');
      setLastFetchedAt(new Date());
      hasLoadedOnce.current = true;
    } catch (err) {
      if (signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to load sheet data');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const refreshMs = Number(import.meta.env.VITE_REFRESH_INTERVAL_MS);
    const intervalMs =
      Number.isFinite(refreshMs) && refreshMs > 0 ? refreshMs : DEFAULT_REFRESH_MS;

    const controller = new AbortController();
    void load(controller.signal, { soft: false });

    const timer = window.setInterval(() => {
      const refreshController = new AbortController();
      void load(refreshController.signal, { soft: true });
    }, intervalMs);

    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [load]);

  return { data, loading, error, source, lastFetchedAt };
}
