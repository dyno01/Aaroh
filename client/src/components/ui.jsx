import React from 'react';

export function PageHead({ kicker, title, lead, children }) {
  return (
    <div className="page-head">
      <div>
        {kicker && <p className="date-k">{kicker}</p>}
        <h1 className="hello">{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </div>
  );
}

export function Empty({ icon: Icon, title, text, children }) {
  return (
    <div className="card empty-card">
      {Icon && <div className="ico"><Icon size={18} /></div>}
      {title && <h3>{title}</h3>}
      <p>{text}</p>
      {children}
    </div>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="rise">
      <div className="skeleton" style={{ width: 180, height: 14, marginBottom: 10 }} />
      <div className="skeleton" style={{ width: 280, height: 36, marginBottom: 18 }} />
      <div className="admin-grid">
        {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 88, borderRadius: 18 }} />)}
      </div>
      <p className="lead">{label}</p>
    </div>
  );
}

export function Avatar({ name, color, size = 44 }) {
  return (
    <div className="avatar" style={{ background: color || '#5B45EA', width: size, height: size, fontSize: size * 0.36 }}>
      {(name || 'A')[0].toUpperCase()}
    </div>
  );
}
