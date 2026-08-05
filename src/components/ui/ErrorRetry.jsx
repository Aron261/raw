import { useLang } from '../../hooks/useLang'

/**
 * Un fallo de carga, con salida.
 *
 * Existe porque media app confundía las dos cosas: varios hooks se tragaban el
 * error en un console.error y la página, al no recibir nada, pintaba su estado
 * vacío. El resultado era una pantalla diciéndole «Sin datos aún» a alguien con
 * años de historial, o un feed de clientes que parecía no tener ninguno. Un
 * fallo y un vacío no se parecen en nada: el vacío se arregla usando la app, el
 * fallo se arregla reintentando, y solo uno de los dos merece un botón.
 *
 * Por eso `onRetry` es opcional pero se espera: sin él queda un mensaje sin
 * salida, que es apenas mejor que el vacío mentiroso.
 *
 * El color sale del rol de acción, no de un rojo propio: Raw tiene una sola
 * paleta a propósito (ver DESIGN.md).
 */
export default function ErrorRetry({ message, onRetry, style }) {
  const { t } = useLang()
  return (
    <div
      role="alert"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '12px',
        background: 'var(--c-action-dim)',
        border: '1px solid var(--c-action-border)',
        color: 'var(--c-action-text)',
        fontSize: '13px', padding: '12px 14px',
        borderRadius: 'var(--r-md)',
        ...style,
      }}
    >
      <span>{message || t('No pudimos cargar esto.')}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            flexShrink: 0, color: 'var(--c-action-text)',
            fontSize: '12px', fontWeight: 700,
            border: '1px solid var(--c-action-border)',
            borderRadius: 'var(--r-xs)',
            // 44px de alto de toque: es un botón que se pulsa con prisa y con
            // el móvil en una mano.
            padding: '12px 14px', minHeight: '44px',
            background: 'transparent',
          }}
        >
          {t('Reintentar')}
        </button>
      )}
    </div>
  )
}
