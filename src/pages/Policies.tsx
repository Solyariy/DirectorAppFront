import { useState, type FormEvent } from 'react';
import { api, statusOf } from '../api';
import { ActiveBadge, Badge, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Pagination } from '../components';
import { useAction, useAsync } from '../hooks';
import type { Policy, PolicyOperator, Rule } from '../types';

const PAGE_SIZE = 20;

export default function Policies() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const list = useAsync(
    () => api.policies.list({ page, page_size: PAGE_SIZE, search, is_active: active }),
    [page, search, active],
  );
  const [editing, setEditing] = useState<Policy | 'new' | null>(null);
  const [showApps, setShowApps] = useState<Policy | null>(null);
  const action = useAction();

  const remove = async (policy: Policy) => {
    if (!confirm(`Delete policy “${policy.name}”? Its rules stay.`)) return;
    await action.run(async () => {
      try {
        await api.policies.remove(policy.id);
      } catch (err) {
        if (statusOf(err) === 409) setShowApps(policy);
        throw err;
      }
    });
    list.reload();
  };

  const toggle = async (policy: Policy) => {
    await action.run(() => api.policies.update(policy.id, { is_active: !policy.is_active }));
    list.reload();
  };

  return (
    <>
      <PageHeader title="Policies">
        <select className="input" value={active} onChange={(e) => (setActive(e.target.value), setPage(1))}>
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <input
          className="input"
          type="search"
          placeholder="Search by name"
          value={search}
          onChange={(e) => (setSearch(e.target.value), setPage(1))}
        />
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          + New policy
        </button>
      </PageHeader>
      <ErrorBox error={list.error ?? action.error} />

      <section className="card card-flush">
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data?.results.length ? (
          <Empty>No policies found.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Rules</th>
                <th>Max jobs</th>
                <th>Apps</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.data.results.map((policy) => (
                <tr key={policy.id}>
                  <td className="muted">{policy.id}</td>
                  <td>
                    <strong>{policy.name}</strong>
                    {policy.description && <div className="muted small">{policy.description}</div>}
                  </td>
                  <td>
                    {policy.rules.length === 0 ? (
                      <span className="muted">no rules</span>
                    ) : (
                      <div className="chips">
                        {policy.rules.map((link, i) => (
                          <span key={link.rule.id} className="row-inline">
                            {i > 0 && <span className="op">{policy.operator.toUpperCase()}</span>}
                            <Badge
                              tone={link.effective ? 'info' : 'neutral'}
                              title={
                                link.effective
                                  ? 'Effective'
                                  : !link.rule.is_active
                                    ? 'Rule is inactive'
                                    : 'Link is switched off'
                              }
                            >
                              {link.effective ? '' : '⏸ '}
                              {link.rule.name}
                            </Badge>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>{policy.max_concurrent_jobs ?? <span className="muted">∞</span>}</td>
                  <td>
                    <button className="btn-link" onClick={() => setShowApps(policy)} disabled={policy.apps_count === 0}>
                      {policy.apps_count}
                    </button>
                  </td>
                  <td>
                    <button className="btn-link" onClick={() => toggle(policy)} title="Click to toggle">
                      <ActiveBadge active={policy.is_active} />
                    </button>
                  </td>
                  <td className="right nowrap">
                    <button className="btn btn-sm" onClick={() => setEditing(policy)}>
                      Edit
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(policy)}>
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
        <PolicyEditor
          policy={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      )}
      {showApps && <PolicyApps policy={showApps} onClose={() => setShowApps(null)} />}
    </>
  );
}

function PolicyApps({ policy, onClose }: { policy: Policy; onClose: () => void }) {
  const apps = useAsync(() => api.policies.apps(policy.id), [policy.id]);
  return (
    <Modal title={`Apps using “${policy.name}”`} onClose={onClose}>
      <ErrorBox error={apps.error} />
      {apps.loading ? (
        <Loading />
      ) : apps.data?.length ? (
        <>
          <ul className="list">
            {apps.data.map((a) => (
              <li key={a.id}>
                {a.name} <span className="muted">#{a.id}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">To delete the policy, move these apps to another policy (or none) on the Apps page.</p>
        </>
      ) : (
        <p className="muted">No apps use this policy.</p>
      )}
    </Modal>
  );
}

interface LinkState {
  linked: boolean;
  is_active: boolean;
}

function PolicyEditor({ policy, onClose, onSaved }: { policy?: Policy; onClose: () => void; onSaved: () => void }) {
  const rules = useAsync(() => api.rules.all(), []);
  const [name, setName] = useState(policy?.name ?? '');
  const [description, setDescription] = useState(policy?.description ?? '');
  const [operator, setOperator] = useState<PolicyOperator>(policy?.operator ?? 'and');
  const [isActive, setIsActive] = useState(policy?.is_active ?? true);
  const [maxJobs, setMaxJobs] = useState(policy?.max_concurrent_jobs?.toString() ?? '');
  const [links, setLinks] = useState<Record<number, LinkState>>(() =>
    Object.fromEntries((policy?.rules ?? []).map((l) => [l.rule.id, { linked: true, is_active: l.is_active }])),
  );
  const save = useAction();

  const setLink = (id: number, patch: Partial<LinkState>) =>
    setLinks((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { linked: false, is_active: true }), ...patch } }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = {
      name,
      description,
      operator,
      is_active: isActive,
      max_concurrent_jobs: maxJobs ? Number(maxJobs) : null,
      rules: Object.entries(links)
        .filter(([, l]) => l.linked)
        .map(([id, l]) => ({ rule: Number(id), is_active: l.is_active })),
    };
    const ok = await save.run(() => (policy ? api.policies.update(policy.id, body) : api.policies.create(body)));
    if (ok) onSaved();
  };

  const linkedCount = Object.values(links).filter((l) => l.linked).length;

  return (
    <Modal title={policy ? `Edit policy “${policy.name}”` : 'New policy'} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <ErrorBox error={save.error} />
        <div className="grid-2 gap-sm">
          <Field label="Name" hint="Unique, up to 100 characters.">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoFocus />
          </Field>
          <Field label="Description">
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Combine rules with">
            <select className="input" value={operator} onChange={(e) => setOperator(e.target.value as PolicyOperator)}>
              <option value="and">AND: all effective rules must pass</option>
              <option value="or">OR: any effective rule passes</option>
            </select>
          </Field>
          <Field label="Max concurrent jobs" hint="Stored, not enforced yet. Empty = no limit.">
            <input className="input" type="number" min={1} value={maxJobs} onChange={(e) => setMaxJobs(e.target.value)} />
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active
        </label>

        <div>
          <div className="field-label">
            Rules <span className="muted">({linkedCount} linked)</span>
          </div>
          <ErrorBox error={rules.error} />
          {rules.loading ? (
            <Loading />
          ) : !rules.data?.length ? (
            <p className="muted">No rules yet. Create some on the Rules page.</p>
          ) : (
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>Linked</th>
                  <th>Rule</th>
                  <th>Link on</th>
                  <th>Effective</th>
                </tr>
              </thead>
              <tbody>
                {rules.data.map((r: Rule) => {
                  const link = links[r.id];
                  const linked = !!link?.linked;
                  const effective = linked && link.is_active && r.is_active;
                  return (
                    <tr key={r.id} className={linked ? '' : 'dim'}>
                      <td>
                        <input type="checkbox" checked={linked} onChange={(e) => setLink(r.id, { linked: e.target.checked })} />
                      </td>
                      <td>
                        {r.name} {!r.is_active && <Badge>rule inactive</Badge>}
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          disabled={!linked}
                          checked={link?.is_active ?? true}
                          onChange={(e) => setLink(r.id, { is_active: e.target.checked })}
                        />
                      </td>
                      <td>{linked ? <Badge tone={effective ? 'ok' : 'neutral'}>{effective ? 'yes' : 'no'}</Badge> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="muted small">Only effective rules (rule and link both on) are evaluated. A policy without effective rules never passes.</p>
        </div>

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
