// El cifrado de Web Push, contra el vector de ejemplo de la RFC.
//
// Esto no es una prueba de comportamiento: es la única forma honesta de saber
// que el sobre está bien cerrado. Un fallo aquí no se ve por ningún otro sitio
// —la notificación simplemente no llega, y el servicio de push devuelve 201
// igual porque él solo transporta— así que se compara byte a byte contra el
// ejemplo del RFC 8291 §5, fijando la sal y la clave efímera, que es lo único
// que en producción es aleatorio a propósito.

import { describe, it, expect } from 'vitest'
import { encryptPayload, vapidHeader, b64urlToBytes, bytesToB64url } from './webpush.ts'

// ── RFC 8291 §5 ──────────────────────────────────────────────────────────
const VECTOR = {
  plaintext: 'When I grow up, I want to be a watermelon',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  authSecret: 'BTBZMqHH6r4Tts7J_aSIgg',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  expected:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml' +
    'mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT' +
    'pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
}

const cifrar = () => encryptPayload(
  VECTOR.plaintext,
  { p256dh: VECTOR.uaPublic, auth: VECTOR.authSecret },
  {
    salt: b64urlToBytes(VECTOR.salt),
    ephemeralPrivate: VECTOR.asPrivate,
    ephemeralPublic: VECTOR.asPublic,
  },
)

describe('cifrado aes128gcm (RFC 8291)', () => {
  it('reproduce el sobre del ejemplo de la RFC, byte a byte', async () => {
    expect(bytesToB64url(await cifrar())).toBe(VECTOR.expected)
  })

  it('la cabecera lleva sal, tamaño de registro y la clave efímera', async () => {
    const body = await cifrar()
    expect(bytesToB64url(body.slice(0, 16))).toBe(VECTOR.salt)
    // rs = 4096, big endian
    expect(new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0)).toBe(4096)
    expect(body[20]).toBe(65)
    expect(bytesToB64url(body.slice(21, 86))).toBe(VECTOR.asPublic)
  })

  it('sin fijar nada, dos envíos del mismo texto salen distintos', async () => {
    const keys = { p256dh: VECTOR.uaPublic, auth: VECTOR.authSecret }
    const a = await encryptPayload('hola', keys)
    const b = await encryptPayload('hola', keys)
    // Sal y clave efímera nuevas en cada envío: si esto coincidiera, se estaría
    // reutilizando material de cifrado.
    expect(bytesToB64url(a)).not.toBe(bytesToB64url(b))
  })
})

describe('base64url', () => {
  it('va y vuelve sin relleno', () => {
    const bytes = new Uint8Array([0, 1, 250, 255, 128, 64])
    expect(b64urlToBytes(bytesToB64url(bytes))).toEqual(bytes)
  })

  it('no deja caracteres que haya que escapar en una URL', () => {
    const s = bytesToB64url(new Uint8Array([251, 255, 190]))
    expect(s).not.toMatch(/[+/=]/)
  })
})

// ── VAPID (RFC 8292) ─────────────────────────────────────────────────────
// Las claves reales del proyecto no pintan nada aquí; estas son de usar y tirar.
const VAPID = {
  publicKey: VECTOR.asPublic,
  privateKey: VECTOR.asPrivate,
  subject: 'mailto:hola@raw.app',
}

describe('cabecera VAPID', () => {
  it('lleva el token y la clave pública, en el formato que espera el servicio', async () => {
    const h = await vapidHeader('https://web.push.apple.com/abc123', VAPID)
    expect(h).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/)
    expect(h.endsWith(VAPID.publicKey)).toBe(true)
  })

  it('el destinatario es el origen del buzón, no la URL entera', async () => {
    const h = await vapidHeader('https://fcm.googleapis.com/fcm/send/xyz?a=1', VAPID)
    const payload = JSON.parse(new TextDecoder().decode(
      b64urlToBytes(h.slice('vapid t='.length).split('.')[1]),
    ))
    // Mandar la ruta completa filtraría el identificador del dispositivo dentro
    // de un token firmado.
    expect(payload.aud).toBe('https://fcm.googleapis.com')
    expect(payload.sub).toBe('mailto:hola@raw.app')
  })

  it('caduca en 12 horas', async () => {
    const now = 1_700_000_000_000
    const h = await vapidHeader('https://example.com/x', VAPID, now)
    const payload = JSON.parse(new TextDecoder().decode(
      b64urlToBytes(h.slice('vapid t='.length).split('.')[1]),
    ))
    expect(payload.exp).toBe(Math.floor(now / 1000) + 12 * 60 * 60)
  })

  it('la firma verifica con la clave pública', async () => {
    const h = await vapidHeader('https://example.com/x', VAPID)
    const [signingInput, sig] = [
      h.slice('vapid t='.length).split(',')[0].split('.').slice(0, 2).join('.'),
      h.slice('vapid t='.length).split(',')[0].split('.')[2],
    ]
    const raw = b64urlToBytes(VAPID.publicKey)
    const key = await crypto.subtle.importKey(
      'jwk',
      {
        kty: 'EC', crv: 'P-256', ext: true,
        x: bytesToB64url(raw.slice(1, 33)),
        y: bytesToB64url(raw.slice(33, 65)),
      },
      { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'],
    )
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' }, key,
      b64urlToBytes(sig), new TextEncoder().encode(signingInput),
    )
    expect(ok).toBe(true)
  })
})
