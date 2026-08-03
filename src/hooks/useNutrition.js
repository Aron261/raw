import { useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useCachedResource, mutateCache } from '../lib/swr'
import { sumMicros, sanitizeMicros, nonZeroKeys } from '../lib/nutrients'

// Fecha local YYYY-MM-DD — una comida a las 11pm es de hoy, no de mañana UTC.
// La implementación vive en lib/calendar.js (módulo puro); se reexporta aquí
// porque es de donde la importan las pantallas desde siempre.
export { toLocalISODate } from '../lib/calendar'

export const MEALS = [
  { id: 'desayuno', label: 'Desayuno' },
  { id: 'almuerzo', label: 'Almuerzo' },
  { id: 'cena',     label: 'Cena' },
  { id: 'snack',    label: 'Snack' },
]

// Entradas de un día concreto. Cacheado por día para que navegar entre
// fechas (y volver) renderice al instante. Sin targetUserId es el propio
// registro; con targetUserId un entrenador lee el de ese cliente (RLS solo
// le permite lectura de entradas).
export function useNutritionDay(dateISO, targetUserId = null) {
  const { user } = useAuth()
  const ownerId = targetUserId || user?.id
  const key = ownerId ? `nutrition:${ownerId}:${dateISO}` : null

  const fetcher = useCallback(async () => {
    const { data, error } = await supabase
      .from('nutrition_entries')
      .select('*')
      .eq('user_id', ownerId)
      .eq('eaten_on', dateISO)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data || []
  }, [ownerId, dateISO])

  const { data, loading, error, refetch } = useCachedResource(key, fetcher)
  const entries = data || []

  const addEntry = useCallback(async (fields) => {
    const { data: row, error: err } = await supabase
      .from('nutrition_entries')
      .insert({ user_id: ownerId, eaten_on: dateISO, ...fields })
      .select()
      .single()
    if (err) throw err
    mutateCache(key, prev => [...(prev || []), row])
    return row
  }, [ownerId, dateISO, key])

  const updateEntry = useCallback(async (id, patch) => {
    const { data: row, error: err } = await supabase
      .from('nutrition_entries')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (err) throw err
    mutateCache(key, prev => (prev || []).map(e => (e.id === id ? row : e)))
    return row
  }, [key])

  const deleteEntry = useCallback(async (id) => {
    const { error: err } = await supabase.from('nutrition_entries').delete().eq('id', id)
    if (err) throw err
    mutateCache(key, prev => (prev || []).filter(e => e.id !== id))
  }, [key])

  // Totales del día. `covered` es cuántas comidas traen algún micro: sin ese
  // dato, «el sodio de hoy» es en realidad «el sodio que conocemos», y la
  // pantalla no tendría forma de decirlo.
  const totals = useMemo(() => totalsOf(entries), [entries])

  return { entries, totals, loading, error, refetch, addEntry, updateEntry, deleteEntry }
}

// Totales de una lista de comidas. Fuera del hook porque la pantalla también
// los necesita sobre una lista filtrada (la entrada pendiente de deshacer).
export function totalsOf(entries) {
  const list = entries || []
  const base = list.reduce(
    (acc, e) => ({
      kcal:    acc.kcal    + Number(e.kcal || 0),
      protein: acc.protein + Number(e.protein_g || 0),
      carbs:   acc.carbs   + Number(e.carbs_g || 0),
      fat:     acc.fat     + Number(e.fat_g || 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  )
  return {
    ...base,
    micros: sumMicros(list.map(e => e.micros)),
    count: list.length,
    covered: list.filter(e => nonZeroKeys(e.micros).length > 0).length,
  }
}

// Biblioteca personal: cada comida registrada queda guardada con su porción
// base en nutrition_foods, para reutilizarla para siempre. Ordenada por
// último uso (lo de esta semana arriba).
export function useMyFoods() {
  const { user } = useAuth()
  const key = user ? `nutrition-foods:${user.id}` : null

  const fetcher = useCallback(async () => {
    const { data, error } = await supabase
      .from('nutrition_foods')
      .select('*')
      .eq('user_id', user.id)
      .order('last_used_at', { ascending: false })
      .limit(200)
    if (error) throw error
    return data || []
  }, [user?.id])

  const { data, loading } = useCachedResource(key, fetcher)

  // Upsert por nombre normalizado: nueva comida se crea, conocida se
  // actualiza (macros base + contador de uso).
  const saveFood = useCallback(async (food) => {
    const name = food.name.trim()
    const norm = name.toLowerCase()
    const patch = {
      name,
      serving_qty: food.serving_qty,
      serving_unit: food.serving_unit,
      kcal: food.kcal, protein_g: food.protein_g, carbs_g: food.carbs_g, fat_g: food.fat_g,
      micros: sanitizeMicros(food.micros),
      last_used_at: new Date().toISOString(),
    }
    const { data: existing } = await supabase
      .from('nutrition_foods')
      .select('id, times_used')
      .eq('user_id', user.id)
      .eq('name_norm', norm)
      .maybeSingle()
    const { data: row, error } = existing
      ? await supabase.from('nutrition_foods')
          .update({ ...patch, times_used: existing.times_used + 1 })
          .eq('id', existing.id).select().single()
      : await supabase.from('nutrition_foods')
          .insert({ user_id: user.id, name_norm: norm, ...patch })
          .select().single()
    if (error) throw error
    mutateCache(key, prev => (prev ? [row, ...prev.filter(f => f.id !== row.id)] : prev))
    return row
  }, [user?.id, key])

  return { foods: data || [], loading, saveFood }
}

export const DEFAULT_TARGETS = { kcal: 2500, protein_g: 160, carbs_g: 280, fat_g: 80, micros: {}, protein_locked: false }

// Recomendación de macros a partir de meta calórica y peso ideal:
// proteína = 2 g × kg de peso ideal, grasa = 25% de las calorías,
// carbos = las calorías restantes.
export function recommendMacros(kcal, weightKg) {
  const protein_g = Math.round(weightKg * 2)
  const fat_g = Math.round((kcal * 0.25) / 9)
  const carbs_g = Math.max(0, Math.round((kcal - protein_g * 4 - fat_g * 9) / 4))
  return { kcal: Math.round(kcal), protein_g, carbs_g, fat_g }
}

// Objetivos diarios (una fila por usuario; defaults si no existe). Con
// targetUserId, un entrenador lee y planifica los objetivos de ese cliente.
export function useNutritionTargets(targetUserId = null) {
  const { user } = useAuth()
  const ownerId = targetUserId || user?.id
  const key = ownerId ? `nutrition-targets:${ownerId}` : null

  const fetcher = useCallback(async () => {
    const { data, error } = await supabase
      .from('nutrition_targets')
      .select('*')
      .eq('user_id', ownerId)
      .maybeSingle()
    if (error) throw error
    return data   // null = sin configurar todavía
  }, [ownerId])

  const { data, loading, error } = useCachedResource(key, fetcher)
  const targets = data || null

  const saveTargets = useCallback(async (fields) => {
    const { data: row, error: err } = await supabase
      .from('nutrition_targets')
      .upsert({ user_id: ownerId, ...fields, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (err) throw err
    mutateCache(key, row)
    return row
  }, [ownerId, key])

  return { targets, hasCustomTargets: !!data, loading, error, saveTargets }
}

// Totales por día de un rango de fechas (para el resumen semanal del
// entrenador). Devuelve un mapa { 'YYYY-MM-DD': { kcal, protein, carbs, fat, count } }.
export function useNutritionRange(fromISO, toISO, targetUserId = null) {
  const { user } = useAuth()
  const ownerId = targetUserId || user?.id
  const key = ownerId ? `nutrition-range:${ownerId}:${fromISO}:${toISO}` : null

  const fetcher = useCallback(async () => {
    const { data, error } = await supabase
      .from('nutrition_entries')
      .select('eaten_on, kcal, protein_g, carbs_g, fat_g')
      .eq('user_id', ownerId)
      .gte('eaten_on', fromISO)
      .lte('eaten_on', toISO)
    if (error) throw error
    const byDay = {}
    for (const e of data || []) {
      const d = byDay[e.eaten_on] || (byDay[e.eaten_on] = { kcal: 0, protein: 0, carbs: 0, fat: 0, count: 0 })
      d.kcal    += Number(e.kcal || 0)
      d.protein += Number(e.protein_g || 0)
      d.carbs   += Number(e.carbs_g || 0)
      d.fat     += Number(e.fat_g || 0)
      d.count   += 1
    }
    return byDay
  }, [ownerId, fromISO, toISO])

  const { data, loading, error } = useCachedResource(key, fetcher)
  return { byDay: data || {}, loading, error }
}
