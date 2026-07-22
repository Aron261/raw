// @vitest-environment jsdom
// La rejilla del mes es donde se cruzan dos fuentes: entrenos ya registrados
// (workouts.started_at, timestamp) y sesiones planeadas (date, YYYY-MM-DD).
// Cruzarlas mal desplaza un día — el fallo clásico de UTC. Aquí se fija el
// reloj y se comprueba que cada dato cae exactamente en su casilla.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('motion/react', async () => {
  const React = await import('react')
  return {
    useReducedMotion: () => true,
    motion: new Proxy({}, {
      get: (_t, tag) => React.forwardRef(function M(props, ref) {
        const { whileTap, transition, ...rest } = props
        return React.createElement(String(tag), { ...rest, ref })
      }),
    }),
  }
})

import Calendar from './Calendar'

const done = (iso) => ({ id: iso, name: 'Entreno', started_at: `${iso}T10:00:00`, ended_at: `${iso}T11:00:00` })

// La rejilla muestra días de tres meses (junio, julio, agosto), así que se
// direcciona por fecha completa, no por número de día.
const cell = (day, month = '07') => {
  const el = document.querySelector(`[data-date="2026-${month}-${String(day).padStart(2, '0')}"]`)
  if (!el) throw new Error(`No hay celda para 2026-${month}-${day}`)
  return el
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 6, 21, 9, 0, 0)) // martes 21 jul 2026
})
afterEach(() => { vi.useRealTimers(); cleanup() })

describe('Calendar — vista mes', () => {
  it('muestra el mes actual con 42 celdas', () => {
    render(<Calendar />)
    expect(screen.getByText('Julio 2026')).toBeTruthy()
    expect(document.querySelectorAll('[data-date]')).toHaveLength(42)
  })

  it('coloca un entreno registrado en su día local, no en el de UTC', () => {
    // 23:00 hora local: en UTC ya sería el día siguiente.
    const late = { id: 'w', name: 'Noche', started_at: '2026-07-15T23:00:00', ended_at: '2026-07-16T00:10:00' }
    render(<Calendar workouts={[late]} />)
    expect(cell(15).getAttribute('aria-label')).toContain('1 entrenos')
    expect(cell(16).getAttribute('aria-label')).toContain('0 entrenos')
  })

  it('cuenta las sesiones planeadas en su fecha', () => {
    const sessions = [
      { id: 'a', date: '2026-07-22', kind: 'cardio', status: 'planned' },
      { id: 'b', date: '2026-07-22', kind: 'mobility', status: 'planned' },
    ]
    render(<Calendar sessions={sessions} />)
    expect(cell(22).getAttribute('aria-label')).toContain('2 planificado')
    expect(cell(23).getAttribute('aria-label')).toContain('0 planificado')
  })

  it('devuelve la fecha tocada', () => {
    const onSelectDay = vi.fn()
    render(<Calendar onSelectDay={onSelectDay} />)
    fireEvent.click(cell(9))
    expect(onSelectDay).toHaveBeenCalledTimes(1)
    const d = onSelectDay.mock.calls[0][0]
    expect(d.getDate()).toBe(9)
    expect(d.getMonth()).toBe(6)
    expect(d.getFullYear()).toBe(2026)
  })

  it('tiñe toda la semana de una descarga, y solo esa', () => {
    // Miércoles 15 jul → su semana va del lunes 13 al domingo 19.
    render(<Calendar sessions={[{ id: 'd', date: '2026-07-15', kind: 'deload', status: 'planned' }]} />)
    const tinted = (day) => cell(day).style.background === 'var(--c-surface-2)'
    expect(tinted(13)).toBe(true)
    expect(tinted(19)).toBe(true)
    expect(tinted(12)).toBe(false) // domingo de la semana anterior
    expect(tinted(20)).toBe(false) // lunes de la siguiente
  })

  it('navega entre meses y vuelve a hoy', () => {
    render(<Calendar />)
    fireEvent.click(screen.getByLabelText('Mes siguiente'))
    expect(screen.getByText('Agosto 2026')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Mes anterior'))
    expect(screen.getByText('Julio 2026')).toBeTruthy()
    // Dos atrás y el atajo "Ir a hoy" debe reaparecer
    fireEvent.click(screen.getByLabelText('Mes anterior'))
    fireEvent.click(screen.getByText('Ir a hoy'))
    expect(screen.getByText('Julio 2026')).toBeTruthy()
  })
})

describe('Calendar — vista semana', () => {
  const toWeek = () => fireEvent.click(screen.getByRole('tab', { name: 'Semana' }))

  it('acerca a la semana de hoy: 7 columnas, de lunes a domingo', () => {
    render(<Calendar />)
    toWeek()
    expect(screen.getByText('20 – 26 de julio')).toBeTruthy()
    const cols = [...document.querySelectorAll('[data-date]')]
    expect(cols.map(e => e.dataset.date)).toEqual([
      '2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23',
      '2026-07-24', '2026-07-25', '2026-07-26',
    ])
    // Horizontal: los 7 días son columnas de una misma rejilla, en una fila
    expect(getComputedStyle(cols[0].parentElement).gridTemplateColumns).toBe('repeat(7, 1fr)')
  })

  it('lee la programación del día en vez de un punto', () => {
    const workouts = [{
      id: 'w', name: 'Upper 1',
      started_at: '2026-07-20T10:00:00', ended_at: '2026-07-20T11:00:00',
      workout_exercises: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    }]
    const sessions = [{ id: 's', date: '2026-07-22', kind: 'cardio', title: 'Cardio 40 min', status: 'planned' }]
    render(<Calendar workouts={workouts} sessions={sessions} />)
    toWeek()
    expect(screen.getByText('Upper 1')).toBeTruthy()
    expect(screen.getByText('Cardio 40 min')).toBeTruthy()
    expect(screen.getAllByText('3 ej').length).toBe(1)
    // Cada cosa cae en la columna de su día, no en la del vecino
    const col = (d) => document.querySelector(`[data-date="${d}"]`)
    expect(col('2026-07-20').textContent).toContain('Upper 1')
    expect(col('2026-07-22').textContent).toContain('Cardio 40 min')
    expect(col('2026-07-21').textContent).not.toContain('Cardio')
  })

  it('muestra de qué se compone una sesión vinculada a un día de rutina', () => {
    const routines = [{
      id: 'r', name: 'Upper/Lower',
      routine_days: [{
        id: 'rd1', day_name: 'Upper 1',
        routine_day_exercises: [
          { exercise_name: 'Press banca' }, { exercise_name: 'Remo' }, { exercise_name: '  ' },
        ],
      }],
    }]
    const sessions = [{ id: 's', date: '2026-07-23', kind: 'strength', title: 'Upper A', status: 'planned', routine_day_id: 'rd1' }]
    render(<Calendar sessions={sessions} routines={routines} />)
    toWeek()
    expect(screen.getByText('Upper A')).toBeTruthy()
    expect(screen.getByText('2 ej')).toBeTruthy() // el nombre en blanco no cuenta
  })

  it('anuncia la semana de descarga', () => {
    render(<Calendar sessions={[{ id: 'd', date: '2026-07-22', kind: 'deload', status: 'planned' }]} />)
    toWeek()
    expect(screen.getByText('Semana de descarga')).toBeTruthy()
  })

  it('navega de semana en semana', () => {
    render(<Calendar />)
    toWeek()
    fireEvent.click(screen.getByLabelText('Semana siguiente'))
    expect(screen.getByText('27 de julio – 2 de agosto')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Semana anterior'))
    expect(screen.getByText('20 – 26 de julio')).toBeTruthy()
  })

  it('cambiar de acercamiento no te teletransporta: la semana es la del mes que mirabas', () => {
    render(<Calendar />)
    // Dos meses adelante en vista mes → septiembre
    fireEvent.click(screen.getByLabelText('Mes siguiente'))
    fireEvent.click(screen.getByLabelText('Mes siguiente'))
    expect(screen.getByText('Septiembre 2026')).toBeTruthy()
    toWeek()
    // La semana mostrada cae dentro de septiembre, no salta de vuelta a hoy
    const dates = [...document.querySelectorAll('[data-date]')].map(e => e.dataset.date)
    expect(dates.some(d => d.startsWith('2026-09'))).toBe(true)
  })
})
