import { useProfile } from './useProfile'

// El plan de la cuenta: 'free' (por defecto), 'pro' o 'coach'. coach ⊇ pro.
//
// La verdad vive en profiles.plan, protegido por trigger (solo la RPC admin lo
// cambia); esto solo la lee. Mientras el perfil carga se responde como si
// hubiera acceso: un candado que parpadea sobre una función que SÍ tienes es
// peor que medio segundo de contenido para quien no la tiene — y el candado de
// UI es señalización de producto, no la barrera (el conector se valida en el
// servidor).
export function usePlan() {
  const { profile, loading } = useProfile()
  const plan = profile?.plan ?? null
  // Plan DESCONOCIDO (perfil aún sin cargar o fila sin crear) cuenta como
  // abierto: en producción toda fila trae plan (not null, default 'free'), así
  // que esto solo pasa en el instante previo a la carga — y un candado que
  // parpadea sobre una función que sí tienes es peor que medio segundo de
  // contenido para quien no la tiene.
  const open = plan === null
  return {
    plan: plan || 'free',
    loading,
    isPro: open || plan === 'pro' || plan === 'coach',
    isCoach: open || plan === 'coach',
  }
}
