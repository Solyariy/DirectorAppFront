import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Badge, EnergyCard, ErrorBox, EvaluateModal, Loading, PageHeader } from '../components';
import { useAction, useAsync } from '../hooks';
import { JOB_STATUSES, type App } from '../types';
import { STATUS_TONE } from './Jobs';

export default function Dashboard() {
  const latest = useAsync(() => api.energy.snapshots({ page_size: 1 }), []);
  const jobCounts = useAsync(
    () => Promise.all(JOB_STATUSES.map((s) => api.jobs.list({ status: s, page_size: 1 }).then((p) => [s, p.count] as const))),
    [],
  );
  const apps = useAsync(() => api.apps.all(), []);
  const policies = useAsync(() => api.policies.all(), []);
  const policyName = (id: number | null) => policies.data?.find((p) => p.id === id)?.name;

  const live = useAction();
  const [evaluating, setEvaluating] = useState<App | null>(null);

  const readLive = () => live.run(api.energy.current).then((snap) => snap && latest.reload());
  const snap = latest.data?.results[0];

  return (
    <>
      <PageHeader title="Dashboard">
        <button className="btn" onClick={readLive} disabled={live.busy} title="Reads the inverter now and stores a snapshot">
          {live.busy ? 'Reading…' : 'Read inverter now'}
        </button>
      </PageHeader>
      <ErrorBox error={live.error} />

      <div className="grid-2">
        <div>
          <ErrorBox error={latest.error} />
          {snap ? (
            <EnergyCard snap={snap} />
          ) : latest.loading ? (
            <Loading />
          ) : (
            <section className="card muted">No energy readings yet.</section>
          )}
        </div>

        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h3>Jobs</h3>
              <Link to="/jobs">All jobs →</Link>
            </div>
            <ErrorBox error={jobCounts.error} />
            <div className="metrics metrics-4">
              {(jobCounts.data ?? JOB_STATUSES.map((s) => [s, undefined] as const)).map(([status, count]) => (
                <div className="metric" key={status}>
                  <span className="metric-label">
                    <Badge tone={STATUS_TONE[status]}>{status}</Badge>
                  </span>
                  <span className="metric-value">{count ?? '…'}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h3>Apps</h3>
              <Link to="/apps">Manage →</Link>
            </div>
            <ErrorBox error={apps.error} />
            {apps.loading && !apps.data ? (
              <Loading />
            ) : apps.data?.length ? (
              <table className="table table-compact">
                <tbody>
                  {apps.data.map((app) => (
                    <tr key={app.id}>
                      <td>
                        <strong>{app.name}</strong>
                      </td>
                      <td>{app.policy ? policyName(app.policy) ?? `#${app.policy}` : <span className="muted">no policy</span>}</td>
                      <td className="right">
                        <button className="btn btn-sm" onClick={() => setEvaluating(app)} title="Reads the inverter live">
                          Can it run?
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">No apps registered.</p>
            )}
          </section>
        </div>
      </div>

      {evaluating && <EvaluateModal app={evaluating} policyName={policyName} onClose={() => setEvaluating(null)} />}
    </>
  );
}
