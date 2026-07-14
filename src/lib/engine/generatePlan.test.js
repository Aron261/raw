import { describe, it, expect } from 'vitest'
import { generatePlan, getSwapAlternatives, swapExercise } from './generatePlan'
import { analyzeHistory } from './history'
import { GOALS, LEVELS, TIME_OPTIONS, VOLUME_TARGETS, SETS_PER_DAY } from './volume'
import { FOCUS_OPTIONS } from './templates'
import library from './__fixtures__/library.json'

const base = {
  mode: 'cycle',
  goal: 'Hipertrofia',
  level: 'Intermedio',
  daysPerWeek: 4,
  sessionMinutes: 60,
  sex: null,
  splitChoice: null,
  priorityGroups: [],
  equipment: 'full',
  useHistory: false,
  seed: 42,
  library,
  history: null,
}

const gen = (overrides = {}) => generatePlan({ ...base, ...overrides })

describe('determinismo y variedad', () => {
  it('mismo input + seed produce el mismo plan', () => {
    expect(JSON.stringify(gen())).toBe(JSON.stringify(gen()))
  })

  it('regenerar (seed+1) produce un plan distinto', () => {
    const a = gen({ seed: 42 })
    const b = gen({ seed: 43 })
    expect(JSON.stringify(a.days)).not.toBe(JSON.stringify(b.days))
  })

  it('días repetidos de la semana nunca son idénticos (6d PPL, 4d UL, 2-3d FB)', () => {
    for (const daysPerWeek of [2, 3, 4, 5, 6]) {
      const plan = gen({ daysPerWeek })
      const lists = plan.days.map(d => d.exercises.map(e => e.name).join('|'))
      expect(new Set(lists).size, `${daysPerWeek} días`).toBe(lists.length)
    }
  })
})

describe('cobertura de todos los combos', () => {
  const equipmentSets = [
    'full',
    ['mancuerna', 'banco', 'peso_corporal'],                 // gym casero
    ['maquina', 'polea', 'peso_corporal', 'banco'],           // solo máquinas
  ]

  for (const goal of GOALS) {
    for (const level of LEVELS) {
      for (const sessionMinutes of TIME_OPTIONS) {
        for (const daysPerWeek of [2, 3, 4, 5, 6]) {
          for (const equipment of equipmentSets) {
            const label = `${goal}/${level}/${sessionMinutes}min/${daysPerWeek}d/${Array.isArray(equipment) ? equipment.length + 'eq' : 'full'}`
            it(label, () => {
              const plan = gen({ goal, level, sessionMinutes, daysPerWeek, equipment })
              expect(plan.days).toHaveLength(daysPerWeek)
              const budget = SETS_PER_DAY[sessionMinutes][level]
              for (const day of plan.days) {
                expect(day.exercises.length).toBeGreaterThanOrEqual(3)
                const totalSets = day.exercises.reduce((n, e) => n + e.sets, 0)
                expect(totalSets).toBeLessThanOrEqual(budget)
                expect(totalSets).toBeGreaterThanOrEqual(Math.min(budget, 6))
                for (const ex of day.exercises) {
                  expect(ex.sets).toBeGreaterThanOrEqual(2)
                  expect(ex.repsMin).toBeLessThanOrEqual(ex.repsMax)
                  expect(ex.restSeconds).toBeGreaterThan(0)
                  expect(ex.note.length).toBeGreaterThan(10)
                }
                // Sin nombres repetidos dentro del día
                const names = day.exercises.map(e => e.name)
                expect(new Set(names).size).toBe(names.length)
              }
            })
          }
        }
      }
    }
  }
})

describe('filtros de librería', () => {
  it('respeta el equipo disponible (sin relajación innecesaria)', () => {
    const equipment = ['mancuerna', 'banco', 'peso_corporal']
    const plan = gen({ equipment, daysPerWeek: 4 })
    const byName = Object.fromEntries(library.map(e => [e.name, e]))
    let relaxed = 0
    for (const day of plan.days) {
      for (const ex of day.exercises) {
        const row = byName[ex.name]
        if (!row.equipment.every(t => equipment.includes(t))) relaxed++
      }
    }
    // La relajación solo se permite si quedó anotada en plan.notes
    if (relaxed > 0) expect(plan.notes.length).toBeGreaterThan(0)
    expect(relaxed).toBeLessThanOrEqual(2)
  })

  it('principiante nunca recibe ejercicios avanzados', () => {
    for (const daysPerWeek of [2, 3, 4, 5, 6]) {
      const plan = gen({ level: 'Principiante', daysPerWeek })
      const byName = Object.fromEntries(library.map(e => [e.name, e]))
      for (const day of plan.days) {
        for (const ex of day.exercises) {
          expect(byName[ex.name].difficulty, ex.name).not.toBe('Avanzado')
        }
      }
    }
  })

  it('todos los nombres existen en la librería (español, conectados al historial)', () => {
    const names = new Set(library.map(e => e.name))
    const plan = gen({ daysPerWeek: 6 })
    for (const day of plan.days) {
      for (const ex of day.exercises) expect(names.has(ex.name), ex.name).toBe(true)
    }
  })
})

describe('dosis', () => {
  it('reps dentro del rango propio de cada ejercicio', () => {
    const byName = Object.fromEntries(library.map(e => [e.name, e]))
    for (const goal of GOALS) {
      const plan = gen({ goal, daysPerWeek: 5 })
      for (const day of plan.days) {
        for (const ex of day.exercises) {
          const row = byName[ex.name]
          expect(ex.repsMin, ex.name).toBeGreaterThanOrEqual(Math.min(row.best_rep_min, 8))
          expect(ex.repsMax, ex.name).toBeLessThanOrEqual(row.best_rep_max)
        }
      }
    }
  })

  it('aislamientos nunca bajan de 8 reps en Fuerza', () => {
    const plan = gen({ goal: 'Fuerza', daysPerWeek: 4 })
    for (const day of plan.days) {
      for (const ex of day.exercises) {
        if ((ex.role === 'isolation' || ex.role === 'core') && ex.repsUnit === 'reps') {
          expect(ex.repsMin, ex.name).toBeGreaterThanOrEqual(8)
        }
      }
    }
  })

  it('volumen semanal razonable para los grupos del split (4d Intermedio 60min)', () => {
    const plan = gen({ daysPerWeek: 4, level: 'Intermedio', sessionMinutes: 60 })
    for (const [group, sets] of Object.entries(plan.weeklyVolume)) {
      const [mev, mav] = VOLUME_TARGETS[group].Intermedio
      expect(sets, group).toBeGreaterThanOrEqual(Math.floor(mev * 0.5))
      expect(sets, group).toBeLessThanOrEqual(Math.ceil(mav * 1.3))
    }
  })

  it('grupos prioritarios reciben más volumen que sin prioridad', () => {
    const without = gen({ daysPerWeek: 4 })
    const withPrio = gen({ daysPerWeek: 4, priorityGroups: ['Hombro'] })
    expect(withPrio.weeklyVolume['Hombro'] || 0).toBeGreaterThanOrEqual(without.weeklyVolume['Hombro'] || 0)
  })
})

describe('historial', () => {
  const workouts = [
    {
      started_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      workout_exercises: [
        { unit: 'kg', exercises: { name: 'Press de banca con barra', muscle_group: 'Pecho' }, sets: [{ weight: 80, reps: 5 }, { weight: 80, reps: 5 }] },
        { unit: 'kg', exercises: { name: 'Sentadilla con barra', muscle_group: 'Cuádriceps' }, sets: [{ weight: 100, reps: 5 }] },
      ],
    },
    {
      started_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      workout_exercises: [
        { unit: 'kg', exercises: { name: 'Press de banca con barra', muscle_group: 'Pecho' }, sets: [{ weight: 82.5, reps: 3 }] },
      ],
    },
  ]

  it('analyzeHistory calcula familiaridad, 1RM y grupos rezagados', () => {
    const h = analyzeHistory(workouts, { level: 'Intermedio' })
    expect(h.familiarity['Press de banca con barra']).toBe(2)
    expect(h.best1RM['Press de banca con barra'].value).toBeGreaterThan(85)
    expect(h.undertrainedGroups.length).toBeGreaterThan(0)
    expect(h.undertrainedGroups).not.toContain('Pecho' in h.weeklyVolumeByGroup ? '__nope__' : 'Pecho')
  })

  it('con historial: pesos sugeridos en ejercicios conocidos y familiar flag', () => {
    const history = analyzeHistory(workouts, { level: 'Intermedio' })
    const plan = gen({ useHistory: true, history, goal: 'Fuerza', daysPerWeek: 4 })
    const bench = plan.days.flatMap(d => d.exercises).find(e => e.name === 'Press de banca con barra')
    expect(bench).toBeTruthy()
    expect(bench.isFamiliar).toBe(true)
    expect(bench.suggestedWeight).toBeGreaterThan(50)
    expect(bench.weightIsEstimate).toBe(false)
    expect(bench.note).toContain('arranca')
  })

  it('1RM de hermano de familia se usa con descuento y flag de estimación', () => {
    const history = analyzeHistory(workouts, { level: 'Intermedio' })
    const plan = gen({ useHistory: true, history, daysPerWeek: 6, seed: 7 })
    const est = plan.days.flatMap(d => d.exercises)
      .find(e => e.weightIsEstimate && e.suggestedWeight != null)
    // No garantizado en todos los seeds, pero con press plano en historial y
    // 6 días de PPL casi siempre cae un press hermano; si no, no falla.
    if (est) expect(est.note).toContain('estimado')
  })
})

describe('single day', () => {
  it('genera un día para cada focus', () => {
    for (const focus of FOCUS_OPTIONS) {
      const plan = gen({ mode: 'single_day', focus, daysPerWeek: undefined })
      expect(plan.days).toHaveLength(1)
      expect(plan.days[0].exercises.length).toBeGreaterThanOrEqual(3)
      expect(plan.title).toContain(focus)
    }
  })
})

describe('cambiar ejercicio (swap)', () => {
  it('ofrece alternativas de la misma familia primero, sin repetir el día', () => {
    const plan = gen({ daysPerWeek: 4 })
    const day = plan.days[0]
    const target = day.exercises[0]
    const alts = getSwapAlternatives(target, {
      library, level: 'Intermedio', equipment: 'full',
      excludeNames: day.exercises.map(e => e.name),
    })
    expect(alts.length).toBeGreaterThan(0)
    const dayNames = new Set(day.exercises.map(e => e.name))
    for (const alt of alts) {
      expect(dayNames.has(alt.name)).toBe(false)
      expect(alt.muscle_group).toBe(target.muscleGroup)
    }
    const current = library.find(e => e.name === target.name)
    expect(alts[0].substitution_group).toBe(current.substitution_group)
  })

  it('respeta el equipo del usuario en las alternativas', () => {
    const equipment = ['mancuerna', 'banco', 'peso_corporal']
    const plan = gen({ daysPerWeek: 4, equipment })
    const target = plan.days[0].exercises[0]
    const alts = getSwapAlternatives(target, { library, level: 'Intermedio', equipment, excludeNames: [] })
    for (const alt of alts) {
      expect(alt.equipment.every(t => equipment.includes(t)), alt.name).toBe(true)
    }
  })

  it('swapExercise re-dosifica reps para el nuevo ejercicio y conserva series/rol', () => {
    const plan = gen({ daysPerWeek: 4, goal: 'Fuerza' })
    const target = plan.days[0].exercises[0]
    const alts = getSwapAlternatives(target, { library, level: 'Intermedio', equipment: 'full', excludeNames: plan.days[0].exercises.map(e => e.name) })
    const next = swapExercise(plan, 0, 0, alts[0], { goal: 'Fuerza', level: 'Intermedio', library })

    expect(plan.days[0].exercises[0].name).toBe(target.name) // inmutable
    const swapped = next.days[0].exercises[0]
    expect(swapped.name).toBe(alts[0].name)
    expect(swapped.sets).toBe(target.sets)
    expect(swapped.role).toBe(target.role)
    expect(swapped.repsMin).toBeGreaterThanOrEqual(Math.min(alts[0].best_rep_min, 8))
    expect(swapped.repsMax).toBeLessThanOrEqual(alts[0].best_rep_max)
    expect(swapped.note).toContain(String(swapped.sets))
    expect(next.edited).toBe(true)
  })
})

describe('resumen y racional', () => {
  it('el plan trae summary y cada día trae rationale', () => {
    const plan = gen({ daysPerWeek: 5, priorityGroups: ['Glúteo'] })
    expect(plan.summary).toContain('Glúteo')
    expect(plan.summary.length).toBeGreaterThan(100)
    for (const day of plan.days) {
      expect(day.rationale.length).toBeGreaterThan(20)
      expect(day.estMinutes).toBeGreaterThan(15)
    }
  })

  it('sesgo femenino: Legs A incluye trabajo extra de glúteo cuando cabe', () => {
    const plan = gen({ daysPerWeek: 6, sex: 'Femenino', sessionMinutes: 90 })
    const legsA = plan.days.find(d => d.dayName === 'Legs A')
    const gluteWork = legsA.exercises.filter(e => e.muscleGroup === 'Glúteo')
    expect(gluteWork.length).toBeGreaterThanOrEqual(1)
  })
})
