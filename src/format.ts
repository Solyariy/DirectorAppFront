const dateTime = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export const fmtDate = (iso: string | null | undefined) => (iso ? dateTime.format(new Date(iso)) : '—');

export function fmtAgo(iso: string): string {
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  return `${Math.floor(sec / 86400)} d ago`;
}

export function fmtW(w: number | null | undefined): string {
  if (w === null || w === undefined) return '—';
  return Math.abs(w) >= 1000 ? `${(w / 1000).toFixed(2)} kW` : `${w} W`;
}

export const fmtNum = (n: number | null | undefined, unit: string, digits = 1) =>
  n === null || n === undefined ? '—' : `${n.toFixed(digits)} ${unit}`;

/** `<input type="datetime-local">` value (local time) to ISO 8601 UTC. */
export const localInputToIso = (value: string) => (value ? new Date(value).toISOString() : '');

const DEFAULT_SYMBOLS: Record<string, string> = {
  and: 'AND', or: 'OR', not: 'NOT',
  eq: '=', ne: '≠', gt: '>', ge: '≥', lt: '<', le: '≤',
  in: 'in', add: '+', sub: '−', mul: '×', div: '÷',
};

const LOGIC = new Set(['and', 'or']);
const ARITH = new Set(['add', 'sub', 'mul', 'div']);

/** Renders a rule `combination` tree as a one-line readable condition. */
export function describeCombination(node: unknown, symbols: Record<string, string> = DEFAULT_SYMBOLS): string {
  const sym = (op: string) => symbols[op] ?? DEFAULT_SYMBOLS[op] ?? op;

  const render = (n: unknown, parentOp?: string): string => {
    if (n === null || n === undefined) return 'null';
    if (Array.isArray(n)) return `[${n.map((x) => render(x)).join(', ')}]`;
    if (typeof n === 'object') {
      const obj = n as Record<string, unknown>;
      if ('field' in obj) return String(obj.field);
      const op = Object.keys(obj)[0];
      if (!op) return '{}';
      const args = Array.isArray(obj[op]) ? (obj[op] as unknown[]) : [obj[op]];
      let text: string;
      if (op === 'not') text = `NOT (${render(args[0])})`;
      else text = args.map((a) => render(a, op)).join(` ${sym(op)} `);
      const needsParens =
        parentOp !== undefined &&
        parentOp !== op &&
        (LOGIC.has(op) || (ARITH.has(op) && ARITH.has(parentOp ?? '')));
      return needsParens ? `(${text})` : text;
    }
    return String(n);
  };

  return render(node);
}
