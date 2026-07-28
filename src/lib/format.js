/*
 * El formato de las cifras, en un sitio.
 *
 * Había cinco copias de la misma función —Training, History, TotalsModule,
 * MuscleBalanceModule, WorkoutCard— y ninguna pasaba el locale, así que en
 * español los miles y los decimales salían al revés: «3,195.782 kg» donde
 * tenía que poner «3.196 kg».
 *
 * Y ese .782 no era un descuido de formato, era la conversión de libras a
 * kilos (× 0,453592) saliendo entera a pantalla. Un instrumento honesto
 * redondea a lo que puede medir: nadie levanta 782 gramos de más.
 */

// Por encima de esto la cifra deja de leerse de un vistazo y lo que importa
// es el orden de magnitud, no la unidad.
const K_THRESHOLD = 10000

/**
 * Volumen levantado. Entero por debajo de 10.000; en miles con un decimal
 * por encima. `empty` es lo que se pinta cuando no hay nada que decir —hay
 * sitios que quieren un guion y otros un cero.
 */
export function formatVolume(v, locale = 'es-CO', { empty = '—' } = {}) {
  if (!v) return empty
  if (v >= K_THRESHOLD) {
    return `${(v / 1000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`
  }
  return Math.round(v).toLocaleString(locale)
}

/** Un recuento (entrenos, series, ejercicios). Nunca lleva decimales. */
export function formatCount(v, locale = 'es-CO') {
  if (!v) return '0'
  if (v >= K_THRESHOLD) {
    return `${(v / 1000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`
  }
  return Math.round(v).toLocaleString(locale)
}
