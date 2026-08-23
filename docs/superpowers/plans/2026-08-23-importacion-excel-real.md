# Importación Real desde Excel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir la importación simulada de `panel-basico` por una importación real: el cliente sube su propio Excel/CSV, se lee en el navegador con SheetJS, el cliente mapea qué columna es cada dato, revisa una vista previa, y se añaden/actualizan productos de verdad en Supabase.

**Architecture:** Todo el parseo ocurre en el cliente (SheetJS vía CDN, sin backend propio). El flujo vive casi entero en `js/import.js` (mapeo, validación, vista previa, envío por lotes), con una única función nueva en `js/data.js` (`upsertProductsChunk`) para la escritura en Supabase vía `upsert(..., { onConflict: "sku" })`. El HTML del modal `#importModal` pasa de 3 a 5 estados.

**Tech Stack:** HTML5, CSS3 (variables del proyecto), JavaScript ES2017+ vainilla, SheetJS (`xlsx`) Community Edition vía CDN, Supabase JS SDK v2.

## Global Constraints

- Alcance exclusivo de `panel-basico/`. No se toca `panel-intermedio/` ni `panel-completo/`.
- Sin build step: sin bundlers ni dependencias npm — SheetJS se carga por `<script>` desde su CDN oficial.
- Seguir el estilo visual existente: variables CSS (`--primary`, `--danger`, `--text-muted`, etc.), mismo patrón de botones/inputs que el resto del panel.
- Todo texto de la interfaz en español.
- `escapeHtml()` (en `js/data.js`) debe usarse para cualquier dato proveniente del archivo subido (cabeceras, nombres, SKU) antes de insertarlo en `innerHTML` — son datos de un archivo del cliente, no de confianza.
- No hay framework de tests en este proyecto. La verificación combina `node --check` para sintaxis y comprobación funcional real en el navegador (ver cada tarea) — incluyendo, cuando sea posible, disparar el `<input type="file">` con un `File`/`DataTransfer` construido en JS y sustituir temporalmente `upsertProductsChunk` por una función simulada para poder ejercitar el flujo completo sin escribir en la base de datos real.
- Formato esperado del archivo: se toma la fila 1 como cabeceras y el resto como datos; solo se usa la primera hoja del libro.
- Reglas de importación (de la spec, sección 3 y 4): upsert por SKU vía `onConflict: "sku"`; el cliente elige si el stock de un producto existente se **sustituye** o se **suma**; nombre y stock mínimo se sustituyen siempre que la columna esté mapeada y la celda no esté vacía; filas inválidas (sin nombre, sin SKU, o stock/stock mínimo no numérico) se excluyen sin bloquear el resto; filas totalmente vacías se ignoran sin contar como error; duplicados de SKU dentro del mismo archivo se procesan en orden, ganando/acumulando el de más abajo; el mapeo de columnas se recuerda en `localStorage` por conjunto exacto de cabeceras; el envío a Supabase se trocea en lotes de 50 filas, con opción de reintentar solo lo que quedó pendiente si un lote falla.

---

## Resumen de archivos afectados

- Modificar: `panel-basico/index.html`
- Modificar: `panel-basico/js/data.js`
- Modificar: `panel-basico/js/import.js` (reescritura completa)
- Modificar: `panel-basico/css/styles.css`
- Modificar: `panel-basico/README.md`

---

### Task 1: SheetJS + función de escritura por lotes (`upsertProductsChunk`)

**Files:**
- Modify: `panel-basico/index.html:284` (añadir script de SheetJS)
- Modify: `panel-basico/js/data.js` (añadir función al final)

**Interfaces:**
- Consumes: `db` (de `js/supabaseClient.js`), `mapRow(row)` (ya existente en `js/data.js`).
- Produces: `upsertProductsChunk(rows): Promise<Array<{id, nombre, sku, stock, stockMinimo}>>` en `js/data.js`, donde `rows` es un array de `{ nombre, sku, stock, stockMinimo }`. La Tarea 2 la usará. También produce, globalmente en la página, el objeto `XLSX` (de la librería SheetJS) que la Tarea 2 usará para leer archivos.

Esta tarea es puramente aditiva: no borra ni modifica nada que ya esté en uso, así que la importación simulada actual sigue funcionando exactamente igual al terminar esta tarea (se sustituye por completo en la Tarea 2).

- [ ] **Step 1: Añadir el script de SheetJS**

En `panel-basico/index.html`, el bloque de scripts final es actualmente:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/config.js"></script>
<script src="js/supabaseClient.js"></script>
<script src="js/data.js"></script>
<script src="js/app.js"></script>
<script src="js/import.js"></script>
<script src="js/auth.js"></script>
<script src="js/theme.js"></script>
```

Sustitúyelo por (se añade SheetJS justo antes de `js/import.js`, que es el único archivo que lo usa):

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
<script src="js/config.js"></script>
<script src="js/supabaseClient.js"></script>
<script src="js/data.js"></script>
<script src="js/app.js"></script>
<script src="js/import.js"></script>
<script src="js/auth.js"></script>
<script src="js/theme.js"></script>
```

- [ ] **Step 2: Añadir `upsertProductsChunk` en `js/data.js`**

Al final de `panel-basico/js/data.js` (después de la función `insertProductsBatch`, que sigue existiendo por ahora — se elimina en la Tarea 2), añade:

```js

async function upsertProductsChunk(rows) {
  const payload = rows.map(({ nombre, sku, stock, stockMinimo }) => ({
    nombre,
    sku,
    stock,
    stock_minimo: stockMinimo,
  }));

  const { data, error } = await db
    .from("products")
    .upsert(payload, { onConflict: "sku" })
    .select("id, nombre, sku, stock, stock_minimo");

  if (error) throw error;
  return data.map(mapRow);
}
```

Nota para quien implemente: `onConflict: "sku"` funciona porque `sku` ya es `unique` en `public.products` (ver `supabase/schema.sql`) — Postgres encuentra la fila en conflicto por ese índice único y la actualiza, sin que haga falta enviar el `id`. No se necesita ninguna política RLS nueva: `upsert` es un INSERT con UPDATE de respaldo, y ya existen las políticas de `insert` y `update` para `authenticated` en `schema.sql`.

- [ ] **Step 3: Verificar sintaxis de `data.js`**

Run: `node --check panel-basico/js/data.js`
Expected: sin salida (exit code 0).

- [ ] **Step 4: Verificación en el navegador**

Sirve `panel-basico/` con un servidor estático (ej. `python -m http.server 8000` desde ese directorio) y abre `index.html`. En la consola del navegador (DevTools):

```js
typeof XLSX === "object" && typeof XLSX.read === "function"
typeof upsertProductsChunk === "function"
```

Expected: ambas líneas devuelven `true`. Esto confirma que SheetJS se cargó correctamente y que la nueva función existe, sin necesidad de sesión de Supabase ni de tocar la base de datos real.

- [ ] **Step 5: Commit**

```bash
cd panel-basico
git add index.html js/data.js
git commit -m "feat: añade SheetJS y la función de escritura por lotes para la importación real"
```

---

### Task 2: Flujo real de importación (mapeo, vista previa y envío por lotes)

**Files:**
- Modify: `panel-basico/index.html` (reestructura completa de `#importModal`)
- Modify: `panel-basico/css/styles.css` (nuevos estilos + ampliar el modal)
- Modify: `panel-basico/js/import.js` (reescritura completa)
- Modify: `panel-basico/js/data.js` (eliminar `insertProductsBatch`, ya sin uso)

**Interfaces:**
- Consumes: `PRODUCTS`, `renderTable()`, `updateDashboard()`, `showToast(message, tone)` (de `js/app.js`/`js/data.js`), `escapeHtml(str)` (de `js/data.js`), `upsertProductsChunk(rows)` (de la Tarea 1), `XLSX` (global de SheetJS, de la Tarea 1).
- Produces: nada que otra tarea del plan consuma — es la última pieza funcional. `js/import.js` sigue siendo autocontenido (no expone funciones a otros archivos), igual que antes.

Esta tarea sustituye por completo la importación simulada. Al terminarla, `insertProductsBatch` deja de usarse en cualquier sitio, así que se elimina en el mismo paso.

- [ ] **Step 1: Reestructurar el modal de importación en `index.html`**

En `panel-basico/index.html`, el bloque completo del modal (desde `<!-- Modal: Importación Excel -->` hasta el `</div>` que lo cierra, justo antes de `<div class="toast" id="toast"></div>`) es actualmente:

```html
<!-- Modal: Importación Excel -->
<div class="modal-overlay" id="importModal">
  <div class="modal">
    <div class="modal-header">
      <div>
        <h3>Importar desde Excel</h3>
        <p class="modal-sub">Sube un archivo para actualizar tu inventario</p>
      </div>
      <button class="modal-close" id="importCloseBtn" aria-label="Cerrar">&times;</button>
    </div>

    <div class="import-state" id="importIdleState">
      <div class="file-card">
        <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
        <div class="file-info">
          <span class="file-name">inventario.xlsx</span>
          <span class="file-meta">96 KB</span>
        </div>
      </div>
      <button class="btn-primary" id="importStartBtn">Subir archivo</button>
    </div>

    <div class="import-state" id="importProgressState" hidden>
      <p class="progress-label">Procesando archivo…</p>
      <div class="progress-track">
        <div class="progress-fill" id="importProgressBar"></div>
      </div>
      <span class="progress-pct" id="importProgressText">0%</span>
    </div>

    <div class="import-state import-success" id="importSuccessState" hidden>
      <svg class="success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      <p><strong id="importSuccessCount">18</strong> productos importados correctamente</p>
    </div>
  </div>
</div>
```

Sustitúyelo por:

```html
<!-- Modal: Importación Excel -->
<div class="modal-overlay" id="importModal">
  <div class="modal modal--wide">
    <div class="modal-header">
      <div>
        <h3>Importar desde Excel</h3>
        <p class="modal-sub">Sube un archivo para actualizar tu inventario</p>
      </div>
      <button class="modal-close" id="importCloseBtn" aria-label="Cerrar">&times;</button>
    </div>

    <div class="import-state" id="importIdleState">
      <label class="file-card" for="importFileInput">
        <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
        <div class="file-info">
          <span class="file-name" id="importFileName">Ningún archivo seleccionado</span>
          <span class="file-meta">.xlsx, .xls o .csv</span>
        </div>
      </label>
      <input type="file" id="importFileInput" accept=".xlsx,.xls,.csv" hidden>
      <p class="import-error" id="importFileError" hidden></p>
    </div>

    <div class="import-state" id="importMappingState" hidden>
      <p class="progress-label">Indica qué columna es cada dato:</p>
      <div class="mapping-list" id="mappingList"></div>
      <div class="field">
        <span class="field-label">Al actualizar productos que ya existen</span>
        <div class="radio-group">
          <label class="radio-option">
            <input type="radio" name="mergeMode" value="replace" checked>
            Sustituir su stock
          </label>
          <label class="radio-option">
            <input type="radio" name="mergeMode" value="sum">
            Sumar al stock actual
          </label>
        </div>
      </div>
      <button class="btn-primary" id="mappingContinueBtn" disabled>Continuar</button>
    </div>

    <div class="import-state" id="importPreviewState" hidden>
      <p class="preview-summary" id="previewSummary"></p>
      <div class="table-wrap preview-table-wrap">
        <table class="products-table preview-table">
          <thead>
            <tr><th>Nombre</th><th>SKU</th><th>Stock</th><th>Stock mínimo</th></tr>
          </thead>
          <tbody id="previewBody"></tbody>
        </table>
      </div>
      <div class="preview-errors" id="previewErrors" hidden></div>
      <div class="modal-actions">
        <button class="btn-secondary" id="previewBackBtn">Volver</button>
        <button class="btn-primary" id="previewConfirmBtn">Confirmar importación</button>
      </div>
    </div>

    <div class="import-state" id="importProgressState" hidden>
      <p class="progress-label" id="importProgressLabel">Importando…</p>
      <div class="progress-track">
        <div class="progress-fill" id="importProgressBar"></div>
      </div>
      <span class="progress-pct" id="importProgressText">0%</span>
    </div>

    <div class="import-state import-success" id="importResultState" hidden>
      <svg class="success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      <p id="importResultSummary"></p>
      <div class="preview-errors" id="resultErrors" hidden></div>
      <button class="btn-primary" id="importResultCloseBtn">Cerrar</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Verificar visualmente la estructura del modal (sin lógica todavía)**

Con un servidor estático corriendo, abre la página, y en la consola del navegador fuerza el modal abierto sin sesión:

```js
document.getElementById("importModal").classList.add("open");
```

Expected: se ve el modal en su estado inicial (selector de archivo con el texto "Ningún archivo seleccionado"), con el layout de dos columnas roto porque `js/import.js` todavía no se ha actualizado (es normal en este punto — el objetivo de este paso es solo confirmar que el HTML no tiene errores de anidación y que el modal se abre). Cierra el modal con `document.getElementById("importModal").classList.remove("open")` antes de continuar.

- [ ] **Step 3: Añadir los estilos nuevos en `css/styles.css`**

Justo después de `.btn-import:active { transform: translateY(0) scale(0.98); }` (línea 738) y antes del comentario `/* Modales */` (línea 740), no hace falta nada nuevo aquí — los estilos van en el bloque de importación. Busca el bloque `/* Modal: importación */` (empieza en la línea 856, justo después de `.field-input:focus { outline: none; border-color: var(--primary); }` y de `.btn-primary:disabled {...}`) y sustitúyelo completo — desde `/* Modal: importación */` hasta el cierre de `@keyframes pop-in { ... }` (línea 924, justo antes de `/* Toast — siempre oscuro... */`) — por:

```css
/* Modal: importación */
.modal--wide { max-width: 560px; }

.import-state {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: stretch;
}

.import-state[hidden] { display: none; }

.file-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg);
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  padding: 16px;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.file-card:hover { border-color: var(--primary); }

.file-icon { width: 30px; height: 30px; color: var(--primary); flex-shrink: 0; }

.file-info { display: flex; flex-direction: column; gap: 2px; }
.file-name { font-weight: 700; font-size: 14px; }
.file-meta { font-size: 12px; color: var(--text-muted); }

.import-error {
  margin: 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--danger);
  background: var(--danger-soft);
  padding: 8px 12px;
  border-radius: var(--radius-md);
}

.mapping-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 240px;
  overflow-y: auto;
}

.mapping-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 160px);
  align-items: center;
  gap: 12px;
}

.mapping-column-name {
  font-size: 13.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mapping-select { padding: 8px 10px; font-size: 13px; }

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  cursor: pointer;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  padding: 12px 18px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.btn-secondary:hover { border-color: var(--primary); color: var(--primary); }
.btn-secondary:active { transform: scale(0.98); }

.preview-summary {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-muted);
}

.preview-table-wrap { max-height: 220px; overflow-y: auto; }

.preview-errors {
  background: var(--danger-soft);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-size: 12.5px;
  color: var(--danger);
}

.preview-errors ul { margin: 6px 0 0; padding-left: 18px; }
.preview-errors li { margin-bottom: 2px; }

.progress-label { margin: 0; font-size: 13px; color: var(--text-muted); }

.progress-track {
  height: 10px;
  background: var(--bg);
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  width: 0%;
  background: var(--primary);
  border-radius: 999px;
  transition: width 0.1s linear;
}

.progress-pct {
  align-self: flex-end;
  font-size: 13px;
  font-weight: 700;
  color: var(--primary);
}

.import-success {
  align-items: center;
  text-align: center;
  padding: 12px 0;
}

.success-icon {
  width: 44px;
  height: 44px;
  color: var(--ok);
  animation: pop-in 0.4s ease;
}

.import-success p { margin: 0; font-size: 14px; }

@keyframes pop-in {
  0% { transform: scale(0.5); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
```

(Este bloque conserva `.file-card`, `.file-icon`, `.file-info`, `.progress-*` y `.import-success`/`.success-icon` tal cual estaban — se siguen usando — y añade todo lo nuevo para las pantallas de mapeo y vista previa, más `.modal--wide` y el cursor/hover en `.file-card` porque ahora es clicable.)

- [ ] **Step 4: Añadir el `media query` para el mapeo en móvil**

En `panel-basico/css/styles.css`, el bloque responsive final es:

```css
/* Responsive */
@media (max-width: 720px) {
  .dashboard {
    grid-template-columns: 1fr;
  }
}
```

Sustitúyelo por:

```css
/* Responsive */
@media (max-width: 720px) {
  .dashboard {
    grid-template-columns: 1fr;
  }

  .mapping-row {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Verificar sintaxis CSS**

No hay linter de CSS configurado en este proyecto; verifica leyendo el archivo completo tras el cambio y confirmando que cada regla abre y cierra sus llaves correctamente (en particular, que el bloque grande sustituido en el Step 3 no dejó ninguna llave de más o de menos al pegar sobre el bloque anterior).

- [ ] **Step 6: Reescribir `js/import.js` por completo**

Sustituye TODO el contenido de `panel-basico/js/import.js` por:

```js
const importModal = document.getElementById("importModal");
const importFileInput = document.getElementById("importFileInput");
const importFileName = document.getElementById("importFileName");
const importFileError = document.getElementById("importFileError");
const importIdleState = document.getElementById("importIdleState");
const importMappingState = document.getElementById("importMappingState");
const importPreviewState = document.getElementById("importPreviewState");
const importProgressState = document.getElementById("importProgressState");
const importResultState = document.getElementById("importResultState");
const mappingList = document.getElementById("mappingList");
const mappingContinueBtn = document.getElementById("mappingContinueBtn");
const previewSummary = document.getElementById("previewSummary");
const previewBody = document.getElementById("previewBody");
const previewErrors = document.getElementById("previewErrors");
const previewBackBtn = document.getElementById("previewBackBtn");
const previewConfirmBtn = document.getElementById("previewConfirmBtn");
const importProgressBar = document.getElementById("importProgressBar");
const importProgressText = document.getElementById("importProgressText");
const importProgressLabel = document.getElementById("importProgressLabel");
const importResultSummary = document.getElementById("importResultSummary");
const resultErrors = document.getElementById("resultErrors");
const importResultCloseBtn = document.getElementById("importResultCloseBtn");

const IMPORT_MAPPING_STORAGE_KEY = "panelbasico-import-mapping";
const IMPORT_FIELDS = [
  { key: "nombre", label: "Nombre" },
  { key: "sku", label: "SKU" },
  { key: "stock", label: "Stock" },
  { key: "stockMinimo", label: "Stock mínimo" },
];
const IMPORT_BATCH_SIZE = 50;

let importHeaders = [];
let importDataRows = [];
let importValidRows = [];
let importInvalidRows = [];
let importRun = 0;

function openImportModal() {
  importRun++;
  importFileInput.value = "";
  importFileName.textContent = "Ningún archivo seleccionado";
  importFileError.hidden = true;
  showImportState("idle");
  importModal.classList.add("open");
}

function closeImportModal() {
  importRun++;
  importModal.classList.remove("open");
}

function showImportState(state) {
  importIdleState.hidden = state !== "idle";
  importMappingState.hidden = state !== "mapping";
  importPreviewState.hidden = state !== "preview";
  importProgressState.hidden = state !== "progress";
  importResultState.hidden = state !== "result";
}

// --- Paso 1: seleccionar y parsear el archivo ---

importFileInput.addEventListener("change", async () => {
  const file = importFileInput.files[0];
  if (!file) return;

  importFileName.textContent = file.name;
  importFileError.hidden = true;

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    const nonEmptyRows = rows.filter((row) => row.some((cell) => String(cell).trim() !== ""));
    if (nonEmptyRows.length < 2) {
      throw new Error("El archivo no tiene filas de datos, solo la cabecera (o está vacío).");
    }

    importHeaders = nonEmptyRows[0].map((h) => String(h).trim());
    importDataRows = nonEmptyRows.slice(1);
    renderMappingStep();
    showImportState("mapping");
  } catch (error) {
    console.error(error);
    importFileError.textContent = "No se pudo leer el archivo. Comprueba que es un .xlsx, .xls o .csv válido.";
    importFileError.hidden = false;
  }
});

// --- Paso 2: mapeo de columnas ---

function loadSavedMapping() {
  try {
    const raw = localStorage.getItem(IMPORT_MAPPING_STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw);
    return all[importHeaders.join("|")] || null;
  } catch (error) {
    return null;
  }
}

function saveMapping(headerToField) {
  try {
    const raw = localStorage.getItem(IMPORT_MAPPING_STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[importHeaders.join("|")] = headerToField;
    localStorage.setItem(IMPORT_MAPPING_STORAGE_KEY, JSON.stringify(all));
  } catch (error) {
    // localStorage puede fallar (modo privado, cuota) — no es crítico, se ignora.
  }
}

function renderMappingStep() {
  const saved = loadSavedMapping();
  mappingList.innerHTML = "";

  const options = [`<option value="">Ignorar esta columna</option>`]
    .concat(IMPORT_FIELDS.map((f) => `<option value="${f.key}">${f.label}</option>`))
    .join("");

  importHeaders.forEach((header, index) => {
    const row = document.createElement("div");
    row.className = "mapping-row";
    row.innerHTML = `
      <span class="mapping-column-name">${escapeHtml(header)}</span>
      <select class="field-input mapping-select" data-column-index="${index}">${options}</select>
    `;
    mappingList.appendChild(row);
    row.querySelector("select").value = saved ? saved[header] || "" : "";
  });

  mappingList.querySelectorAll(".mapping-select").forEach((select) => {
    select.addEventListener("change", updateMappingContinueState);
  });
  updateMappingContinueState();
}

function getCurrentMapping() {
  const mapping = {};
  mappingList.querySelectorAll(".mapping-select").forEach((select) => {
    const field = select.value;
    if (field) mapping[field] = Number(select.dataset.columnIndex);
  });
  return mapping;
}

function updateMappingContinueState() {
  const mapping = getCurrentMapping();
  mappingContinueBtn.disabled = mapping.nombre === undefined || mapping.sku === undefined;
}

mappingContinueBtn.addEventListener("click", () => {
  const mapping = getCurrentMapping();
  const mergeMode = document.querySelector('input[name="mergeMode"]:checked').value;

  const headerToField = {};
  importHeaders.forEach((header, index) => {
    const found = Object.entries(mapping).find(([, colIndex]) => colIndex === index);
    headerToField[header] = found ? found[0] : "";
  });
  saveMapping(headerToField);

  buildPreview(mapping, mergeMode);
  showImportState("preview");
});

// --- Paso 3: validar filas y construir la vista previa ---

function parseNonNegativeInt(value) {
  if (value === undefined || value === null) return null;
  const trimmed = typeof value === "string" ? value.trim() : value;
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return NaN;
  return n;
}

function buildPreview(mapping, mergeMode) {
  importValidRows = [];
  importInvalidRows = [];

  const indexBySku = new Map();

  importDataRows.forEach((row, i) => {
    const rowNumber = i + 2; // fila 1 = cabecera
    if (row.every((cell) => String(cell).trim() === "")) return;

    const rawNombre = mapping.nombre !== undefined ? String(row[mapping.nombre] ?? "").trim() : "";
    const rawSku = mapping.sku !== undefined ? String(row[mapping.sku] ?? "").trim() : "";

    if (!rawNombre) { importInvalidRows.push({ rowNumber, reason: "sin nombre" }); return; }
    if (!rawSku) { importInvalidRows.push({ rowNumber, reason: "sin SKU" }); return; }

    const stockParsed = parseNonNegativeInt(mapping.stock !== undefined ? row[mapping.stock] : "");
    if (Number.isNaN(stockParsed)) { importInvalidRows.push({ rowNumber, reason: "stock inválido" }); return; }

    const stockMinimoParsed = parseNonNegativeInt(mapping.stockMinimo !== undefined ? row[mapping.stockMinimo] : "");
    if (Number.isNaN(stockMinimoParsed)) { importInvalidRows.push({ rowNumber, reason: "stock mínimo inválido" }); return; }

    const priorIndex = indexBySku.get(rawSku);
    const priorEntry = priorIndex !== undefined ? importValidRows[priorIndex] : null;
    const existing = PRODUCTS.find((p) => p.sku === rawSku);
    const isUpdate = Boolean(priorEntry) || Boolean(existing);

    const baseStock = priorEntry ? priorEntry.stock : (existing ? existing.stock : 0);
    let finalStock;
    if (stockParsed === null) {
      finalStock = baseStock;
    } else if (isUpdate && mergeMode === "sum") {
      finalStock = baseStock + stockParsed;
    } else {
      finalStock = stockParsed;
    }

    const baseStockMinimo = priorEntry ? priorEntry.stockMinimo : (existing ? existing.stockMinimo : 5);
    const finalStockMinimo = stockMinimoParsed !== null ? stockMinimoParsed : baseStockMinimo;

    const entry = { rowNumber, nombre: rawNombre, sku: rawSku, stock: finalStock, stockMinimo: finalStockMinimo, isUpdate };

    if (priorIndex !== undefined) {
      importValidRows[priorIndex] = entry;
    } else {
      indexBySku.set(rawSku, importValidRows.length);
      importValidRows.push(entry);
    }
  });

  renderPreview();
}

function renderPreview() {
  const newCount = importValidRows.filter((r) => !r.isUpdate).length;
  const updateCount = importValidRows.filter((r) => r.isUpdate).length;
  previewSummary.textContent = `${newCount} nuevas · ${updateCount} actualizaciones · ${importInvalidRows.length} con error`;

  previewBody.innerHTML = "";
  importValidRows.slice(0, 10).forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.nombre)}</td>
      <td class="sku">${escapeHtml(row.sku)}</td>
      <td>${row.stock}</td>
      <td>${row.stockMinimo}</td>
    `;
    previewBody.appendChild(tr);
  });
  if (importValidRows.length > 10) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="table-loading">y ${importValidRows.length - 10} filas más</td>`;
    previewBody.appendChild(tr);
  }
  if (importValidRows.length === 0) {
    previewBody.innerHTML = `<tr><td colspan="4" class="table-loading">No hay filas válidas para importar.</td></tr>`;
  }

  if (importInvalidRows.length > 0) {
    previewErrors.hidden = false;
    previewErrors.innerHTML = `<p class="progress-label">Filas con error:</p><ul>${importInvalidRows
      .map((e) => `<li>fila ${e.rowNumber}: ${escapeHtml(e.reason)}</li>`)
      .join("")}</ul>`;
  } else {
    previewErrors.hidden = true;
    previewErrors.innerHTML = "";
  }

  previewConfirmBtn.disabled = importValidRows.length === 0;
}

previewBackBtn.addEventListener("click", () => {
  showImportState("mapping");
});

// --- Paso 4: confirmar e importar por lotes ---

previewConfirmBtn.addEventListener("click", () => {
  const confirmed = window.confirm(`¿Importar? Esto añadirá o actualizará ${importValidRows.length} productos de verdad en el inventario.`);
  if (!confirmed) return;
  runImport();
});

async function runImport() {
  const run = ++importRun;
  showImportState("progress");
  importProgressBar.style.width = "0%";
  importProgressText.textContent = "0%";

  const chunks = [];
  for (let i = 0; i < importValidRows.length; i += IMPORT_BATCH_SIZE) {
    chunks.push(importValidRows.slice(i, i + IMPORT_BATCH_SIZE));
  }

  let processed = 0;

  for (let i = 0; i < chunks.length; i++) {
    if (run !== importRun) return;
    importProgressLabel.textContent = `Lote ${i + 1} de ${chunks.length}…`;

    try {
      const chunk = chunks[i];
      const result = await upsertProductsChunk(chunk);
      if (run !== importRun) return;

      result.forEach((product) => {
        const existingIndex = PRODUCTS.findIndex((p) => p.sku === product.sku);
        if (existingIndex >= 0) PRODUCTS[existingIndex] = product;
        else PRODUCTS.push(product);
      });

      processed += chunk.length;
      const pct = Math.round((processed / importValidRows.length) * 100);
      importProgressBar.style.width = `${pct}%`;
      importProgressText.textContent = `${pct}%`;
    } catch (error) {
      console.error(error);
      if (run !== importRun) return;
      renderTable();
      updateDashboard();
      importValidRows = importValidRows.slice(processed);
      renderPreview();
      showImportState("preview");
      const message = error.code === "23505" ? "Conflicto de SKU en un lote." : "No se pudo completar la importación.";
      showToast(`${message} Se procesaron ${processed} filas antes del fallo; quedan ${importValidRows.length} por reintentar.`, "error");
      return;
    }
  }

  const added = importValidRows.filter((r) => !r.isUpdate).length;
  const updated = importValidRows.filter((r) => r.isUpdate).length;

  renderTable();
  updateDashboard();
  showResult(added, updated);
}

function showResult(added, updated) {
  importResultSummary.innerHTML = `<strong>${added}</strong> productos añadidos, <strong>${updated}</strong> actualizados`;

  if (importInvalidRows.length > 0) {
    resultErrors.hidden = false;
    resultErrors.innerHTML = `<p class="progress-label">${importInvalidRows.length} filas se omitieron:</p><ul>${importInvalidRows
      .map((e) => `<li>fila ${e.rowNumber}: ${escapeHtml(e.reason)}</li>`)
      .join("")}</ul>`;
  } else {
    resultErrors.hidden = true;
    resultErrors.innerHTML = "";
  }

  showImportState("result");
}

importResultCloseBtn.addEventListener("click", closeImportModal);

// --- Apertura / cierre del modal ---

document.getElementById("importOpenBtn").addEventListener("click", openImportModal);
document.getElementById("importCloseBtn").addEventListener("click", closeImportModal);
importModal.addEventListener("click", (event) => {
  if (event.target === importModal) closeImportModal();
});
```

- [ ] **Step 7: Verificar sintaxis de `import.js`**

Run: `node --check panel-basico/js/import.js`
Expected: sin salida (exit code 0).

- [ ] **Step 8: Eliminar `insertProductsBatch` de `js/data.js`**

En `panel-basico/js/data.js`, localiza y elimina por completo esta función (ya no la usa nadie tras el Step 6):

```js

async function insertProductsBatch(products) {
  const rows = products.map(({ nombre, sku, stock, stockMinimo }) => ({
    nombre,
    sku,
    stock,
    stock_minimo: stockMinimo,
  }));

  const { data, error } = await db
    .from("products")
    .insert(rows)
    .select("id, nombre, sku, stock, stock_minimo");

  if (error) throw error;
  return data.map(mapRow);
}
```

- [ ] **Step 9: Verificar sintaxis de `data.js` tras el borrado**

Run: `node --check panel-basico/js/data.js`
Expected: sin salida (exit code 0).

- [ ] **Step 10: Verificación funcional completa en el navegador, sin tocar la base de datos real**

Con el servidor estático corriendo, abre la página y en la consola del navegador:

1. Fuerza la pantalla de la app visible sin sesión real (como en tareas anteriores del proyecto):

```js
document.getElementById("appScreen").hidden = false;
document.getElementById("loginScreen").hidden = true;
PRODUCTS = [{ id: 1, nombre: "Camiseta básica", sku: "CAM-001", stock: 10, stockMinimo: 5 }];
renderTable();
updateDashboard();
```

2. Sustituye temporalmente `upsertProductsChunk` por una versión simulada, para poder probar el flujo completo sin escribir en Supabase de verdad:

```js
upsertProductsChunk = async (rows) => {
  console.log("upsertProductsChunk llamada con:", rows);
  return rows.map((r, i) => ({ id: 1000 + i, nombre: r.nombre, sku: r.sku, stock: r.stock, stockMinimo: r.stockMinimo }));
};
```

3. Abre el modal (`document.getElementById("importOpenBtn").click()`) y simula la selección de un archivo CSV real construido en memoria:

```js
const csv = "Nombre,SKU,Stock,Stock mínimo\nCamiseta básica,CAM-001,7,5\nPantalón nuevo,PAN-099,20,4\n,SIN-NOMBRE,3,2\nOtro producto,OTR-050,texto,2\n";
const file = new File([csv], "prueba.csv", { type: "text/csv" });
const dt = new DataTransfer();
dt.items.add(file);
document.getElementById("importFileInput").files = dt.files;
document.getElementById("importFileInput").dispatchEvent(new Event("change", { bubbles: true }));
```

   Expected: el modal pasa a la pantalla de mapeo con 4 columnas detectadas ("Nombre", "SKU", "Stock", "Stock mínimo"). El botón "Continuar" está desactivado hasta que asignes manualmente Nombre y SKU en los desplegables (o, si ya se guardó un mapeo antes con las mismas cabeceras, debería venir precargado).

4. Asigna cada desplegable a su campo correspondiente (Nombre→Nombre, SKU→SKU, Stock→Stock, Stock mínimo→Stock mínimo) y pulsa "Continuar".

   Expected: pantalla de vista previa mostrando "1 nuevas · 1 actualizaciones · 2 con error" (CAM-001 ya existía en `PRODUCTS` → actualización; PAN-099 es nuevo; la fila sin nombre y la de stock "texto" aparecen en la lista de errores con los motivos "sin nombre" y "stock inválido").

5. Pulsa "Confirmar importación" y acepta el `confirm()`.

   Expected: aparece brevemente la barra de progreso ("Lote 1 de 1…"), luego la pantalla de resultado ("1 productos añadidos, 1 actualizados" + el aviso de las 2 filas omitidas), y en la consola se ve el `console.log` con el array que se le pasó a la versión simulada de `upsertProductsChunk` — comprueba en ese log que el producto CAM-001 lleva `stock: 7` (porque el modo por defecto es "Sustituir").

6. Repite el mismo archivo pero eligiendo "Sumar al stock actual" en el mapeo antes de continuar — comprueba en el log que esta vez CAM-001 lleva `stock: 17` (10 + 7).

7. Cierra el modal y recarga la página (para descartar la sustitución temporal de `upsertProductsChunk`).

- [ ] **Step 11: Commit**

```bash
cd panel-basico
git add index.html css/styles.css js/import.js js/data.js
git commit -m "feat: importación real desde Excel con mapeo de columnas y vista previa"
```

---

### Task 3: Documentación

**Files:**
- Modify: `panel-basico/README.md`

**Interfaces:**
- Consumes: nada.
- Produces: nada.

- [ ] **Step 1: Actualizar el bullet de "Importar desde Excel" en Funcionalidades**

En `panel-basico/README.md`, busca el bullet (añadido en un trabajo anterior):

```markdown
- **Importar desde Excel (simulado):** botón que abre un modal, simula la
  subida de un archivo con una barra de progreso de ~2s y **inserta de
  verdad** entre 15 y 20 productos generados en la base de datos.
```

Sustitúyelo por:

```markdown
- **Importar desde Excel:** sube un `.xlsx`, `.xls` o `.csv` real, indica
  qué columna es el nombre/SKU/stock/stock mínimo (el mapeo se recuerda
  para la próxima vez), revisa una vista previa con los productos nuevos y
  las actualizaciones antes de confirmar, y elige si el stock de productos
  ya existentes se sustituye o se suma al actual. Las filas inválidas se
  listan sin bloquear la importación del resto.
```

- [ ] **Step 2: Actualizar la nota de "Notas para extender" sobre la importación**

Busca la frase (también de un trabajo anterior) que menciona que la
importación es una simulación, similar a:

```markdown
La importación desde Excel de este nivel es una simulación (ver Funcionalidades)
```

y ajústala para que ya no diga que es una simulación, dejando claro que
ahora es una importación real con mapeo de columnas (mantén el resto de la
frase sobre proveedores/variantes tal cual esté, ya que eso sigue siendo
correcto — solo corrige la parte de la importación).

- [ ] **Step 3: Commit**

```bash
cd panel-basico
git add README.md
git commit -m "docs: documenta la importación real desde Excel"
```

## Verificación final (a cargo del usuario, con sesión real)

1. Preparar un `.xlsx` real (por ejemplo exportando la tabla de productos
   actual desde cualquier hoja de cálculo) con columnas de nombre, SKU,
   stock y stock mínimo, y subirlo con sesión iniciada de verdad.
2. Comprobar en Supabase (tabla `products`) que los productos nuevos se
   crearon y los que ya existían se actualizaron según el modo elegido
   (sustituir/sumar), incluyendo que el nombre solo cambia si la columna
   de nombre venía mapeada y rellena.
3. Repetir la importación con el mismo archivo (mismas cabeceras) y
   comprobar que el mapeo de columnas aparece ya rellenado.
4. Probar con un archivo `.csv` además del `.xlsx`.
5. Revisar visualmente las pantallas de mapeo y vista previa en modo claro
   y oscuro, y en móvil (menos de 720px de ancho).
