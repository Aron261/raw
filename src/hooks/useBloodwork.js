import { useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useCachedResource, mutateCache } from '../lib/swr'

// Marcadores frecuentes — sugerencias del datalist, no una lista cerrada.
export const COMMON_MARKERS = [
  'Testosterona total', 'Testosterona libre', 'Estradiol', 'Cortisol',
  'Glucosa en ayunas', 'HbA1c', 'Insulina',
  'Colesterol total', 'LDL', 'HDL', 'Triglicéridos', 'ApoB', 'Lp(a)',
  'TSH', 'T3 libre', 'T4 libre',
  'Vitamina D', 'Vitamina B12', 'Ferritina', 'Hierro',
  'Creatinina', 'hs-CRP', 'ALT', 'AST',
]

// Dentro/fuera de rango: null si no hay rango de referencia.
export function inRange(r) {
  if (r.ref_low == null && r.ref_high == null) return null
  const v = Number(r.value)
  if (r.ref_low != null && v < Number(r.ref_low)) return false
  if (r.ref_high != null && v > Number(r.ref_high)) return false
  return true
}

export function useBloodwork() {
  const { user } = useAuth()
  const key = user ? `bloodwork:${user.id}` : null

  const fetcher = useCallback(async () => {
    const { data, error } = await supabase
      .from('bloodwork_results')
      .select('*')
      .eq('user_id', user.id)
      .order('panel_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  }, [user?.id])

  const { data, loading, error, refetch } = useCachedResource(key, fetcher)
  const results = data || []

  const addResult = useCallback(async (fields) => {
    const { data: row, error: err } = await supabase
      .from('bloodwork_results')
      .insert({ user_id: user.id, ...fields })
      .select()
      .single()
    if (err) throw err
    mutateCache(key, prev => [row, ...(prev || [])])
    return row
  }, [user?.id, key])

  const deleteResult = useCallback(async (id) => {
    const { error: err } = await supabase.from('bloodwork_results').delete().eq('id', id)
    if (err) throw err
    mutateCache(key, prev => (prev || []).filter(r => r.id !== id))
  }, [key])

  // Agrupado por marcador; cada grupo con su historial cronológico (viejo → nuevo)
  // y el resultado más reciente al frente para el listado.
  const byMarker = useMemo(() => {
    const map = new Map()
    for (const r of results) {
      const k = r.marker.trim()
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(r)
    }
    return [...map.entries()].map(([marker, rows]) => {
      const chrono = [...rows].sort((a, b) => new Date(a.panel_date) - new Date(b.panel_date))
      return { marker, history: chrono, latest: chrono[chrono.length - 1] }
    }).sort((a, b) => a.marker.localeCompare(b.marker, 'es'))
  }, [results])

  const lastPanelDate = results.length ? results[0].panel_date : null

  return { results, byMarker, lastPanelDate, loading, error, refetch, addResult, deleteResult }
}
