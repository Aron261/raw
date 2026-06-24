import { Component } from 'react'

// App-wide safety net. Without this, any render-time error unmounts the whole
// tree and leaves a blank white screen with no clue. This catches it, logs it,
// and shows a readable, on-brand recovery card with the actual error detail.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('UI crash caught by ErrorBoundary:', error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div style={{ minHeight: '100dvh', background: 'var(--c-bg)', color: 'var(--c-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '420px', width: '100%', background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '16px', padding: '24px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-action-text)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
            Algo se rompió
          </p>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '10px' }}>
            Esta pantalla tuvo un error
          </h1>
          <p style={{ color: 'var(--c-text-muted)', fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
            Puedes recargar o volver al inicio. Si vuelve a pasar, este es el detalle:
          </p>
          <pre style={{
            background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)', borderRadius: '10px',
            padding: '12px', fontSize: '11px', color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '160px', overflow: 'auto', marginBottom: '16px',
          }}>
            {String(error?.message || error)}
          </pre>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => window.location.reload()}
              style={{ flex: 1, background: 'var(--c-action)', color: 'var(--c-on-action)', border: 'none', borderRadius: '12px', padding: '13px', fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}
            >
              Recargar
            </button>
            <button
              onClick={() => { window.location.href = '/' }}
              style={{ flex: 1, background: 'var(--c-surface-2)', color: 'var(--c-text)', border: '1px solid var(--c-border)', borderRadius: '12px', padding: '13px', fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}
            >
              Inicio
            </button>
          </div>
        </div>
      </div>
    )
  }
}
