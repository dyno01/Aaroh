import React, { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../lib/toast.jsx';
import { PageHead } from '../../components/ui.jsx';

function Column({ title, hint, kind, rows, onAdd, onPatch, onDel, onReorder }) {
  const [label, setLabel] = useState('');

  function move(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= rows.length) return;
    const next = [...rows];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    onReorder(kind, next);
  }

  return (
    <div className="card">
      <h3>{title}</h3>
      <p className="lead" style={{ margin: '0 0 12px' }}>{hint}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!label.trim()) return;
          onAdd(kind, label.trim());
          setLabel('');
        }}
        style={{ display: 'flex', gap: 8, marginBottom: 14 }}
      >
        <input placeholder={kind === 'family' ? 'e.g. RBI Grade B' : 'e.g. Previous year'} value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn btn-amber" type="submit">Add button</button>
      </form>
      <div className="list-quiet">
        {rows.map((r, index) => (
          <div key={r.id} className="row-item" style={{ cursor: 'default', display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Reorder controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                title="Move button left / higher"
                style={{ padding: '2px 4px', opacity: index === 0 ? 0.3 : 0.8 }}
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
                title="Move button right / lower"
                style={{ padding: '2px 4px', opacity: index === rows.length - 1 ? 0.3 : 0.8 }}
              >
                <ChevronDown size={14} />
              </button>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', background: 'var(--subtle)', padding: '1px 6px', borderRadius: 4 }}>
                  #{index + 1}
                </span>
                <b>{r.label}</b>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{r.slug}</div>
            </div>

            <button
              type="button"
              className={`btn btn-sm ${r.coming_soon ? 'btn-line' : 'btn-violet'}`}
              onClick={() => onPatch(r.id, { coming_soon: !r.coming_soon })}
            >
              {r.coming_soon ? 'Soon' : 'Live'}
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => onDel(r.id)}>Remove</button>
          </div>
        ))}
        {!rows.length && <p className="lead">None yet — add one or import a paper.</p>}
      </div>
    </div>
  );
}

export default function AdminStyles() {
  const [families, setFamilies] = useState([]);
  const [types, setTypes] = useState([]);
  const toast = useToast();

  function load() {
    api('/api/admin/styles').then((d) => {
      setFamilies(d.families || []);
      setTypes(d.types || []);
    }).catch(() => {});
  }
  useEffect(load, []);

  async function add(kind, label) {
    try {
      await api('/api/admin/styles', { method: 'POST', body: { kind, label } });
      toast.push('Button added — it shows on Tests');
      load();
    } catch (e) { toast.push(e.message); }
  }

  async function patch(id, body) {
    await api(`/api/admin/styles/${id}`, { method: 'PATCH', body });
    load();
  }

  async function del(id) {
    if (!window.confirm('Remove this button? Existing papers keep their family/type.')) return;
    await api(`/api/admin/styles/${id}`, { method: 'DELETE' });
    load();
  }

  async function reorder(kind, nextRows) {
    if (kind === 'family') setFamilies(nextRows);
    else setTypes(nextRows);

    try {
      await api('/api/admin/styles/reorder', {
        method: 'POST',
        body: { ids: nextRows.map((r) => r.id) }
      });
      toast.push('Button order saved — updated on Tests');
    } catch (e) {
      toast.push(e.message || 'Failed to save order');
      load();
    }
  }

  return (
    <div className="rise">
      <PageHead
        kicker="Tests screen"
        title="Buttons & styles"
        lead="These pills are what students see on Tests. Use the ▲ and ▼ arrows to change the order they appear to students. You can also rename, toggle Soon/Live, or add new buttons."
      />
      <div className="grid-home" style={{ marginTop: 8 }}>
        <Column
          title="Exam buttons"
          hint="Top row: All exams, IBPS SO IT, SEBI… Add RBI, IRDAI, or anything you import. Reorder with ▲/▼."
          kind="family"
          rows={families}
          onAdd={add}
          onPatch={patch}
          onDel={del}
          onReorder={reorder}
        />
        <Column
          title="Paper styles"
          hint="Second row: Subject-wise, Full mock, High influence. Add Sectional, PYP, Speed test… Reorder with ▲/▼."
          kind="type"
          rows={types}
          onAdd={add}
          onPatch={patch}
          onDel={del}
          onReorder={reorder}
        />
      </div>
    </div>
  );
}

