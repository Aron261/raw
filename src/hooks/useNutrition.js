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

export const DEFAULT_TARGETS = { kcal: 2500, protein_g: 160, carbs_g: 280, fat_g: 80 }

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
