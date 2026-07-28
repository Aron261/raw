import { useTheme } from '../hooks/useTheme'

/*
 * Los colores de las gráficas, en un sitio.
 *
 * Recharts pinta atributos SVG (fill, stroke), y ahí una var(--c-*) no
 * resuelve: hay que darle el hex literal. Antes cada pantalla con gráfica
 * llevaba su propio mapa copiado —cinco copias, cuatro claves cada una— y
 * cambiar un color pedía tocar cinco archivos y acordarse de los cinco.
 *
 * Ahora es un mapa por modo. Los valores son los mismos tokens de
 * index.css escritos a mano; si tocas la paleta allí, tócala aquí.
 */
const COLORS = {
  light: {
    line:    '#2C56A6', // = --c-data
    bar:     '#2C56A6',
    grid:    '#E2E2DE', // = --c-surface-3
    axis:    '#5C626A', // = --c-text-muted
    current: '#16181B', // = --c-text
    empty:   '#E2E2DE',
    cursor:  'rgba(44, 86, 166, 0.09)',
  },
  dark: {
    line:    '#7FA0EA',
    bar:     '#7FA0EA',
    grid:    '#2E3238',
    axis:    '#949AA2',
    current: '#EDEEF0',
    empty:   '#2E3238',
    cursor:  'rgba(127, 160, 234, 0.15)',
  },
}

export function useChartColors() {
  const { resolved } = useTheme()
  return COLORS[resolved] || COLORS.light
}

export default COLORS
