/*
 * Genera review/pendientes.html: elegir entre varios candidatos, mirándolos.
 *
 * La página de la primera ronda (review.html) enseña un candidato por
 * ejercicio y se responde sí o no. Esta es la otra forma de la misma pregunta:
 * aquí hay dos, tres o cuatro animaciones para el mismo movimiento y hay que
 * escoger cuál es —o ninguna—, que es lo que quedó pendiente cuando la única
 * propuesta de la ronda anterior estaba mal.
 *
 * Se abre con file://: los datos van incrustados y las decisiones se guardan
 * en localStorage, con su propia clave para no pisar las de la otra página.
 *
 *   node scripts/edb/review-pendientes.js
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REVIEW = join(dirname(fileURLToPath(import.meta.url)), 'review')

async function main() {
  const text = await readFile(join(REVIEW, 'pendientes.tsv'), 'utf8')
  const [head, ...body] = text.trim().split('\n')
  const cols = head.split('\t')
  const rows = body.filter(Boolean).map(line => {
    const cells = line.split('\t')
    return Object.fromEntries(cols.map((c, i) => [c, (cells[i] ?? '').trim()]))
  })

  // Una entrada por ejercicio, con sus candidatos dentro.
  const porEjercicio = []
  for (const r of rows) {
    let g = porEjercicio.find(x => x.nombre === r.nombre)
    if (!g) { g = { nombre: r.nombre, name_en: r.name_en, grupo: r.grupo, opciones: [] }; porEjercicio.push(g) }
    if (r.edb_id) g.opciones.push(r)
  }

  const html = PAGE.replace('__DATOS__', JSON.stringify(porEjercicio))
  await writeFile(join(REVIEW, 'pendientes.html'), html)
  process.stderr.write(
    `${porEjercicio.length} ejercicios · ${rows.filter(r => r.edb_id).length} candidatos ` +
    `→ ${join(REVIEW, 'pendientes.html')}\n`)
}

const PAGE = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pendientes · elegir animación</title>
<style>
  :root{--bg:#0e0e10;--card:#17171a;--line:#26262b;--txt:#e8e8ea;--dim:#8b8b93;
        --ok:#3fb950;--warn:#d29922;--acc:#58a6ff}
  @media (prefers-color-scheme:light){
    :root{--bg:#f6f6f7;--card:#fff;--line:#e2e2e5;--txt:#18181b;--dim:#6b6b73}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--txt);
       font:15px/1.5 ui-sans-serif,system-ui,-apple-system,sans-serif}
  header{position:sticky;top:0;z-index:10;background:var(--bg);
         border-bottom:1px solid var(--line);padding:12px 20px;
         display:flex;gap:16px;align-items:center;flex-wrap:wrap}
  h1{font-size:15px;margin:0;font-weight:600}
  .count{font-size:13px;color:var(--dim);font-variant-numeric:tabular-nums}
  .count b{color:var(--txt)}
  button{background:var(--card);color:var(--txt);border:1px solid var(--line);
         border-radius:7px;padding:6px 11px;font:inherit;font-size:13px;cursor:pointer}
  button:hover{border-color:var(--acc)}
  button.primary{background:var(--acc);color:#04121f;border-color:var(--acc);font-weight:600}
  main{padding:16px 20px 120px;max-width:1080px;margin:0 auto;display:grid;gap:14px}
  .ex{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px}
  .ex.done{border-color:var(--ok)}
  .ex.none{opacity:.5}
  .hd{margin-bottom:10px;display:flex;gap:10px;align-items:baseline}
  .hd b{font-size:16px}
  .hd span{color:var(--dim);font-size:13px;flex:1}
  /* "Ninguna" va en la cabecera y no entre las miniaturas: no es un candidato
     más, es descartarlos todos, y metido en la fila caía en cualquier hueco
     que dejara el ajuste de línea. */
  .nada{flex-shrink:0;font-size:12px;padding:4px 10px}
  .nada[aria-pressed="true"]{border-color:var(--warn);color:var(--warn);font-weight:600}
  .ops{display:flex;gap:10px;flex-wrap:wrap}
  .op{border:2px solid var(--line);border-radius:10px;padding:8px;cursor:pointer;
      background:none;text-align:center;width:150px}
  .op[aria-pressed="true"]{border-color:var(--ok);background:color-mix(in srgb,var(--ok) 12%,transparent)}
  .op img{width:130px;height:130px;object-fit:contain;background:#fff;border-radius:7px;display:block}
  .op .nm{font-size:11.5px;line-height:1.3;margin-top:6px;word-break:break-word}
  .op .mt{font-size:10.5px;color:var(--dim);margin-top:2px}
  .op .warn{color:var(--warn)}
  .nada{align-self:center;min-width:104px}
  .vacio{color:var(--dim);font-size:13px;font-style:italic}
  dialog{background:var(--card);color:var(--txt);border:1px solid var(--line);
         border-radius:12px;padding:18px;max-width:780px;width:92vw}
  textarea{width:100%;height:52vh;background:var(--bg);color:var(--txt);
           border:1px solid var(--line);border-radius:8px;padding:10px;
           font:12px/1.45 ui-monospace,Menlo,monospace}
</style>
</head>
<body>
<header>
  <h1>Pendientes · elegir animación</h1>
  <span class="count"><b id="cSel">0</b> elegidos · <b id="cNo">0</b> sin ninguna ·
    <b id="cPend">0</b> por decidir</span>
  <button id="bExport" class="primary">Exportar TSV</button>
</header>
<main id="lista"></main>

<dialog id="dlg">
  <p style="margin:0 0 9px">Pega esto en <code>scripts/edb/review/pendientes.tsv</code>,
     luego <code>node scripts/edb/emit-sql.js</code>.</p>
  <textarea id="salida" readonly></textarea>
  <div style="margin-top:11px;display:flex;gap:8px">
    <button id="bCopy" class="primary">Copiar</button>
    <button onclick="dlg.close()">Cerrar</button>
  </div>
</dialog>

<script>
const DATOS = __DATOS__;
const CLAVE = 'raw-pendientes-review';
const guardado = JSON.parse(localStorage.getItem(CLAVE) || '{}');
DATOS.forEach((g, i) => { g.i = i; g.elegido = guardado[g.nombre] ?? null });  // edb_id | 'NADA' | null

const guardar = () => {
  const out = {};
  for (const g of DATOS) if (g.elegido) out[g.nombre] = g.elegido;
  localStorage.setItem(CLAVE, JSON.stringify(out));
};
const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

function pintar() {
  lista.innerHTML = DATOS.map(g => \`
    <div class="ex \${g.elegido && g.elegido !== 'NADA' ? 'done' : ''} \${g.elegido === 'NADA' ? 'none' : ''}" data-i="\${g.i}">
      <div class="hd">
        <b>\${esc(g.nombre)}</b>
        <span>· \${esc(g.grupo)} · \${esc(g.name_en)}</span>
        \${g.opciones.length ? \`<button class="nada" data-i="\${g.i}" data-id="NADA"
                aria-pressed="\${g.elegido === 'NADA'}">Ninguna</button>\` : ''}
      </div>
      \${g.opciones.length ? \`<div class="ops">
        \${g.opciones.map(o => \`
          <button class="op" data-i="\${g.i}" data-id="\${esc(o.edb_id)}"
                  aria-pressed="\${g.elegido === o.edb_id}">
            <img loading="lazy" src="\${esc(o.gif_url)}" alt="">
            <div class="nm">\${esc(o.edb_name)}</div>
            <div class="mt">\${esc(o.edb_equip)} · \${esc(o.score)}</div>
            \${o.aviso ? \`<div class="mt warn">\${esc(o.aviso)}</div>\` : ''}
          </button>\`).join('')}
      </div>\` : '<p class="vacio">El corpus no tiene nada compatible.</p>'}
    </div>\`).join('');
  contar();
}

function contar() {
  const conOps = DATOS.filter(g => g.opciones.length);
  cSel.textContent = DATOS.filter(g => g.elegido && g.elegido !== 'NADA').length;
  cNo.textContent = DATOS.filter(g => g.elegido === 'NADA').length;
  cPend.textContent = conOps.filter(g => !g.elegido).length;
}

lista.addEventListener('click', e => {
  const b = e.target.closest('.op, .nada');
  if (!b) return;
  const g = DATOS[+b.dataset.i];
  g.elegido = g.elegido === b.dataset.id ? null : b.dataset.id;  // repulsar deshace
  guardar(); pintar();
});

bExport.addEventListener('click', () => {
  const cols = ['ok','grupo','nombre','name_en','opcion','score','aviso',
                'edb_name','edb_equip','gif_url','edb_id'];
  const filas = [];
  for (const g of DATOS) {
    if (!g.opciones.length) { filas.push(['', g.grupo, g.nombre, g.name_en, '', '', 'sin candidato', '', '', '', '']); continue }
    g.opciones.forEach((o, i) => filas.push([
      g.elegido === o.edb_id ? 'OK' : '', g.grupo, g.nombre, g.name_en,
      String(i + 1), o.score, o.aviso, o.edb_name, o.edb_equip, o.gif_url, o.edb_id,
    ]));
  }
  salida.value = [cols.join('\\t'), ...filas.map(f =>
    f.map(c => String(c ?? '').replace(/[\\t\\r\\n]+/g, ' ')).join('\\t'))].join('\\n') + '\\n';
  dlg.showModal();
});
bCopy.addEventListener('click', async () => {
  await navigator.clipboard.writeText(salida.value);
  bCopy.textContent = 'Copiado';
  setTimeout(() => bCopy.textContent = 'Copiar', 1200);
});

pintar();
</script>
</body>
</html>
`

main().catch(err => { process.stderr.write(`\n${err.message}\n`); process.exit(1) })
