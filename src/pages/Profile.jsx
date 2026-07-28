import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import Layout from '../components/Layout'
import { useProfile } from '../hooks/useProfile'
import { useAuth } from '../hooks/useAuth'
import { useBodyWeight } from '../hooks/useBodyWeight'
import { useTrainer } from '../hooks/useTrainer'
import { useInvites } from '../hooks/useInvites'
import { useUnreadCounts } from '../hooks/useUnreadCounts'
import { useTheme } from '../hooks/useTheme'
import { useLang } from '../hooks/useLang'
import { ERROR_STYLE, pressable, PRESS_TRANSITION } from '../lib/ui'
import { Button, Sheet, UnitToggle } from '../components/ui'

// Literal hex per palette+theme — CSS vars don't resolve in recharts SVG attrs.
const PROFILE_CHART = {
  'slate-light': { line: '#3E5C76', grid: '#DDE0E4', axis: '#565C64' },
  'slate-dark':  { line: '#7FA0BE', grid: '#2F343B', axis: '#9AA0A8' },
  'riso-light':  { line: '#2438FF', grid: '#D5D2C7', axis: '#67696c' },
  'riso-dark':   { line: '#6E7BFF', grid: '#26271F', axis: '#A2A096' },
}

// ── Shared label styles ───────────────────────────────────────────────────
const LABEL = {
  fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.09em', color: 'var(--c-text-dim)',
  display: 'block', marginBottom: '8px',
}

const SECTION_TITLE = {
  fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
  letterSpacing: '0.12em', color: 'var(--c-text-dim)',
  marginBottom: '16px', paddingBottom: '10px',
  borderBottom: '1px solid var(--c-border-subtle)',
}

const CARD = {
  background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)',
  borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
}

// ── Disclosure ───────────────────────────────────────────────────────────
// El perfil era una pila de tarjetas todas abiertas: había que pasar por encima
// del tema, del entrenador y del conector para llegar a la cuenta. Ahora cada
// apartado es una línea con su resumen, y se abre el que hagas falta. Se pueden
// abrir varios a la vez a propósito — cerrar uno para ver otro es una pelea que
// nadie pidió.
function Disclosure({ title, summary, open, onToggle, children }) {
  return (
    <section style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        {...pressable(0.985)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
          width: '100%', textAlign: 'left', cursor: 'pointer',
          padding: '16px 20px', minHeight: '44px', background: 'transparent',
          transition: PRESS_TRANSITION,
        }}
      >
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', color: 'var(--c-text)', fontSize: '14px', fontWeight: 800, letterSpacing: '-0.01em' }}>
            {title}
          </span>
          {summary && (
            <span style={{
              display: 'block', color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '3px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {summary}
            </span>
          )}
        </span>
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0, color: 'var(--c-text-dim)', fontSize: '15px', lineHeight: 1,
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 180ms var(--ease-out)',
          }}
        >
          ›
        </span>
      </button>

      {open && (
        <div className="fade-in" style={{ padding: '0 20px 20px', borderTop: '1px solid var(--c-border-subtle)', paddingTop: '18px' }}>
          {children}
        </div>
      )}
    </section>
  )
}

// Una fila que lleva a otra pantalla desde dentro de un apartado.
function LinkRow({ label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...pressable()}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        width: '100%', textAlign: 'left', cursor: 'pointer', minHeight: '44px',
        background: 'var(--c-surface-2)', border: '1px solid var(--c-border-subtle)',
        borderRadius: '12px', padding: '12px 14px',
        transition: PRESS_TRANSITION,
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', color: 'var(--c-text)', fontSize: '13px', fontWeight: 700 }}>{label}</span>
        {hint && <span style={{ display: 'block', color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '2px', lineHeight: 1.4 }}>{hint}</span>}
      </span>
      <span aria-hidden="true" style={{ flexShrink: 0, color: 'var(--c-action-text)', fontSize: '13px', fontWeight: 800 }}>›</span>
    </button>
  )
}

// ── Pill selector (radio group) ────────────────────────────────────────
function PillGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {options.map(opt => {
        const selected = value === opt
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              padding: '7px 16px', borderRadius: '999px',
              fontSize: '12px', fontWeight: 700,
              border: `1px solid ${selected ? 'var(--c-accent)' : 'var(--c-border)'}`,
              background: selected ? 'var(--c-accent-dim)' : 'var(--c-surface-2)',
              color: selected ? 'var(--c-action-text)' : 'var(--c-text-dim)',
              transition: 'all 150ms var(--ease-out)', cursor: 'pointer',
            }}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

// ── Number + unit selector ─────────────────────────────────────────────
function NumberWithUnit({ value, unit, onValueChange, onUnitChange, units, placeholder }) {
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <input
        type="number"
        value={value ?? ''}
        onChange={e => onValueChange(e.target.value ? parseFloat(e.target.value) : null)}
        placeholder={placeholder}
        className="input-field"
        style={{ flex: 1 }}
      />
      <UnitToggle value={unit} units={units} onChange={onUnitChange} />
    </div>
  )
}

// ── Days picker (1-7) ──────────────────────────────────────────────────
function DaysPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      {[1, 2, 3, 4, 5, 6, 7].map(d => {
        const selected = value === d
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            style={{
              width: '36px', height: '36px', borderRadius: '50%',
              fontSize: '13px', fontWeight: 800,
              border: `1px solid ${selected ? 'var(--c-accent)' : 'var(--c-border)'}`,
              background: selected ? 'var(--c-accent)' : 'var(--c-surface-2)',
              color: selected ? 'var(--c-on-action)' : 'var(--c-text-dim)',
              transition: 'all 150ms var(--ease-out)', cursor: 'pointer', flexShrink: 0,
            }}
          >
            {d}
          </button>
        )
      })}
    </div>
  )
}

// ── Summary row: label + value, taps to open a sheet ──────────────────────
function SummaryRow({ label, value, onClick, isFirst }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '13px 0', textAlign: 'left',
        borderTop: isFirst ? 'none' : '1px solid var(--c-border-subtle)',
        cursor: 'pointer',
      }}
    >
      <span style={{ color: 'var(--c-text-dim)', fontSize: '12px', fontWeight: 600 }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: value ? 'var(--c-text)' : 'var(--c-text-ghost)', fontSize: '13px', fontWeight: 700 }}>
          {value || '—'}
        </span>
        <span style={{ color: 'var(--c-text-ghost)', fontSize: '13px' }}>›</span>
      </span>
    </button>
  )
}

// ── Sheet: Mis características (identity + físico + nivel) ──────────────────
function CharacteristicsSheet({ form, set, age, saving, onSave, onClose }) {
  const { t, locale } = useLang()
  return (
    <Sheet title={t('Mis características')} subtitle="Datos que cambian poco. Edítalos cuando haga falta." onClose={onClose} maxHeight="92dvh">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={LABEL}>{t('Nombre')}</label>
          <input
            type="text" value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Tu nombre" className="input-field"
          />
        </div>

        <div>
          <label style={LABEL}>{t('Fecha de nacimiento')}</label>
          <input
            type="date" value={form.birth_date}
            onChange={e => set('birth_date', e.target.value)}
            className="input-field" style={{ colorScheme: 'light' }}
          />
          {age !== null && (
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '5px' }}>{age} años</p>
          )}
        </div>

        <div>
          <label style={LABEL}>{t('Sexo')}</label>
          <PillGroup options={['Masculino', 'Femenino', 'Otro']} value={form.sex} onChange={v => set('sex', v)} />
        </div>

        <div>
          <label style={LABEL}>{t('Altura')}</label>
          <NumberWithUnit
            value={form.height} unit={form.height_unit}
            onValueChange={v => set('height', v)} onUnitChange={u => set('height_unit', u)}
            units={['cm', 'ft']} placeholder="0"
          />
        </div>

        <div>
          <label style={LABEL}>{t('Peso de referencia')}</label>
          <NumberWithUnit
            value={form.weight} unit={form.weight_unit}
            onValueChange={v => set('weight', v)} onUnitChange={u => set('weight_unit', u)}
            units={['kg', 'lb']} placeholder="0"
          />
          <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '6px', lineHeight: 1.4 }}>
            {t('Tu peso base. El seguimiento diario va en «Peso corporal».')}
          </p>
        </div>

        <div>
          <label style={LABEL}>{t('Nivel de entrenamiento')}</label>
          <PillGroup options={['Principiante', 'Intermedio', 'Avanzado']} value={form.level} onChange={v => set('level', v)} />
        </div>
      </div>

      <Button
        type="button" variant="primary" full size="lg"
        loading={saving} disabled={saving} onClick={onSave}
        style={{ marginTop: '24px' }}
      >
        {saving ? 'Guardando...' : 'Guardar'}
      </Button>
    </Sheet>
  )
}

// ── Weight chart tooltip ────────────────────────────────────────────────
function WeightTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)',
      padding: '7px 11px', borderRadius: '10px', fontSize: '11px',
    }}>
      <p style={{ color: 'var(--c-text-dim)', letterSpacing: '0.06em', marginBottom: '2px' }}>{label}</p>
      <p style={{ color: 'var(--c-text)', fontWeight: 700 }}>
        {payload[0].value} {payload[0].payload.unit}
      </p>
    </div>
  )
}

// Relative-time label: "hoy", "ayer", "hace 3 días", or a date
function relativeDay(iso, t = (x) => x, locale = 'es-CO') {
  if (!iso) return ''
  const then = new Date(iso); then.setHours(0, 0, 0, 0)
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const days = Math.round((now - then) / 86400000)
  if (days <= 0) return t('hoy')
  if (days === 1) return t('ayer')
  if (days < 7) return `${t('hace')} ${days} ${t('días')}`
  return new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

// ── Sheet: body-weight history (chart + full log + add) ───────────────────
function BodyWeightSheet({ unit, onClose }) {
  const { t, locale } = useLang()
  const { resolved, palette } = useTheme()
  const cc = PROFILE_CHART[`${palette}-${resolved}`] || PROFILE_CHART['slate-light']
  const { logs, chartData, latestLog, loading, adding, addLog, deleteLog } = useBodyWeight()
  const [inputWeight, setInputWeight] = useState('')

  const handleAdd = async () => {
    const val = parseFloat(inputWeight)
    if (!val || val <= 0) return
    await addLog(val, unit)
    setInputWeight('')
  }

  const recentLogs = [...logs].reverse()

  return (
    <Sheet title="Peso corporal" subtitle={`Registrando en ${unit}. Cambia la unidad en Mis características.`} onClose={onClose} maxHeight="92dvh">
      {/* Quick-add — single unit, no toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type="number"
            value={inputWeight}
            onChange={e => setInputWeight(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder={latestLog ? `Último: ${latestLog.weight}` : 'Ej: 75'}
            className="input-field"
            style={{ width: '100%', paddingRight: '34px' }}
            autoFocus
          />
          <span style={{ position: 'absolute', right: '12px', color: 'var(--c-text-muted)', fontSize: '12px', fontWeight: 700, pointerEvents: 'none' }}>
            {unit}
          </span>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !inputWeight}
          style={{
            padding: '0 18px', background: 'var(--c-accent)', color: 'var(--c-on-action)',
            fontSize: '12px', fontWeight: 800, borderRadius: '10px',
            opacity: adding || !inputWeight ? 0.5 : 1, transition: 'opacity 150ms', flexShrink: 0,
          }}
        >
          {adding ? '...' : '+ Log'}
        </button>
      </div>

      {loading && (
        <div className="skeleton" aria-hidden="true" style={{ height: '160px', marginBottom: '20px' }} />
      )}

      {/* Chart */}
      {!loading && chartData.length >= 2 && (
        <div style={{ height: '160px', width: '100%', marginBottom: '20px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid stroke={cc.grid} strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: cc.axis, fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: cc.axis, fontSize: 9 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip content={<WeightTooltip />} />
              <Line type="monotone" dataKey="peso" stroke={cc.line} strokeWidth={2}
                dot={{ fill: cc.line, r: 3, strokeWidth: 0 }} activeDot={{ fill: cc.line, r: 5, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Empty state */}
      {!loading && logs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
          <p style={{ color: 'var(--c-text-muted)', fontSize: '11px' }}>Registra tu primer peso arriba.</p>
        </div>
      )}

      {/* Full log list */}
      {!loading && recentLogs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {recentLogs.map((log, i) => {
            const dateStr = new Date(log.logged_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })
            return (
              <div key={log.id} style={{
                display: 'flex', alignItems: 'center', padding: '10px 0',
                borderTop: i === 0 ? 'none' : '1px solid var(--c-border-subtle)',
              }}>
                <span style={{ color: 'var(--c-text-dim)', fontSize: '11px', flex: 1 }}>{dateStr}</span>
                <span style={{ color: 'var(--c-text)', fontWeight: 800, fontSize: '14px' }}>
                  {log.weight}
                  <span style={{ color: 'var(--c-text-dim)', fontWeight: 400, fontSize: '11px', marginLeft: '3px' }}>{log.unit}</span>
                </span>
                <button
                  type="button" onClick={() => deleteLog(log.id)} aria-label="Eliminar"
                  style={{ color: 'var(--c-text-ghost)', fontSize: '12px', marginLeft: '12px', padding: '2px 6px' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--c-action-text)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-ghost)'}
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}

// ── Body-weight summary (collapsed) — latest only, taps to open sheet ──────
function BodyWeightSummary({ unit, onOpen }) {
  const { t, locale } = useLang()
  const { latestLog, loading } = useBodyWeight()

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', textAlign: 'left', cursor: 'pointer',
        }}
      >
        <div>
          {loading ? (
            <span className="animate-pulse" style={{ color: 'var(--c-text-muted)', fontSize: '12px' }}>Cargando...</span>
          ) : latestLog ? (
            <>
              <span style={{ color: 'var(--c-text)', fontSize: '28px', fontWeight: 900, letterSpacing: '-0.03em' }}>
                {latestLog.weight}
                <span style={{ color: 'var(--c-text-dim)', fontSize: '14px', fontWeight: 700, marginLeft: '4px' }}>{latestLog.unit}</span>
              </span>
              <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '2px' }}>{relativeDay(latestLog.logged_at, t, locale)}</p>
            </>
          ) : (
            <span style={{ color: 'var(--c-text-muted)', fontSize: '13px', fontWeight: 600 }}>Sin registros — anota el primero</span>
          )}
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--c-action-text)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {latestLog ? 'Ver historial' : 'Registrar'} ›
        </span>
      </button>
    </>
  )
}

// ── Appearance: mode + palette ───────────────────────────────────────────
function ThemeSection() {
  const { preference, setPreference, palette, setPalette } = useTheme()
  const { t, locale } = useLang()
  const modeOpts = [
    { value: 'auto',  label: 'Auto',   icon: '◐' },
    { value: 'light', label: 'Claro',  icon: '☀' },
    { value: 'dark',  label: 'Oscuro', icon: '☾' },
  ]
  const paletteOpts = [
    { value: 'slate', label: 'Sobrio',   sub: 'Calmado' },
    { value: 'riso',  label: 'Vibrante', sub: 'Con color' },
  ]
  const cell = (active) => ({
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
    padding: '12px 8px', borderRadius: '12px',
    background: active ? 'var(--c-action-dim)' : 'var(--c-surface-2)',
    border: `1px solid ${active ? 'var(--c-action-border)' : 'var(--c-border-subtle)'}`,
    color: active ? 'var(--c-action-text)' : 'var(--c-text-dim)',
    fontSize: '11px', fontWeight: 700, transition: 'all 150ms var(--ease-out)',
  })
  return (
    <>
      <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
        {t('Tema')}
      </p>
      <div role="group" aria-label="Modo de color" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {modeOpts.map(o => {
          const active = preference === o.value
          return (
            <button key={o.value} type="button" onClick={() => setPreference(o.value)} aria-pressed={active} style={cell(active)}>
              <span aria-hidden="true" style={{ fontSize: '18px', lineHeight: 1 }}>{o.icon}</span>
              {o.label}
            </button>
          )
        })}
      </div>

      <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
        {t('Paleta')}
      </p>
      <div role="group" aria-label="Paleta de color" style={{ display: 'flex', gap: '8px' }}>
        {paletteOpts.map(o => {
          const active = palette === o.value
          return (
            <button key={o.value} type="button" onClick={() => setPalette(o.value)} aria-pressed={active} style={cell(active)}>
              <span style={{ display: 'flex', gap: '3px' }} aria-hidden="true">
                {(o.value === 'riso' ? ['#FF2E7E', '#2438FF', '#C0EE2E'] : ['#3E5C76', '#6B7280', '#1A1D21']).map(c => (
                  <span key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />
                ))}
              </span>
              {o.label}
              <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--c-text-muted)' }}>{o.sub}</span>
            </button>
          )
        })}
      </div>

      <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '16px 0 10px' }}>
        {t('Idioma de la app')}
      </p>
      <AppLangPicker cell={cell} />
      <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', lineHeight: 1.5, marginTop: '8px' }}>
        {t('Cambia los textos de la app. No toca los nombres de los ejercicios.')}
      </p>

      <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '16px 0 10px' }}>
        {t('Nombre de los ejercicios')}
      </p>
      <ExerciseLangPicker cell={cell} />
      <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', lineHeight: 1.5, marginTop: '8px' }}>
        {t('Solo cambia cómo se llaman. Tu historial y tus récords son los mismos en cualquier idioma.')}
      </p>
    </>
  )
}

// Idioma de la interfaz. Independiente del de los nombres de ejercicio: se
// puede tener la app en español y los lifts en inglés, y al revés.
function AppLangPicker({ cell }) {
  const { lang, setLang, saving } = useLang()
  const opts = [
    { value: 'es', label: 'Español', sub: 'Esta semana' },
    { value: 'en', label: 'English', sub: 'This week' },
  ]
  return (
    <div role="group" aria-label="Idioma de la app" style={{ display: 'flex', gap: '8px', opacity: saving ? 0.6 : 1 }}>
      {opts.map(o => {
        const active = lang === o.value
        return (
          <button
            key={o.value}
            type="button"
            disabled={saving}
            onClick={() => { if (!active) setLang(o.value) }}
            aria-pressed={active}
            {...pressable(0.97)}
            style={cell(active)}
          >
            {o.label}
            <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--c-text-muted)' }}>{o.sub}</span>
          </button>
        )
      })}
    </div>
  )
}

// Idioma de los nombres de ejercicio. La identidad vive en la librería, así que
// esto no toca historial ni PRs — solo elige las palabras.
function ExerciseLangPicker({ cell }) {
  const { profile, saveProfile, saving } = useProfile()
  const lang = profile?.exercise_lang === 'en' ? 'en' : 'es'
  const opts = [
    { value: 'es', label: 'Español', sub: 'Press de banca' },
    { value: 'en', label: 'English',  sub: 'Bench Press' },
  ]
  return (
    <div role="group" aria-label="Idioma de los ejercicios" style={{ display: 'flex', gap: '8px', opacity: saving ? 0.6 : 1 }}>
      {opts.map(o => {
        const active = lang === o.value
        return (
          <button
            key={o.value}
            type="button"
            disabled={saving}
            onClick={() => { if (!active) saveProfile({ exercise_lang: o.value }) }}
            aria-pressed={active}
            style={cell(active)}
          >
            {o.label}
            <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--c-text-muted)' }}>{o.sub}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Conectar con Claude (MCP) ───────────────────────────────────────────
// La URL del conector NO es la de la Edge Function: se sirve desde nuestro
// dominio porque el descubrimiento OAuth necesita la raíz del origen.
// Ver supabase/functions/mcp/auth.ts y los rewrites de vercel.json.
const MCP_URL = 'https://raw-red.vercel.app/mcp'

const CAN_DO = [
  'Leer tus entrenos, series y progreso',
  'Crear y editar rutinas y ciclos',
  'Crear objetivos y registrar comidas o peso',
]

const CANNOT_DO = [
  'Registrar o cambiar entrenos y series',
  'Cambiar tu perfil o tus objetivos de macros',
  'Ver datos de otras personas',
]

export function ClaudeSection() {
  const { t, locale } = useLang()
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(MCP_URL)
    } catch {
      // Safari sin permiso de portapapeles: al menos se ve la URL en pantalla.
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>

      <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', lineHeight: 1.55, marginBottom: '14px' }}>
        Conecta RAW a tu cuenta de Claude y planifica desde el chat: pídele un ciclo
        y aparece aquí, en tus rutinas. Tus datos siguen siendo tuyos y puedes
        desconectarlo cuando quieras.
      </p>

      {/* URL del conector + copiar */}
      <label style={LABEL}>URL del conector</label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch', marginBottom: '16px' }}>
        <code
          style={{
            flex: 1, minWidth: 0, background: 'var(--c-surface-2)',
            border: '1px solid var(--c-border-subtle)', borderRadius: '10px',
            padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px',
            color: 'var(--c-text-secondary)', overflowX: 'auto', whiteSpace: 'nowrap',
          }}
        >
          {MCP_URL}
        </code>
        <button
          type="button"
          onClick={copy}
          style={{
            flexShrink: 0, border: '1px solid var(--c-accent-border)', borderRadius: '10px',
            padding: '0 14px', background: 'transparent', color: 'var(--c-action-text)',
            fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.06em', cursor: 'pointer',
          }}
        >
          {t(copied ? 'Copiada' : 'Copiar')}
        </button>
      </div>

      {/* Pasos */}
      <ol style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
        {[
          'En Claude, entra en Ajustes › Conectores.',
          'Elige "Añadir conector personalizado" y pega la URL.',
          'Inicia sesión con esta misma cuenta de RAW y autoriza.',
        ].map((t, i) => (
          <li key={t} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{
              flexShrink: 0, width: '18px', height: '18px', borderRadius: '50%',
              background: 'var(--c-surface-2)', color: 'var(--c-text-dim)',
              fontSize: '10px', fontWeight: 800, display: 'flex',
              alignItems: 'center', justifyContent: 'center', marginTop: '1px',
            }}>
              {i + 1}
            </span>
            <span style={{ color: 'var(--c-text-secondary)', fontSize: '12px', lineHeight: 1.5 }}>{t}</span>
          </li>
        ))}
      </ol>

      {/* Qué puede y qué no — plegable para no cargar la pantalla */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          color: 'var(--c-action-text)', fontSize: '11px', fontWeight: 700,
        }}
      >
        {t(open ? 'Ocultar permisos' : '¿Qué puede hacer Claude?')}
      </button>

      {open && (
        <div className="fade-in" style={{ marginTop: '12px' }}>
          {[['Puede', CAN_DO, '✓', 'var(--c-action-text)'],
            ['No puede', CANNOT_DO, '✕', 'var(--c-text-muted)']].map(([title, items, mark, color]) => (
            <div key={title} style={{ marginBottom: '12px' }}>
              <p style={{ ...LABEL, marginBottom: '6px' }}>{title}</p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {items.map(t => (
                  <li key={t} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span aria-hidden="true" style={{ color, fontSize: '11px', lineHeight: 1.5, flexShrink: 0 }}>{mark}</span>
                    <span style={{ color: 'var(--c-text-secondary)', fontSize: '12px', lineHeight: 1.5 }}>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', lineHeight: 1.5 }}>
            Todo lo que Claude cambie queda registrado y se puede deshacer. Los permisos
            de administrador y el borrado de cuenta solo se hacen desde esta app.
          </p>
        </div>
      )}
    </>
  )
}

// ── Trainer / coach section ─────────────────────────────────────────────
function TrainerSection() {
  const { t, locale } = useLang()
  const navigate = useNavigate()
  const { isTrainer, toggleTrainer, error: trainerError } = useTrainer()
  const { trainers, redeemCode, removeTrainer, redeeming, error: inviteError } = useInvites()
  const { counts } = useUnreadCounts()
  const [code, setCode]       = useState('')
  const [redeemMsg, setRedeemMsg] = useState(null)
  const [localError, setLocalError] = useState(null)
  const [toggling, setToggling]   = useState(false)

  const handleToggle = async () => {
    setToggling(true)
    setLocalError(null)
    try { await toggleTrainer(!isTrainer) } catch (e) { setLocalError(e.message) } finally { setToggling(false) }
  }

  const handleRedeem = async () => {
    setRedeemMsg(null)
    setLocalError(null)
    try {
      await redeemCode(code)
      setCode('')
      setRedeemMsg('✓ Entrenador vinculado')
      setTimeout(() => setRedeemMsg(null), 2500)
    } catch (e) {
      setLocalError(e.message)
    }
  }

  return (
    <>

      {(localError || trainerError || inviteError) && (
        <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError || trainerError || inviteError}</div>
      )}

      {/* Toggle: soy entrenador */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ flex: 1, paddingRight: '12px' }}>
          <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700 }}>{t('Soy entrenador')}</p>
          <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', marginTop: '2px', lineHeight: 1.4 }}>
            {t('Activa el panel «Coach» para invitar clientes y asignarles rutinas y metas.')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={toggling}
          role="switch"
          aria-checked={isTrainer}
          style={{
            width: '46px', height: '28px', borderRadius: '999px', flexShrink: 0,
            background: isTrainer ? 'var(--c-accent)' : 'var(--c-border)',
            transition: 'background 200ms var(--ease-out)', position: 'relative',
            opacity: toggling ? 0.6 : 1,
          }}
        >
          <span style={{
            position: 'absolute', top: '3px', left: isTrainer ? '21px' : '3px',
            width: '22px', height: '22px', borderRadius: '50%', background: '#fff',
            transition: 'left 200ms var(--ease-out)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>

      {/* Vincular entrenador por código */}
      <div>
        <label style={LABEL}>Vincular un entrenador (código)</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleRedeem()}
            placeholder="Ej: A1B2C3D4"
            className="input-field"
            style={{ flex: 1, letterSpacing: '0.08em', fontWeight: 700 }}
          />
          <button
            type="button"
            onClick={handleRedeem}
            disabled={redeeming || !code.trim()}
            style={{
              padding: '0 18px', background: 'var(--c-accent)', color: 'var(--c-on-action)',
              fontSize: '12px', fontWeight: 800, borderRadius: '10px', flexShrink: 0,
              opacity: redeeming || !code.trim() ? 0.5 : 1,
            }}
          >
            {redeeming ? '...' : 'Vincular'}
          </button>
        </div>
        {redeemMsg && (
          <p style={{ color: 'var(--c-success)', fontSize: '11px', fontWeight: 700, marginTop: '8px' }}>{redeemMsg}</p>
        )}
      </div>

      {/* Mis entrenadores */}
      {trainers.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <label style={LABEL}>Mis entrenadores</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {trainers.map(t => (
              <div key={t.linkId} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', background: 'var(--c-surface-2)',
                border: '1px solid var(--c-border-subtle)', borderRadius: '10px',
              }}>
                <span style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 700 }}>
                  {t.profile?.name || 'Entrenador'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {counts[t.trainerId] > 0 && (
                    <span style={{
                      minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '999px',
                      background: 'var(--c-accent)', color: 'var(--c-on-action)',
                      fontSize: '10px', fontWeight: 800, lineHeight: '18px', textAlign: 'center',
                    }}>
                      {counts[t.trainerId] > 9 ? '9+' : counts[t.trainerId]}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(`/chat/${t.trainerId}`)}
                    style={{ color: 'var(--c-action-text)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                  >
                    Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTrainer(t.linkId)}
                    style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--c-action-text)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-dim)'}
                  >
                    {t('Quitar')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ── Account row (tappable, opens a sheet) ─────────────────────────────────
function AccountRow({ label, hint, danger, onClick, isFirst }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '13px 0', textAlign: 'left',
        borderTop: isFirst ? 'none' : '1px solid var(--c-border-subtle)', cursor: 'pointer',
      }}
    >
      <span>
        <span style={{ color: danger ? 'var(--c-danger, #C0392B)' : 'var(--c-text)', fontSize: '13px', fontWeight: 700, display: 'block' }}>{label}</span>
        {hint && <span style={{ color: 'var(--c-text-dim)', fontSize: '11px', marginTop: '2px', display: 'block' }}>{hint}</span>}
      </span>
      <span style={{ color: 'var(--c-text-ghost)', fontSize: '13px' }}>›</span>
    </button>
  )
}

// ── Sheet: cambiar contraseña ─────────────────────────────────────────────
function ChangePasswordSheet({ onClose }) {
  const { t, locale } = useLang()
  const { updatePassword } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const submit = async () => {
    setError(null)
    if (next.length < 6) { setError('La contraseña nueva debe tener al menos 6 caracteres.'); return }
    if (next !== confirm) { setError('Las contraseñas no coinciden.'); return }
    setSaving(true)
    try {
      await updatePassword(current, next)
      setDone(true)
      setTimeout(onClose, 1200)
    } catch (e) {
      setError(e.message || 'No se pudo cambiar la contraseña.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title="Cambiar contraseña" subtitle="Confirma tu contraseña actual y elige una nueva." onClose={onClose}>
      {error && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{error}</div>}
      {done ? (
        <p style={{ color: 'var(--c-success)', fontSize: '13px', fontWeight: 700, textAlign: 'center', padding: '12px 0' }}>✓ Contraseña actualizada</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input type="password" value={current} onChange={e => setCurrent(e.target.value)} className="input-field" placeholder="Contraseña actual" autoComplete="current-password" />
          <input type="password" value={next} onChange={e => setNext(e.target.value)} className="input-field" placeholder="Nueva contraseña" autoComplete="new-password" minLength={6} />
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="input-field" placeholder="Repite la nueva" autoComplete="new-password" minLength={6} />
          <Button type="button" variant="primary" full size="lg" loading={saving} disabled={saving} onClick={submit} style={{ marginTop: '4px' }}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      )}
    </Sheet>
  )
}

// ── Sheet: cambiar email ──────────────────────────────────────────────────
function ChangeEmailSheet({ currentEmail, onClose }) {
  const { t, locale } = useLang()
  const { updateEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  const submit = async () => {
    setError(null)
    if (!email.includes('@')) { setError('Ingresa un email válido.'); return }
    if (email === currentEmail) { setError('Ese ya es tu email actual.'); return }
    setSaving(true)
    try {
      await updateEmail(email)
      setSent(true)
    } catch (e) {
      setError(e.message || 'No se pudo cambiar el email.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title="Cambiar email" subtitle={`Actual: ${currentEmail}`} onClose={onClose}>
      {error && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{error}</div>}
      {sent ? (
        <p style={{ color: 'var(--c-text-secondary)', fontSize: '13px', lineHeight: 1.5, textAlign: 'center', padding: '12px 0' }}>
          Te enviamos un enlace de confirmación a <strong>{email}</strong>. El cambio se aplica cuando lo confirmes.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="nuevo@email.com" autoComplete="email" />
          <Button type="button" variant="primary" full size="lg" loading={saving} disabled={saving} onClick={submit} style={{ marginTop: '4px' }}>
            {saving ? 'Enviando…' : 'Enviar confirmación'}
          </Button>
        </div>
      )}
    </Sheet>
  )
}

// ── Sheet: eliminar cuenta ────────────────────────────────────────────────
function DeleteAccountSheet({ onClose }) {
  const { t, locale } = useLang()
  const { deleteAccount } = useAuth()
  const navigate = useNavigate()
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const ready = confirmText.trim().toUpperCase() === 'ELIMINAR'

  const submit = async () => {
    if (!ready) return
    setError(null)
    setDeleting(true)
    try {
      await deleteAccount()
      navigate('/login', { replace: true })
    } catch (e) {
      setError(e.message || 'No se pudo eliminar la cuenta.')
      setDeleting(false)
    }
  }

  return (
    <Sheet title="Eliminar cuenta" subtitle="Esta acción es permanente y no se puede deshacer." onClose={onClose}>
      {error && <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{error}</div>}
      <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', lineHeight: 1.6, marginBottom: '16px' }}>
        Se borrarán tu perfil, entrenos, rutinas, metas, nutrición, peso corporal, vínculos con entrenadores y mensajes. Escribe <strong style={{ color: 'var(--c-text)' }}>ELIMINAR</strong> para confirmar.
      </p>
      <input
        type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)}
        className="input-field" placeholder="ELIMINAR"
        style={{ marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}
      />
      <Button
        type="button" variant="primary" full size="lg"
        loading={deleting} disabled={deleting || !ready} onClick={submit}
        style={{ background: ready ? 'var(--c-danger, #C0392B)' : undefined }}
      >
        {t(deleting ? 'Eliminando…' : 'Eliminar mi cuenta')}
      </Button>
    </Sheet>
  )
}

// ── Account / security section ────────────────────────────────────────────
function AccountSection({ email }) {
  const { t, locale } = useLang()
  const [sheet, setSheet] = useState(null)   // 'password' | 'email' | 'delete' | null
  return (
    <>
      <AccountRow label="Cambiar contraseña" onClick={() => setSheet('password')} isFirst />
      <AccountRow label="Cambiar email" hint={email} onClick={() => setSheet('email')} />
      <AccountRow label="Eliminar cuenta" hint="Permanente" danger onClick={() => setSheet('delete')} />

      {sheet === 'password' && <ChangePasswordSheet onClose={() => setSheet(null)} />}
      {sheet === 'email' && <ChangeEmailSheet currentEmail={email} onClose={() => setSheet(null)} />}
      {sheet === 'delete' && <DeleteAccountSheet onClose={() => setSheet(null)} />}
    </>
  )
}

// ── Main page ──────────────────────────────────────────────────────────
export default function Profile() {
  const navigate = useNavigate()
  const { t, locale } = useLang()
  const { user, signOut } = useAuth()
  const { profile, loading, saving, saveError, saveSuccess, saveProfile, age } = useProfile()
  const { preference: themePreference, palette: themePalette } = useTheme()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  // sheet: null | 'characteristics' | 'weight'
  const [sheet, setSheet] = useState(null)

  // Apartados abiertos. Se entra con todo cerrado; `?s=<id>` abre uno concreto
  // para que un enlace de fuera (el chip de peso en Inicio) caiga donde debe y
  // no en una lista de títulos que hay que volver a abrir a mano.
  const [params] = useSearchParams()
  const [open, setOpen] = useState(() => {
    const s = params.get('s')
    return new Set(s ? [s] : [])
  })
  const isOpen = (id) => open.has(id)
  const toggle = (id) => setOpen(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  // Local form state — mirrors profile fields
  const [form, setForm] = useState({
    name: '', birth_date: '', sex: null,
    weight: null, weight_unit: 'kg',
    height: null, height_unit: 'cm',
    level: null, goal: null, days_per_week: null,
  })

  // Sync from loaded profile
  useEffect(() => {
    if (profile) {
      setForm({
        name:          profile.name          ?? '',
        birth_date:    profile.birth_date    ?? '',
        sex:           profile.sex           ?? null,
        weight:        profile.weight        ?? null,
        weight_unit:   profile.weight_unit   ?? 'kg',
        height:        profile.height        ?? null,
        height_unit:   profile.height_unit   ?? 'cm',
        level:         profile.level         ?? null,
        goal:          profile.goal          ?? null,
        days_per_week: profile.days_per_week ?? null,
      })
    }
  }, [profile])

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  // Save a subset (sheet) or all editable fields. upsert only writes passed keys.
  const persist = async (keys) => {
    const payload = {}
    for (const k of keys) {
      let v = form[k]
      if ((k === 'name' || k === 'birth_date') && !v) v = null
      payload[k] = v
    }
    await saveProfile(payload)
  }

  const saveCharacteristics = async () => {
    await persist(['name', 'birth_date', 'sex', 'height', 'height_unit', 'weight', 'weight_unit', 'level'])
    setSheet(null)
  }

  const saveTraining = (e) => {
    e.preventDefault()
    persist(['goal', 'days_per_week'])
  }

  const weightUnit = form.weight_unit || 'kg'

  // Summary line for the characteristics card
  const charsSummary = [
    form.sex,
    form.height ? `${form.height} ${form.height_unit}` : null,
    form.level,
  ].filter(Boolean).join(' · ')

  const trainingSummary = [
    form.goal,
    form.days_per_week ? `${form.days_per_week} ${form.days_per_week === 1 ? 'día' : 'días'}/semana` : null,
  ].filter(Boolean).join(' · ') || 'Objetivo, frecuencia y ejercicios'

  const MODE_LABEL = { auto: 'Auto', light: 'Claro', dark: 'Oscuro' }
  const appearanceSummary = `${MODE_LABEL[themePreference] || 'Auto'} · ${themePalette === 'riso' ? 'Vibrante' : 'Sobrio'}`

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[120, 80, 160, 140].map((h, i) => (
            <div key={i} style={{ height: h, background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '16px', opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="fade-in w-full mx-auto max-w-[600px] lg:max-w-[960px]" style={{ padding: '32px 20px 60px' }}>

        {/* Header — avatar beside identity; back button only on mobile */}
        <div style={{ marginBottom: '32px' }}>
          <button
            onClick={() => navigate(-1)}
            className="md:hidden"
            style={{ color: 'var(--c-text-dim)', fontSize: '18px', lineHeight: 1, padding: '6px 8px 6px 0', marginBottom: '10px', display: 'block' }}
            aria-label="Volver"
          >
            ←
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%', flexShrink: 0,
              background: 'var(--c-accent-dim)', border: '2px solid var(--c-accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '22px', fontWeight: 900, color: 'var(--c-action-text)', letterSpacing: '-0.03em' }}>
                {form.name ? form.name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>

            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: '28px', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--c-text)', lineHeight: 1.02 }}>
                {form.name || t('Tu perfil')}
              </h1>
              {age !== null && (
                <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', marginTop: '4px' }}>
                  {age} años{form.sex ? ` · ${form.sex}` : ''}
                </p>
              )}
              <p style={{ color: 'var(--c-text-ghost)', fontSize: '11px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Apartados — todos cerrados de entrada. El perfil se lee de un
            vistazo (cinco líneas con su resumen) y se abre solo lo que hace
            falta tocar. Una columna: con todo plegado, dos columnas dejarían
            media pantalla vacía. */}
        <div className="flex flex-col gap-3">

          {/* ── Mis características (incluye el peso corporal) ── */}
          <Disclosure
            title="Mis características"
            summary={charsSummary || t('Añade tus datos')}
            open={isOpen('caracteristicas')}
            onToggle={() => toggle('caracteristicas')}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button
                type="button"
                onClick={() => setSheet('characteristics')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', textAlign: 'left', cursor: 'pointer', minHeight: '44px',
                }}
              >
                <span style={{ color: charsSummary ? 'var(--c-text)' : 'var(--c-text-ghost)', fontSize: '13px', fontWeight: 600, lineHeight: 1.5 }}>
                  {charsSummary || 'Nombre, fecha de nacimiento, sexo, altura y nivel'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--c-action-text)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0, marginLeft: '12px' }}>
                  Editar ›
                </span>
              </button>

              <div style={{ borderTop: '1px solid var(--c-border-subtle)', paddingTop: '16px' }}>
                <BodyWeightSummary unit={weightUnit} onOpen={() => setSheet('weight')} />
              </div>
            </div>
          </Disclosure>

          {/* ── Entrenamiento — objetivo, frecuencia, ejercicios y entrenador ── */}
          <Disclosure
            title={t('Entrenamiento')}
            summary={trainingSummary}
            open={isOpen('entrenamiento')}
            onToggle={() => toggle('entrenamiento')}
          >
            <form onSubmit={saveTraining}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={LABEL}>{t('Objetivo principal')}</label>
                  <PillGroup
                    options={['Ganar músculo', 'Perder grasa', 'Fuerza', 'Resistencia', 'Mantener']}
                    value={form.goal}
                    onChange={v => set('goal', v)}
                  />
                </div>

                <div>
                  <label style={LABEL}>{t('Días que entrenas por semana')}</label>
                  <DaysPicker value={form.days_per_week} onChange={v => set('days_per_week', v)} />
                </div>
              </div>

              {saveError && (
                <div className="fade-in" style={{ ...ERROR_STYLE, marginTop: '16px' }}>{saveError}</div>
              )}

              <Button
                type="submit" variant="primary" full size="lg"
                loading={saving} disabled={saving}
                style={{ marginTop: '20px', background: saveSuccess ? 'var(--c-success)' : undefined, transition: 'background 300ms var(--ease-out)' }}
              >
                {saving ? 'Guardando...' : saveSuccess ? '✓ Guardado' : 'Guardar'}
              </Button>
            </form>

            {/* La biblioteca de ejercicios se gestiona aquí dentro; ya no ocupa
                una pestaña de la barra inferior, donde competía con Inicio. */}
            <div style={{ borderTop: '1px solid var(--c-border-subtle)', marginTop: '20px', paddingTop: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <LinkRow
                label={t('Mis ejercicios')}
                hint="Clasifica por grupo muscular y vincula los que no reconoció"
                onClick={() => navigate('/ejercicios')}
              />
            </div>

            {/* Entrenador — la otra mitad de "entrenar": con quién. */}
            <div style={{ borderTop: '1px solid var(--c-border-subtle)', marginTop: '18px', paddingTop: '18px' }}>
              <TrainerSection />
            </div>
          </Disclosure>

          {/* ── Apariencia ── */}
          <Disclosure
            title={t('Apariencia')}
            summary={appearanceSummary}
            open={isOpen('apariencia')}
            onToggle={() => toggle('apariencia')}
          >
            <ThemeSection />
          </Disclosure>

          {/* ── Cuenta (incluye el conector de Claude) ── */}
          <Disclosure
            title={t('Cuenta')}
            summary={user?.email}
            open={isOpen('cuenta')}
            onToggle={() => toggle('cuenta')}
          >
            <AccountSection email={user?.email} />

            <div style={{ borderTop: '1px solid var(--c-border-subtle)', marginTop: '18px', paddingTop: '18px' }}>
              <ClaudeSection />
            </div>

            <div style={{ borderTop: '1px solid var(--c-border-subtle)', marginTop: '18px', paddingTop: '18px', display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleSignOut}
                style={{
                  color: 'var(--c-text-dim)', fontSize: '11px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  border: '1px solid var(--c-border-subtle)', borderRadius: '10px',
                  padding: '10px 20px', background: 'transparent', minHeight: '44px',
                  transition: 'color 150ms var(--ease-out), border-color 150ms var(--ease-out)',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-action-text)'; e.currentTarget.style.borderColor = 'var(--c-accent)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-dim)'; e.currentTarget.style.borderColor = 'var(--c-border-subtle)' }}
              >
                {t('Cerrar sesión')}
              </button>
            </div>
          </Disclosure>

          {/* ── Panel de administración — solo administradores ── */}
          {profile?.is_admin && (
            <section style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => navigate('/admin')}
                {...pressable(0.985)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                  padding: '16px 20px', minHeight: '44px', background: 'transparent',
                  transition: PRESS_TRANSITION,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', color: 'var(--c-text)', fontSize: '14px', fontWeight: 800, letterSpacing: '-0.01em' }}>
                    {t('Panel de administración')}
                  </span>
                  <span style={{ display: 'block', color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '3px' }}>
                    {t('Estado de la app, usuarios y actividad')}
                  </span>
                </span>
                <span aria-hidden="true" style={{ flexShrink: 0, color: 'var(--c-action-text)', fontSize: '15px', fontWeight: 800 }}>›</span>
              </button>
            </section>
          )}

        </div>
      </div>

      {/* ── Sheets ── */}
      {sheet === 'characteristics' && (
        <CharacteristicsSheet
          form={form} set={set} age={age}
          saving={saving} onSave={saveCharacteristics}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'weight' && (
        <BodyWeightSheet unit={weightUnit} onClose={() => setSheet(null)} />
      )}
    </Layout>
  )
}
