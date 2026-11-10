import { useEffect, type ReactNode } from 'react';
import { api, errorMessage } from './api';
import { fmtAgo, fmtDate, fmtNum, fmtW } from './format';
import { useAsync } from './hooks';
import type { App, AppEvaluation, EnergySnapshot } from './types';

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      <div className="actions">{children}</div>
    </header>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="alert alert-error" role="alert">
      {errorMessage(error)}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="muted pad">{label}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

type Tone = 'ok' | 'bad' | 'warn' | 'info' | 'neutral';

export function Badge({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
    </span>
  );
}

export const ActiveBadge = ({ active }: { active: boolean }) => (
  <Badge tone={active ? 'ok' : 'neutral'}>{active ? 'active' : 'inactive'}</Badge>
);

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Pagination({
  page,
  pageSize,
  count,
  onPage,
}: {
  page: number;
  pageSize: number;
  count: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (count === 0) return null;
  return (
    <div className="pagination">
      <span className="muted">
        {count} item{count === 1 ? '' : 's'} · page {page} of {pages}
      </span>
      <div className="row">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ← Prev
        </button>
        <button className="btn btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next →
        </button>
      </div>
    </div>
  );
}

export function EnergyCard({ snap, title = 'Latest reading' }: { snap: EnergySnapshot; title?: string }) {
  const grid = snap.grid_power_w;
  const batt = snap.battery_power_w;
  const pct = Math.min(100, Math.max(0, snap.battery_charge_pct));
  return (
    <section className="card">
      <div className="card-head">
        <h3>{title}</h3>
        <span className="muted" title={fmtDate(snap.timestamp)}>
          {fmtAgo(snap.timestamp)}
        </span>
      </div>
      <div className="metrics">
        <Metric label="Solar" value={fmtW(snap.solar_power_w)} tone="sun" />
        <Metric label="Load" value={fmtW(snap.load_power_w)} />
        <Metric
          label={grid > 0 ? 'Grid import' : grid < 0 ? 'Grid export' : 'Grid'}
          value={fmtW(Math.abs(grid))}
          tone={grid > 0 ? 'bad' : 'ok'}
        />
        <Metric
          label={batt > 0 ? 'Battery discharging' : batt < 0 ? 'Battery charging' : 'Battery idle'}
          value={fmtW(Math.abs(batt))}
          sub={`${snap.battery_charge_pct}% · ${fmtNum(snap.battery_voltage_v, 'V')}`}
        />
      </div>
      <div
        className="battery"
        role="progressbar"
        aria-label="Battery charge"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="battery-bar">
          <div style={{ width: `${pct}%` }} />
        </div>
        <span className="battery-pct">{snap.battery_charge_pct}%</span>
      </div>
      <dl className="kv">
        <dt>Grid voltage</dt>
        <dd>{fmtNum(snap.grid_voltage_v, 'V')}</dd>
        <dt>PV1</dt>
        <dd>
          {fmtW(snap.pv1_power_w)} · {fmtNum(snap.pv1_voltage_v, 'V')} · {fmtNum(snap.pv1_current_a, 'A')}
        </dd>
        <dt>PV2</dt>
        <dd>
          {fmtW(snap.pv2_power_w)} · {fmtNum(snap.pv2_voltage_v, 'V')} · {fmtNum(snap.pv2_current_a, 'A')}
        </dd>
        <dt>Max charge current</dt>
        <dd>{fmtNum(snap.battery_max_charge_current_a, 'A', 0)}</dd>
      </dl>
    </section>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'sun' | 'ok' | 'bad' }) {
  return (
    <div className={`metric${tone ? ` metric-${tone}` : ''}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
      {sub && <span className="metric-sub">{sub}</span>}
    </div>
  );
}

/** Live evaluation of one app; every open reads the inverter and stores a snapshot. */
export function EvaluateModal({
  app,
  policyName,
  onClose,
}: {
  app: App;
  policyName: (id: number | null) => string | undefined;
  onClose: () => void;
}) {
  const ev = useAsync(() => api.apps.evaluate(app.id), [app.id]);
  return (
    <Modal title={`Can “${app.name}” run now?`} onClose={onClose} wide>
      <ErrorBox error={ev.error} />
      {ev.loading ? (
        <Loading label="Reading the inverter…" />
      ) : (
        ev.data && <EvaluationView ev={ev.data} policyName={policyName(ev.data.policy?.policy ?? null)} />
      )}
      <div className="modal-foot">
        <button className="btn" onClick={ev.reload} disabled={ev.loading}>
          Re-evaluate
        </button>
      </div>
    </Modal>
  );
}

export function EvaluationView({ ev, policyName }: { ev: AppEvaluation; policyName?: string }) {
  return (
    <div className="stack">
      <div className={`verdict ${ev.can_run ? 'verdict-ok' : 'verdict-bad'}`}>
        {ev.can_run ? '✓ Can run now' : '✕ Cannot run now'}
      </div>
      {ev.policy ? (
        <section>
          <h3>
            Policy {policyName ? `“${policyName}”` : `#${ev.policy.policy}`}{' '}
            <Badge tone={ev.policy.passed ? 'ok' : 'bad'}>{ev.policy.passed ? 'passed' : 'failed'}</Badge>{' '}
            <span className="muted">combined with {ev.policy.operator.toUpperCase()}</span>
          </h3>
          {ev.policy.rules.length === 0 ? (
            <p className="muted">No effective rules: a policy without effective rules never passes.</p>
          ) : (
            <ul className="checklist">
              {ev.policy.rules.map((r) => (
                <li key={r.rule} className={r.passed ? 'pass' : 'fail'}>
                  <span>{r.passed ? '✓' : '✕'}</span> {r.name}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <p className="muted">The app has no active policy, so it can't run.</p>
      )}
      <EnergyCard snap={ev.energy} title="Reading used" />
    </div>
  );
}
