import TotalsModule from '../components/stats/TotalsModule'
import VolumeTrendModule from '../components/stats/VolumeTrendModule'

// The stats registry. Adding a new stat = write one component + one line here.
// `default` seeds which modules show before the user customizes (useStatPrefs).
export const STAT_MODULES = [
  { id: 'totals',      label: 'Totales históricos', default: true, Component: TotalsModule },
  { id: 'volumeTrend', label: 'Volumen por mes',    default: true, Component: VolumeTrendModule },
]
