import { useMemo } from 'react'
import CalorieRing from '../CalorieRing'
import { useNutritionDay, useNutritionTargets, DEFAULT_TARGETS } from '../../hooks/useNutrition'
import { useLang } from '../../hooks/useLang'

// ── DayNutrition ─────────────────────────────────────────────────────────
// La comida de un día dentro de la hoja del calendario.
//
// Aquí se LEE, y para cambiar algo se salta a Nutrición ya abierta en ese día.
// No es pereza: el editor de comidas de verdad lleva micronutrientes,
// biblioteca de alimentos y escalado por porción — replicarlo dentro de una
// hoja significaría mantener dos editores que se van separando solos. Lo que
// faltaba no era un segundo editor, era poder VER el día y llegar al bueno.
export default function DayNutrition({ dateISO, onNavigate }) {
  const { t, locale } = useLang()
  const { entries, loading } = useNutritionDay(dateISO)
  const { targets } = useNutritionTargets()

  const goal = targets || DEFAULT_TARGETS

  const totals = useMemo(() => {
    const sum = (k) => entries.reduce((acc, e) => acc + (Number(e[k]) || 0), 0)
    return {
      kcal: sum('kcal'),
      protein: sum('protein_g'),
      carbs: sum('carbs_g'),
      fat: sum('fat_g'),
    }
  }, [entries])

  const fmt = (n) => Math.round(n).toLocaleString(locale)
  const registrado = entries.length > 0
  const restante = Math.round((Number(goal.kcal) || 0) - totals.kcal)

  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
        <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em' }}>
          {t('Comida')}
        </p>
        <button
          onClick={onNavigate}
          style={{
            fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
            letterSpacing: '-0.01em', color: 'var(--c-action-text)',
            background: 'transparent', minHeight: '32px',
          }}
        >
          {registrado ? t('Editar') : t('Añadir')}
        </button>
      </div>

      <button
        onClick={onNavigate}
        style={{
          width: '100%', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: '13px',
          background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)',
          borderRadius: 'var(--r-sm)', padding: '12px',
        }}
      >
        <CalorieRing
          size={88}
          kcal={Math.round(totals.kcal)}
          target={Math.round(Number(goal.kcal) || 0)}
          protein={totals.protein}
          carbs={totals.carbs}
          fat={totals.fat}
        />

        <span style={{ minWidth: 0, flex: 1 }}>
          {loading ? (
            <span style={{ color: 'var(--c-text-muted)', fontSize: '12px' }}>{t('Cargando...')}</span>
          ) : !registrado ? (
            <>
              <span style={{ display: 'block', color: 'var(--c-text)', fontSize: '13px', fontWeight: 700 }}>
                {t('Sin comidas registradas')}
              </span>
              <span style={{ display: 'block', color: 'var(--c-text-muted)', fontSize: '10.5px', marginTop: '3px' }}>
                {t('Toca para añadir')}
              </span>
            </>
          ) : (
            <>
              {/* El anillo ya lleva dentro el total y el objetivo. Aquí va lo
                  que el anillo NO puede decir: cuánto queda —el número con el
                  que se decide la siguiente comida— y el desglose de macros. */}
              <span className="tnum" style={{
                display: 'block', fontFamily: 'var(--font-sans)', fontSize: '14px',
                fontWeight: 900, letterSpacing: '-0.025em',
                color: restante < 0 ? 'var(--c-action-text)' : 'var(--c-text)',
              }}>
                {restante < 0
                  ? `${fmt(Math.abs(restante))} kcal ${t('de más')}`
                  : `${fmt(restante)} kcal ${t('restantes')}`}
              </span>
              <span className="tnum" style={{
                display: 'block', fontFamily: 'var(--font-sans)', fontSize: '10.5px',
                color: 'var(--c-text-muted)', marginTop: '4px',
              }}>
                P {fmt(totals.protein)} · C {fmt(totals.carbs)} · G {fmt(totals.fat)}
              </span>
            </>
          )}
        </span>
      </button>

      {/* Qué se comió, no solo cuánto. Un total sin desglose no deja corregir
          nada: para saber si sobra algo hay que ver los nombres. */}
      {registrado && (
        <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
          {entries.map(e => (
            <li
              key={e.id}
              style={{
                display: 'flex', alignItems: 'baseline', gap: '8px',
                padding: '5px 12px',
              }}
            >
              <span style={{
                minWidth: 0, flex: 1, color: 'var(--c-text-dim)', fontSize: '11.5px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {e.name}
              </span>
              <span className="tnum" style={{
                flexShrink: 0, fontFamily: 'var(--font-sans)', fontSize: '11px',
                fontWeight: 700, color: 'var(--c-text-muted)',
              }}>
                {fmt(e.kcal)} kcal
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
