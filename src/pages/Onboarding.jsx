import { useState } from 'react'
import { Button } from '../components/ui'
import { useProfile } from '../hooks/useProfile'
import { useLang } from '../hooks/useLang'
import { ERROR_STYLE } from '../lib/ui'

/*
 * La primera vez.
 *
 * Antes, tras el código beta se caía en Inicio sin nada: el saludo sin nombre,
 * los ejercicios naciendo en libras en una app es-CO, y las barras de nutrición
 * midiéndose contra una meta inventada de 2500 kcal. Todo eso tenía un aviso
 * en su pantalla, pero repartido en tres sitios que hay que descubrir.
 *
 * Tres preguntas y una pantalla. No cuatro pasos con barra de progreso: son
 * tres datos, no un formulario de alta, y cada paso extra es una salida más.
 *
 * Lo que NO se pregunta aquí, a propósito: peso, altura, grasa corporal, días
 * por semana. Hacen falta para la recomendación de macros, pero pedirlos ahora
 * convierte la puerta de entrada en un interrogatorio — y esa pantalla ya
 * existe, sabe explicar para qué es cada dato, y avisa cuando falta algo.
 *
 * Se puede saltar. Alguien que quiere ver la app antes de darle sus datos
 * tiene razón, y forzarlo solo consigue un perfil con el nombre "asdf".
 */
export default function Onboarding({ onDone }) {
  const { t } = useLang()
  const { saveProfile, saving, saveError } = useProfile()
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('kg')
  const [goal, setGoal] = useState('Ganar músculo')

  const GOALS = ['Ganar músculo', 'Perder grasa', 'Fuerza', 'Resistencia', 'Mantener']

  const guardar = async () => {
    const limpio = name.trim()
    const ok = await saveProfile({
      ...(limpio ? { name: limpio } : {}),
      weight_unit: unit,
      goal,
    })
    // Sin guardado no hay despedida: cerrar con el save fallido perdía nombre,
    // unidad y objetivo en silencio Y sellaba el skip — el onboarding no
    // volvía a aparecer en este dispositivo. El error queda a la vista y se
    // puede reintentar (o salir con «Ahora no», que sí es una decisión).
    if (!ok) return
    onDone?.()
  }

  return (
    <div className="min-h-dvh" style={{ background: 'var(--c-bg)' }}>
      <div className="fade-in" style={{
        maxWidth: '420px', margin: '0 auto', width: '100%',
        padding: '56px 24px calc(32px + env(safe-area-inset-bottom))',
        display: 'flex', flexDirection: 'column', minHeight: '100dvh',
      }}>
        <p style={{
          fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 800,
          letterSpacing: '-0.01em', color: 'var(--c-text-dim)', marginBottom: '10px',
        }}>
          RAW
        </p>
        <h1 style={{
          color: 'var(--c-text)', fontSize: '28px', fontWeight: 900,
          letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '8px',
        }}>
          {t('Tres cosas y entramos')}
        </h1>
        <p style={{
          color: 'var(--c-text-muted)', fontSize: '13px', lineHeight: 1.5,
          marginBottom: '32px',
        }}>
          {t('Se cambian luego en Perfil, cuando quieras.')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', flex: 1 }}>
          <div>
            <label
              htmlFor="onb-name"
              style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text-dim)', marginBottom: '8px' }}
            >
              {t('¿Cómo te llamas?')}
            </label>
            <input
              id="onb-name"
              className="input-field"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('Tu nombre')}
              autoFocus
              autoComplete="given-name"
            />
          </div>

          <div>
            <span
              id="onb-unit-label"
              style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text-dim)', marginBottom: '8px' }}
            >
              {t('¿En qué unidad levantas?')}
            </span>
            {/* Manda la unidad con la que arranca cada ejercicio nuevo, así que
                preguntarla aquí ahorra el toque de cambiarla en cada uno. */}
            <div role="radiogroup" aria-labelledby="onb-unit-label" style={{ display: 'flex', gap: '8px' }}>
              {['kg', 'lb'].map(u => {
                const on = unit === u
                return (
                  <button
                    key={u}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setUnit(u)}
                    style={{
                      flex: 1, minHeight: '52px', borderRadius: 'var(--r-md)',
                      fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em',
                      border: `1px solid ${on ? 'var(--c-accent)' : 'var(--c-border)'}`,
                      background: on ? 'var(--c-accent-dim)' : 'var(--c-surface-2)',
                      color: on ? 'var(--c-action-text)' : 'var(--c-text-dim)',
                      transition: 'all 150ms var(--ease-out)',
                    }}
                  >
                    {u}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <span
              id="onb-goal-label"
              style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text-dim)', marginBottom: '8px' }}
            >
              {t('¿A qué vas?')}
            </span>
            <div role="radiogroup" aria-labelledby="onb-goal-label" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {GOALS.map(g => {
                const on = goal === g
                return (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setGoal(g)}
                    style={{
                      minHeight: '44px', padding: '10px 16px', borderRadius: '999px',
                      fontSize: '13px', fontWeight: 700,
                      border: `1px solid ${on ? 'var(--c-accent)' : 'var(--c-border)'}`,
                      background: on ? 'var(--c-accent-dim)' : 'var(--c-surface-2)',
                      color: on ? 'var(--c-action-text)' : 'var(--c-text-dim)',
                      transition: 'all 150ms var(--ease-out)',
                    }}
                  >
                    {t(g)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {saveError && <div style={{ ...ERROR_STYLE, marginTop: '20px' }}>{saveError}</div>}

        <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Button onClick={guardar} disabled={saving} full>
            {saving ? t('Guardando…') : t('Empezar')}
          </Button>
          <button
            type="button"
            onClick={onDone}
            disabled={saving}
            style={{
              minHeight: '44px', background: 'transparent',
              color: 'var(--c-text-muted)', fontSize: '12px', fontWeight: 700,
            }}
          >
            {t('Ahora no')}
          </button>
        </div>
      </div>
    </div>
  )
}
