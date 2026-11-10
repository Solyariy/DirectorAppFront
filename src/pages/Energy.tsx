import { useState } from 'react';
import { api } from '../api';
import { EnergyCard, Empty, ErrorBox, Field, Loading, PageHeader, Pagination } from '../components';
import { fmtDate, fmtNum, fmtW, localInputToIso } from '../format';
import { useAction, useAsync } from '../hooks';
import type { EnergySnapshot } from '../types';

const PAGE_SIZE = 50;

export default function Energy() {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const list = useAsync(
    () => api.energy.snapshots({ page, page_size: PAGE_SIZE, from: localInputToIso(from), to: localInputToIso(to) }),
    [page, from, to],
  );
  const live = useAction();
  const [current, setCurrent] = useState<EnergySnapshot>();

  const readLive = async () => {
    const snap = await live.run(api.energy.current);
    if (snap) {
      setCurrent(snap);
      list.reload();
    }
  };

  return (
    <>
      <PageHeader title="Energy">
        <button className="btn" onClick={readLive} disabled={live.busy} title="Reads the inverter now and stores a snapshot">
          {live.busy ? 'Reading…' : 'Read inverter now'}
        </button>
      </PageHeader>
      <ErrorBox error={live.error} />
      {current && <EnergyCard snap={current} title="Live reading" />}

      <div className="filters">
        <Field label="From">
          <input className="input" type="datetime-local" value={from} onChange={(e) => (setFrom(e.target.value), setPage(1))} />
        </Field>
        <Field label="To">
          <input className="input" type="datetime-local" value={to} onChange={(e) => (setTo(e.target.value), setPage(1))} />
        </Field>
        {(from || to) && (
          <button className="btn btn-ghost" onClick={() => (setFrom(''), setTo(''), setPage(1))}>
            Clear
          </button>
        )}
      </div>
      <ErrorBox error={list.error} />

      <section className="card card-flush scroll-x">
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data?.results.length ? (
          <Empty>No readings in this range.</Empty>
        ) : (
          <table className="table table-compact numeric">
            <thead>
              <tr>
                <th>Time</th>
                <th>Solar</th>
                <th>Load</th>
                <th title="+ import / − export">Grid</th>
                <th title="+ discharge / − charge">Battery</th>
                <th>SoC</th>
                <th>Batt V</th>
                <th>Grid V</th>
                <th>PV1</th>
                <th>PV2</th>
              </tr>
            </thead>
            <tbody>
              {list.data.results.map((s) => (
                <tr key={s.id}>
                  <td className="nowrap">{fmtDate(s.timestamp)}</td>
                  <td className="sun">{fmtW(s.solar_power_w)}</td>
                  <td>{fmtW(s.load_power_w)}</td>
                  <td className={s.grid_power_w > 0 ? 'neg' : 'pos'}>{fmtW(s.grid_power_w)}</td>
                  <td>{fmtW(s.battery_power_w)}</td>
                  <td>{s.battery_charge_pct}%</td>
                  <td>{fmtNum(s.battery_voltage_v, 'V')}</td>
                  <td>{fmtNum(s.grid_voltage_v, 'V')}</td>
                  <td>{fmtW(s.pv1_power_w)}</td>
                  <td>{fmtW(s.pv2_power_w)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {list.data && <Pagination page={page} pageSize={PAGE_SIZE} count={list.data.count} onPage={setPage} />}
    </>
  );
}
