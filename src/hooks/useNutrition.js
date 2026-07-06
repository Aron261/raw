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
    // Sube la comida al tope de recientes para que el próximo registro sea instantáneo.
    mutateCache(`nutrition-recents:${user.id}`, prev => {
      if (!prev) return prev
      const norm = row.name.trim().toLowerCase()
      const existing = prev.find(f => f.name.trim().toLowerCase() === norm)
      return [
        { name: row.name, kcal: row.kcal, protein_g: row.protein_g, carbs_g: row.carbs_g, fat_g: row.fat_g, created_at: row.created_at, count: (existing?.count || 0) + 1 },
        ...prev.filter(f => f.name.trim().toLowerCase() !== norm),
      ]
    })
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

// Comidas recientes/frecuentes (últimos 60 días), dedupe por nombre.
// Derivadas de las entradas — sin tabla nueva. Ordenadas por frecuencia y
// luego por recencia, para que "lo de siempre" quede arriba.
export function useRecentFoods() {
  const { user } = useAuth()
  const key = user ? `nutrition-recents:${user.id}` : null

  const fetcher = useCallback(async () => {
    const since = toLocalISODate(new Date(Date.now() - 60 * 86400000))
    const { data, error } = await supabase
      .from('nutrition_entries')
      .select('name, kcal, protein_g, carbs_g, fat_g, created_at')
      .eq('user_id', user.id)
      .gte('eaten_on', since)
      .order('created_at', { ascending: false })
      .limit(400)
    if (error) throw error
    const map = new Map()
    for (const e of data || []) {
      const norm = e.name.trim().toLowerCase()
      const cur = map.get(norm)
      if (cur) cur.count += 1        // macros quedan las de la entrada más reciente
      else map.set(norm, { ...e, count: 1 })
    }
    return [...map.values()].sort((a, b) =>
      b.count - a.count || (a.created_at < b.created_at ? 1 : -1)
    )
  }, [user?.id])

  const { data, loading } = useCachedResource(key, fetcher)
  return { recents: data || [], loading }
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
