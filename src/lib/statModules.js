import TotalsModule from '../components/stats/TotalsModule'
import VolumeTrendModule from '../components/stats/VolumeTrendModule'
import AllLiftsModule from '../components/stats/AllLiftsModule'
import MuscleBalanceModule from '../components/stats/MuscleBalanceModule'

// The stats registry. Adding a new stat = write one component + one line here.
// `default` seeds which modules show before the user customizes (useStatPrefs).
export const STAT_MODULES = [
  { id: 'totals',        label: 'Totales históricos', default: true, Component: TotalsModule },
  { id: 'volumeTrend',   label: 'Volumen por mes',    default: true, Component: VolumeTrendModule },
  { id: 'allLifts',      label: 'Mis levantamientos', default: true, Component: AllLiftsModule },
  { id: 'muscleBalance', label: 'Balance muscular',   default: true, Component: MuscleBalanceModule },
]
