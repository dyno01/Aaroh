import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../lib/toast.jsx';
import { PageHead } from '../../components/ui.jsx';

function Column({ title, hint, kind, rows, onAdd, onPatch, onDel }) {
  const [label, setLabel] = useState('');
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
        {rows.map((r) => (
          <div key={r.id} className="row-item" style={{ cursor: 'default' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{r.label}</b>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.slug}</div>
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

  return (
    <div className="rise">
      <PageHead
        kicker="Tests screen"
        title="Buttons & styles"
        lead="These pills are what students see on Tests. Import a new exam_family or exam_type and the button appears. You can also add one here, then change the label any time."
      />
      <div className="grid-home" style={{ marginTop: 8 }}>
        <Column
          title="Exam buttons"
          hint="Top row: All exams, IBPS SO IT, SEBI… Add RBI, IRDAI, or anything you import."
          kind="family"
          rows={families}
          onAdd={add}
          onPatch={patch}
          onDel={del}
        />
        <Column
          title="Paper styles"
          hint="Second row: Subject-wise, Full mock, High influence. Add Sectional, PYP, Speed test…"
          kind="type"
          rows={types}
          onAdd={add}
          onPatch={patch}
          onDel={del}
        />
      </div>
    </div>
  );
}
