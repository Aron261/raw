// El aviso sonoro de fin de descanso.
//
// El fin del descanso solo vibraba, y `navigator.vibrate` no existe en iOS
// Safari: en iPhone, con el móvil en el bolsillo o la pantalla apagada, no
// había forma de enterarse de que tocaba la siguiente serie. Justo el momento
// en que la app tiene que hablar sin que la estés mirando.
//
// WebAudio y no un <audio src>: son dos tonos de medio segundo, no hace falta
// descargar ni versionar un archivo, y así no hay un fallo de red entre el
// final del descanso y el aviso.
//
// La restricción que manda: iOS no deja sonar un AudioContext que no nació de
// un gesto. Por eso `primeChime()` se llama al ARRANCAR el descanso —que
// siempre viene de un toque— y no al terminarlo, que ocurre solo. Sin ese
// cebado el contexto queda 'suspended' y el aviso no suena nunca.

const KEY = 'raw.restChime'

let ctx = null

// Preferencia. Por defecto ENCENDIDO: quien no lo quiera lo apaga en la propia
// hoja del descanso, mientras que quien lo necesita no puede descubrir una
// opción que no sabe que existe.
export function chimeEnabled() {
  try {
    return window.localStorage.getItem(KEY) !== 'off'
  } catch {
    return true   // almacenamiento bloqueado: mejor que suene
  }
}

export function setChimeEnabled(on) {
  try {
    window.localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch { /* se queda para esta sesión */ }
}

/** Se llama desde un gesto (arrancar el descanso). Sin esto, iOS no suena. */
export function primeChime() {
  if (!chimeEnabled()) return
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx ||= new AC()
    if (ctx.state === 'suspended') ctx.resume()
  } catch { /* sin audio disponible */ }
}

/**
 * Dos tonos cortos. Sube el segundo: un final, no una alarma — esto avisa de
 * que se puede seguir, no de que algo va mal.
 */
export function playChime() {
  if (!chimeEnabled() || !ctx || ctx.state !== 'running') return
  try {
    const t0 = ctx.currentTime
    for (const [i, hz] of [880, 1320].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = hz
      // Rampas y no cortes secos: un corte cuadrado suena a chasquido.
      const start = t0 + i * 0.18
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.22, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.18)
    }
  } catch { /* que no suene nunca puede tumbar el entreno */ }
}

// Para los tests: deja el módulo como recién cargado.
export function __resetChime() { ctx = null }
