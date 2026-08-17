import TotalsModule from '../components/stats/TotalsModule'
import ConsistencyModule from '../components/stats/ConsistencyModule'
import ProgressionModule from '../components/stats/ProgressionModule'
import VolumeTrendModule from '../components/stats/VolumeTrendModule'
import AllLiftsModule from '../components/stats/AllLiftsModule'
import MuscleBalanceModule from '../components/stats/MuscleBalanceModule'
import { formatVolume } from './format'

// The stats registry. Adding a new stat = write one component + one line here.
// `default` seeds which modules show before the user customizes (useStatPrefs).
//
// El orden es el argumento de la página: primero cómo estás entrenando ahora
// (constancia, progresión) y después el histórico. Antes todo era histórico, y
// una página que solo sabe sumar no puede decirte que llevas tres semanas
// flojas. A quien ya tenía un orden guardado los módulos nuevos le llegan al
// final —useStatPrefs no reordena lo que alguien colocó a mano—, pero llegan
// encendidos.
//
// `summary` es la línea que se ve con el módulo PLEGADO. Existe porque la
// página llegó a seis módulos abiertos a la vez, todos del mismo peso visual y
// tres con gráfico: había que scrollear entera para saber si algo iba mal.
// Ahora se ojea en una pantalla y se abre lo que interese. Un `summary` que
// devuelve null deja la fila sin cifra en vez de inventarse una.
//
// `open` marca los que arrancan desplegados: los dos que contestan «¿cómo voy
// AHORA?». El histórico se abre si lo pides — no es la pregunta de un martes.
const n = (v, locale) => Number(v ?? 0).toLocaleString(locale, { maximumFractionDigits: 1 })

export const STAT_MODULES = [
  {
    id: 'totals',
    label: 'Totales históricos',
    default: true,
    Component: TotalsModule,
    summary: (d, { t, locale }) => {
      if (!d?.totals?.workouts) return null
      return `${formatVolume(d.totals.volume, locale, { empty: '0' })} kg · ${n(d.totals.workouts, locale)} ${t('entrenos')}`
    },
  },
  {
    id: 'consistency',
    label: 'Constancia',
    default: true,
    open: true,
    Component: ConsistencyModule,
    summary: (d, { t, locale }) => {
      const c = d?.consistency
      if (!c) return null
      const base = `${n(c.perWeek, locale)} ${t('por semana')}`
      if (c.deltaPerWeek == null) return base
      return `${base} · ${c.deltaPerWeek >= 0 ? '▲' : '▼'} ${Math.abs(c.deltaPerWeek)}%`
    },
  },
  {
    id: 'progression',
    label: 'Progresión',
    default: true,
    open: true,
    Component: ProgressionModule,
    summary: (d, { t }) => {
      const p = d?.progression || []
      if (!p.length) return null
      const up = p.filter(x => x.status === 'up').length
      const stuck = p.length - up
      return `${up} ${t('subiendo')} · ${stuck} ${t('parados')}`
    },
  },
  {
    id: 'volumeTrend',
    label: 'Volumen',
    default: true,
    Component: VolumeTrendModule,
    summary: (d, { t, locale }) => {
      // La última semana CERRADA, no la actual: la en curso está a medias y
      // daría una mala noticia falsa cada lunes.
      const weeks = (d?.weeklyActivity || []).slice(0, -1)
      const last = weeks[weeks.length - 1]
      if (!last) return null
      return `${formatVolume(last.volume, locale, { empty: '0' })} kg · ${t('última semana cerrada')}`
    },
  },
  {
    id: 'allLifts',
    label: 'Mis levantamientos',
    default: true,
    Component: AllLiftsModule,
    summary: (d, { t, locale }) => {
      const top = (d?.relativeStrength || [])[0]
      if (top) {
        const ratio = `${n(top.ratio, locale)}×`
        return top.level ? `${top.name} · ${ratio} · ${t(top.level)}` : `${top.name} · ${ratio}`
      }
      const lifts = d?.allLifts || []
      if (!lifts.length) return null
      return `${lifts.length} ${t('ejercicios')}`
    },
  },
  {
    id: 'muscleBalance',
    label: 'Balance muscular',
    default: true,
    Component: MuscleBalanceModule,
    summary: (d, { t, locale }) => {
      const sets = d?.weeklySets || []
      if (!sets.length) return null
      const top = sets[0]
      return `${top.group} ${n(top.sets, locale)} ${t('series/sem')}`
    },
  },
]
