import React, { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
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
    onReorder(kind, next, moved.label, targetIndex + 1);
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
        <input
          placeholder={kind === 'family' ? 'e.g. RBI Grade B' : 'e.g. Previous year'}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button className="btn btn-amber" type="submit">Add button</button>
      </form>

      <div className="list-quiet">
        {rows.map((r, index) => (
          <div
            key={r.id}
            className="row-item"
            style={{
              cursor: 'default',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 12,
              marginBottom: 8,
              background: '#FAF7F2',
              border: '1px solid #EBE4D8'
            }}
          >
            {/* High-Contrast Reorder Arrow Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                type="button"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                title={`Move "${r.label}" up`}
                style={{
                  background: index === 0 ? '#EAE5DB' : '#FFFFFF',
                  color: index === 0 ? '#A8A29E' : '#1C1917',
                  border: '1px solid #D6D0C4',
                  borderRadius: 6,
                  width: 28,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: index === 0 ? 'not-allowed' : 'pointer',
                  opacity: index === 0 ? 0.35 : 1,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all .15s ease'
                }}
              >
                <ChevronUp size={16} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
                title={`Move "${r.label}" down`}
                style={{
                  background: index === rows.length - 1 ? '#EAE5DB' : '#FFFFFF',
                  color: index === rows.length - 1 ? '#A8A29E' : '#1C1917',
                  border: '1px solid #D6D0C4',
                  borderRadius: 6,
                  width: 28,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: index === rows.length - 1 ? 'not-allowed' : 'pointer',
                  opacity: index === rows.length - 1 ? 0.35 : 1,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all .15s ease'
                }}
              >
                <ChevronDown size={16} strokeWidth={2.5} />
              </button>
            </div>

            {/* Position and Title */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#5B45EA',
                  background: '#ECE8FB',
                  padding: '2px 8px',
                  borderRadius: 6
                }}>
                  #{index + 1}
                </span>
                <b style={{ fontSize: 15, color: 'var(--ink)' }}>{r.label}</b>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, fontFamily: 'monospace' }}>
                {r.slug}
              </div>
            </div>

            {/* Reorder Up/Down text buttons for quick tap */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                className="btn btn-sm btn-line"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                title={`Move "${r.label}" up`}
                style={{ padding: '6px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
              >
                <ArrowUp size={12} /> Up
              </button>
              <button
                type="button"
                className="btn btn-sm btn-line"
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
                title={`Move "${r.label}" down`}
                style={{ padding: '6px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
              >
                <ArrowDown size={12} /> Down
              </button>
            </div>

            {/* Live / Soon Toggle */}
            <button
              type="button"
              className={`btn btn-sm ${r.coming_soon ? 'btn-line' : 'btn-violet'}`}
              onClick={() => onPatch(r.id, { coming_soon: !r.coming_soon })}
              style={{ minWidth: 54 }}
            >
              {r.coming_soon ? 'Soon' : 'Live'}
            </button>

            {/* Remove Button */}
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => onDel(r.id)}
            >
              Remove
            </button>
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
    toast.push('Button removed');
    load();
  }

  async function reorder(kind, nextRows, movedLabel, targetPos) {
    if (kind === 'family') setFamilies(nextRows);
    else setTypes(nextRows);

    try {
      await api('/api/admin/styles/reorder', {
        method: 'POST',
        body: { ids: nextRows.map((r) => r.id) }
      });
      toast.push(`✓ Moved "${movedLabel}" to position #${targetPos}!`);
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
