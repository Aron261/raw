/*
 * Genera review/review.html: la hoja de revisión, pero con los gifs puestos.
 *
 * El TSV sirve para editar en bloque, no para decidir. Decidir requiere ver la
 * animación — "dumbbell rear fly" y "aperturas con mancuernas" solo se
 * distinguen mirando. Así que el mismo dato se vuelca a una página que carga
 * cada gif al lado de su fila.
 *
 * Se abre con file:// directamente: los datos van incrustados en el HTML, sin
 * fetch. Las decisiones se guardan en localStorage según se toman, y al final
 * se exporta un TSV con la columna `ok` rellena y una columna `nombre_nuevo`
 * para los renombrados.
 *
 *   node scripts/edb/review-ui.js
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REVIEW = join(dirname(fileURLToPath(import.meta.url)), 'review')

async function main() {
  const text = await readFile(join(REVIEW, 'media.tsv'), 'utf8')
  const [head, ...body] = text.trim().split('\n')
  const cols = head.split('\t')
  const rows = body.filter(Boolean).map(line => {
    const cells = line.split('\t')
    return Object.fromEntries(cols.map((c, i) => [c, (cells[i] ?? '').trim()]))
  })

  // Qué gifs se los disputa más de una fila. Se calcula aquí y no en el
  // navegador para que la página ya llegue sabiendo dónde están los choques.
  const veces = {}
  for (const r of rows) if (r.edb_id) veces[r.edb_id] = (veces[r.edb_id] ?? 0) + 1
  for (const r of rows) r.colisiona = r.edb_id ? veces[r.edb_id] > 1 : false

  const html = PAGE.replace('__DATOS__', JSON.stringify(rows))
  await writeFile(join(REVIEW, 'review.html'), html)
  process.stderr.write(
    `${rows.length} filas → ${join(REVIEW, 'review.html')}\n` +
    `Ábrelo, revisa, y usa "Exportar TSV" para volcar media.tsv.\n`)
}

const PAGE = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Revisión de media · librería de ejercicios</title>
<style>
  :root {
    --bg:#0e0e10; --card:#17171a; --line:#26262b; --txt:#e8e8ea; --dim:#8b8b93;
    --ok:#3fb950; --no:#f85149; --warn:#d29922; --acc:#58a6ff;
  }
  @media (prefers-color-scheme:light){
    :root{ --bg:#f6f6f7; --card:#fff; --line:#e2e2e5; --txt:#18181b; --dim:#6b6b73; }
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--txt);
       font:15px/1.5 ui-sans-serif,system-ui,-apple-system,sans-serif}
  header{position:sticky;top:0;z-index:10;background:var(--bg);
         border-bottom:1px solid var(--line);padding:12px 20px;
         display:flex;gap:16px;align-items:center;flex-wrap:wrap}
  h1{font-size:15px;margin:0;font-weight:600}
  .count{font-variant-numeric:tabular-nums;color:var(--dim);font-size:13px}
  .count b{color:var(--txt)}
  select,button{background:var(--card);color:var(--txt);border:1px solid var(--line);
                border-radius:7px;padding:6px 11px;font:inherit;font-size:13px;cursor:pointer}
  button:hover{border-color:var(--acc)}
  button.primary{background:var(--acc);color:#04121f;border-color:var(--acc);font-weight:600}
  main{padding:16px 20px 120px;max-width:1000px;margin:0 auto;
       display:grid;gap:12px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:12px;
        padding:14px;display:grid;grid-template-columns:184px 1fr;gap:16px;align-items:start}
  .card[data-ok="OK"]{border-color:var(--ok)}
  .card[data-ok="NO"]{opacity:.45}
  .card.dup{border-left:3px solid var(--warn)}
  /* Fondo blanco, no negro: los gifs vienen sobre blanco, y con #000 cada carga
     diferida parpadeaba en negro antes de pintar. */
  .gif{width:184px;height:184px;border-radius:9px;background:#fff;object-fit:contain}
  .gif.none{display:grid;place-items:center;color:var(--dim);font-size:12px;
            background:var(--bg);border:1px dashed var(--line)}
  .name{font-size:17px;font-weight:600;margin:0 0 2px;
        background:none;border:none;color:var(--txt);width:100%;
        border-bottom:1px dashed transparent;padding:1px 0;font-family:inherit}
  .name:hover{border-bottom-color:var(--line)}
  .name:focus{outline:none;border-bottom-color:var(--acc)}
  .name.renamed{color:var(--acc)}
  .meta{color:var(--dim);font-size:13px;margin-bottom:8px;
        display:flex;gap:5px;align-items:baseline;flex-wrap:wrap}
  .name-en{background:none;border:none;color:var(--dim);font:inherit;
           border-bottom:1px dashed transparent;padding:1px 0;min-width:180px;flex:1}
  .name-en:hover{border-bottom-color:var(--line)}
  .name-en:focus{outline:none;border-bottom-color:var(--acc);color:var(--txt)}
  .name-en.renamed{color:var(--acc)}
  .was{color:var(--acc);font-size:12px;margin:-4px 0 8px}
  .cand{font-size:14px;margin:8px 0 10px}
  .cand b{font-weight:600}
  .tag{display:inline-block;font-size:11px;padding:1px 7px;border-radius:20px;
       border:1px solid var(--line);color:var(--dim);margin-right:5px;
       text-transform:uppercase;letter-spacing:.04em}
  .tag.exact{color:var(--ok);border-color:var(--ok)}
  .tag.strong{color:var(--acc);border-color:var(--acc)}
  .tag.dup{color:var(--warn);border-color:var(--warn)}
  .acts{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
  .acts button{min-width:74px}
  .acts .yes[aria-pressed="true"]{background:var(--ok);border-color:var(--ok);color:#04120a;font-weight:600}
  .acts .not[aria-pressed="true"]{background:var(--no);border-color:var(--no);color:#fff;font-weight:600}
  .rivals{margin-top:9px;padding:8px 10px;background:var(--bg);border-radius:8px;
          font-size:12.5px;color:var(--dim)}
  .rivals b{color:var(--warn)}
  dialog{background:var(--card);color:var(--txt);border:1px solid var(--line);
         border-radius:12px;padding:18px;max-width:760px;width:92vw}
  textarea{width:100%;height:52vh;background:var(--bg);color:var(--txt);
           border:1px solid var(--line);border-radius:8px;padding:10px;
           font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;resize:vertical}
  kbd{background:var(--bg);border:1px solid var(--line);border-radius:4px;
      padding:0 5px;font-size:11px;font-family:ui-monospace,monospace}
</style>
</head>
<body>
<header>
  <h1>Revisión de media</h1>
  <span class="count"><b id="cOk">0</b> aceptados · <b id="cNo">0</b> descartados ·
    <b id="cPend">0</b> pendientes</span>
  <select id="fTier">
    <option value="">todos los tiers</option>
    <option value="exact">exact</option>
    <option value="strong">strong</option>
    <option value="weak">weak</option>
    <option value="colision">solo colisiones</option>
    <option value="sin">sin candidato</option>
  </select>
  <select id="fGrupo"><option value="">todos los grupos</option></select>
  <select id="fEstado">
    <option value="">todo</option>
    <option value="pend">solo pendientes</option>
  </select>
  <button id="bExport" class="primary">Exportar TSV</button>
  <span class="count"><kbd>A</kbd> aceptar · <kbd>R</kbd> descartar</span>
</header>
<main id="lista"></main>

<dialog id="dlg">
  <p style="margin:0 0 9px">Pega esto en <code>scripts/edb/review/media.tsv</code>
     (reemplaza el archivo entero), luego <code>node scripts/edb/emit-sql.js</code>.</p>
  <textarea id="salida" readonly></textarea>
  <div style="margin-top:11px;display:flex;gap:8px">
    <button id="bCopy" class="primary">Copiar</button>
    <button id="bDl">Descargar</button>
    <button onclick="dlg.close()">Cerrar</button>
  </div>
</dialog>

<script>
const DATOS = __DATOS__;
const CLAVE = 'raw-media-review';

// Las decisiones sobreviven a un F5: son cien y pico y no se toman de una vez.
const guardado = JSON.parse(localStorage.getItem(CLAVE) || '{}');
DATOS.forEach((r, i) => {
  const g = guardado[r.nombre] || {};
  r.i = i;
  r.ok = g.ok ?? (r.ok === 'OK' ? 'OK' : '');
  r.nombre_nuevo = g.nombre_nuevo ?? '';
  r.name_en_nuevo = g.name_en_nuevo ?? '';
});

const guardar = () => {
  const out = {};
  for (const r of DATOS) {
    if (r.ok || r.nombre_nuevo || r.name_en_nuevo) {
      out[r.nombre] = { ok: r.ok, nombre_nuevo: r.nombre_nuevo, name_en_nuevo: r.name_en_nuevo };
    }
  }
  localStorage.setItem(CLAVE, JSON.stringify(out));
};

const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Qué nombres se están sustituyendo. Vacío si no se ha tocado nada.
const textoAntes = r => {
  const partes = [r.nombre_nuevo && r.nombre, r.name_en_nuevo && r.name_en].filter(Boolean);
  return partes.length ? 'antes: ' + partes.join(' · ') : '';
};

const lista = document.getElementById('lista');
const filtros = { tier: '', grupo: '', estado: '' };

for (const g of [...new Set(DATOS.map(r => r.grupo))].sort()) {
  fGrupo.insertAdjacentHTML('beforeend', \`<option>\${esc(g)}</option>\`);
}

function visible(r) {
  if (filtros.grupo && r.grupo !== filtros.grupo) return false;
  if (filtros.estado === 'pend' && r.ok) return false;
  if (!filtros.tier) return true;
  if (filtros.tier === 'colision') return r.colisiona;
  if (filtros.tier === 'sin') return r.tier === 'sin candidato';
  return r.tier.startsWith(filtros.tier);
}

function pintar() {
  const filas = DATOS.filter(visible);
  lista.innerHTML = filas.map(tarjeta).join('') ||
    '<p style="color:var(--dim)">Nada que mostrar con estos filtros.</p>';
  contar();
}

function tarjeta(r) {
  const dup = r.colisiona
    ? DATOS.filter(o => o.edb_id === r.edb_id && o.nombre !== r.nombre).map(o => o.nombre)
    : [];
  const tier = r.tier.split(' ')[0];
  return \`
  <div class="card \${r.colisiona ? 'dup' : ''}" data-ok="\${r.ok}" data-i="\${r.i}">
    \${r.gif_url
      ? \`<img class="gif" loading="lazy" src="\${esc(r.gif_url)}" alt="">\`
      : '<div class="gif none">sin candidato</div>'}
    <div>
      <input class="name \${r.nombre_nuevo ? 'renamed' : ''}" data-i="\${r.i}" data-campo="nombre_nuevo"
             value="\${esc(r.nombre_nuevo || r.nombre)}"
             title="Edítalo para renombrar el ejercicio en español">
      <div class="meta">
        <span>\${esc(r.grupo)}</span><span>·</span>
        <input class="name-en \${r.name_en_nuevo ? 'renamed' : ''}" data-i="\${r.i}" data-campo="name_en_nuevo"
               value="\${esc(r.name_en_nuevo || r.name_en)}"
               title="Edítalo para cambiar el nombre en inglés">
      </div>
      <div class="was" data-was="\${r.i}">\${esc(textoAntes(r))}</div>
      <div class="cand">
        <span class="tag \${tier}">\${esc(r.tier)}</span>
        \${r.score ? \`<span class="tag">\${esc(r.score)}</span>\` : ''}
        \${r.colisiona ? '<span class="tag dup">colisión</span>' : ''}
        \${r.edb_name ? \`<br><b>\${esc(r.edb_name)}</b>
           <span style="color:var(--dim)">· \${esc(r.edb_equip)}</span>\` : ''}
      </div>
      <div class="acts">
        <button class="yes" data-a="OK" data-i="\${r.i}" aria-pressed="\${r.ok === 'OK'}">Aceptar</button>
        <button class="not" data-a="NO" data-i="\${r.i}" aria-pressed="\${r.ok === 'NO'}">Descartar</button>
      </div>
      \${dup.length ? \`<div class="rivals">Este gif se lo disputa con
        <b>\${dup.map(esc).join('</b>, <b>')}</b>. Acepta uno como mucho.</div>\` : ''}
    </div>
  </div>\`;
}

function contar() {
  cOk.textContent = DATOS.filter(r => r.ok === 'OK').length;
  cNo.textContent = DATOS.filter(r => r.ok === 'NO').length;
  cPend.textContent = DATOS.filter(r => !r.ok).length;
}

lista.addEventListener('click', e => {
  const b = e.target.closest('button[data-a]');
  if (!b) return;
  const r = DATOS[+b.dataset.i];
  r.ok = r.ok === b.dataset.a ? '' : b.dataset.a;   // volver a pulsar deshace
  const card = b.closest('.card');
  card.dataset.ok = r.ok;
  card.querySelector('.yes').setAttribute('aria-pressed', r.ok === 'OK');
  card.querySelector('.not').setAttribute('aria-pressed', r.ok === 'NO');
  guardar(); contar();
});

// Un solo manejador para los dos campos editables: el nombre español y el
// inglés. Se guarda vacío cuando coincide con el original, para que "renombrado"
// signifique de verdad "cambiado" y no "tocado".
lista.addEventListener('input', e => {
  const input = e.target.closest('input[data-campo]');
  if (!input) return;
  const r = DATOS[+input.dataset.i];
  const campo = input.dataset.campo;
  const original = campo === 'nombre_nuevo' ? r.nombre : r.name_en;
  const v = input.value.trim();
  r[campo] = (v && v !== original) ? v : '';
  input.classList.toggle('renamed', Boolean(r[campo]));
  // Se actualiza el texto en vez de repintar la tarjeta: repintar mientras
  // escribes te quita el foco del campo.
  const was = lista.querySelector(\`[data-was="\${r.i}"]\`);
  if (was) was.textContent = textoAntes(r);
  guardar();
});

// Aceptar/descartar con el teclado sobre la tarjeta que tengas debajo del ratón.
let bajoRaton = null;
lista.addEventListener('mouseover', e => { bajoRaton = e.target.closest('.card'); });
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const k = e.key.toLowerCase();
  if (k !== 'a' && k !== 'r') return;
  if (!bajoRaton) return;
  bajoRaton.querySelector(k === 'a' ? '.yes' : '.not').click();
});

for (const [el, key] of [[fTier, 'tier'], [fGrupo, 'grupo'], [fEstado, 'estado']]) {
  el.addEventListener('change', () => { filtros[key] = el.value; pintar(); });
}

bExport.addEventListener('click', () => {
  const cols = ['ok','grupo','nombre','nombre_nuevo','name_en','name_en_nuevo','tier','score',
                'edb_name','edb_equip','gif_url','edb_id'];
  const tsv = [cols.join('\\t'), ...DATOS.map(r =>
    cols.map(c => String(r[c] ?? '').replace(/[\\t\\r\\n]+/g, ' ')).join('\\t'))].join('\\n') + '\\n';
  salida.value = tsv;
  dlg.showModal();
});
bCopy.addEventListener('click', async () => {
  await navigator.clipboard.writeText(salida.value);
  bCopy.textContent = 'Copiado';
  setTimeout(() => bCopy.textContent = 'Copiar', 1200);
});
bDl.addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([salida.value], { type: 'text/tab-separated-values' }));
  a.download = 'media.tsv';
  a.click();
});

pintar();
</script>
</body>
</html>
`

main().catch(err => { process.stderr.write(`\n${err.message}\n`); process.exit(1) })
