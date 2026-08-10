import { useMemo, useState } from 'react'
import CalorieRing from '../CalorieRing'
import EntrySheet from '../nutrition/EntrySheet'
import { useNutritionDay, useNutritionTargets, useMyFoods, DEFAULT_TARGETS } from '../../hooks/useNutrition'
import { useLang } from '../../hooks/useLang'

// ── DayNutrition ─────────────────────────────────────────────────────────
// La comida de un día dentro de la hoja del calendario.
//
// Se edita aquí mismo, con el MISMO editor que la pantalla de Nutrición —
// micronutrientes, biblioteca de alimentos y escalado por porción incluidos.
// Un segundo editor más simple para el día habría sido garantizar que los dos
// se separan solos: alguien arregla un redondeo en uno y no en el otro, y la
// misma comida sale distinta según por dónde la registres.
export default function DayNutrition({ dateISO, onNavigate }) {
  const { t, locale } = useLang()
  const { entries, loading, addEntry, updateEntry, deleteEntry } = useNutritionDay(dateISO)
  const { targets } = useNutritionTargets()
  const { foods, saveFood } = useMyFoods()

  // { entry } al editar una que ya existe, {} al añadir una nueva.
  const [sheet, setSheet] = useState(null)

  const save = async (fields, food) => {
    if (sheet?.entry) {
      await updateEntry(sheet.entry.id, fields)
    } else {
      await addEntry(fields)
      // La biblioteca personal se actualiza en segundo plano: si falla, la
      // comida del día ya quedó guardada, que es lo que importaba.
      if (food) saveFood(food).catch(err => console.error('Error guardando comida en biblioteca:', err))
    }
    setSheet(null)
  }

  const remove = async (id) => {
    await deleteEntry(id)
    setSheet(null)
  }

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
          onClick={() => setSheet({})}
          style={{
            fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
            letterSpacing: '-0.01em', color: 'var(--c-action-text)',
            background: 'transparent', minHeight: '32px',
          }}
        >
          {t('Añadir comida')}
        </button>
      </div>

      <button
        onClick={registrado ? onNavigate : () => setSheet({})}
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
          nada: para saber si sobra algo hay que ver los nombres — y tocar uno
          lo abre para cambiarlo, que era lo que faltaba. */}
      {registrado && (
        <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
          {entries.map(e => (
            <li key={e.id}>
              <button
                onClick={() => setSheet({ entry: e })}
                aria-label={`${t('Editar')}: ${e.name}`}
                style={{
                  width: '100%', textAlign: 'left',
                  display: 'flex', alignItems: 'baseline', gap: '8px',
                  padding: '9px 12px', minHeight: '44px',
                  background: 'transparent', border: 'none',
                }}
              >
                <span style={{
                  minWidth: 0, flex: 1, color: 'var(--c-text-dim)', fontSize: '12px',
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
              </button>
            </li>
          ))}
        </ul>
      )}

      {sheet && (
        <EntrySheet
          initial={sheet.entry}
          foods={foods}
          onSave={save}
          onDelete={remove}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
