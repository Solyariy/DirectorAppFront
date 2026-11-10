import { useMemo, useRef, useState, type FormEvent } from 'react';
import { api, statusOf } from '../api';
import { ActiveBadge, Badge, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Pagination } from '../components';
import { describeCombination, fmtDate } from '../format';
import { useAction, useAsync } from '../hooks';
import type { Combination, Rule, RuleCatalog, RuleOperator } from '../types';

const PAGE_SIZE = 20;
const DEFAULT_COMBINATION: Combination = { ge: [{ field: 'solar_power_w' }, 1500] };

export default function Rules() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const list = useAsync(
    () => api.rules.list({ page, page_size: PAGE_SIZE, search, is_active: active }),
    [page, search, active],
  );
  const catalog = useAsync(() => api.rules.catalog(), []);
  const symbols = useMemo(
    () => Object.fromEntries((catalog.data?.operators ?? []).map((o) => [o.op, o.symbol])),
    [catalog.data],
  );

  const [editing, setEditing] = useState<Rule | 'new' | null>(null);
  const action = useAction();

  const remove = async (rule: Rule) => {
    if (!confirm(`Delete rule “${rule.name}”?`)) return;
    await action.run(async () => {
      try {
        await api.rules.remove(rule.id);
      } catch (err) {
        if (statusOf(err) !== 409) throw err;
        if (!confirm(`“${rule.name}” is linked to policies. Unlink it from every policy and delete it?`)) return;
        await api.rules.unlink(rule.id);
        await api.rules.remove(rule.id);
      }
    });
    list.reload();
  };

  const unlink = async (rule: Rule) => {
    if (!confirm(`Remove “${rule.name}” from every policy? The rule itself stays.`)) return;
    await action.run(() => api.rules.unlink(rule.id));
  };

  const toggle = async (rule: Rule) => {
    await action.run(() => api.rules.update(rule.id, { is_active: !rule.is_active }));
    list.reload();
  };

  return (
    <>
      <PageHeader title="Rules">
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
          + New rule
        </button>
      </PageHeader>
      <ErrorBox error={list.error ?? action.error} />

      <section className="card card-flush">
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data?.results.length ? (
          <Empty>No rules found.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Condition</th>
                <th>Status</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.data.results.map((rule) => (
                <tr key={rule.id}>
                  <td className="muted">{rule.id}</td>
                  <td>
                    <strong>{rule.name}</strong>
                    {rule.description && <div className="muted small">{rule.description}</div>}
                  </td>
                  <td>
                    <code className="condition">{describeCombination(rule.combination, symbols)}</code>
                  </td>
                  <td>
                    <button className="btn-link" onClick={() => toggle(rule)} title="Click to toggle">
                      <ActiveBadge active={rule.is_active} />
                    </button>
                  </td>
                  <td className="nowrap">{fmtDate(rule.updated_at)}</td>
                  <td className="right nowrap">
                    <button className="btn btn-sm" onClick={() => setEditing(rule)}>
                      Edit
                    </button>
                    <button className="btn btn-sm" onClick={() => unlink(rule)}>
                      Unlink
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(rule)}>
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
        <RuleEditor
          rule={editing === 'new' ? undefined : editing}
          catalog={catalog.data}
          symbols={symbols}
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

function operatorTemplate(op: RuleOperator): string {
  switch (op.kind) {
    case 'logic':
      return op.op === 'not' ? `{"not": [ ]}` : `{"${op.op}": [ , ]}`;
    case 'membership':
      return `{"in": [{"field": ""}, [ ]]}`;
    default:
      return `{"${op.op}": [{"field": ""}, 0]}`;
  }
}

function RuleEditor({
  rule,
  catalog,
  symbols,
  onClose,
  onSaved,
}: {
  rule?: Rule;
  catalog?: RuleCatalog;
  symbols: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(rule?.name ?? '');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);
  const [json, setJson] = useState(JSON.stringify(rule?.combination ?? DEFAULT_COMBINATION, null, 2));
  const textarea = useRef<HTMLTextAreaElement>(null);
  const save = useAction();

  const parsed = useMemo((): { value?: Combination; error?: string } => {
    try {
      const value = JSON.parse(json);
      if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'The root must be an object.' };
      return { value };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }, [json]);

  const insert = (text: string) => {
    const el = textarea.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const next = json.slice(0, start) + text + json.slice(end);
    setJson(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const format = () => parsed.value && setJson(JSON.stringify(parsed.value, null, 2));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!parsed.value) return;
    const body = { name, description, is_active: isActive, combination: parsed.value };
    const ok = await save.run(() => (rule ? api.rules.update(rule.id, body) : api.rules.create(body)));
    if (ok) onSaved();
  };

  return (
    <Modal title={rule ? `Edit rule “${rule.name}”` : 'New rule'} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <ErrorBox error={save.error} />
        <div className="grid-2 gap-sm">
          <Field label="Name" hint="Unique, up to 100 characters.">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoFocus />
          </Field>
          <Field label="Description">
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active
        </label>

        <div className="rule-editor">
          <div className="stack-sm">
            <div className="row between">
              <span className="field-label">Combination (JSON)</span>
              <button type="button" className="btn btn-sm btn-ghost" onClick={format} disabled={!parsed.value}>
                Format
              </button>
            </div>
            <textarea
              ref={textarea}
              className="input mono"
              rows={14}
              spellCheck={false}
              value={json}
              onChange={(e) => setJson(e.target.value)}
            />
            {parsed.error ? (
              <div className="alert alert-warn small">JSON: {parsed.error}</div>
            ) : (
              <div className="preview">
                <span className="muted small">Reads as</span>
                <code className="condition">{describeCombination(parsed.value, symbols)}</code>
              </div>
            )}
          </div>

          <aside className="catalog">
            <p className="muted small">
              Click to insert at the cursor. Each node is <code>{'{"op": [args]}'}</code>; operands are{' '}
              <code>{'{"field": name}'}</code>, numbers, <code>"HH:MM"</code> or ISO datetimes. A null field fails the
              rule. <code>weekday</code> (0 = Mon) and <code>local_time</code> are server local time.
            </p>
            {!catalog ? (
              <Loading />
            ) : (
              <>
                <h4>Fields</h4>
                <div className="chips">
                  {catalog.fields.map((f) => (
                    <button
                      type="button"
                      key={f.name}
                      className="chip"
                      title={[f.type, f.nullable ? 'nullable' : '', f.description ?? ''].filter(Boolean).join(' · ')}
                      onClick={() => insert(`{"field": "${f.name}"}`)}
                    >
                      {f.name}
                      <span className="chip-type">{f.type}</span>
                    </button>
                  ))}
                </div>
                <h4>Operators</h4>
                <div className="chips">
                  {catalog.operators.map((o) => (
                    <button
                      type="button"
                      key={o.op}
                      className="chip"
                      title={`${o.kind} · ${o.types.join(', ')}`}
                      onClick={() => insert(operatorTemplate(o))}
                    >
                      <strong>{o.symbol}</strong> {o.op}
                    </button>
                  ))}
                </div>
              </>
            )}
            <h4>Example</h4>
            <button
              type="button"
              className="chip"
              onClick={() =>
                setJson(
                  JSON.stringify(
                    {
                      and: [
                        { in: [{ field: 'weekday' }, [0, 1, 2, 3, 4]] },
                        { ge: [{ field: 'local_time' }, '09:00'] },
                        { ge: [{ field: 'solar_power_w' }, 1500] },
                      ],
                    },
                    null,
                    2,
                  ),
                )
              }
            >
              Weekdays after 09:00 with solar ≥ 1.5 kW
            </button>
            {rule && (
              <p className="small muted">
                <Badge tone="info">tip</Badge> Server validation errors point at the node, e.g. <code>and[1].ge[0]</code>.
              </p>
            )}
          </aside>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.busy || !parsed.value}>
            {save.busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
