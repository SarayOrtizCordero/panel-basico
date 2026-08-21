# Mejoras Plan Básico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir a `panel-basico` la eliminación de productos, una importación "desde Excel" simulada (igual que en `panel-intermedio`) y la mascota de marca "fueguito" en cabecera, login y pie de página.

**Architecture:** El proyecto es HTML + CSS + JS vainilla sin build step, con Supabase como backend (auth + tabla `products` con Row Level Security). Cada función nueva sigue el patrón ya existente: `js/data.js` habla con Supabase, `js/app.js` pinta el DOM y engancha eventos, `js/import.js` es un módulo nuevo dedicado solo a la simulación de importación (mismo patrón de separación que `panel-intermedio`).

**Tech Stack:** HTML5, CSS3 (variables CSS para tema claro/oscuro), JavaScript ES2017+ vainilla, Supabase JS SDK v2 (vía CDN), Postgres/Supabase (SQL + Row Level Security).

## Global Constraints

- Alcance exclusivo de `panel-basico/`. No tocar `panel-intermedio/` ni `panel-completo/`.
- Sin build step: no se introducen bundlers, frameworks ni dependencias npm.
- Seguir el estilo visual existente: variables CSS de `styles.css` (`--primary`, `--danger`, `--text-muted`, etc.), mismo patrón de botones/iconos SVG inline con `stroke-width="2"` para iconografía funcional.
- Todo texto en español, igual que el resto de la interfaz.
- `escapeHtml()` (definida en `js/data.js`) debe seguir usándose para cualquier dato de producto insertado en `innerHTML`.
- **Sobre las pruebas:** este proyecto no tiene ningún framework de tests (no hay `package.json`, ni Jest, ni Playwright, ni ningún archivo de test). La verificación de cada tarea combina: `node --check` para validar la sintaxis de cada archivo `.js` tocado, e inspección visual/DOM en el navegador vía las herramientas de Browser (abriendo `index.html` con un servidor estático local). El panel está conectado a un proyecto Supabase real; los flujos que necesitan sesión iniciada (persistencia real del borrado, inserción real de la importación) se verifican forzando el DOM a mostrar `#appScreen` sin iniciar sesión real (así se prueba maquetación, JS y renderizado sin tocar la base de datos), y quedan para verificación final manual del usuario con su propia sesión — así se acordó explícitamente antes de escribir este plan.

---

## Resumen de archivos afectados

- Modificar: `panel-basico/supabase/schema.sql`
- Modificar: `panel-basico/README.md`
- Modificar: `panel-basico/js/data.js`
- Modificar: `panel-basico/js/app.js`
- Modificar: `panel-basico/css/styles.css`
- Modificar: `panel-basico/index.html`
- Crear: `panel-basico/js/import.js`

---

### Task 1: Política de borrado en Supabase + documentación

**Files:**
- Modify: `panel-basico/supabase/schema.sql:27-34`
- Modify: `panel-basico/README.md` (sección "Configuración de Supabase (una sola vez)")

**Interfaces:**
- Consumes: nada (solo SQL/documentación).
- Produces: la política SQL `"Usuarios autenticados pueden eliminar productos"` que la Tarea 2 necesita para que `deleteProduct()` funcione contra la base de datos real.

- [ ] **Step 1: Añadir la política de borrado y el grant en `schema.sql`**

Abre `panel-basico/supabase/schema.sql`. El bloque actual (líneas 27-34) es:

```sql
create policy "Usuarios autenticados pueden actualizar productos"
  on public.products for update
  to authenticated
  using (true)
  with check (true);

grant usage on schema public to authenticated;
grant select, insert, update on public.products to authenticated;
```

Sustitúyelo por:

```sql
create policy "Usuarios autenticados pueden actualizar productos"
  on public.products for update
  to authenticated
  using (true)
  with check (true);

create policy "Usuarios autenticados pueden eliminar productos"
  on public.products for delete
  to authenticated
  using (true);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.products to authenticated;
```

- [ ] **Step 2: Verificar que el SQL no tiene errores de sintaxis evidentes**

Lee el archivo completo (`panel-basico/supabase/schema.sql`) y confirma:
- El nuevo bloque `create policy ... for delete` tiene la misma indentación y estructura que el de `update` (salvo que no lleva `with check`, porque `delete` no lo necesita — solo `using`).
- El `grant` final incluye ahora `delete` en la lista, sin romper la coma/sintaxis.
- El archivo sigue terminando en el `insert into public.products (...) on conflict (sku) do nothing;` ya existente, sin tocarlo.

- [ ] **Step 3: Documentar el paso de migración para proyectos Supabase ya existentes**

En `panel-basico/README.md`, dentro de la sección `## Configuración de Supabase (una sola vez)`, justo después del punto 6 (que termina en "...sustituyendo los marcadores `TU-PROYECTO` y `TU-ANON-KEY`.") y antes del párrafo "Con eso, abrir `index.html`...", añade:

```markdown

> **Si ya tenías este proyecto Supabase creado antes de añadir el borrado de
> productos:** `schema.sql` no se vuelve a ejecutar solo. Ve a **SQL Editor**
> y ejecuta únicamente esto una vez:
>
> ```sql
> create policy "Usuarios autenticados pueden eliminar productos"
>   on public.products for delete
>   to authenticated
>   using (true);
>
> grant delete on public.products to authenticated;
> ```
```

- [ ] **Step 4: Añadir la nueva funcionalidad a la lista de "Funcionalidades" del README**

En la misma sección `## Funcionalidades`, después del bullet que empieza por "**Añadir producto:**" (línea ~24-25), añade un nuevo bullet:

```markdown
- **Eliminar producto:** botón de papelera en cada fila, con confirmación
  antes de borrar de verdad en la base de datos.
```

- [ ] **Step 5: Commit**

```bash
cd panel-basico
git add supabase/schema.sql README.md
git commit -m "docs+db: añade política de borrado de productos"
```

---

### Task 2: Eliminar producto (backend + UI)

**Files:**
- Modify: `panel-basico/js/data.js:46-56` (añadir función al final del archivo)
- Modify: `panel-basico/js/app.js:19-50` (botón en la fila), `js/app.js:95-136` (handler + listener)
- Modify: `panel-basico/css/styles.css:479-487` (ancho de `.col-actions`), `css/styles.css:638-657` (nuevo `.btn-delete`)

**Interfaces:**
- Consumes: `db` (de `js/supabaseClient.js`), `PRODUCTS`, `productsBody`, `showToast(message, tone)`, `updateDashboard()`, `renderTable()`, `escapeHtml(str)` (todas ya existentes).
- Produces: `deleteProduct(id): Promise<void>` en `js/data.js`; `removeProduct(id): Promise<void>` en `js/app.js` (llamada desde el nuevo botón `.btn-delete`).

- [ ] **Step 1: Añadir `deleteProduct` en `js/data.js`**

Al final de `panel-basico/js/data.js` (después de la función `insertProduct`, que termina en `}` en la línea 55), añade:

```js

async function deleteProduct(id) {
  const { error } = await db.from("products").delete().eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 2: Verificar sintaxis de `data.js`**

Run: `node --check panel-basico/js/data.js`
Expected: sin salida (exit code 0 = sintaxis válida).

- [ ] **Step 3: Añadir el botón de papelera a cada fila en `js/app.js`**

En `panel-basico/js/app.js`, dentro de `renderRow`, el bloque `<td class="col-actions">` (líneas 40-46) es actualmente:

```js
    <td class="col-actions">
      <button class="btn-restock" data-id="${p.id}" aria-label="Reponer stock de ${safeNombre}" title="Reponer stock">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"></path><path d="M1 3h22v5H1z"></path><line x1="10" y1="12" x2="14" y2="12"></line><line x1="12" y1="10" x2="12" y2="14"></line></svg>
      </button>
      <button class="btn-qty btn-minus" data-id="${p.id}" data-action="dec" aria-label="Restar unidad de ${safeNombre}">−</button>
      <button class="btn-qty btn-plus" data-id="${p.id}" data-action="inc" aria-label="Sumar unidad de ${safeNombre}">+</button>
    </td>
```

Sustitúyelo por (añade el botón de papelera al final):

```js
    <td class="col-actions">
      <button class="btn-restock" data-id="${p.id}" aria-label="Reponer stock de ${safeNombre}" title="Reponer stock">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"></path><path d="M1 3h22v5H1z"></path><line x1="10" y1="12" x2="14" y2="12"></line><line x1="12" y1="10" x2="12" y2="14"></line></svg>
      </button>
      <button class="btn-qty btn-minus" data-id="${p.id}" data-action="dec" aria-label="Restar unidad de ${safeNombre}">−</button>
      <button class="btn-qty btn-plus" data-id="${p.id}" data-action="inc" aria-label="Sumar unidad de ${safeNombre}">+</button>
      <button class="btn-delete" data-id="${p.id}" aria-label="Eliminar ${safeNombre}" title="Eliminar producto">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
      </button>
    </td>
```

- [ ] **Step 4: Añadir la función `removeProduct` en `js/app.js`**

En `panel-basico/js/app.js`, justo después de la función `changeStock` (termina en la línea 114 con `});`) y antes del comentario `productsBody.addEventListener("click", ...)` (línea 116), añade:

```js

async function removeProduct(id) {
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) return;

  const confirmed = window.confirm(`¿Eliminar "${product.nombre}"? Esta acción no se puede deshacer.`);
  if (!confirmed) return;

  const row = productsBody.querySelector(`tr[data-id="${id}"]`);
  const deleteBtn = row ? row.querySelector(".btn-delete") : null;
  if (deleteBtn) deleteBtn.disabled = true;

  try {
    await deleteProduct(id);
    PRODUCTS = PRODUCTS.filter((p) => p.id !== id);
    if (row) row.remove();
    if (PRODUCTS.length === 0) renderTable();
    updateDashboard();
    showToast(`${product.nombre} eliminado del inventario`, "ok");
  } catch (error) {
    console.error(error);
    if (deleteBtn) deleteBtn.disabled = false;
    showToast("No se pudo eliminar el producto. Inténtalo de nuevo.", "error");
  }
}
```

- [ ] **Step 5: Enganchar el click del botón de papelera**

En `panel-basico/js/app.js`, el listener de `productsBody` (líneas 116-136) empieza así:

```js
productsBody.addEventListener("click", (event) => {
  const restockBtn = event.target.closest(".btn-restock");
  if (restockBtn) {
    openRestockModal(Number(restockBtn.dataset.id));
    return;
  }

  const btn = event.target.closest(".btn-qty");
```

Inserta un nuevo bloque entre el `if (restockBtn)` y el `const btn = ...`:

```js
productsBody.addEventListener("click", (event) => {
  const restockBtn = event.target.closest(".btn-restock");
  if (restockBtn) {
    openRestockModal(Number(restockBtn.dataset.id));
    return;
  }

  const deleteBtn = event.target.closest(".btn-delete");
  if (deleteBtn) {
    removeProduct(Number(deleteBtn.dataset.id));
    return;
  }

  const btn = event.target.closest(".btn-qty");
```

(El resto de la función, desde `if (btn) {` hasta el cierre `});`, no cambia.)

- [ ] **Step 6: Verificar sintaxis de `app.js`**

Run: `node --check panel-basico/js/app.js`
Expected: sin salida (exit code 0).

- [ ] **Step 7: Estilo del botón de papelera en `css/styles.css`**

Justo después del bloque `.btn-restock` (que termina en la línea 656 con `.btn-restock:active { transform: scale(0.9); }`) y antes del comentario `/* Cabecera de tabla con acción */` (línea 658), añade:

```css

.btn-delete {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  margin-left: 6px;
  transition: transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.btn-delete svg { width: 14px; height: 14px; }
.btn-delete:hover { border-color: var(--danger); background: var(--danger-soft); color: var(--danger); }
.btn-delete:active { transform: scale(0.9); }
.btn-delete:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 8: Ampliar el ancho de la columna de acciones**

En `panel-basico/css/styles.css`, la regla `.col-actions` (dentro del bloque que empieza en la línea 479) es:

```css
.col-photo { width: 56px; }
.col-actions {
  width: 170px;
```

Cambia `width: 170px;` por `width: 210px;` (ahora hay 4 botones en vez de 3 en esa columna). El resto de la regla (el comentario sobre `white-space: nowrap` y `.table-loading` debajo) no cambia.

- [ ] **Step 9: Verificación visual sin sesión real**

Sirve el directorio con un servidor estático (por ejemplo `python -m http.server 8000` dentro de `panel-basico/`) y abre `index.html` en el navegador. En la consola del navegador (DevTools), ejecuta:

```js
document.getElementById("appScreen").hidden = false;
document.getElementById("loginScreen").hidden = true;
PRODUCTS = [{ id: 1, nombre: "Producto de prueba", sku: "TEST-1", stock: 5, stockMinimo: 2 }];
renderTable();
updateDashboard();
```

Expected: aparece una fila con el nombre "Producto de prueba", y en la columna de acciones se ven 4 botones: reponer, `−`, `+` y la papelera nueva (con icono, borde y hover en rojo al pasar el ratón). Al hacer click en la papelera aparece el `confirm()` del navegador con el texto `¿Eliminar "Producto de prueba"? Esta acción no se puede deshacer.`. Si cancelas, la fila sigue ahí. (No aceptes el diálogo en esta verificación: al no haber sesión real, `deleteProduct` fallaría contra Supabase por RLS y mostraría el toast de error — eso es exactamente el comportamiento esperado sin login, no un bug.)

- [ ] **Step 10: Commit**

```bash
cd panel-basico
git add js/data.js js/app.js css/styles.css
git commit -m "feat: permite eliminar productos del inventario"
```

---

### Task 3: Importar desde Excel (simulado)

**Files:**
- Modify: `panel-basico/js/data.js` (añadir función al final)
- Modify: `panel-basico/index.html:123-133` (botón), añadir modal antes de `<div class="toast">`, añadir `<script src="js/import.js">`
- Modify: `panel-basico/css/styles.css` (nuevos estilos: `.table-header-actions`, `.btn-import`, `.import-state`, `.file-card`, `.progress-*`, `.import-success`)
- Create: `panel-basico/js/import.js`
- Modify: `panel-basico/README.md` (Funcionalidades + Estructura)

**Interfaces:**
- Consumes: `PRODUCTS`, `renderTable()`, `updateDashboard()`, `showToast(message, tone)` (de `js/app.js`), `mapRow(row)` y `db` (de `js/data.js` / `js/supabaseClient.js`).
- Produces: `insertProductsBatch(products): Promise<Array<{id, nombre, sku, stock, stockMinimo}>>` en `js/data.js`. `js/import.js` no expone funciones a otros archivos (autocontenido, solo engancha sus propios listeners), igual que en `panel-intermedio`.

- [ ] **Step 1: Añadir `insertProductsBatch` en `js/data.js`**

Al final de `panel-basico/js/data.js` (después de la función `deleteProduct` añadida en la Tarea 2), añade:

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

- [ ] **Step 2: Verificar sintaxis de `data.js`**

Run: `node --check panel-basico/js/data.js`
Expected: sin salida (exit code 0).

- [ ] **Step 3: Añadir el botón "Importar desde Excel" junto a "Añadir producto"**

En `panel-basico/index.html`, el bloque `.table-header` (líneas 124-133) es:

```html
    <div class="table-header">
      <div class="table-header-text">
        <h2>Productos</h2>
        <span class="table-sub">Gestiona el stock en tiempo real</span>
      </div>
      <button class="btn-add-product" id="addProductOpenBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Añadir producto
      </button>
    </div>
```

Sustitúyelo por (se añade el botón de importar y se envuelven los dos botones en `.table-header-actions`):

```html
    <div class="table-header">
      <div class="table-header-text">
        <h2>Productos</h2>
        <span class="table-sub">Gestiona el stock en tiempo real</span>
      </div>
      <div class="table-header-actions">
        <button class="btn-import" id="importOpenBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Importar desde Excel
        </button>
        <button class="btn-add-product" id="addProductOpenBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Añadir producto
        </button>
      </div>
    </div>
```

- [ ] **Step 4: Añadir el modal de importación**

En `panel-basico/index.html`, justo antes de `<div class="toast" id="toast"></div>` (línea 207, inmediatamente después de que cierra `#addProductModal`), añade:

```html
<!-- Modal: Importación Excel -->
<div class="modal-overlay" id="importModal">
  <div class="modal modal--import">
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

- [ ] **Step 5: Cargar `js/import.js` en el HTML**

En `panel-basico/index.html`, el bloque de scripts final (líneas 209-215) es:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/config.js"></script>
<script src="js/supabaseClient.js"></script>
<script src="js/data.js"></script>
<script src="js/app.js"></script>
<script src="js/auth.js"></script>
<script src="js/theme.js"></script>
```

Sustitúyelo por (se añade `import.js` entre `app.js` y `auth.js`, porque `import.js` usa funciones definidas en `app.js` y `data.js`):

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

- [ ] **Step 6: Crear `js/import.js`**

Crea `panel-basico/js/import.js` con este contenido completo:

```js
const importModal = document.getElementById("importModal");
const importProgressBar = document.getElementById("importProgressBar");
const importProgressText = document.getElementById("importProgressText");
const importStartBtn = document.getElementById("importStartBtn");
const importIdleState = document.getElementById("importIdleState");
const importProgressState = document.getElementById("importProgressState");
const importSuccessState = document.getElementById("importSuccessState");
const importSuccessCount = document.getElementById("importSuccessCount");

const IMPORT_PRODUCT_NAMES = [
  "Camiseta básica", "Pantalón vaquero", "Sudadera con capucha", "Zapatillas running", "Gorra deportiva",
  "Chaqueta impermeable", "Vestido de verano", "Bufanda de lana", "Calcetines (pack 3)", "Guantes térmicos",
];

// Semilla a partir de la hora actual (no un contador fijo) para que los SKU
// generados no choquen con los de una importación anterior ya guardada en
// la base de datos.
let importCounter = Date.now();

function nextImportSku() {
  importCounter++;
  return `IMP-${importCounter.toString(36).toUpperCase()}`;
}

function openImportModal() {
  showImportState("idle");
  importModal.classList.add("open");
}

function closeImportModal() {
  importModal.classList.remove("open");
}

function showImportState(state) {
  importIdleState.hidden = state !== "idle";
  importProgressState.hidden = state !== "progress";
  importSuccessState.hidden = state !== "success";
}

function startImport() {
  showImportState("progress");
  importProgressBar.style.width = "0%";
  importProgressText.textContent = "0%";

  const duration = 2000;
  const start = performance.now();

  function step(now) {
    const elapsed = now - start;
    const pct = Math.min(100, Math.round((elapsed / duration) * 100));
    importProgressBar.style.width = `${pct}%`;
    importProgressText.textContent = `${pct}%`;

    if (elapsed < duration) {
      requestAnimationFrame(step);
    } else {
      finishImport();
    }
  }

  requestAnimationFrame(step);
}

function generateFakeProducts(n) {
  const products = [];
  for (let i = 0; i < n; i++) {
    const name = IMPORT_PRODUCT_NAMES[i % IMPORT_PRODUCT_NAMES.length];
    const tanda = Math.floor(i / IMPORT_PRODUCT_NAMES.length) + 1;

    products.push({
      nombre: `${name} ${tanda}`,
      sku: nextImportSku(),
      stock: Math.floor(Math.random() * 40) + 1,
      stockMinimo: Math.floor(Math.random() * 8) + 3,
    });
  }
  return products;
}

async function finishImport() {
  const count = Math.floor(Math.random() * 6) + 15; // 15–20 productos
  const generated = generateFakeProducts(count);

  try {
    const added = await insertProductsBatch(generated);
    PRODUCTS.push(...added);

    importSuccessCount.textContent = added.length;
    showImportState("success");

    setTimeout(() => {
      closeImportModal();
      renderTable();
      updateDashboard();
      showToast(`${added.length} productos importados correctamente`, "ok");
    }, 900);
  } catch (error) {
    console.error(error);
    showImportState("idle");
    showToast("No se pudo completar la importación. Inténtalo de nuevo.", "error");
  }
}

document.getElementById("importOpenBtn").addEventListener("click", openImportModal);
document.getElementById("importCloseBtn").addEventListener("click", closeImportModal);
importStartBtn.addEventListener("click", startImport);
importModal.addEventListener("click", (event) => {
  if (event.target === importModal) closeImportModal();
});
```

- [ ] **Step 7: Verificar sintaxis de `import.js`**

Run: `node --check panel-basico/js/import.js`
Expected: sin salida (exit code 0).

- [ ] **Step 8: Estilos — botón de importar y contenedor de botones de cabecera**

En `panel-basico/css/styles.css`, justo después del bloque `.btn-add-product:active { transform: translateY(0) scale(0.98); }` (línea 684) y antes del comentario `/* Modales */` (línea 686), añade:

```css

.table-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-import {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--surface);
  color: var(--primary);
  border: 1px solid var(--border);
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 700;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}

.btn-import svg { width: 16px; height: 16px; }

.btn-import:hover {
  border-color: var(--primary);
  background: var(--primary-soft);
  transform: translateY(-1px);
}

.btn-import:active { transform: translateY(0) scale(0.98); }
```

(Nota: `.btn-import` usa aquí un estilo secundario — fondo `--surface`, borde y texto `--primary` — en vez del relleno naranja sólido de `.btn-add-product`, para que "Añadir producto" siga siendo la acción principal visualmente y "Importar" quede como acción secundaria junto a ella.)

- [ ] **Step 9: Estilos — estados del modal de importación**

En `panel-basico/css/styles.css`, justo después de `.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }` (línea 800) y antes del comentario `/* Toast — siempre oscuro... */` (línea 802), añade:

```css

/* Modal: importación */
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
}

.file-icon { width: 30px; height: 30px; color: var(--primary); flex-shrink: 0; }

.file-info { display: flex; flex-direction: column; gap: 2px; }
.file-name { font-weight: 700; font-size: 14px; }
.file-meta { font-size: 12px; color: var(--text-muted); }

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

- [ ] **Step 10: Verificación visual sin sesión real**

Con el servidor estático ya corriendo (Task 2, Step 9), recarga la página y en la consola del navegador ejecuta de nuevo:

```js
document.getElementById("appScreen").hidden = false;
document.getElementById("loginScreen").hidden = true;
```

Expected: junto a "Añadir producto" aparece el botón "Importar desde Excel" (estilo secundario, borde). Al hacer click se abre el modal con la tarjeta de archivo falso "inventario.xlsx" y el botón "Subir archivo". Al pulsarlo, se ve la barra de progreso avanzar de 0% a 100% en ~2 segundos. Al llegar a 100%, como no hay sesión real, la llamada a `insertProductsBatch` fallará por RLS: debe volver al estado inicial del modal y mostrarse el toast de error "No se pudo completar la importación. Inténtalo de nuevo." — ese es el comportamiento correcto para esta verificación sin login. Cierra el modal con la `×` y comprueba que también se cierra al hacer click fuera de la tarjeta del modal.

- [ ] **Step 11: Actualizar el README**

En `panel-basico/README.md`, sección `## Funcionalidades`, añade otro bullet (después del que se añadió en la Tarea 1 para "Eliminar producto"):

```markdown
- **Importar desde Excel (simulado):** botón que abre un modal, simula la
  subida de un archivo con una barra de progreso de ~2s y **inserta de
  verdad** entre 15 y 20 productos generados en la base de datos.
```

En la sección `## Estructura`, dentro del bloque de árbol de archivos, añade `import.js` a la lista de `js/` (después de la línea de `app.js`):

```
    └── js/
        ├── config.js           URL y anon key de tu proyecto Supabase (a rellenar)
        ├── supabaseClient.js   Inicializa el cliente ("db")
        ├── data.js              fetch/insert/update/delete de productos contra Supabase
        ├── auth.js              Login, logout y qué pantalla se muestra
        ├── theme.js              Toggle de modo claro/oscuro
        ├── app.js                Render de la tabla, dashboard y eventos
        └── import.js             Simulación de importación desde Excel
```

(Sustituye el bloque de árbol de archivos existente completo por esta versión — es el mismo, solo con `data.js` actualizado para mencionar `delete` y con la línea nueva de `import.js` al final.)

- [ ] **Step 12: Commit**

```bash
cd panel-basico
git add js/data.js js/import.js index.html css/styles.css README.md
git commit -m "feat: añade importación simulada desde Excel"
```

---

### Task 4: Mascota "fueguito" en cabecera y login

**Files:**
- Modify: `panel-basico/index.html:40-42` (login `.brand-mark`), `index.html:67-69` (topbar `.brand-icon`)

**Interfaces:**
- Consumes: nada nuevo (solo SVG estático).
- Produces: nada que otras tareas consuman (Task 5 usa su propia copia del SVG, ver más abajo).

- [ ] **Step 1: Sustituir el icono de la pantalla de login**

En `panel-basico/index.html`, dentro de `.brand-mark` (líneas 40-42):

```html
    <div class="brand-mark">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4a2 2 0 0 1-1.11-1.8V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.79 0z"></path><polyline points="2.32 6.16 12 11 21.68 6.16"></polyline><line x1="12" y1="22.76" x2="12" y2="11"></line></svg>
    </div>
```

Sustitúyelo por (el `.brand-mark` ya tiene un fondo degradado naranja/rojo fijo — ver `.brand-mark` en `styles.css` — así que aquí el fueguito se dibuja en un solo tono claro para que se lea bien sobre ese fondo, con los ojos y la sonrisa en un tono oscuro fijo, igual que hacía el icono anterior con `color: #fff`):

```html
    <div class="brand-mark">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill="#fff" d="M12 1.3c.7 2.5 2.4 4 4.1 5.7 2.1 2.1 3.6 4.5 3.6 7.4 0 4.8-3.5 8.1-7.7 8.1s-7.7-3-7.7-7.2c0-2.5 1-4.3 2.2-5.8.4 1.4 1.2 2.2 2.2 2.3-.5-2.6.4-4.9 1.8-6.6.4 1 1.1 1.6 1.9 1.9-.9-1.8-1-3.7-.4-5.8z"/>
        <circle cx="9.6" cy="15.6" r="1" fill="#241608"/>
        <circle cx="14.3" cy="15.6" r="1" fill="#241608"/>
        <path d="M9.9 18c.6.7 1.4 1 2.1 1s1.5-.3 2.1-1" stroke="#241608" stroke-width="1.1" stroke-linecap="round" fill="none"/>
      </svg>
    </div>
```

- [ ] **Step 2: Sustituir el icono de la cabecera del panel**

En `panel-basico/index.html`, dentro de `.brand-icon` (líneas 67-69):

```html
      <span class="brand-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4a2 2 0 0 1-1.11-1.8V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.79 0z"></path><polyline points="2.32 6.16 12 11 21.68 6.16"></polyline><line x1="12" y1="22.76" x2="12" y2="11"></line></svg>
      </span>
```

Sustitúyelo por (aquí el fondo es la página normal, no una caja de color, así que el fueguito lleva su propio degradado naranja→rojo con relleno):

```html
      <span class="brand-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="fueguitoGradTopbar" x1="5" y1="21" x2="18" y2="2" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#df3314"/>
              <stop offset="1" stop-color="#fb7b15"/>
            </linearGradient>
          </defs>
          <path fill="url(#fueguitoGradTopbar)" d="M12 1.3c.7 2.5 2.4 4 4.1 5.7 2.1 2.1 3.6 4.5 3.6 7.4 0 4.8-3.5 8.1-7.7 8.1s-7.7-3-7.7-7.2c0-2.5 1-4.3 2.2-5.8.4 1.4 1.2 2.2 2.2 2.3-.5-2.6.4-4.9 1.8-6.6.4 1 1.1 1.6 1.9 1.9-.9-1.8-1-3.7-.4-5.8z"/>
          <circle cx="9.6" cy="15.6" r="1" fill="#2a1c10"/>
          <circle cx="14.3" cy="15.6" r="1" fill="#2a1c10"/>
          <path d="M9.9 18c.6.7 1.4 1 2.1 1s1.5-.3 2.1-1" stroke="#2a1c10" stroke-width="1.1" stroke-linecap="round" fill="none"/>
        </svg>
      </span>
```

(No hace falta tocar `.brand-icon` ni `.brand-mark` en `styles.css`: el tamaño del `<svg>` lo siguen fijando esas reglas ya existentes, `26px` y `28px` respectivamente. La regla `.brand-icon { color: var(--primary); }` deja de tener efecto visual porque el nuevo icono ya no usa `stroke="currentColor"`, pero no hace falta quitarla — no molesta.)

- [ ] **Step 3: Verificación visual**

Con el servidor estático corriendo, recarga `index.html` **sin** forzar nada por consola (es decir, con la pantalla de login visible de forma natural, ya que no requiere sesión). Verifica:
- El círculo naranja/rojo de la pantalla de login muestra ahora una llama blanca con ojitos y sonrisa oscuros, en vez del escudo.
- Cambia el tema a oscuro con el botón de la esquina superior derecha de la pantalla de login: el círculo y el fueguito blanco deben verse igual de bien (el `.brand-mark` usa colores fijos, no depende del tema).
- Con la consola del navegador, fuerza otra vez `document.getElementById("appScreen").hidden = false; document.getElementById("loginScreen").hidden = true;` y comprueba que junto al texto "Panel de Inventario" de la cabecera aparece el fueguito en color (degradado naranja a rojo) en vez del escudo, tanto en tema claro como oscuro.

- [ ] **Step 4: Commit**

```bash
cd panel-basico
git add index.html
git commit -m "feat: sustituye el icono de marca por la mascota fueguito"
```

---

### Task 5: Pie de página "Panel creado por Melray"

**Files:**
- Modify: `panel-basico/index.html:148-150` (añadir `<footer>` dentro de `.app`)
- Modify: `panel-basico/css/styles.css` (nuevas reglas `.app-footer`, `.footer-mascot`)

**Interfaces:**
- Consumes: nada.
- Produces: nada.

- [ ] **Step 1: Añadir el footer al HTML**

En `panel-basico/index.html`, la `</section>` que cierra `.table-section` (línea 148) va seguida de una línea en blanco y luego `</div>` que cierra `.app` (línea 150):

```html
  </section>

</div>
</div>
```

Sustitúyelo por (se inserta el `<footer>` entre el cierre de `.table-section` y el cierre de `.app`):

```html
  </section>

  <footer class="app-footer">
    <svg class="footer-mascot" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fueguitoGradFooter" x1="5" y1="21" x2="18" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#df3314"/>
          <stop offset="1" stop-color="#fb7b15"/>
        </linearGradient>
      </defs>
      <path fill="url(#fueguitoGradFooter)" d="M12 1.3c.7 2.5 2.4 4 4.1 5.7 2.1 2.1 3.6 4.5 3.6 7.4 0 4.8-3.5 8.1-7.7 8.1s-7.7-3-7.7-7.2c0-2.5 1-4.3 2.2-5.8.4 1.4 1.2 2.2 2.2 2.3-.5-2.6.4-4.9 1.8-6.6.4 1 1.1 1.6 1.9 1.9-.9-1.8-1-3.7-.4-5.8z"/>
      <circle cx="9.6" cy="15.6" r="1" fill="#2a1c10"/>
      <circle cx="14.3" cy="15.6" r="1" fill="#2a1c10"/>
      <path d="M9.9 18c.6.7 1.4 1 2.1 1s1.5-.3 2.1-1" stroke="#2a1c10" stroke-width="1.1" stroke-linecap="round" fill="none"/>
    </svg>
    <span>Panel creado por Melray</span>
  </footer>

</div>
</div>
```

- [ ] **Step 2: Estilo del footer**

En `panel-basico/css/styles.css`, al final del archivo, justo antes del comentario `/* Responsive */` (línea 837), añade:

```css

/* Pie de página de marca */
.app-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 40px;
  padding-top: 20px;
  color: var(--text-muted);
  font-size: 12.5px;
  font-weight: 600;
  opacity: 0;
  animation: fadeInUp 0.5s ease 0.4s both;
}

.footer-mascot { width: 20px; height: 20px; flex-shrink: 0; }
```

- [ ] **Step 3: Verificación visual**

Con el servidor estático corriendo y `appScreen` forzado a visible (igual que en tareas anteriores), haz scroll hasta el final de la página. Verifica: el fueguito pequeño (degradado naranja/rojo) junto al texto "Panel creado por Melray" aparece centrado, separado de la tabla con espacio suficiente, en color `--text-muted` (gris/marrón apagado). Cambia a modo oscuro y confirma que el texto se sigue leyendo bien (usa la variable de tema, a diferencia del fueguito que mantiene sus colores fijos). Reduce el ancho de la ventana por debajo de 720px y confirma que el footer no se rompe ni desborda.

- [ ] **Step 4: Commit**

```bash
cd panel-basico
git add index.html css/styles.css
git commit -m "feat: añade pie de página de marca Melray"
```

---

## Verificación final (a cargo del usuario, con sesión real)

Estos pasos quedan para cuando el usuario pruebe con su propia sesión de Supabase, tal y como se acordó (ver spec, sección "Plan de pruebas manuales"):

1. Ejecutar en el SQL Editor de Supabase la política de borrado (Task 1, Step 3) si el proyecto ya existía antes de este cambio.
2. Iniciar sesión real en el panel.
3. Eliminar un producto de prueba y confirmar que desaparece también tras recargar la página (persistencia real).
4. Usar "Importar desde Excel" y confirmar que los productos nuevos aparecen tanto en la tabla como recargando la página.
5. Revisar visualmente cabecera, login y pie de página con datos reales cargados, en claro y oscuro, y en móvil.
