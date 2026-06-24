import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useBetaGate } from '../hooks/useBetaGate'
import { pressProps, ERROR_STYLE } from '../lib/ui'
import { Button } from '../components/ui'

// Pantalla de acceso durante la beta: pide el código compartido.
// Se muestra a cualquier usuario autenticado que aún no esté aprobado.
export default function BetaGate() {
  const { user, signOut } = useAuth()
  const { redeemCode, redeeming } = useBetaGate()
  const [code, setCode] = useState('')
  const [localError, setLocalError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError(null)
    try {
      await redeemCode(code)
      // Al aprobarse, recargamos para entrar a la app ya con acceso completo.
      window.location.assign('/')
    } catch (err) {
      setLocalError(err.message)
    }
  }

  return (
    <div className="min-h-dvh bg-background" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="fade-in" style={{ width: '100%', maxWidth: '360px' }}>

        {/* Wordmark */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '40px', letterSpacing: '0.02em', color: 'var(--c-action-text)' }}>RAW</span>
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: '4px' }}>
            Acceso beta
          </p>
        </div>

        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h1 style={{ color: 'var(--c-text)', fontSize: '17px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
            Ingresa tu código
          </h1>
          <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', lineHeight: 1.5, marginBottom: '20px' }}>
            La app está en beta cerrada. Ingresa el código de acceso que te compartieron para continuar.
          </p>

          {localError && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError}</div>}

          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="Código beta"
              autoFocus
              className="input-field"
              style={{ textAlign: 'center', letterSpacing: '0.14em', fontWeight: 700, fontSize: '15px', marginBottom: '14px' }}
            />
            <Button
              type="submit"
              variant="primary"
              full
              size="lg"
              disabled={redeeming || !code.trim()}
            >
              {redeeming ? 'Verificando...' : 'Entrar'}
            </Button>
          </form>
        </div>

        {/* Pie: sesión actual + salir */}
        <div style={{ textAlign: 'center', marginTop: '18px' }}>
          <p style={{ color: 'var(--c-text-ghost)', fontSize: '11px', marginBottom: '8px' }}>{user?.email}</p>
          <button
            onClick={signOut}
            style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
