import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { useProfile } from '../hooks/useProfile'
import { useAuth } from '../hooks/useAuth'

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
