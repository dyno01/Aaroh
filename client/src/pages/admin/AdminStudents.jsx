import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../lib/toast.jsx';
import { Avatar, PageHead } from '../../components/ui.jsx';

export default function AdminStudents() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: 'Aaroh@123', role: 'student' });
  const toast = useToast();

  function load() { api('/api/admin/students').then((d) => setRows(d.students || [])).catch(() => {}); }
  useEffect(load, []);

  async function create(e) {
    e.preventDefault();
    try {
      await api('/api/admin/students', { method: 'POST', body: form });
      toast.push('Account created');
      setForm({ name: '', email: '', password: 'Aaroh@123', role: 'student' });
      load();
    } catch (ex) { toast.push(ex.message); }
  }

  async function role(id, next) {
    await api(`/api/admin/students/${id}`, { method: 'PATCH', body: { role: next } });
    toast.push(`Role → ${next}`);
    load();
  }

  return (
    <div className="rise">
      <PageHead kicker="Directory" title="People" lead="Students sit papers. Coaches see the desk. You can promote anyone." />
      <form className="card" onSubmit={create}>
        <h3>Add someone</h3>
        <div className="settings-grid">
          <div><label className="fld">Name</label><input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="fld">Email</label><input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div><label className="fld">Password</label><input placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div>
            <label className="fld">Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <button className="btn btn-violet" style={{ marginTop: 14 }} type="submit">Create account</button>
      </form>
      <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Tests</th><th>Avg</th><th>Streak</th><th></th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Avatar name={u.name} color={u.avatar_color} size={32} />
                    <b>{u.name}</b>
                  </div>
                </td>
                <td>{u.email}</td>
                <td><span className={`tag ${u.role === 'admin' ? 'gold' : ''}`}>{u.role}</span></td>
                <td>{u.tests}</td>
                <td>{u.avg_score ?? '—'}</td>
                <td>{u.streak}</td>
                <td>
                  <button className="btn btn-sm btn-line" onClick={() => role(u.id, u.role === 'student' ? 'admin' : 'student')}>
                    {u.role === 'student' ? 'Make admin' : 'Make student'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
