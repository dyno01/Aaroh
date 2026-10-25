import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart3, Clock, CheckCircle2, XCircle, Award, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import { Avatar, PageHead, Loading } from '../../components/ui.jsx';

export default function AdminStudents() {
  const { user: currentUser, refresh } = useAuth();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: 'Password@123', role: 'student' });
  const [editing, setEditing] = useState(null);
  const [perfStudent, setPerfStudent] = useState(null);
  const [perfData, setPerfData] = useState(null);
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();

  function load() {
    api('/api/admin/students')
      .then((d) => {
        const list = d.students || [];
        setRows(list);
        const queryStudentId = searchParams.get('studentId');
        if (queryStudentId) {
          const match = list.find((s) => String(s.id) === String(queryStudentId));
          if (match) openPerformance(match);
        }
      })
      .catch((err) => {
        toast.push(err.message || 'Failed to load students');
      });
  }
  useEffect(load, []);

  function openPerformance(u) {
    setPerfStudent(u);
    setLoadingPerf(true);
    setPerfData(null);
    api(`/api/admin/students/${u.id}/performance`)
      .then(setPerfData)
      .catch((err) => {
        toast.push(err.message || 'Could not load student performance');
      })
      .finally(() => setLoadingPerf(false));
  }

  async function create(e) {
    e.preventDefault();
    try {
      await api('/api/admin/students', { method: 'POST', body: form });
      toast.push(`Created account for ${form.name}`);
      setForm({ name: '', email: '', password: 'Password@123', role: 'student' });
      load();
    } catch (ex) {
      toast.push(ex.message || 'Could not create account');
    }
  }

  async function role(u, next) {
    if (u.id === currentUser?.id && next !== 'admin') {
      toast.push('You cannot remove your own admin privileges');
      return;
    }
    const confirmMsg = next === 'admin'
      ? `Promote "${u.name}" to Admin? They will have full administrative access to all exams and students.`
      : `Demote "${u.name}" to Student?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api(`/api/admin/students/${u.id}`, { method: 'PATCH', body: { role: next } });
      toast.push(`${u.name} is now ${next === 'admin' ? 'an Admin' : 'a Student'}`);
      load();
      if (u.id === currentUser?.id && refresh) refresh();
    } catch (ex) {
      toast.push(ex.message || 'Failed to update role');
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    try {
      const payload = {
        name: editing.name,
        email: editing.email,
        role: editing.role
      };
      if (editing.password && editing.password.trim()) {
        if (editing.password.trim().length < 6) {
          toast.push('Password must be at least 6 characters');
          return;
        }
        payload.password = editing.password.trim();
      }

      await api(`/api/admin/students/${editing.id}`, { method: 'PATCH', body: payload });
      toast.push(`Saved changes for ${editing.name}`);
      setEditing(null);
      load();
      if (editing.id === currentUser?.id && refresh) refresh();
    } catch (ex) {
      toast.push(ex.message || 'Failed to save changes');
    }
  }

  async function remove(u) {
    if (u.id === currentUser?.id) {
      toast.push('You cannot delete your own account while logged in');
      return;
    }
    if (u.email === 'ishwar@aaroh.in' || u.name === 'Ishwar Rathod') {
      toast.push('Cannot delete the primary administrator account');
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${u.name}" (${u.email})?\n\nAll their tests, attempt history and credentials will be removed.`
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
      <PageHead
        kicker="Directory"
        title="People"
        lead="Manage students and administrators. View each student's performance, test results, and analytics."
      />

      <form className="card" onSubmit={create}>
        <h3>Add someone</h3>
        <div className="settings-grid">
          <div>
            <label className="fld">Name</label>
            <input
              placeholder="e.g. Nikita Rathod"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="fld">Email</label>
            <input
              placeholder="e.g. student@aaroh.in"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="fld">Password</label>
            <input
              placeholder="Password (min 6 characters)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <label className="fld">Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <button className="btn btn-violet" style={{ marginTop: 14 }} type="submit">
          Create account
        </button>
      </form>

      <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Tests</th>
              <th>Avg Score</th>
              <th>Streak</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const isSelf = u.id === currentUser?.id;
              const isPrimaryAdmin = u.email === 'ishwar@aaroh.in';
              return (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <Avatar name={u.name} color={u.avatar_color} size={32} />
                      <div>
                        <b>{u.name}</b>
                        {isSelf && (
                          <span className="tag" style={{ marginLeft: 6, fontSize: 11, background: 'var(--violet-soft)', color: 'var(--violet)' }}>
                            You
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`tag ${u.role === 'admin' ? 'gold' : ''}`}>
                      {u.role}
                    </span>
                  </td>
                  <td><b>{u.tests}</b></td>
                  <td>{u.avg_score ?? '—'}</td>
                  <td>{u.streak}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-violet"
                        title="View complete test results and analytics"
                        onClick={() => openPerformance(u)}
                      >
                        Performance
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm btn-line"
                        title="Edit name, email, role or reset password"
                        onClick={() => setEditing({ id: u.id, name: u.name, email: u.email, role: u.role, password: '' })}
                      >
                        Edit
                      </button>

                      {!isSelf && (
                        <button
                          type="button"
                          className="btn btn-sm btn-line"
                          onClick={() => role(u, u.role === 'student' ? 'admin' : 'student')}
                          title={u.role === 'student' ? 'Promote to Admin' : 'Demote to Student'}
                        >
                          {u.role === 'student' ? 'Make admin' : 'Make student'}
                        </button>
                      )}

                      {!isSelf && !isPrimaryAdmin && (
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

      {/* Student Performance & Test Results Modal */}
      {perfStudent && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(26, 22, 18, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div className="card" style={{ maxWidth: 840, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Avatar name={perfStudent.name} color={perfStudent.avatar_color} size={42} />
                <div>
                  <h2 style={{ margin: 0, fontSize: 20 }}>{perfStudent.name} — Performance & Analytics</h2>
                  <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
                    {perfStudent.email} · {perfStudent.role} · streak {perfStudent.streak}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-line"
                onClick={() => setPerfStudent(null)}
                style={{ padding: '4px 10px' }}
              >
                ✕ Close
              </button>
            </div>

            {loadingPerf ? (
              <Loading label="Analyzing student submissions…" />
            ) : !perfData ? (
              <p className="lead">Could not retrieve performance details.</p>
            ) : (
              <div>
                {/* KPI Metrics */}
                <div className="kpi-row" style={{ marginBottom: 18 }}>
                  <div className="kpi">
                    <div className="n">{perfData.stats.tests_taken}</div>
                    <div className="l">Tests Taken</div>
                  </div>
                  <div className="kpi">
                    <div className="n">{perfData.stats.avg_score}</div>
                    <div className="l">Average Score</div>
                  </div>
                  <div className="kpi">
                    <div className="n">{perfData.stats.best_score}</div>
                    <div className="l">Best Score</div>
                  </div>
                  <div className="kpi">
                    <div className="n">{perfData.stats.avg_accuracy}%</div>
                    <div className="l">Mean Accuracy</div>
                  </div>
                </div>

                {/* Subject Mastery Breakdown */}
                {perfData.subjects?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, marginBottom: 10 }}>Subject Breakdown & Accuracy</h3>
                    <div className="stack" style={{ gap: 8 }}>
                      {perfData.subjects.map((sub) => (
                        <div key={sub.subject} style={{ background: 'var(--surface-sunken)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
                            <b>{sub.subject}</b>
                            <span style={{ fontWeight: 700, color: sub.accuracy >= 70 ? 'var(--green, #1F9D6C)' : sub.accuracy < 50 ? 'var(--red, #E24B4A)' : 'var(--amber, #F0B429)' }}>
                              {sub.accuracy}% accuracy
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 12 }}>
                            <span>✓ {sub.correct} correct</span>
                            <span>✗ {sub.wrong} wrong</span>
                            <span>- {sub.skipped} skipped</span>
                            <span>Total questions: {sub.total}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submitted Tests List */}
                <h3 style={{ fontSize: 16, marginBottom: 10 }}>Submitted Test Papers</h3>
                {perfData.attempts?.length === 0 ? (
                  <p className="lead" style={{ fontSize: 14, color: 'var(--muted)' }}>
                    {perfStudent.name} has not submitted any tests yet.
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Paper</th>
                          <th>Score</th>
                          <th>Accuracy</th>
                          <th>Questions</th>
                          <th>Time</th>
                          <th>Submitted</th>
                          <th style={{ textAlign: 'right' }}>Review</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perfData.attempts.map((att) => (
                          <tr key={att.id}>
                            <td>
                              <b>{att.title}</b>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{att.code}</div>
                            </td>
                            <td>
                              <b>{att.score}</b> <span style={{ fontSize: 12, color: 'var(--muted)' }}>/ {att.max_score}</span>
                            </td>
                            <td>
                              <span className={`tag ${att.accuracy >= 70 ? 'green' : att.accuracy < 50 ? 'amber' : ''}`}>
                                {att.accuracy}%
                              </span>
                            </td>
                            <td style={{ fontSize: 12 }}>
                              <span style={{ color: 'var(--green, #1F9D6C)', fontWeight: 600 }}>{att.correct_count}✓</span>
                              {' · '}
                              <span style={{ color: 'var(--red, #E24B4A)', fontWeight: 600 }}>{att.wrong_count}✗</span>
                              {' · '}
                              <span style={{ color: 'var(--muted)' }}>{att.skipped_count}-</span>
                            </td>
                            <td style={{ fontSize: 12 }}>{Math.round((att.duration_sec || 0) / 60)}m</td>
                            <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                              {new Date(att.submitted_at).toLocaleDateString()}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="btn btn-sm btn-violet"
                                onClick={() => nav(`/app/result/${att.id}`)}
                              >
                                View Result
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(26, 22, 18, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div className="card" style={{ maxWidth: 460, width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Edit User Details</h3>
              <button
                type="button"
                className="btn btn-sm btn-line"
                onClick={() => setEditing(null)}
                style={{ padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveEdit} className="stack">
              <div>
                <label className="fld">Full Name</label>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="fld">Email Address</label>
                <input
                  type="email"
                  value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="fld">Role</label>
                <select
                  value={editing.role}
                  disabled={editing.id === currentUser?.id}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                >
                  <option value="student">Student</option>
                  <option value="admin">Admin</option>
                </select>
                {editing.id === currentUser?.id && (
                  <p className="hint-n" style={{ margin: '4px 0 0' }}>You cannot change your own role here.</p>
                )}
              </div>
              <div>
                <label className="fld">Set New Password</label>
                <input
                  type="password"
                  placeholder="Leave blank to keep existing password"
                  value={editing.password}
                  onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                  autoComplete="new-password"
                />
                <p className="hint-n" style={{ margin: '4px 0 0' }}>Type a new password (min 6 chars) to reset this user's password.</p>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
                <button type="button" className="btn btn-line" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-violet">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
