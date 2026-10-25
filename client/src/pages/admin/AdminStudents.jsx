import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import { Avatar, PageHead } from '../../components/ui.jsx';

export default function AdminStudents() {
  const { user: currentUser } = useAuth();
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

  async function remove(u) {
    if (u.id === currentUser?.id) {
      toast.push('You cannot delete your own account while logged in');
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to delete ${u.name} (${u.email})?\n\nThis will permanently delete their account and all test attempt history.`
    );
    if (!confirmed) return;

    try {
      await api(`/api/admin/students/${u.id}`, { method: 'DELETE' });
      toast.push(`Deleted ${u.name}`);
      load();
    } catch (ex) {
      toast.push(ex.message || 'Could not delete account');
    }
  }

  return (
    <div className="rise">
      <PageHead kicker="Directory" title="People" lead="Students sit papers. Coaches see the desk. You can promote, manage, or delete accounts." />
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
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Tests</th>
              <th>Avg</th>
              <th>Streak</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const isSelf = u.id === currentUser?.id;
              return (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <Avatar name={u.name} color={u.avatar_color} size={32} />
                      <div>
                        <b>{u.name}</b>
                        {isSelf && <span className="tag" style={{ marginLeft: 6, fontSize: 11 }}>You</span>}
                      </div>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td><span className={`tag ${u.role === 'admin' ? 'gold' : ''}`}>{u.role}</span></td>
                  <td>{u.tests}</td>
                  <td>{u.avg_score ?? '—'}</td>
                  <td>{u.streak}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      <button className="btn btn-sm btn-line" onClick={() => role(u.id, u.role === 'student' ? 'admin' : 'student')}>
                        {u.role === 'student' ? 'Make admin' : 'Make student'}
                      </button>
                      {!isSelf && (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          title={`Delete ${u.name}`}
                          onClick={() => remove(u)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
