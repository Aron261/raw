// Web Push a mano: RFC 8291 (cifrado aes128gcm) + RFC 8292 (VAPID).
//
// ── Por qué a mano ────────────────────────────────────────────────────────
// Las librerías de Web Push que se usan en todas partes son de Node y tiran de
// `node:https` y `node:crypto`. En el runtime de las edge functions eso es
// compatibilidad, no terreno propio, y un fallo aquí no se ve: no revienta el
// despliegue, simplemente el aviso no llega nunca y no hay forma de saber por
// qué. Todo esto son unas ochenta líneas de WebCrypto, que corre igual en Deno
// que en Node — y, lo que importa, se puede probar contra el vector de ejemplo
// de la propia RFC. Eso es lo que hace `webpush.test.js`.
//
// ── El formato, en corto ──────────────────────────────────────────────────
// El cuerpo que se envía es:
//
//   salt(16) ‖ rs(4) ‖ idlen(1) ‖ clave_pública_efímera(65) ‖ AES-GCM(...)
//
// y la clave de ese AES sale de un ECDH entre una clave efímera nuestra y la
// pública del navegador, mezclado con el «auth secret» de la suscripción. O
// sea: cada envío usa una clave nueva y solo ese navegador puede abrirlo — el
// servicio de push de Apple o de Google transporta el sobre sin poder leerlo.

const enc = new TextEncoder()

export const b64urlToBytes = (s: string): Uint8Array => {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4))
  return Uint8Array.from(bin, c => c.charCodeAt(0))
}

export const bytesToB64url = (b: Uint8Array): string => {
  let s = ''
  for (const byte of b) s += String.fromCharCode(byte)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) { out.set(p, at); at += p.length }
  return out
}

// Una P-256 sin comprimir son 65 bytes: 0x04 ‖ X(32) ‖ Y(32). El JWK los quiere
// por separado, así que la clave privada se reconstruye desde su pareja pública.
const jwkFrom = (publicRaw: Uint8Array, d?: string): JsonWebKey => ({
  kty: 'EC',
  crv: 'P-256',
  x: bytesToB64url(publicRaw.slice(1, 33)),
  y: bytesToB64url(publicRaw.slice(33, 65)),
  ...(d ? { d } : {}),
  ext: true,
})

const hkdf = async (salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) => {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8)
  return new Uint8Array(bits)
}

export interface PushKeys {
  /** Clave pública del navegador (base64url, 65 bytes sin comprimir). */
  p256dh: string
  /** Secreto de autenticación de la suscripción (base64url, 16 bytes). */
  auth: string
}

export interface VapidKeys {
  publicKey: string   // base64url, 65 bytes
  privateKey: string  // base64url del escalar d, 32 bytes
  subject: string     // mailto: o https:
}

/**
 * Cifra el payload para una suscripción. `salt` y `ephemeral` solo se pasan en
 * las pruebas: fijar los dos es lo que permite comparar contra el vector de la
 * RFC, que si no sería distinto en cada ejecución por definición.
 */
export async function encryptPayload(
  payload: string,
  keys: PushKeys,
  fixed?: { salt: Uint8Array; ephemeralPrivate: string; ephemeralPublic: string },
): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(keys.p256dh)
  const authSecret = b64urlToBytes(keys.auth)

  let asPublic: Uint8Array
  let asPrivateKey: CryptoKey

  if (fixed) {
    asPublic = b64urlToBytes(fixed.ephemeralPublic)
    asPrivateKey = await crypto.subtle.importKey(
      'jwk', jwkFrom(asPublic, fixed.ephemeralPrivate),
      { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'],
    )
  } else {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
    asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
    asPrivateKey = pair.privateKey
  }

  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16))

  const uaKey = await crypto.subtle.importKey(
    'raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  )
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPrivateKey, 256),
  )

  // RFC 8291 §3.4 — el secreto compartido se ata a las dos claves públicas, no
  // solo al ECDH: así un sobre no se puede reutilizar contra otra suscripción.
  const keyInfo = concat(enc.encode('WebPush: info'), new Uint8Array([0]), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, shared, keyInfo, 32)

  const cekInfo = concat(enc.encode('Content-Encoding: aes128gcm'), new Uint8Array([0]))
  const nonceInfo = concat(enc.encode('Content-Encoding: nonce'), new Uint8Array([0]))
  const cek = await hkdf(salt, ikm, cekInfo, 16)
  const nonce = await hkdf(salt, ikm, nonceInfo, 12)

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  // 0x02 = delimitador de «este es el último registro» (RFC 8188 §2).
  const plaintext = concat(enc.encode(payload), new Uint8Array([2]))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, plaintext),
  )

  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, 4096)
  const header = concat(salt, rs, new Uint8Array([asPublic.length]), asPublic)
  return concat(header, ciphertext)
}

/** El JWT que prueba quién envía. Va en la cabecera Authorization. */
export async function vapidHeader(endpoint: string, vapid: VapidKeys, now = Date.now()): Promise<string> {
  const aud = new URL(endpoint).origin
  const header = { typ: 'JWT', alg: 'ES256' }
  const body = {
    aud,
    // 12 horas. El máximo que admite la especificación son 24; la mitad deja
    // margen para relojes que no coinciden sin dar un token eterno.
    exp: Math.floor(now / 1000) + 12 * 60 * 60,
    sub: vapid.subject,
  }
  const part = (o: unknown) => bytesToB64url(enc.encode(JSON.stringify(o)))
  const signingInput = `${part(header)}.${part(body)}`

  const publicRaw = b64urlToBytes(vapid.publicKey)
  const key = await crypto.subtle.importKey(
    'jwk', jwkFrom(publicRaw, vapid.privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
  )
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput),
  ))

  return `vapid t=${signingInput}.${bytesToB64url(sig)}, k=${vapid.publicKey}`
}

export interface SendResult {
  ok: boolean
  status: number
  /** El buzón ya no existe: hay que borrar la suscripción, no reintentarla. */
  gone: boolean
  error?: string
}

export async function sendPush(
  endpoint: string,
  keys: PushKeys,
  payload: string,
  vapid: VapidKeys,
  ttlSeconds = 3600,
): Promise<SendResult> {
  try {
    const body = await encryptPayload(payload, keys)
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': await vapidHeader(endpoint, vapid),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        'TTL': String(ttlSeconds),
        'Urgency': 'normal',
      },
      body,
    })
    // 404 y 410 son la forma que tiene el servicio de push de decir «este
    // dispositivo ya no está»: se desinstaló la app, se revocó el permiso o
    // caducó. Reintentar no lo arregla; borrar la fila, sí.
    const gone = res.status === 404 || res.status === 410
    return {
      ok: res.ok,
      status: res.status,
      gone,
      error: res.ok ? undefined : `${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`,
    }
  } catch (e) {
    return { ok: false, status: 0, gone: false, error: String(e) }
  }
}
