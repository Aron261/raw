// @vitest-environment jsdom
//
// La pantalla del día es donde la planificación deja de ser decorativa: aquí se
// fija una previsión, se repite una sesión y se borra una serie. Las tres
// tocan varios días de calendario de una vez, así que lo que se prueba es que
// hagan exactamente lo que dicen — ni un día más.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

vi.mock('../../hooks/useLang', () => ({
  useLang: () => ({ t: (x) => x, locale: 'es-CO', lang: 'es' }),
}))
// Cuenta Pro: el formulario con series recurrentes es el camino que estas
// pruebas ejercitan; el candado free tiene su propio componente.
vi.mock('../../hooks/usePlan', () => ({ usePlan: () => ({ plan: 'pro', isPro: true, isCoach: false, loading: false }) }))

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))

const startWorkoutFromRoutineDay = vi.fn(async () => ({ id: 'new-workout' }))
vi.mock('../../hooks/useStartRoutineWorkout', () => ({
  useStartRoutineWorkout: () => ({ startWorkoutFromRoutineDay }),
}))

// La pantalla del día es ahora también comida y peso: los dos cuelgan de supabase.
let mockEntries = []
let mockWeightLogs = []
const addLog = vi.fn(async () => ({ id: 'w1' }))
const addEntry = vi.fn(async () => ({ id: 'n1' }))
const updateEntry = vi.fn(async () => ({}))
const deleteEntry = vi.fn(async () => {})
vi.mock('../../hooks/useNutrition', () => ({
  useNutritionDay: () => ({
    entries: mockEntries, loading: false, addEntry, updateEntry, deleteEntry,
  }),
  useNutritionTargets: () => ({ targets: { kcal: 3000, protein_g: 180, carbs_g: 400, fat_g: 80 } }),
  useMyFoods: () => ({ foods: [], saveFood: vi.fn(async () => {}) }),
  MEALS: [
    { id: 'desayuno', label: 'Desayuno' }, { id: 'almuerzo', label: 'Almuerzo' },
    { id: 'cena', label: 'Cena' }, { id: 'snack', label: 'Snack' },
  ],
  DEFAULT_TARGETS: { kcal: 2000, protein_g: 150, carbs_g: 200, fat_g: 60 },
}))
vi.mock('../../hooks/useBodyWeight', () => ({
  useBodyWeight: () => ({
    logs: mockWeightLogs,
    latestLog: mockWeightLogs[mockWeightLogs.length - 1] || null,
    addLog,
    adding: false,
  }),
}))

vi.mock('motion/react', async () => {
  const React = await import('react')
  const mv = () => ({ get: () => 0, set: () => {}, on: () => () => {} })
  return {
    useReducedMotion: () => true,
    useMotionValue: mv,
    useMotionValueEvent: () => {},
    useDragControls: () => ({ start: () => {} }),
    // Sheet cierra con `animate(...).finished.then(...)`: sin esa promesa el
    // cierre revienta dentro del oyente de teclado y la hoja se queda pegada.
    animate: () => ({ finished: Promise.resolve(), stop: () => {} }),
    motion: new Proxy({}, {
      get: (_t, tag) => React.forwardRef(function M(props, ref) {
        const {
          whileTap, transition, drag, dragControls, dragListener, dragConstraints,
          dragElastic, onDragEnd, style, initial, animate: _a, exit, ...rest
        } = props
        return React.createElement(String(tag), { ...rest, style: style || {}, ref })
      }),
    }),
  }
})

import DayView from './DayView'

const routines = [{
  id: 'r1',
  name: 'PPL',
  routine_days: [{
    id: 'rd1',
    day_name: 'Push',
    routine_day_exercises: [{ exercise_name: 'Press banca' }, { exercise_name: 'Fondos' }],
  }],
}]

const props = (over = {}) => ({
  date: new Date(2026, 7, 11),
  workouts: [],
  sessions: [],
  routines,
  ghost: null,
  onCreate: vi.fn(async () => {}),
  onUpdate: vi.fn(async () => {}),
  onDelete: vi.fn(async () => {}),
  onDeleteSeries: vi.fn(async () => {}),
  onClose: vi.fn(),
  ...over,
})

// El reloj se fija en el día que usan las pruebas. Sin esto, «el futuro no se
// pesa» convierte al 11 de agosto en futuro o en pasado según cuándo se corra
// la suite, y media docena de pruebas empiezan a fallar solas con el tiempo.
// shouldAdvanceTime deja que waitFor siga funcionando.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 7, 11, 9, 0, 0))
  navigate.mockClear()
  startWorkoutFromRoutineDay.mockClear()
  addLog.mockClear()
  mockEntries = []
  mockWeightLogs = []
})
afterEach(() => { vi.useRealTimers(); cleanup() })

describe('DayView — la previsión del ciclo', () => {
  const ghost = {
    date: '2026-08-11', routineId: 'r1', routineName: 'PPL',
    day: { id: 'rd1', day_name: 'Push' }, ghost: true,
  }

  it('la muestra con lo que trae el día, marcada como no escrita', () => {
    render(<DayView {...props({ ghost })} />)
    expect(screen.getByText('Push')).toBeTruthy()
    expect(screen.getByText(/PPL · 2 ej/)).toBeTruthy()
    expect(screen.getByText(/Todavía no está escrito/)).toBeTruthy()
  })

  it('fijarla la convierte en un plan real, vinculado al día de rutina', async () => {
    const p = props({ ghost })
    render(<DayView {...p} />)
    fireEvent.click(screen.getByText('Fijar'))
    await waitFor(() => expect(p.onCreate).toHaveBeenCalledTimes(1))
    expect(p.onCreate.mock.calls[0][0]).toMatchObject({
      date: '2026-08-11',
      kind: 'strength',
      title: 'Push',
      routine_id: 'r1',
      routine_day_id: 'rd1',
    })
  })

  it('empezarla arranca el entreno de ese día y navega', async () => {
    render(<DayView {...props({ ghost })} />)
    fireEvent.click(screen.getByText('Empezar'))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/workout/new-workout'))
    expect(startWorkoutFromRoutineDay.mock.calls[0][0]).toMatchObject({
      routineId: 'r1', routineDayId: 'rd1',
    })
  })

  it('sin previsión no ocupa sitio', () => {
    render(<DayView {...props()} />)
    expect(screen.queryByText('Fijar')).toBeNull()
  })
})

describe('DayView — repetir', () => {
  it('manda las semanas elegidas al crear', async () => {
    const p = props()
    render(<DayView {...p} />)
    fireEvent.click(screen.getByText('4 semanas'))
    fireEvent.click(screen.getByText('Agregar al calendario'))
    await waitFor(() => expect(p.onCreate).toHaveBeenCalledTimes(1))
    expect(p.onCreate.mock.calls[0][0].repeatWeeks).toBe(4)
  })

  it('por defecto no repite', async () => {
    const p = props()
    render(<DayView {...p} />)
    fireEvent.click(screen.getByText('Agregar al calendario'))
    await waitFor(() => expect(p.onCreate).toHaveBeenCalledTimes(1))
    expect(p.onCreate.mock.calls[0][0].repeatWeeks).toBe(1)
  })

  it('una nota suelta no se ofrece repetir', () => {
    render(<DayView {...props()} />)
    expect(screen.getByText('Repetir')).toBeTruthy()
    fireEvent.click(screen.getByText('Nota'))
    expect(screen.queryByText('Repetir')).toBeNull()
  })
})

describe('DayView — borrar', () => {
  const single = {
    id: 's1', date: '2026-08-11', kind: 'cardio', title: 'Bici',
    status: 'planned', series_id: null,
  }
  const inSeries = { ...single, id: 's2', series_id: 'serie-1' }

  it('una sesión suelta se borra de un toque', async () => {
    const p = props({ sessions: [single] })
    render(<DayView {...p} />)
    fireEvent.click(screen.getByLabelText('Eliminar: Bici'))
    await waitFor(() => expect(p.onDelete).toHaveBeenCalledWith('s1'))
    expect(p.onDeleteSeries).not.toHaveBeenCalled()
  })

  it('una de una serie pregunta antes: un día o todos', async () => {
    const p = props({ sessions: [inSeries] })
    render(<DayView {...p} />)
    fireEvent.click(screen.getByLabelText('Eliminar: Bici'))
    // Nada se ha borrado todavía — solo se ha preguntado.
    expect(p.onDelete).not.toHaveBeenCalled()
    expect(screen.getByText('Parte de una serie')).toBeTruthy()

    fireEvent.click(screen.getByText('Solo este día'))
    await waitFor(() => expect(p.onDelete).toHaveBeenCalledWith('s2'))
    expect(p.onDeleteSeries).not.toHaveBeenCalled()
  })

  it('«toda la serie» borra por series_id, no por sesión', async () => {
    const p = props({ sessions: [inSeries] })
    render(<DayView {...p} />)
    fireEvent.click(screen.getByLabelText('Eliminar: Bici'))
    fireEvent.click(screen.getByText('Toda la serie'))
    await waitFor(() => expect(p.onDeleteSeries).toHaveBeenCalledWith('serie-1'))
    expect(p.onDelete).not.toHaveBeenCalled()
  })

  it('declara que una sesión pertenece a una serie', () => {
    render(<DayView {...props({ sessions: [inSeries] })} />)
    expect(screen.getByText('Cardio · Planeado · Parte de una serie')).toBeTruthy()
  })
})

describe('DayView — cardio y movilidad con datos de verdad', () => {
  const cardio = {
    id: 's1', date: '2026-08-11', kind: 'cardio', title: 'Bici',
    status: 'planned', series_id: null,
  }

  it('dar por hecho un cardio pregunta qué hiciste en vez de marcarlo a secas', () => {
    const p = props({ sessions: [cardio] })
    render(<DayView {...p} />)
    fireEvent.click(screen.getByLabelText('Cambiar estado: Bici'))
    // No se cierra nada todavía: primero las cifras.
    expect(p.onUpdate).not.toHaveBeenCalled()
    expect(screen.getByText('¿Qué hiciste?')).toBeTruthy()
  })

  it('guarda duración, distancia y esfuerzo, y cierra la sesión', async () => {
    const p = props({ sessions: [cardio] })
    render(<DayView {...p} />)
    fireEvent.click(screen.getByLabelText('Cambiar estado: Bici'))

    fireEvent.change(screen.getByLabelText('Duración'), { target: { value: '45' } })
    fireEvent.change(screen.getByLabelText('Distancia'), { target: { value: '8.2' } })
    fireEvent.click(screen.getByLabelText('RPE 7'))
    fireEvent.click(screen.getByText('Registrar'))

    await waitFor(() => expect(p.onUpdate).toHaveBeenCalledTimes(1))
    expect(p.onUpdate.mock.calls[0]).toEqual(['s1', {
      status: 'done', duration_min: 45, distance_km: 8.2, rpe: 7,
    }])
  })

  it('lo que no sabes se guarda como desconocido, no como cero', async () => {
    const p = props({ sessions: [cardio] })
    render(<DayView {...p} />)
    fireEvent.click(screen.getByLabelText('Cambiar estado: Bici'))
    fireEvent.change(screen.getByLabelText('Duración'), { target: { value: '30' } })
    fireEvent.click(screen.getByText('Registrar'))

    await waitFor(() => expect(p.onUpdate).toHaveBeenCalledTimes(1))
    expect(p.onUpdate.mock.calls[0][1]).toEqual({
      status: 'done', duration_min: 30, distance_km: null, rpe: null,
    })
  })

  it('la movilidad no pregunta distancia: no te desplazas', () => {
    const p = props({ sessions: [{ ...cardio, kind: 'mobility', title: 'Estiramientos' }] })
    render(<DayView {...p} />)
    fireEvent.click(screen.getByLabelText('Cambiar estado: Estiramientos'))
    expect(screen.getByLabelText('Duración')).toBeTruthy()
    expect(screen.queryByLabelText('Distancia')).toBeNull()
  })

  it('la fuerza sigue marcándose de un toque, sin hoja', async () => {
    const p = props({ sessions: [{ ...cardio, kind: 'strength', title: 'Upper' }] })
    render(<DayView {...p} />)
    fireEvent.click(screen.getByLabelText('Cambiar estado: Upper'))
    await waitFor(() => expect(p.onUpdate).toHaveBeenCalledTimes(1))
    expect(p.onUpdate.mock.calls[0][1].status).toBe('done')
    expect(screen.queryByText('¿Qué hiciste?')).toBeNull()
  })

  it('deshacer un hecho se lleva las cifras que ya no describen nada', async () => {
    const done = { ...cardio, status: 'done', duration_min: 45, distance_km: 8.2, rpe: 7 }
    const p = props({ sessions: [done] })
    render(<DayView {...p} />)
    fireEvent.click(screen.getByLabelText('Cambiar estado: Bici'))
    await waitFor(() => expect(p.onUpdate).toHaveBeenCalledTimes(1))
    expect(p.onUpdate.mock.calls[0][1]).toEqual({
      status: 'skipped', duration_min: null, distance_km: null, rpe: null,
    })
  })

  it('enseña lo registrado y deja corregirlo', () => {
    const done = { ...cardio, status: 'done', duration_min: 45, distance_km: 8.2, rpe: 7 }
    render(<DayView {...props({ sessions: [done] })} />)
    expect(screen.getByText('45 min · 8,2 km · RPE 7')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Editar lo registrado: Bici'))
    expect(screen.getByLabelText('Duración').value).toBe('45')
  })

  it('«Ya lo hice» registra algo que nunca se planeó', async () => {
    const created = [{ id: 'nueva', date: '2026-08-11', kind: 'cardio', status: 'done' }]
    const p = props({ onCreate: vi.fn(async () => created) })
    render(<DayView {...p} />)
    fireEvent.click(screen.getByText('Cardio'))
    fireEvent.click(screen.getByText('Ya lo hice'))

    await waitFor(() => expect(p.onCreate).toHaveBeenCalledTimes(1))
    expect(p.onCreate.mock.calls[0][0]).toMatchObject({
      date: '2026-08-11', kind: 'cardio', status: 'done', repeatWeeks: 1,
    })
    // Y encadena con la hoja de cifras sobre la sesión recién creada
    await waitFor(() => expect(screen.getByText('¿Qué hiciste?')).toBeTruthy())
  })

  it('la fuerza no ofrece registrar a mano: eso es un entreno', () => {
    render(<DayView {...props()} />)
    expect(screen.queryByText('Ya lo hice')).toBeNull()
    fireEvent.click(screen.getByText('Cardio'))
    expect(screen.getByText('Ya lo hice')).toBeTruthy()
  })
})

describe('DayView — la descarga se repite CADA tantas, no tantas seguidas', () => {
  it('ofrece cadencias en vez de semanas seguidas', () => {
    render(<DayView {...props()} />)
    fireEvent.click(screen.getByText('Descarga'))
    expect(screen.getByText('Cada 4 semanas')).toBeTruthy()
    // Nadie hace deload cuatro semanas seguidas.
    expect(screen.queryByText('4 semanas')).toBeNull()
  })

  it('manda cuántas veces y cada cuánto', async () => {
    const p = props()
    render(<DayView {...p} />)
    fireEvent.click(screen.getByText('Descarga'))
    fireEvent.click(screen.getByText('Cada 4 semanas'))
    fireEvent.click(screen.getByText('Agregar al calendario'))
    await waitFor(() => expect(p.onCreate).toHaveBeenCalledTimes(1))
    expect(p.onCreate.mock.calls[0][0]).toMatchObject({ repeatWeeks: 6, repeatEvery: 4 })
  })

  it('cambiar de tipo no arrastra la repetición elegida para el anterior', async () => {
    const p = props()
    render(<DayView {...p} />)
    fireEvent.click(screen.getByText('Cardio'))
    fireEvent.click(screen.getByText('12 semanas'))
    fireEvent.click(screen.getByText('Descarga'))
    fireEvent.click(screen.getByText('Agregar al calendario'))
    await waitFor(() => expect(p.onCreate).toHaveBeenCalledTimes(1))
    expect(p.onCreate.mock.calls[0][0]).toMatchObject({ repeatWeeks: 1, repeatEvery: 1 })
  })
})

// Dos Sheet a la vez se pelean por Escape y por el foco: las dos se enganchan
// al `document`, y stopPropagation no frena a otro oyente del mismo nodo. Con
// la hoja de cifras apilada encima, un Escape cerraba tambien la del dia.
describe('DayView — las hojas no se apilan', () => {
  const cardio = {
    id: 's1', date: '2026-08-11', kind: 'cardio', title: 'Bici', status: 'planned',
  }

  it('la hoja del día cede el sitio mientras se anotan las cifras', () => {
    render(<DayView {...props({ sessions: [cardio] })} />)
    expect(screen.getByText('Agregar al calendario')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Cambiar estado: Bici'))
    expect(screen.getByText('¿Qué hiciste?')).toBeTruthy()
    // Solo una hoja montada: la del día no sigue debajo escuchando teclas.
    expect(screen.queryByText('Agregar al calendario')).toBeNull()
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
  })

  it('cerrar la de cifras devuelve a la del día, no cierra las dos', async () => {
    const p = props({ sessions: [cardio] })
    render(<DayView {...p} />)
    fireEvent.click(screen.getByLabelText('Cambiar estado: Bici'))
    fireEvent.keyDown(document, { key: 'Escape' })

    // El cierre de Sheet es asíncrono (anima y luego avisa).
    await waitFor(() => expect(screen.getByText('Agregar al calendario')).toBeTruthy())
    expect(p.onClose).not.toHaveBeenCalled()
  })
})

describe('DayView — el día entero, no solo el entreno', () => {
  it('resume la comida de ESE día contra el objetivo', () => {
    mockEntries = [
      { id: 'e1', name: 'Avena', kcal: 400, protein_g: 20, carbs_g: 60, fat_g: 8 },
      { id: 'e2', name: 'Pollo con arroz', kcal: 700, protein_g: 55, carbs_g: 70, fat_g: 15 },
    ]
    render(<DayView {...props()} />)
    // El total y el objetivo los lleva el anillo; al lado va lo accionable.
    expect(screen.getByText('1.100')).toBeTruthy()
    expect(screen.getByText('/ 3.000 kcal')).toBeTruthy()
    expect(screen.getByText(/1.900 kcal restantes/)).toBeTruthy()
    expect(screen.getByText('P 75 · C 130 · G 23')).toBeTruthy()
  })

  it('desglosa qué se comió, no solo cuánto', () => {
    mockEntries = [{ id: 'e1', name: 'Avena', kcal: 400, protein_g: 20, carbs_g: 60, fat_g: 8 }]
    render(<DayView {...props()} />)
    expect(screen.getByText('Avena')).toBeTruthy()
    expect(screen.getByText('400 kcal')).toBeTruthy()
  })

  it('avisa cuando te pasaste, en vez de dar un negativo', () => {
    mockEntries = [{ id: 'e1', name: 'Todo', kcal: 3500, protein_g: 0, carbs_g: 0, fat_g: 0 }]
    render(<DayView {...props()} />)
    expect(screen.getByText(/500 kcal de más/)).toBeTruthy()
  })

  it('un día sin comida lo dice y deja añadirla sin salir del día', () => {
    render(<DayView {...props()} />)
    expect(screen.getByText('Sin comidas registradas')).toBeTruthy()
    fireEvent.click(screen.getByText('Añadir comida'))
    // El editor bueno, ahí mismo — no un salto a Nutrición.
    expect(screen.getByText('Agregar comida')).toBeTruthy()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('tocar una comida la abre para corregirla, en el sitio', () => {
    mockEntries = [{ id: 'e1', name: 'Avena', kcal: 400, protein_g: 0, carbs_g: 0, fat_g: 0 }]
    render(<DayView {...props()} />)
    fireEvent.click(screen.getByLabelText('Editar: Avena'))
    expect(screen.getByText('Editar comida')).toBeTruthy()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('el resumen sigue llevando a Nutrición para ver el día completo', () => {
    mockEntries = [{ id: 'e1', name: 'Avena', kcal: 400, protein_g: 0, carbs_g: 0, fat_g: 0 }]
    render(<DayView {...props()} />)
    fireEvent.click(screen.getByText('P 0 · C 0 · G 0'))
    expect(navigate).toHaveBeenCalledWith('/nutrition?d=2026-08-11')
  })

  it('enseña el peso de ese día, no el último de la lista', () => {
    mockWeightLogs = [
      { id: 'a', weight: 80, unit: 'kg', logged_at: '2026-08-11T08:00:00' },
      { id: 'b', weight: 91, unit: 'kg', logged_at: '2026-08-12T08:00:00' },
    ]
    render(<DayView {...props()} />)
    expect(screen.getByText('80')).toBeTruthy()
    expect(screen.queryByText('91')).toBeNull()
  })

  it('deja anotar el peso de un día que ya pasó, fechado en ese día', async () => {
    const p = props()
    render(<DayView {...p} />)
    fireEvent.change(screen.getByLabelText('Peso corporal'), { target: { value: '80.4' } })
    fireEvent.click(screen.getByText('Guardar'))
    await waitFor(() => expect(addLog).toHaveBeenCalledTimes(1))
    // El cuarto argumento es la fecha: sin él, el peso del martes entra el jueves.
    expect(addLog.mock.calls[0]).toEqual([80.4, 'kg', null, '2026-08-11T12:00:00'])
  })

  it('hereda la unidad en la que te pesaste la última vez', async () => {
    mockWeightLogs = [{ id: 'a', weight: 176, unit: 'lb', logged_at: '2026-08-01T08:00:00' }]
    render(<DayView {...props()} />)
    fireEvent.change(screen.getByLabelText('Peso corporal'), { target: { value: '177' } })
    fireEvent.click(screen.getByText('Guardar'))
    await waitFor(() => expect(addLog).toHaveBeenCalledTimes(1))
    expect(addLog.mock.calls[0][1]).toBe('lb')
  })

  it('el futuro no se pesa', () => {
    render(<DayView {...props({ date: new Date(2099, 0, 1) })} />)
    expect(screen.queryByLabelText('Peso corporal')).toBeNull()
  })
})
