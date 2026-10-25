import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart3, Clock, CheckCircle2, XCircle, Award, ArrowRight, X, BookOpen, Lightbulb, User, Target, Percent } from 'lucide-react';
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

      {/* Student Performance & Test Results Modal using createPortal so it attaches directly to body */}
      {perfStudent && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 12, 10, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '24px 16px'
          }}
          onClick={() => setPerfStudent(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: 880,
              width: '100%',
              maxHeight: '88vh',
              overflowY: 'auto',
              borderRadius: 22,
              background: 'var(--paper, #FFFFFF)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
              padding: 28,
              border: '1px solid rgba(255,255,255,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <Avatar name={perfStudent.name} color={perfStudent.avatar_color} size={46} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h2 style={{ margin: 0, fontSize: 22 }}>{perfStudent.name}</h2>
                    <span className={`tag ${perfStudent.role === 'admin' ? 'gold' : ''}`} style={{ fontSize: 11, textTransform: 'capitalize' }}>
                      {perfStudent.role}
                    </span>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                    {perfStudent.email} · Streak {perfStudent.streak} days
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-line"
                onClick={() => setPerfStudent(null)}
                style={{
                  width: 32,
                  height: 32,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%'
                }}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {loadingPerf ? (
              <Loading label="Analyzing student submissions…" />
            ) : !perfData ? (
              <p className="lead">Could not retrieve performance details.</p>
            ) : (
              <div>
                {/* KPI Metrics */}
                <div className="admin-grid" style={{ marginBottom: 22 }}>
                  <div className="kpi" style={{ background: '#FAF7F2', borderRadius: 16, padding: '14px 18px' }}>
                    <div className="n" style={{ fontSize: 28 }}>{perfData.stats.tests_taken}</div>
                    <div className="l" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <BookOpen size={13} color="var(--muted)" /> Tests Taken
                    </div>
                  </div>
                  <div className="kpi" style={{ background: '#FAF7F2', borderRadius: 16, padding: '14px 18px' }}>
                    <div className="n" style={{ fontSize: 28 }}>{perfData.stats.avg_score}</div>
                    <div className="l" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Target size={13} color="var(--muted)" /> Average Score
                    </div>
                  </div>
                  <div className="kpi" style={{ background: '#FAF7F2', borderRadius: 16, padding: '14px 18px' }}>
                    <div className="n" style={{ fontSize: 28 }}>{perfData.stats.best_score}</div>
                    <div className="l" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Award size={13} color="var(--muted)" /> Best Score
                    </div>
                  </div>
                  <div className="kpi" style={{ background: '#FAF7F2', borderRadius: 16, padding: '14px 18px' }}>
                    <div className="n" style={{ fontSize: 28 }}>{perfData.stats.avg_accuracy}%</div>
                    <div className="l" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Percent size={13} color="var(--muted)" /> Mean Accuracy
                    </div>
                  </div>
                </div>

                {/* Subject Mastery Breakdown */}
                {perfData.subjects?.length > 0 && (
                  <div style={{ marginBottom: 22 }}>
                    <h3 style={{ fontSize: 16, margin: '0 0 12px' }}>Subject Breakdown & Accuracy</h3>
                    <div className="stack" style={{ gap: 10 }}>
                      {perfData.subjects.map((sub) => (
                        <div key={sub.subject} style={{ background: '#FAF7F2', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
                            <b>{sub.subject}</b>
                            <span style={{ fontWeight: 700, color: sub.accuracy >= 70 ? 'var(--green, #1F9D6C)' : sub.accuracy < 50 ? 'var(--red, #E24B4A)' : 'var(--amber, #F0B429)' }}>
                              {sub.accuracy}% accuracy
                            </span>
                          </div>
                          {/* Visual progress bar */}
                          <div style={{ height: 6, background: '#EAE3D6', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${Math.min(100, Math.max(0, sub.accuracy))}%`,
                                background: sub.accuracy >= 70 ? '#1F9D6C' : sub.accuracy < 50 ? '#E24B4A' : '#F0B429',
                                borderRadius: 999
                              }}
                            />
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 14 }}>
                            <span style={{ color: '#1F9D6C', fontWeight: 600 }}>✓ {sub.correct} correct</span>
                            <span style={{ color: '#E24B4A', fontWeight: 600 }}>✗ {sub.wrong} wrong</span>
                            <span>- {sub.skipped} skipped</span>
                            <span>Total questions: {sub.total}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submitted Tests List */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 16, margin: 0 }}>Submitted Test Papers</h3>
                  {perfData.attempts?.length > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{perfData.attempts.length} papers recorded</span>
                  )}
                </div>

                {perfData.attempts?.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '36px 20px',
                    background: '#FAF7F2',
                    borderRadius: 16,
                    border: '1.5px dashed var(--border)',
                    marginTop: 6
                  }}>
                    <div style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      background: '#EFE8DC',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12
                    }}>
                      <BookOpen size={24} color="#8A8378" />
                    </div>
                    <h4 style={{ margin: '0 0 6px', fontSize: 16 }}>No test papers submitted yet</h4>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
                      {perfStudent.name} hasn't taken any tests yet. When they sit for a paper, question accuracy breakdowns, hint lifelines used, and question reviews will appear here.
                    </p>
                    <div style={{ marginTop: 18, display: 'flex', gap: 10, justifyContent: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-line"
                        onClick={() => {
                          setPerfStudent(null);
                          nav('/app/tests');
                        }}
                      >
                        View Question Bank
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 14 }}>
                    <table className="table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Paper</th>
                          <th>Score</th>
                          <th>Accuracy</th>
                          <th>Breakdown</th>
                          <th>Lifelines</th>
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
                              <span className={`tag ${att.accuracy >= 70 ? 'green' : att.accuracy < 50 ? 'amber' : ''}`} style={{ fontWeight: 700 }}>
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
                            <td>
                              <span style={{ fontSize: 12, color: att.hints_used > 0 ? '#9A6B00' : 'var(--muted)', fontWeight: att.hints_used > 0 ? 600 : 400 }}>
                                💡 {att.hints_used || 0}
                              </span>
                            </td>
                            <td style={{ fontSize: 12 }}>{Math.round((att.duration_sec || 0) / 60)}m</td>
                            <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                              {new Date(att.submitted_at).toLocaleDateString()}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="btn btn-sm btn-violet"
                                onClick={() => nav(`/app/result/${att.id}`)}
                                title="Review student answers and question explanations"
                              >
                                Review Sheet
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
        </div>,
        document.body
      )}

      {/* Edit User Modal using createPortal so it attaches directly to body */}
      {editing && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 12, 10, 0.72)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: 16
          }}
          onClick={() => setEditing(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: 480,
              width: '100%',
              borderRadius: 20,
              background: 'var(--paper, #FFFFFF)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
              padding: 24
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Edit User Account</h3>
              <button
                type="button"
                className="btn btn-sm btn-line"
                onClick={() => setEditing(null)}
                style={{
                  width: 30,
                  height: 30,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%'
                }}
              >
                <X size={15} />
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
        </div>,
        document.body
      )}
    </div>
  );
}
