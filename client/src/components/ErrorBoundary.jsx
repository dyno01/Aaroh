import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err, info) {
    console.error('Aaroh crashed', err, info);
  }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', background: '#110f0d', color: '#F6F1E8', fontFamily: 'system-ui', padding: 40 }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: '#2a2520', display: 'grid', placeItems: 'center', fontWeight: 800, marginBottom: 16 }}>A</div>
        <h1 style={{ fontSize: 28, margin: '0 0 8px' }}>Aaroh hit a snag</h1>
        <p style={{ color: '#C9C2B6' }}>{this.state.err.message || String(this.state.err)}</p>
        <button
          onClick={() => { this.setState({ err: null }); window.location.href = '/'; }}
          style={{ marginTop: 16, background: '#F0B429', border: 0, borderRadius: 999, padding: '12px 18px', fontWeight: 700, cursor: 'pointer' }}
        >
          Reload Aaroh
        </button>
      </div>
    );
  }
}
