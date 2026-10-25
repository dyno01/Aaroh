import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp, Users, BookOpen, Award, CheckCircle2, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { Loading, PageHead, Empty } from '../../components/ui.jsx';

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    api('/api/admin/analytics')
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setData(null);
        setLoading(false);
      });
  }, []);

  if (loading) return <Loading label="Calculating student metrics…" />;
  if (!data) return <Empty title="Failed to load analytics" text="Could not fetch metrics from server." />;

  const { summary, students, recentAttempts, examsSummary } = data;

  return (
    <div className="rise">
      <PageHead
        kicker="Coach Desk · Analytics"
        title="Student Performance & Test Results"
        lead="Comprehensive overview of student accuracy, mock test attempts, and individual test submissions."
      />

      <div className="kpi-row" style={{ marginTop: 16 }}>
        <div className="kpi">
          <div className="n">{summary.total_students}</div>
          <div className="l">Active Students</div>
        </div>
        <div className="kpi">
          <div className="n">{summary.total_attempts}</div>
          <div className="l">Tests Submitted</div>
        </div>
        <div className="kpi">
          <div className="n">{summary.avg_accuracy}%</div>
          <div className="l">Mean Accuracy</div>
        </div>
        <div className="kpi">
          <div className="n">{summary.avg_score}</div>
          <div className="l">Average Score</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 16 }}>
        {/* Student Directory & Quick Performance Links */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} color="var(--violet)" /> Students Directory
            </h3>
            <button className="btn btn-sm btn-line" onClick={() => nav('/app/admin/students')}>
              Manage People
            </button>
          </div>

          {students.length === 0 ? (
            <p className="lead">No students registered yet.</p>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {students.map((st) => (
                <div
                  key={st.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'var(--surface-sunken)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{st.name}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>{st.email} · streak {st.streak}</div>
                  </div>
                  <button
                    className="btn btn-sm btn-violet"
                    onClick={() => nav(`/app/admin/students?studentId=${st.id}`)}
                  >
                    View Performance
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Paper Completion Summary */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={18} color="var(--amber)" /> Papers Overview
            </h3>
            <button className="btn btn-sm btn-line" onClick={() => nav('/app/admin/exams')}>
              All Papers
            </button>
          </div>

          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Paper</th>
                  <th>Attempts</th>
                  <th>Avg Score</th>
                  <th>Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {examsSummary.slice(0, 8).map((ex) => (
                  <tr key={ex.id}>
                    <td>
                      <b>{ex.title}</b>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{ex.code}</div>
                    </td>
                    <td>{ex.attempts_count}</td>
                    <td>{ex.avg_score ?? '—'}</td>
                    <td>{ex.avg_accuracy ? `${ex.avg_accuracy}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Test Submissions with Direct Result Links */}
      <div className="card" style={{ marginTop: 18, overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0 }}>Recent Test Submissions</h3>
            <p className="lead" style={{ margin: '4px 0 0', fontSize: 13 }}>
              Click "View Result" on any submission to review the student's full question-by-question paper.
            </p>
          </div>
        </div>

        {recentAttempts.length === 0 ? (
          <p className="lead">No submitted tests yet. When students sit mocks, results will appear here in real time.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Paper</th>
                <th>Score</th>
                <th>Accuracy</th>
                <th>Correct / Wrong</th>
                <th>Time & Hints</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentAttempts.map((att) => (
                <tr key={att.id}>
                  <td>
                    <b>{att.student_name}</b>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{att.student_email}</div>
                  </td>
                  <td>
                    <b>{att.exam_title}</b>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{att.exam_code}</div>
                  </td>
                  <td>
                    <b>{att.score}</b> <span style={{ color: 'var(--muted)', fontSize: 12 }}>/ {att.max_score}</span>
                  </td>
                  <td>
                    <span className={`tag ${att.accuracy >= 70 ? 'green' : att.accuracy < 50 ? 'amber' : ''}`}>
                      {att.accuracy}%
                    </span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--green, #1F9D6C)', fontWeight: 600 }}>{att.correct_count}✓</span>
                    {' · '}
                    <span style={{ color: 'var(--red, #E24B4A)', fontWeight: 600 }}>{att.wrong_count}✗</span>
                    {' · '}
                    <span style={{ color: 'var(--muted)' }}>{att.skipped_count} skipped</span>
                  </td>
                  <td>
                    <div>{Math.round((att.duration_sec || 0) / 60)} min</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{att.hints_used || 0} hints</div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {att.submitted_at ? new Date(att.submitted_at).toLocaleDateString() : '—'}
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
        )}
      </div>
    </div>
  );
}
