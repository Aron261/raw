// Las piezas puras del enlace compartido.
//
// La que de verdad importa es sharedRoutineToInput: es el puente entre lo que
// devuelve get_shared_routine y lo que acepta create_routine_tree. Si se
// desalinea, guardar una rutina compartida falla —o peor, guarda un plan a
// medias— y solo se nota con el enlace ya en manos de otra persona.

import { describe, it, expect } from 'vitest'
import { shareUrl, sharePath, countExercises, countDays, shareMessage, sharedRoutineToInput, routineToInput } from './share'

const SNAPSHOT = {
  name: 'Push Pull Legs',
  description: 'Tres días, dos vueltas por semana.',
  type: 'cycle',
  goal: 'Hipertrofia',
  level: 'Intermedio',
  days_per_week: 3,
  days: [
    {
      day_name: 'Push',
      focus: 'Pecho y hombro',
      exercises: [
        { exercise_name: 'Press de banca con barra', sets: 4, reps: '6-8', rest_seconds: 150, notes: 'Controla la bajada' },
        { exercise_name: 'Press militar con mancuernas', sets: 3, reps: '10', rest_seconds: null, notes: null },
      ],
    },
    { day_name: 'Pull', focus: null, exercises: [{ exercise_name: 'Dominadas', sets: 4, reps: 'Al fallo' }] },
  ],
  shared_by: 'Pedro',
  token: 'abc123',
  import_count: 2,
}

describe('shareUrl', () => {
  it('construye la URL absoluta del enlace', () => {
    expect(shareUrl('abc123', 'https://raw-red.vercel.app')).toBe('https://raw-red.vercel.app/r/abc123')
  })

  it('no duplica la barra si el origin trae una', () => {
    expect(shareUrl('abc123', 'https://raw-red.vercel.app/')).toBe('https://raw-red.vercel.app/r/abc123')
  })

  it('sin token no inventa un enlace', () => {
    expect(shareUrl(null, 'https://raw-red.vercel.app')).toBe('')
  })
})

describe('sharePath', () => {
  it('es la ruta a la que volver tras el login', () => {
    expect(sharePath('abc123')).toBe('/r/abc123')
  })
})

describe('conteos', () => {
  it('cuenta días y ejercicios de todo el plan', () => {
    expect(countDays(SNAPSHOT)).toBe(2)
    expect(countExercises(SNAPSHOT)).toBe(3)
  })

  it('tolera un plan vacío', () => {
    expect(countDays(null)).toBe(0)
    expect(countExercises({})).toBe(0)
  })
})

describe('shareMessage', () => {
  it('dice qué es, de quién y dónde', () => {
    const msg = shareMessage(SNAPSHOT, 'https://raw-red.vercel.app/r/abc123')
    expect(msg).toContain('Push Pull Legs')
    expect(msg).toContain('de Pedro')
    expect(msg).toContain('https://raw-red.vercel.app/r/abc123')
  })

  it('omite el autor si el enlace no lo trae', () => {
    expect(shareMessage({ name: 'Full Body' }, 'u')).not.toContain('de ')
  })
})

describe('sharedRoutineToInput', () => {
  it('conserva el plan entero y lo marca como compartido', () => {
    const input = sharedRoutineToInput(SNAPSHOT)

    expect(input.name).toBe('Push Pull Legs')
    expect(input.type).toBe('cycle')
    expect(input.source).toBe('shared')
    expect(input.goal).toBe('Hipertrofia')
    expect(input.level).toBe('Intermedio')
    expect(input.days_per_week).toBe(3)
    expect(input.description).toBe('Tres días, dos vueltas por semana.')

    expect(input.days).toHaveLength(2)
    expect(input.days[0].day_name).toBe('Push')
    expect(input.days[0].focus).toBe('Pecho y hombro')
    expect(input.days[0].exercises[0]).toEqual({
      exercise_name: 'Press de banca con barra',
      sets: 4, reps: '6-8', rest_seconds: 150, notes: 'Controla la bajada',
    })
    // Los campos ausentes viajan como null, no como undefined: create_routine_tree
    // lee el jsonb y undefined desaparecería del payload.
    expect(input.days[1].exercises[0].rest_seconds).toBeNull()
    expect(input.days[1].focus).toBeNull()
  })

  it('la copia nunca llega activa', () => {
    expect(sharedRoutineToInput(SNAPSHOT).is_active).toBeUndefined()
  })

  it('respeta las rutinas de un día', () => {
    expect(sharedRoutineToInput({ ...SNAPSHOT, type: 'single_day' }).type).toBe('single_day')
  })

  it('un type desconocido cae en ciclo, no en un valor que el CHECK rechace', () => {
    expect(sharedRoutineToInput({ ...SNAPSHOT, type: 'inventado' }).type).toBe('cycle')
  })

  it('permite renombrar la copia al guardarla', () => {
    expect(sharedRoutineToInput(SNAPSHOT, { name: '  Mi PPL  ' }).name).toBe('Mi PPL')
  })

  it('una rutina sin nombre no se guarda sin nombre', () => {
    expect(sharedRoutineToInput({ ...SNAPSHOT, name: '   ' }).name).toBe('Rutina compartida')
  })

  it('sin plan, falla claro en vez de guardar una rutina vacía', () => {
    expect(() => sharedRoutineToInput(null)).toThrow()
  })
})

describe('routineToInput', () => {
  // Forma en la que useRoutines entrega una rutina propia: días y ejercicios
  // anidados y ya ordenados.
  const ROUTINE = {
    id: 'rut-1',
    name: 'Full Body',
    type: 'single_day',
    goal: null,
    level: 'Principiante',
    days_per_week: null,
    routine_days: [
      {
        id: 'd1', day_name: 'Full', day_order: 0, focus: 'Todo',
        routine_day_exercises: [
          { id: 'e1', exercise_name: 'Sentadilla trasera con barra', exercise_order: 0, sets: 5, reps: '5', rest_seconds: 180, notes: 'Sin rebote' },
          { id: 'e2', exercise_name: 'Remo con barra', exercise_order: 1, sets: 3, reps: '10', rest_seconds: null, notes: null },
        ],
      },
    ],
  }

  it('convierte una rutina propia en el payload de create_routine_tree', () => {
    const input = routineToInput(ROUTINE)

    expect(input.name).toBe('Full Body')
    expect(input.type).toBe('single_day')
    expect(input.source).toBe('shared')
    expect(input.level).toBe('Principiante')
    expect(input.days).toHaveLength(1)
    expect(input.days[0].day_name).toBe('Full')
    expect(input.days[0].focus).toBe('Todo')
    expect(input.days[0].exercises.map(e => e.exercise_name)).toEqual([
      'Sentadilla trasera con barra',
      'Remo con barra',
    ])
    expect(input.days[0].exercises[0].notes).toBe('Sin rebote')
  })

  // El id de la rutina original no puede viajar: create_routine_tree crearía…
  // nada, pero un id ajeno en el payload es justo el tipo de dato que acaba
  // pisando la rutina de otra persona si alguien lo usa más adelante.
  it('no arrastra ids de la rutina original', () => {
    const input = routineToInput(ROUTINE)
    expect(input.id).toBeUndefined()
    expect(input.days[0].id).toBeUndefined()
    expect(input.days[0].exercises[0].id).toBeUndefined()
  })

  it('una rutina sin días produce un payload sin días, no un error', () => {
    expect(routineToInput({ name: 'Vacía', type: 'cycle' }).days).toEqual([])
  })
})
