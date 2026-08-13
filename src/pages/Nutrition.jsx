import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { Button, PageHeader, LiveRegion, UndoSnackbar, Toast } from '../components/ui'
import CalorieRing from '../components/CalorieRing'
import MacroLegend from '../components/MacroLegend'
import MicroGrid from '../components/MicroGrid'
import NutritionTargetsSheet from '../components/NutritionTargetsSheet'
import NutritionMicrosSheet from '../components/NutritionMicrosSheet'
import EntrySheet from '../components/nutrition/EntrySheet'
import { useUndoableDelete } from '../hooks/useUndoableDelete'
import { ERROR_STYLE } from '../lib/ui'
import { useClientDetail } from '../hooks/useClientDetail'
import { useProfile } from '../hooks/useProfile'
import { useLang } from '../hooks/useLang'
import {
  useNutritionDay, useNutritionTargets, useMyFoods, totalsOf,
  toLocalISODate, MEALS, DEFAULT_TARGETS,
} from '../hooks/useNutrition'

// ── Fecha helpers ────────────────────────────────────────────────────────
function shiftISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return toLocalISODate(date)
}

function labelForISO(iso, t = (x) => x, locale = 'es-CO') {
  const today = toLocalISODate()
  if (iso === today) return t('Hoy')
  if (iso === shiftISO(today, -1)) return t('Ayer')
  const [y, m, d] = iso.split('-').map(Number)
  const s = new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const fmt = (n, locale = 'es-CO') => Math.round(n).toLocaleString(locale)

// Los botones de día: fantasma dentro de la tarjeta del resumen, no dos
// superficies elevadas propias compitiendo con ella.
const dayNavBtn = (disabled) => ({
  width: '36px', height: '36px', flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: disabled ? 'var(--c-text-ghost)' : 'var(--c-text-dim)',
  fontSize: '17px', background: 'transparent', border: 'none',
  borderRadius: '999px', opacity: disabled ? 0.5 : 1,
  cursor: disabled ? 'default' : 'pointer',
})

// ── Nutrition ────────────────────────────────────────────────────────────
// Vista propia por defecto; un entrenador pasa userId + readOnly para ver el
// registro de ese cliente (solo lectura) y planificar sus objetivos.
export default function Nutrition({ userId = null, readOnly = false }) {
  const { t, locale } = useLang()
  const navigate = useNavigate()
  const today = toLocalISODate()
  // ?d=YYYY-MM-DD abre directamente ese día. Es lo que deja que «editar la
  // comida» desde la hoja del calendario caiga en el día que estabas mirando y
  // no en hoy, que era el único día al que se podía llegar de un salto.
  const [params] = useSearchParams()
  const [dateISO, setDateISO] = useState(() => {
    const d = params.get('d')
    return /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : today
  })
  const isToday = dateISO === today

  const { entries, loading, error, refetch, addEntry, updateEntry, deleteEntry } = useNutritionDay(dateISO, userId)
  const { foods, saveFood } = useMyFoods()
  const { targets, saveTargets, hasCustomTargets } = useNutritionTargets(userId)
  const { profile: clientProfile } = useClientDetail(readOnly ? userId : null)
  const { profile: myProfile } = useProfile()
  // El perfil de quien come, no el de quien mira: un entrenador planificando a
  // un cliente tiene que ver el cálculo hecho con el cuerpo del cliente.
  const planProfile = readOnly ? clientProfile : myProfile
  const tgt = targets || DEFAULT_TARGETS

  const [sheet, setSheet] = useState(null)   // { entry?, meal? } | 'targets' | null

  // Undoable entry delete (shared primitive) — hide optimistically, commit
  // after a grace window, announce to screen readers. Si el borrado real falla
  // (sin señal en el gimnasio), la comida va a reaparecer: se dice por qué en
  // vez de dejar que parezca un fantasma.
  const [failMsg, setFailMsg] = useState(null)
  const entryDelete = useUndoableDelete(entry => deleteEntry(entry.id), {
    onError: (_err, entry) => {
      const msg = t('No se pudo borrar «{name}». Revisa tu conexión: sigue registrada.', { name: entry?.name || '' })
      entryDelete.setLiveMsg(msg)
      setFailMsg(msg)
      refetch()
    },
  })
  const pendingId = entryDelete.pending?.id

  // Colapso por comida, recordado en el dispositivo.
  const [collapsedMeals, setCollapsedMeals] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nutrition-meals-collapsed')) || {} } catch { return {} }
  })
  const toggleMeal = (id) => setCollapsedMeals(prev => {
    const next = { ...prev, [id]: !prev[id] }
    try { localStorage.setItem('nutrition-meals-collapsed', JSON.stringify(next)) } catch { /* sin storage */ }
    return next
  })

  // Oculta la entrada pendiente de borrado (ventana de deshacer). El héroe,
  // las barras y las secciones parten todos de la misma lista filtrada: antes
  // los totales se recalculaban restando campo a campo, y cada dato nuevo
  // (ahora los micros) había que acordarse de restarlo también.
  const visibleEntries = useMemo(
    () => entries.filter(e => e.id !== pendingId),
    [entries, pendingId]
  )
  const byMeal = useMemo(() => {
    const map = Object.fromEntries(MEALS.map(m => [m.id, []]))
    for (const e of visibleEntries) (map[e.meal] || map.snack).push(e)
    return map
  }, [visibleEntries])

  const shownTotals = useMemo(() => totalsOf(visibleEntries), [visibleEntries])
  const visibleCount = visibleEntries.length

  const kcalOver = shownTotals.kcal > tgt.kcal

  const handleSaveEntry = async (fields, food) => {
    if (sheet?.entry) {
      await updateEntry(sheet.entry.id, fields)
      entryDelete.setLiveMsg(`«${fields.name}» actualizada.`)
    } else {
      await addEntry(fields)
      // Actualiza la biblioteca personal en segundo plano; si falla, la
      // entrada del día ya quedó guardada.
      if (food) saveFood(food).catch(err => console.error('Error guardando comida en biblioteca:', err))
      entryDelete.setLiveMsg(`«${fields.name}» registrada.`)
    }
    setSheet(null)
  }

  // Borrado deshacible: cierra la hoja y arranca la ventana de deshacer.
  const handleDeleteEntry = () => {
    const entry = sheet?.entry
    setSheet(null)
    if (entry) entryDelete.request(entry, {
      deletedMsg: `«${entry.name}» eliminada. Toca deshacer para recuperarla.`,
      restoredMsg: `«${entry.name}» restaurada.`,
    })
  }

  return (
    <Layout>
      <div className="w-full px-5 pb-10 max-w-[480px] mx-auto md:max-w-[720px] md:px-8">

        {readOnly ? (
          /* Cabecera de coach: volver al cliente + nombre, mismo patrón que Stats */
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '40px', paddingBottom: '20px' }}>
            <button
              onClick={() => navigate(-1)}
              style={{ color: 'var(--c-text-dim)', fontSize: '18px', lineHeight: 1, flexShrink: 0 }}
              aria-label="Volver"
            >
              ←
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text)', fontSize: '20px', fontWeight: 900, letterSpacing: '-0.03em' }}>
                {t('Nutrición')}
              </h1>
              {clientProfile?.name && (
                <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '11.5px', fontWeight: 700, letterSpacing: '-0.01em', marginTop: '2px' }}>
                  {clientProfile.name}
                </p>
              )}
            </div>
            <button
              onClick={() => setSheet('targets')}
              style={{
                flexShrink: 0, fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'var(--c-action-text)', border: '1px solid var(--c-accent-border)',
                borderRadius: '999px', padding: '7px 14px', background: 'transparent',
              }}
            >
              {t('Plan')}
            </button>
          </div>
        ) : (
          <PageHeader
            title={t('Nutrición')}
            right={
              <button
                onClick={() => setSheet('targets')}
                style={{
                  fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700,
                  letterSpacing: '-0.01em',
                  color: 'var(--c-action-text)', border: '1px solid var(--c-accent-border)',
                  borderRadius: '999px', padding: '7px 14px', background: 'transparent',
                }}
              >
                {t('Objetivos')}
              </button>
            }
          />
        )}

        {error && (
          <div style={{ ...ERROR_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span>{readOnly ? t('No pudimos cargar sus comidas.') : t('No pudimos cargar tus comidas.')}</span>
            <button
              onClick={refetch}
              style={{ flexShrink: 0, color: 'var(--c-action-text)', fontSize: '12px', fontWeight: 700, border: '1px solid var(--c-accent-border)', borderRadius: 'var(--r-xs)', padding: '6px 12px', background: 'transparent' }}
            >
              {t('Reintentar')}
            </button>
          </div>
        )}

        {/* ── El día ──
            El resumen —calorías, progreso y macros— es lo que se viene a ver
            y estaba suelto sobre el fondo, mientras las comidas de abajo sí
            tenían estructura. Ahora es una superficie del sistema, y la
            navegación de día entra en su cabecera: eran 90px de cromo (dos
            botones de 44px con elevación propia) para un control que se toca
            mucho menos que «+». */}
        <div className="fade-in material" style={{ padding: '18px', marginBottom: '22px', animationDelay: '40ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '16px' }}>
            <button
              onClick={() => setDateISO(shiftISO(dateISO, -1))}
              aria-label={t('Día anterior')}
              style={dayNavBtn(false)}
            >
              ‹
            </button>
            <div style={{ textAlign: 'center', minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--c-text)' }}>
                {labelForISO(dateISO, t, locale)}
              </p>
              {!isToday && (
                <button
                  onClick={() => setDateISO(today)}
                  style={{ fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700, color: 'var(--c-action-text)', marginTop: '2px', letterSpacing: '-0.01em' }}
                >
                  {t('Volver a hoy')}
                </button>
              )}
            </div>
            <button
              onClick={() => !isToday && setDateISO(shiftISO(dateISO, 1))}
              aria-label={t('Día siguiente')}
              disabled={isToday}
              style={dayNavBtn(isToday)}
            >
              ›
            </button>
          </div>

          {/* Anillo + leyenda. Antes esto era un número de 52px y una barra
              lineal: decía cuánto llevas y nada de qué. El anillo dice las dos
              cosas en el mismo dibujo —lo que llevas es cuánto está pintado, y
              de qué es cómo está repartido— y encima ocupa menos alto que el
              número gigante más la barra más los tres macros sueltos. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '16px' }}>
            <CalorieRing
              kcal={shownTotals.kcal}
              target={tgt.kcal}
              protein={shownTotals.protein}
              carbs={shownTotals.carbs}
              fat={shownTotals.fat}
            />
            <MacroLegend totals={shownTotals} targets={tgt} />
          </div>

          <p className="tnum" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', color: kcalOver ? 'var(--c-action-text)' : 'var(--c-text-dim)', marginBottom: '4px' }}>
            {kcalOver
              ? t('{n} kcal por encima', { n: fmt(shownTotals.kcal - tgt.kcal, locale) })
              : t('Quedan {n} kcal', { n: fmt(tgt.kcal - shownTotals.kcal, locale) })}
          </p>

          {/* Meta por defecto: invita a fijar objetivos propios (solo si no los tiene) */}
          {!readOnly && !hasCustomTargets && (
            <button
              onClick={() => setSheet('targets')}
              style={{ display: 'inline-block', fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-action-text)', background: 'transparent', border: 'none', padding: 0, margin: '-8px 0 18px', cursor: 'pointer' }}
            >
              {t('Meta por defecto · fija la tuya →')}
            </button>
          )}

          {/* La cobertura sigue dicha en voz alta: es lo que le pone precio a
              todo lo de arriba. Si de siete comidas solo tres traen micros, el
              total no es «lo que comiste» sino «lo que sabemos». */}
          {visibleCount > 0 && (
            <p className="tnum" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text-muted)' }}>
              {t('{cov} de {n} comidas con micros', { cov: shownTotals.covered, n: visibleCount })}
            </p>
          )}
        </div>

        <MicroGrid
          totals={shownTotals}
          targets={tgt}
          onOpenAll={() => setSheet('micros')}
        />

        {/* ── Comidas del día ── */}
        {loading && entries.length === 0 ? (
          <div aria-hidden="true">
            {MEALS.map((m, i) => (
              <div key={m.id} style={{ marginBottom: '22px' }}>
                <div className="skeleton" style={{ height: '15px', width: '108px', borderRadius: 'var(--r-xs)', marginBottom: '10px' }} />
                <div className="skeleton" style={{ height: '42px', borderRadius: 'var(--r-sm)', opacity: 1 - i * 0.12 }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="fade-in" style={{ animationDelay: '80ms' }}>
            {/* El bloque de «Registra tu primera comida» ocupaba 250px para
                decir lo mismo que ya dicen las cuatro filas de abajo, cada una
                con su «Toca + para añadir». Se queda una línea. */}
            {!readOnly && visibleCount === 0 && (
              <p style={{ color: 'var(--c-text-muted)', fontSize: '12.5px', lineHeight: 1.5, marginBottom: '18px' }}>
                {t('Toca + en cualquier comida, busca un alimento y regístralo en segundos.')}
              </p>
            )}
            {MEALS.map(m => {
              const list = byMeal[m.id]
              const mealKcal = list.reduce((s, e) => s + Number(e.kcal || 0), 0)
              const isCollapsed = !!collapsedMeals[m.id]
              return (
                <section key={m.id} style={{ marginBottom: '22px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
                    <button
                      onClick={() => toggleMeal(m.id)}
                      aria-expanded={!isCollapsed}
                      style={{ display: 'flex', alignItems: 'baseline', gap: '7px', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', minWidth: 0 }}
                    >
                      <span aria-hidden style={{ color: 'var(--c-text-dim)', fontSize: '10px', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 150ms var(--ease-out)' }}>
                        ▾
                      </span>
                      <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--c-text)' }}>
                        {t(m.label)}
                      </h2>
                    </button>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexShrink: 0 }}>
                      {(mealKcal > 0 || (isCollapsed && list.length > 0)) && (
                        <span className="tnum" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700, color: 'var(--c-text-dim)' }}>
                          {isCollapsed && list.length > 0 ? `${list.length} · ` : ''}{fmt(mealKcal)} kcal
                        </span>
                      )}
                      {!readOnly && (
                        <button
                          onClick={() => setSheet({ meal: m.id })}
                          aria-label={`${t('Agregar a')} ${t(m.label)}`}
                          style={{ color: 'var(--c-action-text)', fontSize: '22px', fontWeight: 300, lineHeight: 1, minWidth: '44px', minHeight: '44px', margin: '-12px -12px -12px 0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          +
                        </button>
                      )}
                    </div>
                  </div>

                  {!isCollapsed && (list.length === 0 ? (
                    <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', padding: '8px 0 2px', borderTop: '1px solid var(--c-border-subtle)' }}>
                      {t('Nada anotado')}
                    </p>
                  ) : (
                    <div>
                      {list.map(e => (
                        <button
                          key={e.id}
                          onClick={readOnly ? undefined : () => setSheet({ entry: e })}
                          disabled={readOnly}
                          className={readOnly ? undefined : 'pressable'}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                            width: '100%', textAlign: 'left', padding: '11px 0',
                            background: 'transparent', border: 'none',
                            borderTop: '1px solid var(--c-border-subtle)',
                            cursor: readOnly ? 'default' : 'pointer',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {e.name}
                            </p>
                            <p className="tnum" style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-muted)', fontSize: '10px', fontWeight: 700, marginTop: '3px', letterSpacing: '-0.01em' }}>
                              P {Math.round(e.protein_g)} · C {Math.round(e.carbs_g)} · G {Math.round(e.fat_g)}
                            </p>
                          </div>
                          <span className="tnum" style={{ fontFamily: 'var(--font-sans)', color: 'var(--c-text-dim)', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                            {fmt(e.kcal)} kcal
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                </section>
              )
            })}
          </div>
        )}

      </div>

      {/* ── Sheets ── */}
      {sheet === 'targets' && (
        <NutritionTargetsSheet
          targets={targets}
          userId={userId}
          profile={planProfile}
          onOpenProfile={readOnly ? null : () => navigate('/profile?s=caracteristicas')}
          title={t(readOnly ? 'Plan de nutrición' : 'Objetivos diarios')}
          subtitle={readOnly
            ? `Calorías y macros diarios para ${clientProfile?.name || 'tu cliente'}.`
            : t('Tu meta de calorías y macros para cada día.')}
          onSave={async (fields) => { await saveTargets(fields); setSheet(null) }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'micros' && (
        <NutritionMicrosSheet
          totals={shownTotals}
          targets={tgt}
          entryCount={visibleCount}
          coveredCount={shownTotals.covered}
          onOpenTargets={() => setSheet('targets')}
          onClose={() => setSheet(null)}
        />
      )}
      {!readOnly && sheet && sheet !== 'targets' && sheet !== 'micros' && (
        <EntrySheet
          initial={sheet.entry}
          defaultMeal={sheet.meal}
          foods={foods}
          onSave={handleSaveEntry}
          onDelete={handleDeleteEntry}
          onClose={() => setSheet(null)}
        />
      )}

      {/* ── Feedback compartido: región viva + snackbar de deshacer ── */}
      <LiveRegion>{entryDelete.liveMsg}</LiveRegion>
      <Toast message={failMsg} onDismiss={() => setFailMsg(null)} />
      <UndoSnackbar show={!!entryDelete.pending} message="Comida eliminada" onUndo={entryDelete.undo} />
    </Layout>
  )
}
