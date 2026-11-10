import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { Empty, ErrorBox, EvaluateModal, Field, Loading, Modal, PageHeader, Pagination } from '../components';
import { fmtDate } from '../format';
import { useAction, useAsync } from '../hooks';
import type { App, Policy } from '../types';

const PAGE_SIZE = 20;

export default function Apps() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const list = useAsync(() => api.apps.list({ page, page_size: PAGE_SIZE, search }), [page, search]);
  const policies = useAsync(() => api.policies.all(), []);
  const policyName = (id: number | null) => policies.data?.find((p) => p.id === id)?.name;

  const [editing, setEditing] = useState<App | 'new' | null>(null);
  const [evaluating, setEvaluating] = useState<App | null>(null);
  const del = useAction();

  const remove = async (app: App) => {
    if (!confirm(`Delete app “${app.name}”? Its jobs stay, with no app.`)) return;
    await del.run(() => api.apps.remove(app.id));
    list.reload();
  };

  return (
    <>
      <PageHeader title="Apps">
        <input
          className="input"
          type="search"
          placeholder="Search by name"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          + New app
        </button>
      </PageHeader>
      <ErrorBox error={list.error ?? del.error} />

      <section className="card card-flush">
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data?.results.length ? (
          <Empty>{search ? 'No apps match.' : 'No apps yet. Register one to attach a policy.'}</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Description</th>
                <th>Policy</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.data.results.map((app) => (
                <tr key={app.id}>
                  <td className="muted">{app.id}</td>
                  <td>
                    <strong>{app.name}</strong>
                  </td>
                  <td className="clip">{app.description || <span className="muted">—</span>}</td>
                  <td>{app.policy ? policyName(app.policy) ?? `#${app.policy}` : <span className="muted">none</span>}</td>
                  <td className="nowrap">{fmtDate(app.created_at)}</td>
                  <td className="right nowrap">
                    <button className="btn btn-sm" onClick={() => setEvaluating(app)} title="Reads the inverter live">
                      Evaluate
                    </button>
                    <button className="btn btn-sm" onClick={() => setEditing(app)}>
                      Edit
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(app)}>
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
        <AppEditor
          app={editing === 'new' ? undefined : editing}
          policies={policies.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      )}
      {evaluating && <EvaluateModal app={evaluating} policyName={policyName} onClose={() => setEvaluating(null)} />}
    </>
  );
}

function AppEditor({
  app,
  policies,
  onClose,
  onSaved,
}: {
  app?: App;
  policies: Policy[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(app?.name ?? '');
  const [description, setDescription] = useState(app?.description ?? '');
  const [policy, setPolicy] = useState<string>(app?.policy ? String(app.policy) : '');
  const save = useAction();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = { name, description, policy: policy ? Number(policy) : null };
    const ok = await save.run(() => (app ? api.apps.update(app.id, body) : api.apps.create(body)));
    if (ok) onSaved();
  };

  return (
    <Modal title={app ? `Edit app “${app.name}”` : 'New app'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <ErrorBox error={save.error} />
        <Field label="Name" hint="Unique, up to 100 characters.">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoFocus />
        </Field>
        <Field label="Description">
          <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Policy" hint="Without a policy the app can't run.">
          <select className="input" value={policy} onChange={(e) => setPolicy(e.target.value)}>
            <option value="">— none —</option>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.is_active ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </Field>
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
