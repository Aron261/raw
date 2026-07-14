// @vitest-environment jsdom
// Test de integración del wizard: recorre los pasos reales (single_day y
// cycle) con la librería curada y verifica que el preview genera y guarda.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

afterEach(cleanup)
import library from '../lib/engine/__fixtures__/library.json'

// Mutables para variar perfil/historial por test sin re-mockear módulos
const mockState = {
  profile: { goal: 'Ganar músculo', level: 'Intermedio', days_per_week: 4, sex: 'Masculino' },
  history: null,
  hasHistory: false,
}

vi.mock('../hooks/useProfile', () => ({
  useProfile: () => ({ profile: mockState.profile }),
}))

vi.mock('../hooks/useGenerationContext', () => ({
  useGenerationContext: () => ({
    library,
    history: mockState.history,
    hasHistory: mockState.hasHistory,
    loading: false,
    error: null,
    refetch: () => {},
  }),
}))

import RecommendedPlanWizard from './RecommendedPlanWizard'
import { analyzeHistory } from '../lib/engine'

const realishWorkouts = [
  {
    started_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    workout_exercises: [
      { unit: 'kg', exercises: { name: 'Press de banca con barra', muscle_group: 'Pecho' }, sets: [{ weight: 80, reps: 6 }] },
      { unit: 'kg', exercises: { name: 'Mi ejercicio inventado', muscle_group: 'Pierna' }, sets: [{ weight: 40, reps: 10 }] },
      { unit: 'lb', exercises: { name: 'Curl raro', muscle_group: null }, sets: [{ weight: null, reps: null }] },
    ],
  },
]

describe('RecommendedPlanWizard single_day', () => {
  let onCreate, onClose

  beforeEach(() => {
    onCreate = vi.fn().mockResolvedValue({ id: 'r1' })
    onClose = vi.fn()
  })

  it('recorre el flujo completo y guarda una rutina de un día', async () => {
    render(<RecommendedPlanWizard mode="single_day" onClose={onClose} onCreate={onCreate} />)

    // Paso 1: enfoque
    fireEvent.click(screen.getByText('Pecho'))
    // Paso 2: tiempo
    fireEvent.click(screen.getByText('60 min'))
    // Paso 3: objetivo
    fireEvent.click(screen.getByText('Hipertrofia'))
    // Paso 4: equipo (gym completo por defecto) → continuar
    fireEvent.click(screen.getByText('Continuar'))

    // Preview: resumen + botón de guardar
    await waitFor(() => {
      expect(screen.getByText('Por qué este plan')).toBeTruthy()
      expect(screen.getByText('Guardar rutina')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Guardar rutina'))
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))

    const data = onCreate.mock.calls[0][0]
    expect(data.type).toBe('single_day')
    expect(data.source).toBe('recommended')
    expect(data.days).toHaveLength(1)
    expect(data.days[0].exercises.length).toBeGreaterThanOrEqual(3)
    expect(onClose).toHaveBeenCalled()
  })

  it('Regenerar produce un plan distinto sin errores', async () => {
    render(<RecommendedPlanWizard mode="single_day" onClose={onClose} onCreate={onCreate} />)
    fireEvent.click(screen.getByText('Espalda'))
    fireEvent.click(screen.getByText('45 min'))
    fireEvent.click(screen.getByText('Fuerza'))
    fireEvent.click(screen.getByText('Continuar'))
    await waitFor(() => expect(screen.getByText('Guardar rutina')).toBeTruthy())

    const before = document.body.textContent
    fireEvent.click(screen.getByText('Regenerar'))
    await waitFor(() => expect(document.body.textContent).not.toBe(before))
  })
})

describe('RecommendedPlanWizard single_day con historial y perfil incompleto', () => {
  it('genera con historial real (nombres libres, unidades mixtas, nulls)', async () => {
    mockState.profile = {}
    mockState.history = analyzeHistory(realishWorkouts, { level: 'Intermedio' })
    mockState.hasHistory = true
    const onCreate = vi.fn().mockResolvedValue({ id: 'r3' })

    render(<RecommendedPlanWizard mode="single_day" onClose={vi.fn()} onCreate={onCreate} />)
    fireEvent.click(screen.getByText('Push'))
    fireEvent.click(screen.getByText('90 min'))
    fireEvent.click(screen.getByText('Fuerza'))
    fireEvent.click(screen.getByText('Continuar'))

    await waitFor(() => expect(screen.getByText('Guardar rutina')).toBeTruthy())
    fireEvent.click(screen.getByText('Guardar rutina'))
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))

    mockState.profile = { goal: 'Ganar músculo', level: 'Intermedio', days_per_week: 4, sex: 'Masculino' }
    mockState.history = null
    mockState.hasHistory = false
  })
})

describe('RecommendedPlanWizard swap en preview', () => {
  it('permite cambiar un ejercicio por una alternativa similar antes de guardar', async () => {
    const onCreate = vi.fn().mockResolvedValue({ id: 'r4' })
    render(<RecommendedPlanWizard mode="single_day" onClose={vi.fn()} onCreate={onCreate} />)

    fireEvent.click(screen.getByText('Pecho'))
    fireEvent.click(screen.getByText('60 min'))
    fireEvent.click(screen.getByText('Hipertrofia'))
    fireEvent.click(screen.getByText('Continuar'))
    await waitFor(() => expect(screen.getByText('Guardar rutina')).toBeTruthy())

    // Abre el selector del primer ejercicio y elige la primera alternativa
    const swapButtons = screen.getAllByLabelText(/Cambiar .* por uno similar/)
    expect(swapButtons.length).toBeGreaterThan(2)
    const originalName = swapButtons[0].getAttribute('aria-label').replace('Cambiar ', '').replace(' por uno similar', '')
    fireEvent.click(swapButtons[0])
    await waitFor(() => expect(screen.getByText('Cambiar por')).toBeTruthy())

    const altButtons = screen.getAllByText(/· (compuesto|aislamiento)/, { exact: false })
    expect(altButtons.length).toBeGreaterThan(0)
    const altName = altButtons[0].closest('button').textContent.split(' ·')[0]
    fireEvent.click(altButtons[0].closest('button'))

    // El ejercicio cambió en el preview y se guarda con el nuevo nombre
    await waitFor(() => expect(screen.getByText(altName)).toBeTruthy())
    fireEvent.click(screen.getByText('Guardar rutina'))
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    const saved = onCreate.mock.calls[0][0]
    const names = saved.days[0].exercises.map(e => e.exercise_name)
    expect(names).toContain(altName)
    expect(names).not.toContain(originalName)
  })
})

describe('RecommendedPlanWizard cycle', () => {
  it('recorre el flujo de ciclo (4 días, prefill de perfil) y guarda', async () => {
    const onCreate = vi.fn().mockResolvedValue({ id: 'r2' })
    const onClose = vi.fn()
    render(<RecommendedPlanWizard mode="cycle" onClose={onClose} onCreate={onCreate} />)

    fireEvent.click(screen.getByText('Hipertrofia'))       // objetivo
    fireEvent.click(screen.getByText('Intermedio'))        // nivel
    fireEvent.click(screen.getByText('60 min'))            // tiempo (días ya prefill = 4)
    fireEvent.click(screen.getByText('Continuar'))         // agenda → equipo
    fireEvent.click(screen.getByText('Continuar'))         // equipo → prioridades
    fireEvent.click(screen.getByText('Generar plan'))      // prioridades → preview

    await waitFor(() => expect(screen.getByText('Guardar ciclo')).toBeTruthy())
    fireEvent.click(screen.getByText('Guardar ciclo'))
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    expect(onCreate.mock.calls[0][0].days).toHaveLength(4)
  })
})
