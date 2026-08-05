// @vitest-environment jsdom
// La hoja de objetivos, con la recomendación.
//
// Lo que de verdad importa probar aquí es que «Usar esto» NO guarda. Es la
// promesa de la pantalla: la app calcula y propone, pero los objetivos de
// alguien no cambian sin que esa persona pulse Guardar. Si eso se rompe, se
// rompe en silencio — la pantalla se ve idéntica.
//
// Y que la recomendación sale del perfil de quien COME. El día que un
// entrenador planifique a un cliente con su propio cuerpo, tampoco se va a ver.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import NutritionTargetsSheet from './NutritionTargetsSheet'
import { recommendPlan, toCm } from '../lib/nutritionPlan'
import { MICRO_KEYS } from '../lib/nutrients'

// Perfil completo: con % de grasa, así que el cálculo va por Katch-McArdle.
const PERFIL = {
  weight: 80, weight_unit: 'kg',
  height: 180, height_unit: 'cm',
  birth_date: '1995-06-15',
  sex: 'Masculino',
  body_fat_pct: 18,
  body_fat_source: 'estimado',
  activity_level: 'moderado',
  nutrition_phase: 'definicion',
  days_per_week: 4,
  goal: 'Perder grasa',
}

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))

vi.mock('../hooks/useLang', () => ({
  useLang: () => ({
    lang: 'es',
    locale: 'es-CO',
    // Interpola como el diccionario real, para que un {marcador} huérfano se vea.
    t: (k, vars) => (vars ? String(k).replace(/\{(\w+)\}/g, (_, n) => vars[n] ?? `{${n}}`) : k),
  }),
}))

// Sin peso registrado: así el cálculo usa profiles.weight y el test no depende
// de una carrera con el prefill asíncrono.
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: async () => ({ data: [] }) }),
        }),
      }),
    }),
  },
}))

let onSave

beforeEach(() => { onSave = vi.fn().mockResolvedValue(undefined) })
afterEach(() => { cleanup(); vi.clearAllMocks() })

const abrir = (props = {}) => render(
  <NutritionTargetsSheet
    targets={null}
    profile={PERFIL}
    onSave={onSave}
    onClose={() => {}}
    {...props}
  />
)

// Lo que el motor diría con ese perfil. Se calcula aquí para comprobar que la
// hoja le pasa los campos correctos, que es el cableado que puede romperse.
const esperado = recommendPlan({
  weightKg: 80,
  heightCm: toCm(180, 'cm'),
  age: new Date().getFullYear() - 1995 - (new Date() < new Date(`${new Date().getFullYear()}-06-15`) ? 1 : 0),
  sex: 'Masculino',
  bodyFatPct: 18,
  bodyFatSource: 'estimado',
  activityId: 'moderado',
  phaseId: 'definicion',
  daysPerWeek: 4,
  goal: 'Perder grasa',
})

describe('la tarjeta de recomendación', () => {
  it('con un perfil completo propone un objetivo', async () => {
    abrir()
    expect(await screen.findByText('Recomendado para ti')).toBeTruthy()
    expect(screen.getByText(`P ${esperado.protein_g} · C ${esperado.carbs_g} · G ${esperado.fat_g}`)).toBeTruthy()
  })

  it('usa Katch-McArdle y lo explica al desplegarla', () => {
    abrir()
    fireEvent.click(screen.getByText('Recomendado para ti'))
    expect(screen.getByText(/Katch-McArdle/)).toBeTruthy()
    expect(screen.getByText(/son techos, no metas/)).toBeTruthy()
  })

  it('avisa de que un % de grasa a ojo tiene margen', () => {
    abrir()
    fireEvent.click(screen.getByText('Recomendado para ti'))
    expect(screen.getByText(/±5 puntos/)).toBeTruthy()
  })

  it('sin datos suficientes dice qué falta, en vez de inventarse un número', () => {
    abrir({ profile: { sex: 'Masculino' } })
    expect(screen.getByText('Podemos calcularlo por ti')).toBeTruthy()
    expect(screen.getByText(/Nos falta/)).toBeTruthy()
    expect(screen.queryByText('Usar esto')).toBeNull()
  })

  it('sin perfil ninguno no revienta', () => {
    expect(() => abrir({ profile: null })).not.toThrow()
  })
})

describe('«Usar esto»', () => {
  it('NO guarda: rellena el editor y deja la decisión al usuario', () => {
    abrir()
    fireEvent.click(screen.getByText('Usar esto'))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('deja las calorías y los gramos puestos para poder retocarlos', () => {
    const { container } = abrir()
    fireEvent.click(screen.getByText('Usar esto'))
    const valores = [...container.querySelectorAll('input[type="number"]')].map(i => i.value)
    expect(valores).toContain(String(esperado.kcal))
    expect(valores).toContain(String(esperado.protein_g))
    expect(valores).toContain(String(esperado.carbs_g))
    expect(valores).toContain(String(esperado.fat_g))
  })

  it('y solo entonces Guardar manda los macros y los dieciséis micros', async () => {
    abrir()
    fireEvent.click(screen.getByText('Usar esto'))
    fireEvent.click(screen.getByText('Guardar objetivos'))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const payload = onSave.mock.calls[0][0]
    expect(payload.kcal).toBe(esperado.kcal)
    expect(payload.protein_g).toBe(esperado.protein_g)
    expect(payload.fat_g).toBe(esperado.fat_g)
    expect(Object.keys(payload.micros).sort()).toEqual([...MICRO_KEYS].sort())
  })
})

// El caso que motivó el candado: una proteína decidida a mano que «Usar esto»
// sustituía por la calculada cada vez que se pulsaba.
describe('el candado de proteína', () => {
  const CON_OBJETIVOS = { kcal: 3501, protein_g: 180, carbs_g: 477, fat_g: 97, micros: {}, protein_locked: false }

  it('solo se ofrece si hay una proteína guardada que fijar', () => {
    abrir({ targets: null })
    expect(screen.queryByText(/Mantener mi proteína/)).toBeNull()

    cleanup()
    abrir({ targets: CON_OBJETIVOS })
    expect(screen.getByText('Mantener mi proteína en 180 g')).toBeTruthy()
  })

  it('activado, la recomendación deja de recalcularla', () => {
    abrir({ targets: CON_OBJETIVOS })
    fireEvent.click(screen.getByText('Mantener mi proteína en 180 g'))
    fireEvent.click(screen.getByText('Recomendado para ti'))
    expect(screen.getByText(/Proteína fija en 180 g/)).toBeTruthy()
  })

  it('y «Usar esto» ya no la pisa', () => {
    const { container } = abrir({ targets: CON_OBJETIVOS })
    fireEvent.click(screen.getByText('Mantener mi proteína en 180 g'))
    fireEvent.click(screen.getByText('Usar esto'))
    const valores = [...container.querySelectorAll('input[type="number"]')].map(i => i.value)
    expect(valores).toContain('180')
    expect(valores).not.toContain(String(esperado.protein_g))
  })

  it('sin activarlo, sigue proponiendo la calculada', () => {
    abrir({ targets: CON_OBJETIVOS })
    fireEvent.click(screen.getByText('Recomendado para ti'))
    expect(screen.queryByText(/Proteína fija/)).toBeNull()
  })

  it('se guarda con los objetivos, para que dure más que la sesión', async () => {
    abrir({ targets: CON_OBJETIVOS })
    fireEvent.click(screen.getByText('Mantener mi proteína en 180 g'))
    fireEvent.click(screen.getByText('Gramos exactos'))
    fireEvent.click(screen.getByText('Guardar objetivos'))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0].protein_locked).toBe(true)
  })

  it('llega activado si ya lo estaba', () => {
    abrir({ targets: { ...CON_OBJETIVOS, protein_locked: true } })
    fireEvent.click(screen.getByText('Recomendado para ti'))
    expect(screen.getByText(/Proteína fija en 180 g/)).toBeTruthy()
  })

  // El reparto «Según tu cuerpo» tenía su propio cálculo (2 g/kg de peso) que
  // no sabía nada del candado: proponía recalcular una cifra que quien la fijó
  // había dicho explícitamente que no se tocara. Ahora usa el mismo motor.
  // La proteína propuesta se pinta en la vista previa, no en un input.
  const proteinaPropuesta = () => screen.getByText('Proteína').parentElement.textContent

  it('el reparto por cuerpo tampoco recalcula una proteína fijada', () => {
    abrir({ targets: { ...CON_OBJETIVOS, protein_locked: true } })
    fireEvent.click(screen.getByText('Según tu cuerpo'))
    expect(proteinaPropuesta()).toContain('180 g')
    expect(proteinaPropuesta()).not.toContain('160 g')  // 80 kg × 2 g/kg, lo de antes
  })

  it('sin candado, propone la misma proteína que el asistente', () => {
    abrir({ targets: CON_OBJETIVOS })
    fireEvent.click(screen.getByText('Según tu cuerpo'))
    // Mismo motor que «Recomendado para ti»: los dos salen de computeMacros
    // sobre el mismo cuerpo, así que la proteína propuesta coincide.
    expect(proteinaPropuesta()).toContain(`${esperado.protein_g} g`)
  })
})

describe('los objetivos de micros', () => {
  it('sin tocar la recomendación, se guarda lo que ya tuviera el usuario', async () => {
    abrir({ targets: { kcal: 2000, protein_g: 150, carbs_g: 200, fat_g: 60, micros: { fibra: 30 } } })
    // El modo inicial («Según tu cuerpo») exige un peso y sin él Guardar
    // está deshabilitado — comportamiento de siempre. Aquí interesan los micros.
    fireEvent.click(screen.getByText('Gramos exactos'))
    fireEvent.click(screen.getByText('Guardar objetivos'))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0].micros).toEqual({ fibra: 30 })
  })

  it('sobreviven a cambiar de modo de reparto', async () => {
    abrir()
    fireEvent.click(screen.getByText('Usar esto'))
    fireEvent.click(screen.getByText('Keto'))
    fireEvent.click(screen.getByText('Guardar objetivos'))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(Object.keys(onSave.mock.calls[0][0].micros).length).toBe(MICRO_KEYS.length)
  })
})
