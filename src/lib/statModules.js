import TotalsModule from '../components/stats/TotalsModule'
import ConsistencyModule from '../components/stats/ConsistencyModule'
import ProgressionModule from '../components/stats/ProgressionModule'
import VolumeTrendModule from '../components/stats/VolumeTrendModule'
import AllLiftsModule from '../components/stats/AllLiftsModule'
import MuscleBalanceModule from '../components/stats/MuscleBalanceModule'

// The stats registry. Adding a new stat = write one component + one line here.
// `default` seeds which modules show before the user customizes (useStatPrefs).
//
// El orden es el argumento de la página: primero cómo estás entrenando ahora
// (constancia, progresión) y después el histórico. Antes todo era histórico, y
// una página que solo sabe sumar no puede decirte que llevas tres semanas
// flojas. A quien ya tenía un orden guardado los módulos nuevos le llegan al
// final —useStatPrefs no reordena lo que alguien colocó a mano—, pero llegan
// encendidos.
export const STAT_MODULES = [
  { id: 'totals',        label: 'Totales históricos', default: true, Component: TotalsModule },
  { id: 'consistency',   label: 'Constancia',         default: true, Component: ConsistencyModule },
  { id: 'progression',   label: 'Progresión',         default: true, Component: ProgressionModule },
  { id: 'volumeTrend',   label: 'Volumen por mes',    default: true, Component: VolumeTrendModule },
  { id: 'allLifts',      label: 'Mis levantamientos', default: true, Component: AllLiftsModule },
  { id: 'muscleBalance', label: 'Balance muscular',   default: true, Component: MuscleBalanceModule },
]
