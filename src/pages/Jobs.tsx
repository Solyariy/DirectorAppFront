import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { Badge, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Pagination } from '../components';
import { fmtDate } from '../format';
import { useAction, useAsync } from '../hooks';
import { JOB_STATUSES, type App, type Job, type JobStatus } from '../types';

const PAGE_SIZE = 20;

export const STATUS_TONE = { queued: 'info', 'in-process': 'warn', success: 'ok', failed: 'bad' } as const;

export default function Jobs() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<JobStatus | ''>('');
  const list = useAsync(() => api.jobs.list({ page, page_size: PAGE_SIZE, status }), [page, status]);
  const apps = useAsync(() => api.apps.all(), []);
  const appName = (id: number | null) => (id === null ? undefined : apps.data?.find((a) => a.id === id)?.name ?? `#${id}`);

  const [editing, setEditing] = useState<Job | 'new' | null>(null);
  const action = useAction();

  const setJobStatus = async (job: Job, next: JobStatus) => {
    await action.run(() => api.jobs.update(job.id, { status: next }));
    list.reload();
  };

  const remove = async (job: Job) => {
    if (!confirm(`Delete job #${job.id}?`)) return;
    await action.run(() => api.jobs.remove(job.id));
    list.reload();
  };

  return (
    <>
      <PageHeader title="Jobs">
        <select className="input" value={status} onChange={(e) => (setStatus(e.target.value as JobStatus | ''), setPage(1))}>
          <option value="">All statuses</option>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          + New job
        </button>
      </PageHeader>
      <p className="muted small">Jobs are plain records for now: nothing runs them, so statuses change only when you edit them.</p>
      <ErrorBox error={list.error ?? action.error} />

      <section className="card card-flush">
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data?.results.length ? (
          <Empty>No jobs found.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>App</th>
                <th>Model</th>
                <th>Prompt</th>
                <th>Data</th>
                <th>Status</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.data.results.map((job) => (
                <tr key={job.id}>
                  <td className="muted">{job.id}</td>
                  <td>{appName(job.app) ?? <span className="muted">—</span>}</td>
                  <td>
                    <code>{job.model}</code>
                  </td>
                  <td className="clip" title={job.prompt}>
                    {job.prompt}
                  </td>
                  <td title={job.data.join('\n')}>
                    {job.data.length} URL{job.data.length === 1 ? '' : 's'}
                  </td>
                  <td>
                    <select
                      className={`input input-sm status-${STATUS_TONE[job.status]}`}
                      value={job.status}
                      onChange={(e) => setJobStatus(job, e.target.value as JobStatus)}
                      aria-label="Status"
                    >
                      {JOB_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="nowrap">{fmtDate(job.created_at)}</td>
                  <td className="right nowrap">
                    <button className="btn btn-sm" onClick={() => setEditing(job)}>
                      Edit
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(job)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {list.data && <Pagination page={page} pageSize={PAGE_SIZE} count={list.data.count} onPage={setPage} />}

      {editing && (
        <JobEditor
          job={editing === 'new' ? undefined : editing}
          apps={apps.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      )}
    </>
  );
}

function JobEditor({ job, apps, onClose, onSaved }: { job?: Job; apps: App[]; onClose: () => void; onSaved: () => void }) {
  const [app, setApp] = useState(job?.app?.toString() ?? '');
  const [model, setModel] = useState(job?.model ?? '');
  const [urls, setUrls] = useState(job?.data.join('\n') ?? '');
  const [prompt, setPrompt] = useState(job?.prompt ?? '');
  const [status, setStatus] = useState<JobStatus>(job?.status ?? 'queued');
  const save = useAction();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = {
      app: app ? Number(app) : null,
      model,
      prompt,
      status,
      data: urls
        .split('\n')
        .map((u) => u.trim())
        .filter(Boolean),
    };
    const ok = await save.run(() => (job ? api.jobs.update(job.id, body) : api.jobs.create(body)));
    if (ok) onSaved();
  };

  return (
    <Modal title={job ? `Edit job #${job.id}` : 'New job'} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <ErrorBox error={save.error} />
        <div className="grid-2 gap-sm">
          <Field label="App">
            <select className="input" value={app} onChange={(e) => setApp(e.target.value)}>
              <option value="">— none —</option>
              {apps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Model" hint="e.g. llama3.1:8b">
            <input className="input" value={model} onChange={(e) => setModel(e.target.value)} required maxLength={200} />
          </Field>
        </div>
        <Field label="Data URLs" hint="Public http(s) URLs, one per line. At least one.">
          <textarea className="input mono" rows={4} value={urls} onChange={(e) => setUrls(e.target.value)} required />
        </Field>
        <Field label="Prompt">
          <textarea className="input" rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)} required />
        </Field>
        <Field label="Status">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as JobStatus)}>
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        {job && (
          <p className="muted small">
            <Badge tone="neutral">updated</Badge> {fmtDate(job.updated_at)}
          </p>
        )}
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.busy}>
            {save.busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
