import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Radio, Upload, Timer, BarChart3, Shield } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';

export default function Landing() {
  const { user } = useAuth();
  const hall = user?.role === 'admin' ? '/app/admin' : '/app';
  return (
    <div className="land">
      <nav className="land-nav">
        <div className="brand"><div className="brand-mark">A</div> Aaroh</div>
        <div className="links">
          <a href="#exams">Exams</a>
          <a href="#features">Why Aaroh</a>
          {user ? <Link to={hall}>Open hall</Link> : <Link to="/login">Sign in</Link>}
        </div>
        {user
          ? <Link to={hall} className="btn btn-amber btn-sm">Continue as {(user.name || 'you').split(' ')[0]} <ArrowRight size={16} /></Link>
          : <Link to="/register" className="btn btn-amber btn-sm">Create account <ArrowRight size={16} /></Link>}
      </nav>

      <header className="hero">
        <div>
          <div className="kicker"><Sparkles size={14} /> Built for IBPS SO IT · SEBI & NABARD next</div>
          <h1>Mock tests that feel like the <em>real hall.</em></h1>
          <p className="lead">
            Subject drills, full papers, and high-influence PK mocks — with a coach desk that can change hints, extra time and permissions while you are still writing.
          </p>
          <div className="hero-cta">
            {user ? (
              <Link to={hall} className="btn btn-amber">Go to your hall <ArrowRight size={18} /></Link>
            ) : (
              <>
                <Link to="/register" className="btn btn-amber">Start free practice <ArrowRight size={18} /></Link>
                <Link to="/login" className="btn btn-ghost">I already have a seat</Link>
              </>
            )}
          </div>
          <div className="hero-stats">
            <div><b>IBPS SO IT</b><span>Live question bank</span></div>
            <div><b>3 modes</b><span>Subject · Full · High influence</span></div>
            <div><b>Live coach</b><span>Hints & permissions, no restart</span></div>
          </div>
        </div>
        <div className="phone-wrap">
          <div className="phone">
            <div className="phone-date">Sunday, 25 Oct</div>
            <h2>Hello, Nikita</h2>
            <div className="note">
              <span style={{ color: '#1B9468' }}>●</span>
              Your last two answers started with background. I moved <b>answer first</b> to the top.
            </div>
            <div className="pick">
              <div className="eyebrow">Coach’s pick · about 18 min</div>
              <h3>High influence: DBMS + Networks + OS</h3>
              <p>Scenario · the three subjects that make the IBPS SO IT merit.</p>
              <div className="pick-actions"><span>Why this?</span><span>Swap</span><span>Easier</span><span>Later</span></div>
              <button className="btn btn-amber btn-block">Start</button>
            </div>
            <div className="plan">
              <div className="plan-top">Today’s plan <span>about 42 min</span></div>
              <div className="bars">
                {[['Warm-up', '70%'], ['DBMS', '40%'], ['Full mock', '0%'], ['Cards', '20%']].map(([l, w]) => (
                  <div className="bar" key={l}>
                    <div className="track"><div className="fill" style={{ width: w }} /></div>
                    <label>{l}</label>
                  </div>
                ))}
              </div>
            </div>
            <div className="mini-dock">
              <div className="it active"><span>Home</span></div>
              <div className="it">Path</div>
              <div className="it"><div className="go">⚡</div>Attempt</div>
              <div className="it">Tests</div>
              <div className="it">You</div>
            </div>
          </div>
        </div>
      </header>

      <section className="section" id="exams">
        <h2>One desk. Three careers.</h2>
        <p className="sub">IBPS SO IT is live. SEBI Grade A and NABARD Grade A unlock the day you import their banks.</p>
        <div className="cards-3">
          {[
            ['IBPS SO IT Officer', 'Live', 'Prelims 100Q / Mains PK. DBMS, Networks and OS treated as first-class papers — not an afterthought chapter.'],
            ['SEBI Grade A', 'Coming soon', 'Phase 1 & 2. Import a CSV tonight and the paper appears for students without a deploy.'],
            ['NABARD Grade A', 'Coming soon', 'ESI, ARD, Decision Making. Same CBT, same live coach controls, same analytics.']
          ].map(([t, s, d]) => (
            <div className="exam-card-land" key={t}>
              <span className={`pill ${s === 'Live' ? 'live' : ''}`}>{s}</span>
              <h3>{t}</h3>
              <p style={{ color: '#B7B0A5', fontSize: 14, lineHeight: 1.5 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="features">
        <h2>What Oliveboard doesn’t let a coach do.</h2>
        <p className="sub">Aaroh is built like a hall with a control room behind the glass.</p>
        <div className="cards-3">
          {[
            [Radio, 'Live permissions', 'Change hint caps, extra minutes, calculator, bilingual, pause — while the student is still on Q.14. No restart.'],
            [Upload, 'Import any paper', 'CSV or JSON. Code, options, hints, negative marks. Preview, then commit. SEBI and NABARD land the same way.'],
            [Timer, 'Hall-true CBT', 'Palette, mark for review, sectional jump, autosave, negative marking, keyboard 1–4 / N / P / H / M.'],
            [BarChart3, 'After the bell', 'Subject accuracy, time per question, rank on that paper, and a path that points at the next high-influence drill.'],
            [Shield, 'Hints with a leash', 'Each paper has a hint budget. Students spend it. You can raise or freeze it in realtime.'],
            [Sparkles, 'Three test shapes', 'Subject-wise · full mock · high-influence full papers for DBMS, Networks, OS and the mix that actually makes merit.']
          ].map(([Icon, t, d]) => (
            <div className="feature" key={t}>
              <div className="ico"><Icon size={18} /></div>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="land-foot">
        <span>Aaroh · the ascent through every mock.</span>
        <span>Dedicated test hall for competitive aspirants</span>
      </footer>
    </div>
  );
}
