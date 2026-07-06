import { useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useCachedResource, mutateCache } from '../lib/swr'

// Fecha local YYYY-MM-DD — una comida a las 11pm es de hoy, no de mañana UTC.
export function toLocalISODate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const MEALS = [
  { id: 'desayuno', label: 'Desayuno' },
  { id: 'almuerzo', label: 'Almuerzo' },
  { id: 'cena',     label: 'Cena' },
  { id: 'snack',    label: 'Snack' },
]

// Entradas de un día concreto. Cacheado por día para que navegar entre
// fechas (y volver) renderice al instante.
export function useNutritionDay(dateISO) {
  const { user } = useAuth()
  const key = user ? `nutrition:${user.id}:${dateISO}` : null

  const fetcher = useCallback(async () => {
    const { data, error } = await supabase
      .from('nutrition_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('eaten_on', dateISO)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data || []
  }, [user?.id, dateISO])

  const { data, loading, error, refetch } = useCachedResource(key, fetcher)
  const entries = data || []

  const addEntry = useCallback(async (fields) => {
    const { data: row, error: err } = await supabase
      .from('nutrition_entries')
      .insert({ user_id: user.id, eaten_on: dateISO, ...fields })
      .select()
      .single()
    if (err) throw err
    mutateCache(key, prev => [...(prev || []), row])
    return row
  }, [user?.id, dateISO, key])

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

  // Totales del día
  const totals = useMemo(() => entries.reduce(
    (acc, e) => ({
      kcal:    acc.kcal    + Number(e.kcal || 0),
      protein: acc.protein + Number(e.protein_g || 0),
      carbs:   acc.carbs   + Number(e.carbs_g || 0),
      fat:     acc.fat     + Number(e.fat_g || 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  ), [entries])

  return { entries, totals, loading, error, refetch, addEntry, updateEntry, deleteEntry }
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

export const DEFAULT_TARGETS = { kcal: 2500, protein_g: 160, carbs_g: 280, fat_g: 80 }

// Recomendación de macros a partir de meta calórica y peso ideal:
// proteína = 2 g × kg de peso ideal, grasa = 25% de las calorías,
// carbos = las calorías restantes.
export function recommendMacros(kcal, weightKg) {
  const protein_g = Math.round(weightKg * 2)
  const fat_g = Math.round((kcal * 0.25) / 9)
  const carbs_g = Math.max(0, Math.round((kcal - protein_g * 4 - fat_g * 9) / 4))
  return { kcal: Math.round(kcal), protein_g, carbs_g, fat_g }
}

// Objetivos diarios del usuario (una fila por usuario; defaults si no existe).
export function useNutritionTargets() {
  const { user } = useAuth()
  const key = user ? `nutrition-targets:${user.id}` : null

  const fetcher = useCallback(async () => {
    const { data, error } = await supabase
      .from('nutrition_targets')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) throw error
    return data   // null = sin configurar todavía
  }, [user?.id])

  const { data, loading, error } = useCachedResource(key, fetcher)
  const targets = data || null

  const saveTargets = useCallback(async (fields) => {
    const { data: row, error: err } = await supabase
      .from('nutrition_targets')
      .upsert({ user_id: user.id, ...fields, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (err) throw err
    mutateCache(key, row)
    return row
  }, [user?.id, key])

  return { targets, hasCustomTargets: !!data, loading, error, saveTargets }
}
