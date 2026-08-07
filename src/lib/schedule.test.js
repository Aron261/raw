import { describe, it, expect } from 'vitest'
import {
  matchPlannedSession, trainingWeekdays, projectCycle, projectionByDate,
  getNextRoutineDay, recurringDates, MAX_SERIES_OCCURRENCES, weekAdherence,
  isLoggable, formatSessionLog, loggedMinutes,
} from './schedule'

// Entreno terminado en una fecha local dada.
const workout = (iso, extra = {}) => ({
  id: `w-${iso}-${extra.routine_day_id || 'free'}`,
  started_at: `${iso}T10:00:00`,
  ended_at: `${iso}T11:00:00`,
  routine_id: null,
  routine_day_id: null,
  ...extra,
})

const session = (iso, extra = {}) => ({
  id: `s-${iso}`,
  date: iso,
  kind: 'strength',
  status: 'planned',
  routine_day_id: null,
  sort_order: 0,
  ...extra,
})

const cycle = (dayCount = 3, extra = {}) => ({
  id: 'cycle-1',
  name: 'PPL',
  days_per_week: null,
  routine_days: Array.from({ length: dayCount }, (_, i) => ({
    id: `d${i + 1}`,
    day_name: `Día ${i + 1}`,
    day_order: i + 1,
  })),
  ...extra,
})

describe('matchPlannedSession', () => {
  it('cumple el plan vinculado al mismo día de rutina', () => {
    const w = workout('2026-08-10', { routine_id: 'cycle-1', routine_day_id: 'd2' })
    const s = session('2026-08-10', { routine_day_id: 'd2' })
    expect(matchPlannedSession(w, [s])).toBe(s)
  })

  it('cumple un plan de fuerza sin vincular', () => {
    const w = workout('2026-08-10')
    const s = session('2026-08-10')
    expect(matchPlannedSession(w, [s])).toBe(s)
  })

  it('NO da por hecho un plan que apuntaba a otro día de rutina', () => {
    // Planeaste Upper A e hiciste pierna: el plan sigue pendiente.
    const w = workout('2026-08-10', { routine_id: 'cycle-1', routine_day_id: 'd3' })
    const s = session('2026-08-10', { routine_day_id: 'd1' })
    expect(matchPlannedSession(w, [s])).toBeNull()
  })

  it('no toca cardio ni movilidad: un entreno no los cumple', () => {
    const w = workout('2026-08-10')
    expect(matchPlannedSession(w, [session('2026-08-10', { kind: 'cardio' })])).toBeNull()
    expect(matchPlannedSession(w, [session('2026-08-10', { kind: 'mobility' })])).toBeNull()
    expect(matchPlannedSession(w, [session('2026-08-10', { kind: 'rest' })])).toBeNull()
  })

  it('ignora otros días y planes ya cerrados', () => {
    const w = workout('2026-08-10')
    expect(matchPlannedSession(w, [session('2026-08-11')])).toBeNull()
    expect(matchPlannedSession(w, [session('2026-08-10', { status: 'done' })])).toBeNull()
    expect(matchPlannedSession(w, [session('2026-08-10', { status: 'skipped' })])).toBeNull()
  })

  it('con varios candidatos toma el primero por sort_order', () => {
    const w = workout('2026-08-10')
    const b = session('2026-08-10', { id: 'b', sort_order: 2 })
    const a = session('2026-08-10', { id: 'a', sort_order: 1 })
    expect(matchPlannedSession(w, [b, a]).id).toBe('a')
  })

  it('el vínculo gana al plan libre aunque vaya después', () => {
    const w = workout('2026-08-10', { routine_id: 'cycle-1', routine_day_id: 'd2' })
    const free = session('2026-08-10', { id: 'free', sort_order: 0 })
    const linked = session('2026-08-10', { id: 'linked', routine_day_id: 'd2', sort_order: 9 })
    expect(matchPlannedSession(w, [free, linked]).id).toBe('linked')
  })

  it('un entreno sin terminar no cumple nada', () => {
    const w = { started_at: '2026-08-10T10:00:00', ended_at: null }
    expect(matchPlannedSession(w, [session('2026-08-10')])).toBeNull()
    expect(matchPlannedSession(null, [session('2026-08-10')])).toBeNull()
  })

  it('usa la fecha LOCAL del entreno, no la UTC', () => {
    // 11pm local sigue siendo hoy aunque en UTC ya sea mañana.
    const w = { started_at: '2026-08-10T23:30:00', ended_at: '2026-08-11T00:15:00' }
    expect(matchPlannedSession(w, [session('2026-08-10')])).toBeTruthy()
  })
})

describe('trainingWeekdays', () => {
  const now = new Date(2026, 7, 10) // lunes 10 de agosto de 2026

  it('sin historial no inventa una cadencia', () => {
    expect(trainingWeekdays([], { now })).toEqual([])
    expect(trainingWeekdays(null, { now })).toEqual([])
  })

  it('lee los días en los que de verdad se entrena', () => {
    // Cuatro semanas de lunes/miércoles/viernes.
    const ws = []
    for (let w = 1; w <= 4; w++) {
      for (const d of [3, 5, 7]) { // lun/mié/vie de agosto 2026
        const day = String(d + (w - 1) * 7).padStart(2, '0')
        ws.push(workout(`2026-08-${day}`))
      }
    }
    // Ventana hacia atrás desde el final del bloque.
    const got = trainingWeekdays(ws, { now: new Date(2026, 7, 28) })
    expect(got).toEqual([0, 2, 4]) // lunes, miércoles, viernes
  })

  it('ignora entrenos sin terminar y los del futuro', () => {
    const ws = [
      { started_at: '2026-08-03T10:00:00', ended_at: null },
      workout('2026-08-24'), // después de `now`
    ]
    expect(trainingWeekdays(ws, { now })).toEqual([])
  })

  it('respeta el objetivo de días por semana de la rutina', () => {
    const ws = [
      workout('2026-08-03'), workout('2026-08-04'), workout('2026-08-05'),
      workout('2026-08-06'), workout('2026-08-07'),
    ]
    const got = trainingWeekdays(ws, { now: new Date(2026, 7, 8), target: 2 })
    expect(got).toHaveLength(2)
  })

  it('descarta lo que cae fuera de la ventana', () => {
    // Un entreno de hace medio año no dice nada de la cadencia de hoy.
    expect(trainingWeekdays([workout('2026-02-02')], { now })).toEqual([])
  })
})

describe('projectCycle', () => {
  const from = new Date(2026, 7, 10) // lunes

  // Historial: lun/mié/vie durante tres semanas, vinculado al ciclo.
  const history = () => {
    const ws = []
    const dates = [
      '2026-07-20', '2026-07-22', '2026-07-24',
      '2026-07-27', '2026-07-29', '2026-07-31',
      '2026-08-03', '2026-08-05', '2026-08-07',
    ]
    dates.forEach((iso, i) => ws.push(workout(iso, {
      routine_id: 'cycle-1',
      routine_day_id: `d${(i % 3) + 1}`,
    })))
    return ws
  }

  it('sin ciclo activo no proyecta', () => {
    expect(projectCycle({ activeCycle: null, workouts: history(), from })).toEqual([])
    expect(projectCycle({ activeCycle: cycle(0), workouts: history(), from })).toEqual([])
  })

  it('sin señal de cadencia no proyecta', () => {
    expect(projectCycle({ activeCycle: cycle(), workouts: [], from })).toEqual([])
  })

  it('coloca los días del ciclo sobre los días en que se entrena', () => {
    const got = projectCycle({ activeCycle: cycle(), workouts: history(), from, horizonDays: 14 })
    expect(got.map(g => g.date)).toEqual([
      '2026-08-10', '2026-08-12', '2026-08-14',
      '2026-08-17', '2026-08-19', '2026-08-21',
    ])
  })

  it('sigue la rotación desde el último entreno, sin reiniciarla', () => {
    // El último registrado fue d3 → toca d1, d2, d3, d1…
    const got = projectCycle({ activeCycle: cycle(), workouts: history(), from, horizonDays: 14 })
    expect(got.map(g => g.day.id)).toEqual(['d1', 'd2', 'd3', 'd1', 'd2', 'd3'])
  })

  it('cede el sitio a un plan escrito a mano', () => {
    const got = projectCycle({
      activeCycle: cycle(),
      workouts: history(),
      sessions: [session('2026-08-12', { kind: 'cardio' })],
      from,
      horizonDays: 14,
    })
    expect(got.map(g => g.date)).not.toContain('2026-08-12')
    // Y la rotación no se salta un día: lo que iba el 12 pasa al 14.
    expect(got.find(g => g.date === '2026-08-14').day.id).toBe('d2')
  })

  it('no proyecta sobre un día ya entrenado', () => {
    const ws = [...history(), workout('2026-08-10', { routine_id: 'cycle-1', routine_day_id: 'd1' })]
    const got = projectCycle({ activeCycle: cycle(), workouts: ws, from, horizonDays: 7 })
    expect(got.map(g => g.date)).not.toContain('2026-08-10')
  })

  it('nunca proyecta hacia el pasado', () => {
    const got = projectCycle({ activeCycle: cycle(), workouts: history(), from, horizonDays: 30 })
    expect(got.every(g => g.date >= '2026-08-10')).toBe(true)
  })

  it('projectionByDate indexa por fecha', () => {
    const map = projectionByDate({ activeCycle: cycle(), workouts: history(), from, horizonDays: 7 })
    expect(Object.keys(map)).toEqual(['2026-08-10', '2026-08-12', '2026-08-14'])
    expect(map['2026-08-10'].day.id).toBe('d1')
  })
})

// getNextRoutineDay se mudó aquí desde useRoutines (donde arrastraba supabase).
// Su contrato no cambia — estas pruebas lo fijan.
describe('getNextRoutineDay', () => {
  it('sin historial empieza por el primer día', () => {
    expect(getNextRoutineDay(cycle(), []).id).toBe('d1')
  })

  it('avanza al siguiente y da la vuelta al final', () => {
    const c = cycle()
    const w = (dayId, iso) => workout(iso, { routine_id: 'cycle-1', routine_day_id: dayId })
    expect(getNextRoutineDay(c, [w('d1', '2026-08-03')]).id).toBe('d2')
    expect(getNextRoutineDay(c, [w('d3', '2026-08-03')]).id).toBe('d1')
  })

  it('ignora entrenos libres y de otras rutinas', () => {
    const c = cycle()
    const free = workout('2026-08-05')
    const other = workout('2026-08-06', { routine_id: 'otra', routine_day_id: 'x1' })
    const mine = workout('2026-08-03', { routine_id: 'cycle-1', routine_day_id: 'd1' })
    expect(getNextRoutineDay(c, [free, other, mine]).id).toBe('d2')
  })

  it('si el día ya no existe (rutina editada) reinicia', () => {
    const c = cycle()
    const gone = workout('2026-08-03', { routine_id: 'cycle-1', routine_day_id: 'borrado' })
    expect(getNextRoutineDay(c, [gone]).id).toBe('d1')
  })

  it('sin ciclo o sin días devuelve null', () => {
    expect(getNextRoutineDay(null, [])).toBeNull()
    expect(getNextRoutineDay(cycle(0), [])).toBeNull()
  })
})

describe('recurringDates', () => {
  it('reparte las ocurrencias cada siete días', () => {
    expect(recurringDates('2026-08-11', 4)).toEqual([
      '2026-08-11', '2026-08-18', '2026-08-25', '2026-09-01',
    ])
  })

  it('una sola ocurrencia es el día que le diste', () => {
    expect(recurringDates('2026-08-11', 1)).toEqual(['2026-08-11'])
    expect(recurringDates('2026-08-11', 0)).toEqual(['2026-08-11'])
  })

  it('cruza el cambio de mes y de año sin desviarse', () => {
    expect(recurringDates('2026-12-28', 3)).toEqual(['2026-12-28', '2027-01-04', '2027-01-11'])
  })

  it('no materializa más allá del tope', () => {
    expect(recurringDates('2026-08-11', 999)).toHaveLength(MAX_SERIES_OCCURRENCES)
  })
})

describe('lo registrado en una sesión', () => {
  it('solo cardio y movilidad llevan cifras propias', () => {
    expect(isLoggable('cardio')).toBe(true)
    expect(isLoggable('mobility')).toBe(true)
    // La fuerza se registra serie a serie, no aquí.
    expect(isLoggable('strength')).toBe(false)
    expect(isLoggable('rest')).toBe(false)
    expect(isLoggable('note')).toBe(false)
  })

  it('resume lo que hay, y solo lo que hay', () => {
    expect(formatSessionLog({ duration_min: 45, distance_km: 8.2, rpe: 7 }))
      .toBe('45 min · 8,2 km · RPE 7')
    expect(formatSessionLog({ duration_min: 30 })).toBe('30 min')
    expect(formatSessionLog({ rpe: 6 })).toBe('RPE 6')
  })

  it('un dato ausente no se inventa como cero', () => {
    // Media hora de bici sin mirar el cuentakilómetros no son 0 km.
    expect(formatSessionLog({ duration_min: 30, distance_km: null })).toBe('30 min')
    expect(formatSessionLog({ duration_min: 30, distance_km: 0, rpe: 0 })).toBe('30 min')
    expect(formatSessionLog({})).toBe('')
    expect(formatSessionLog(null)).toBe('')
  })
})

describe('loggedMinutes', () => {
  const s = (over) => ({ date: '2026-08-11', kind: 'cardio', status: 'done', duration_min: 30, ...over })

  it('suma los minutos de lo hecho', () => {
    expect(loggedMinutes([s(), s({ duration_min: 20, kind: 'mobility' })])).toBe(50)
  })

  it('un plan sin cumplir no son minutos entrenados', () => {
    expect(loggedMinutes([s({ status: 'planned' }), s({ status: 'skipped' })])).toBe(0)
  })

  it('la fuerza no cuenta aquí: sus minutos no se registran en esta tabla', () => {
    expect(loggedMinutes([s({ kind: 'strength' }), s({ kind: 'rest' })])).toBe(0)
  })

  it('respeta el rango de fechas', () => {
    const ws = [s({ date: '2026-08-03' }), s({ date: '2026-08-11' }), s({ date: '2026-08-20' })]
    expect(loggedMinutes(ws, { from: '2026-08-10', to: '2026-08-16' })).toBe(30)
  })

  it('una sesión sin duración no aporta', () => {
    expect(loggedMinutes([s({ duration_min: null })])).toBe(0)
  })
})

describe('recurringDates — cadencia', () => {
  it('una descarga cada cuatro semanas cae cada 28 días', () => {
    expect(recurringDates('2026-08-03', 4, 4)).toEqual([
      '2026-08-03', '2026-08-31', '2026-09-28', '2026-10-26',
    ])
  })

  it('sin cadencia declarada es semanal', () => {
    expect(recurringDates('2026-08-03', 2)).toEqual(['2026-08-03', '2026-08-10'])
    expect(recurringDates('2026-08-03', 2, 0)).toEqual(['2026-08-03', '2026-08-10'])
  })

  it('el tope es de filas, no de semanas', () => {
    // Cada ocho semanas, 26 ocurrencias son cuatro años: el tope no lo recorta.
    expect(recurringDates('2026-08-03', 26, 8)).toHaveLength(26)
    expect(recurringDates('2026-08-03', 40, 8)).toHaveLength(MAX_SERIES_OCCURRENCES)
  })
})

describe('weekAdherence', () => {
  const s = (iso, over = {}) => ({ date: iso, kind: 'strength', status: 'planned', ...over })
  // Semana del lunes 10 al domingo 16 de agosto de 2026.
  const wed = new Date(2026, 7, 12)

  it('cuenta lo prometido y lo cumplido de esa semana', () => {
    const got = weekAdherence([
      s('2026-08-10', { status: 'done' }),
      s('2026-08-12', { kind: 'cardio', status: 'done' }),
      s('2026-08-14'),
    ], wed)
    expect(got).toEqual({ planned: 3, done: 2 })
  })

  it('no cuenta lo que no es una tarea', () => {
    // Un descanso cumplido no es un logro y una nota no se hace.
    const got = weekAdherence([
      s('2026-08-10', { kind: 'rest', status: 'done' }),
      s('2026-08-11', { kind: 'note' }),
      s('2026-08-12', { kind: 'deload' }),
    ], wed)
    expect(got).toEqual({ planned: 0, done: 0 })
  })

  it('un saltado cuenta como prometido, no como cumplido', () => {
    expect(weekAdherence([s('2026-08-10', { status: 'skipped' })], wed))
      .toEqual({ planned: 1, done: 0 })
  })

  it('se queda dentro de su semana, de lunes a domingo', () => {
    const got = weekAdherence([
      s('2026-08-09'), // domingo anterior
      s('2026-08-10'), // lunes
      s('2026-08-16'), // domingo
      s('2026-08-17'), // lunes siguiente
    ], wed)
    expect(got.planned).toBe(2)
  })

  it('sin sesiones no hay nada que cumplir', () => {
    expect(weekAdherence([], wed)).toEqual({ planned: 0, done: 0 })
    expect(weekAdherence(null, wed)).toEqual({ planned: 0, done: 0 })
  })
})
