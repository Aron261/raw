import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { ERROR_STYLE } from '../lib/ui'

// ── Shared label style ──────────────────────────────────────────────────
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
              padding: '7px 16px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 700,
              border: `1px solid ${selected ? 'var(--c-accent)' : 'var(--c-border)'}`,
              background: selected ? 'var(--c-accent-dim)' : 'var(--c-surface-2)',
              color: selected ? 'var(--c-accent)' : 'var(--c-text-dim)',
              transition: 'all 150ms var(--ease-out)',
              cursor: 'pointer',
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
      <div style={{ display: 'flex', background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
        {units.map(u => (
          <button
            key={u}
            type="button"
            onClick={() => onUnitChange(u)}
            style={{
              padding: '0 14px',
              fontSize: '11px',
              fontWeight: 700,
              background: unit === u ? 'var(--c-accent)' : 'transparent',
              color: unit === u ? '#fff' : 'var(--c-text-dim)',
              transition: 'all 150ms var(--ease-out)',
              height: '100%',
            }}
          >
            {u}
          </button>
        ))}
      </div>
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
              width: '36px', height: '36px',
              borderRadius: '50%',
              fontSize: '13px', fontWeight: 800,
              border: `1px solid ${selected ? 'var(--c-accent)' : 'var(--c-border)'}`,
              background: selected ? 'var(--c-accent)' : 'var(--c-surface-2)',
              color: selected ? '#fff' : 'var(--c-text-dim)',
              transition: 'all 150ms var(--ease-out)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {d}
          </button>
        )
      })}
    </div>
  )
}

// ── Weight chart tooltip ────────────────────────────────────────────────
function WeightTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border-subtle)',
      padding: '7px 11px',
      borderRadius: '10px',
      fontSize: '11px',
    }}>
      <p style={{ color: 'var(--c-text-dim)', letterSpacing: '0.06em', marginBottom: '2px' }}>{label}</p>
      <p style={{ color: 'var(--c-text)', fontWeight: 700 }}>
        {payload[0].value} {payload[0].payload.unit}
      </p>
    </div>
  )
}

// ── Body weight section ─────────────────────────────────────────────────
function BodyWeightSection() {
  const { logs, chartData, latestLog, loading, adding, addLog, deleteLog } = useBodyWeight()
  const [inputWeight, setInputWeight] = useState('')
  const [inputUnit, setInputUnit] = useState(latestLog?.unit ?? 'kg')

  // Sync unit with latest entry when it loads
  useEffect(() => {
    if (latestLog?.unit) setInputUnit(latestLog.unit)
  }, [latestLog?.unit])

  const handleAdd = async () => {
    const val = parseFloat(inputWeight)
    if (!val || val <= 0) return
    await addLog(val, inputUnit)
    setInputWeight('')
  }

  const recentLogs = [...logs].reverse().slice(0, 10)

  return (
    <section style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <p style={SECTION_TITLE}>Peso corporal</p>

      {/* Quick-add input */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <input
          type="number"
          value={inputWeight}
          onChange={e => setInputWeight(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder={latestLog ? `Último: ${latestLog.weight} ${latestLog.unit}` : 'Ej: 75'}
          className="input-field"
          style={{ flex: 1 }}
        />
        <div style={{ display: 'flex', background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
          {['kg', 'lb'].map(u => (
            <button
              key={u}
              type="button"
              onClick={() => setInputUnit(u)}
              style={{
                padding: '0 14px',
                fontSize: '11px', fontWeight: 700,
                background: inputUnit === u ? 'var(--c-accent)' : 'transparent',
                color: inputUnit === u ? '#fff' : 'var(--c-text-dim)',
                transition: 'all 150ms var(--ease-out)',
                height: '100%',
              }}
            >
              {u}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !inputWeight}
          style={{
            padding: '0 16px',
            background: 'var(--c-accent)',
            color: '#fff',
            fontSize: '12px', fontWeight: 800,
            borderRadius: '10px',
            opacity: adding || !inputWeight ? 0.5 : 1,
            transition: 'opacity 150ms',
            flexShrink: 0,
          }}
        >
          {adding ? '...' : '+ Log'}
        </button>
      </div>

      {loading && (
        <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', textAlign: 'center', padding: '24px 0' }} className="animate-pulse">
          Cargando...
        </p>
      )}

      {/* Chart */}
      {!loading && chartData.length >= 2 && (
        <div style={{ height: '140px', width: '100%', marginBottom: '20px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid stroke="#E8E8EE" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: '#9E9EA8', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9E9EA8', fontSize: 9 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip content={<WeightTooltip />} />
              <Line
                type="monotone"
                dataKey="peso"
                stroke="#FF2D2D"
                strokeWidth={2}
                dot={{ fill: '#FF2D2D', r: 3, strokeWidth: 0 }}
                activeDot={{ fill: '#FF2D2D', r: 5, strokeWidth: 0 }}
              />
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

      {/* Recent log list */}
      {!loading && recentLogs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {recentLogs.map((log, i) => {
            const dateStr = new Date(log.logged_at).toLocaleDateString('es', {
              weekday: 'short', month: 'short', day: 'numeric',
            })
            const isFirst = i === 0
            return (
              <div
                key={log.id}
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: '9px 0',
                  borderTop: isFirst ? 'none' : '1px solid var(--c-border-subtle)',
                }}
              >
                <span style={{ color: 'var(--c-text-dim)', fontSize: '11px', flex: 1 }}>{dateStr}</span>
                <span style={{ color: 'var(--c-text)', fontWeight: 800, fontSize: '14px' }}>
                  {log.weight}
                  <span style={{ color: 'var(--c-text-dim)', fontWeight: 400, fontSize: '11px', marginLeft: '3px' }}>{log.unit}</span>
                </span>
                <button
                  type="button"
                  onClick={() => deleteLog(log.id)}
                  aria-label="Eliminar"
                  style={{ color: 'var(--c-text-ghost)', fontSize: '12px', marginLeft: '12px', padding: '2px 6px' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--c-accent)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-ghost)'}
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ── Trainer / coach section ─────────────────────────────────────────────
function TrainerSection() {
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
    <section style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <p style={SECTION_TITLE}>Entrenador</p>

      {(localError || trainerError || inviteError) && (
        <div style={{ ...ERROR_STYLE, marginBottom: '14px' }}>{localError || trainerError || inviteError}</div>
      )}

      {/* Toggle: soy entrenador */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ flex: 1, paddingRight: '12px' }}>
          <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 700 }}>Soy entrenador</p>
          <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', marginTop: '2px', lineHeight: 1.4 }}>
            Activa el panel «Coach» para invitar clientes y asignarles rutinas y metas.
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
              padding: '0 18px', background: 'var(--c-accent)', color: '#fff',
              fontSize: '12px', fontWeight: 800, borderRadius: '10px', flexShrink: 0,
              opacity: redeeming || !code.trim() ? 0.5 : 1,
            }}
          >
            {redeeming ? '...' : 'Vincular'}
          </button>
        </div>
        {redeemMsg && (
          <p style={{ color: 'oklch(55% 0.15 145)', fontSize: '11px', fontWeight: 700, marginTop: '8px' }}>{redeemMsg}</p>
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
                      background: 'var(--c-accent)', color: '#fff',
                      fontSize: '10px', fontWeight: 800, lineHeight: '18px', textAlign: 'center',
                    }}>
                      {counts[t.trainerId] > 9 ? '9+' : counts[t.trainerId]}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(`/chat/${t.trainerId}`)}
                    style={{ color: 'var(--c-accent)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                  >
                    Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTrainer(t.linkId)}
                    style={{ color: 'var(--c-text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--c-accent)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-dim)'}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

// ── Main page ──────────────────────────────────────────────────────────
export default function Profile() {
  const { user } = useAuth()
  const { profile, loading, saving, saveError, saveSuccess, saveProfile, age } = useProfile()

  // Local form state — mirrors profile fields
  const [form, setForm] = useState({
    name: '',
    birth_date: '',
    sex: null,
    weight: null,
    weight_unit: 'kg',
    height: null,
    height_unit: 'cm',
    level: null,
    goal: null,
    days_per_week: null,
  })

  // Sync from loaded profile
  useEffect(() => {
    if (profile) {
      setForm({
        name:         profile.name         ?? '',
        birth_date:   profile.birth_date   ?? '',
        sex:          profile.sex          ?? null,
        weight:       profile.weight       ?? null,
        weight_unit:  profile.weight_unit  ?? 'kg',
        height:       profile.height       ?? null,
        height_unit:  profile.height_unit  ?? 'cm',
        level:        profile.level        ?? null,
        goal:         profile.goal         ?? null,
        days_per_week: profile.days_per_week ?? null,
      })
    }
  }, [profile])

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const handleSave = (e) => {
    e.preventDefault()
    const payload = { ...form }
    // Convert empty strings to null
    if (!payload.name) payload.name = null
    if (!payload.birth_date) payload.birth_date = null
    saveProfile(payload)
  }

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
      <div className="fade-in" style={{ padding: '32px 20px 60px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          {/* Avatar circle with initials */}
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'var(--c-accent-dim)', border: '2px solid var(--c-accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '16px',
          }}>
            <span style={{ fontSize: '22px', fontWeight: 900, color: 'var(--c-accent)', letterSpacing: '-0.03em' }}>
              {form.name ? form.name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>

          <h1 style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--c-text)', lineHeight: 1 }}>
            {form.name || 'Tu perfil'}
          </h1>
          {age !== null && (
            <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', marginTop: '4px' }}>
              {age} años{form.sex ? ` · ${form.sex}` : ''}
            </p>
          )}
          <p style={{ color: 'var(--c-text-ghost)', fontSize: '11px', marginTop: '2px' }}>{user?.email}</p>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* ── Identidad ── */}
          <section style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <p style={SECTION_TITLE}>Identidad</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={LABEL}>Nombre</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Tu nombre"
                  className="input-field"
                />
              </div>

              <div>
                <label style={LABEL}>Fecha de nacimiento</label>
                <input
                  type="date"
                  value={form.birth_date}
                  onChange={e => set('birth_date', e.target.value)}
                  className="input-field"
                  style={{ colorScheme: 'light' }}
                />
                {age !== null && (
                  <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', marginTop: '5px' }}>
                    {age} años
                  </p>
                )}
              </div>

              <div>
                <label style={LABEL}>Sexo</label>
                <PillGroup
                  options={['Masculino', 'Femenino', 'Otro']}
                  value={form.sex}
                  onChange={v => set('sex', v)}
                />
              </div>
            </div>
          </section>

          {/* ── Físico ── */}
          <section style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <p style={SECTION_TITLE}>Físico</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={LABEL}>Peso</label>
                <NumberWithUnit
                  value={form.weight}
                  unit={form.weight_unit}
                  onValueChange={v => set('weight', v)}
                  onUnitChange={u => set('weight_unit', u)}
                  units={['kg', 'lb']}
                  placeholder="0"
                />
              </div>

              <div>
                <label style={LABEL}>Altura</label>
                <NumberWithUnit
                  value={form.height}
                  unit={form.height_unit}
                  onValueChange={v => set('height', v)}
                  onUnitChange={u => set('height_unit', u)}
                  units={['cm', 'ft']}
                  placeholder="0"
                />
              </div>
            </div>
          </section>

          {/* ── Entrenamiento ── */}
          <section style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-subtle)', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <p style={SECTION_TITLE}>Entrenamiento</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={LABEL}>Nivel</label>
                <PillGroup
                  options={['Principiante', 'Intermedio', 'Avanzado']}
                  value={form.level}
                  onChange={v => set('level', v)}
                />
              </div>

              <div>
                <label style={LABEL}>Objetivo principal</label>
                <PillGroup
                  options={['Ganar músculo', 'Perder grasa', 'Fuerza', 'Resistencia', 'Mantener']}
                  value={form.goal}
                  onChange={v => set('goal', v)}
                />
              </div>

              <div>
                <label style={LABEL}>Días que entrenas por semana</label>
                <DaysPicker value={form.days_per_week} onChange={v => set('days_per_week', v)} />
              </div>
            </div>
          </section>

          {/* ── Peso corporal ── */}
          <BodyWeightSection />

          {/* ── Entrenador ── */}
          <TrainerSection />

          {/* ── Save ── */}
          {saveError && (
            <div className="fade-in" style={{
              background: 'var(--c-accent-dim)', border: '1px solid var(--c-accent-border)',
              color: 'var(--c-accent)', fontSize: '12px', padding: '10px 14px', borderRadius: '10px',
            }}>
              {saveError}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
            style={{
              padding: '16px', fontSize: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              background: saveSuccess ? 'oklch(55% 0.15 145)' : 'var(--c-accent)',
              transition: 'background 300ms var(--ease-out)',
            }}
          >
            {saving
              ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /><span>Guardando...</span></>
              : saveSuccess
                ? '✓ Guardado'
                : 'Guardar perfil'
            }
          </button>
        </form>
      </div>
    </Layout>
  )
}
