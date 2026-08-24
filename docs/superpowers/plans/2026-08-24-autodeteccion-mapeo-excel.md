# Autodetección de Columnas al Mapear el Excel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al llegar a la pantalla de mapeo de columnas de la importación de Excel, autodetectar qué columna es cada dato (Nombre/SKU/Stock/Stock mínimo) a partir del texto de la cabecera, y aclarar los textos de esa pantalla, para que el cliente casi nunca tenga que rellenar los desplegables a mano.

**Architecture:** Una única función pura (`guessColumnMapping`) recibe la lista de cabeceras del archivo y devuelve, para cada una, el campo que le corresponde (o ninguno). `renderMappingStep()` la usa para rellenar los `<select>` solo cuando no hay un mapeo guardado en `localStorage` para ese mismo conjunto de cabeceras — el mapeo guardado sigue mandando siempre que exista, igual que hoy.

**Tech Stack:** JavaScript ES2017+ vainilla (sin dependencias nuevas).

## Global Constraints

- Alcance exclusivo de `panel-basico/`. No se toca `panel-intermedio/` ni `panel-completo/`.
- Sin cambios de CSS ni de estructura de pantallas — mismos elementos, mismo diseño visual.
- Sin librerías ni dependencias nuevas.
- Todo texto de la interfaz en español.
- Orden de prioridad de la autodetección (de más específico a más genérico, para que "Stock mínimo" no se confunda con "Stock"): **1. Stock mínimo** (contiene "minimo"), **2. SKU** (contiene "sku", "codigo", "referencia" o "ref"), **3. Stock** (contiene "stock", "cantidad", "existencias" o "unidades"), **4. Nombre** (contiene "nombre", "producto", "articulo" o "item"). Comparación en minúsculas y sin acentos.
- Si dos cabeceras encajarían con el mismo campo, gana la primera (de izquierda a derecha); la segunda queda sin asignar.
- El mapeo guardado en `localStorage` (ya existente) tiene prioridad total sobre la autodetección: esta última solo se ejecuta cuando no hay mapeo guardado para el conjunto exacto de cabeceras del archivo actual.
- No hay framework de tests en este proyecto. Verificación = `node --check` + comprobación funcional en el navegador, disparando el `<input type="file">` con un `File`/`DataTransfer` construido en JS, como en tareas anteriores de este mismo proyecto.

---

## Resumen de archivos afectados

- Modificar: `panel-basico/js/import.js`
- Modificar: `panel-basico/index.html`

---

### Task 1: Autodetección de columnas + textos aclaratorios

**Files:**
- Modify: `panel-basico/js/import.js`
- Modify: `panel-basico/index.html`

**Interfaces:**
- Consumes: `escapeHtml`, `PRODUCTS`, `showToast`, `fetchProducts` (ya existentes, sin cambios).
- Produces: `guessColumnMapping(headers: string[]): Record<string, string>` en `js/import.js` (mapa de cabecera → clave de campo, o cadena vacía si no se detecta ninguno). No la usa ninguna otra tarea de este plan (es un plan de una sola tarea), pero queda disponible como función nombrada por si se reutiliza en el futuro.

- [ ] **Step 1: Añadir las reglas y la función de autodetección en `js/import.js`**

En `panel-basico/js/import.js`, justo después de la función `saveMapping` (que termina en la línea 121 con `}`) y antes de `function renderMappingStep() {` (línea 123), añade:

```js

const AUTO_MAPPING_RULES = [
  { field: "stockMinimo", keywords: ["minimo"] },
  { field: "sku", keywords: ["sku", "codigo", "referencia", "ref"] },
  { field: "stock", keywords: ["stock", "cantidad", "existencias", "unidades"] },
  { field: "nombre", keywords: ["nombre", "producto", "articulo", "item"] },
];

function normalizeForMatching(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function guessColumnMapping(headers) {
  const guess = {};
  const claimedFields = new Set();

  headers.forEach((header) => {
    const normalized = normalizeForMatching(header);
    const rule = AUTO_MAPPING_RULES.find(
      (r) => !claimedFields.has(r.field) && r.keywords.some((keyword) => normalized.includes(keyword))
    );
    if (rule) {
      guess[header] = rule.field;
      claimedFields.add(rule.field);
    } else {
      guess[header] = "";
    }
  });

  return guess;
}
```

- [ ] **Step 2: Usar la autodetección en `renderMappingStep` y renombrar la opción de ignorar**

En `panel-basico/js/import.js`, la función `renderMappingStep` (líneas 123-146) es actualmente:

```js
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
```

Sustitúyela por (cambia la etiqueta de la primera opción y añade la línea `const guessed = ...` y el uso de `guessed[header]` como valor de respaldo cuando no hay mapeo guardado):

```js
function renderMappingStep() {
  const saved = loadSavedMapping();
  const guessed = saved ? null : guessColumnMapping(importHeaders);
  mappingList.innerHTML = "";

  const options = [`<option value="">No se usa este dato</option>`]
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
    row.querySelector("select").value = saved ? saved[header] || "" : guessed[header] || "";
  });

  mappingList.querySelectorAll(".mapping-select").forEach((select) => {
    select.addEventListener("change", updateMappingContinueState);
  });
  updateMappingContinueState();
}
```

- [ ] **Step 3: Verificar sintaxis de `import.js`**

Run: `node --check panel-basico/js/import.js`
Expected: sin salida (exit code 0).

- [ ] **Step 4: Actualizar el texto explicativo de la pantalla de mapeo en `index.html`**

En `panel-basico/index.html`, dentro de `#importMappingState`, la línea actual es:

```html
      <p class="progress-label">Indica qué columna es cada dato:</p>
```

Sustitúyela por:

```html
      <p class="progress-label">Hemos intentado adivinar qué columna es cada dato — revisa que esté bien y cambia lo que haga falta. Si tu archivo tiene alguna columna que no necesitamos (como categoría o proveedor), déjala en "No se usa este dato".</p>
```

(No hace falta ningún cambio de CSS: `.progress-label` no tiene `white-space: nowrap` ni recorte de texto, así que el párrafo más largo simplemente ocupa varias líneas dentro del modal.)

- [ ] **Step 5: Verificación funcional en el navegador, sin tocar la base de datos real**

Con un servidor estático corriendo dentro de `panel-basico/` (ej. `python -m http.server 8000`) y la página abierta, en la consola del navegador:

1. Fuerza la pantalla de la app visible y limpia cualquier mapeo guardado de pruebas anteriores:

```js
document.getElementById("appScreen").hidden = false;
document.getElementById("loginScreen").hidden = true;
localStorage.removeItem("panelbasico-import-mapping");
document.getElementById("importOpenBtn").click();
```

2. Función auxiliar para simular la subida de un CSV con las cabeceras que quieras (pégala una vez en la consola):

```js
function subirCsvDePrueba(headers) {
  const csv = headers.join(",") + "\nvalor1,valor2,valor3,valor4\n";
  const file = new File([csv], "prueba.csv", { type: "text/csv" });
  const dt = new DataTransfer();
  dt.items.add(file);
  const input = document.getElementById("importFileInput");
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
function valoresDeMapeo() {
  return [...document.querySelectorAll(".mapping-select")].map((s) => s.value);
}
```

3. **Caso 1 — cabeceras exactas:**

```js
subirCsvDePrueba(["Nombre", "SKU", "Stock", "Stock mínimo"]);
```

Espera un instante (el parseo es síncrono pero dale un tick) y comprueba:

```js
valoresDeMapeo()
```

Expected: `["nombre", "sku", "stock", "stockMinimo"]`.

4. **Caso 2 — cabeceras distintas pero reconocibles:**

```js
subirCsvDePrueba(["Producto", "Referencia", "Cantidad", "Categoría"]);
valoresDeMapeo()
```

Expected: `["nombre", "sku", "stock", ""]`.

5. **Caso 3 — colisión (dos cabeceras encajan con Nombre):**

```js
subirCsvDePrueba(["Nombre", "Producto", "SKU", "Stock"]);
valoresDeMapeo()
```

Expected: `["nombre", "", "sku", "stock"]` (la segunda, "Producto", se queda sin asignar).

6. **Caso 4 — ninguna cabecera reconocible:**

```js
subirCsvDePrueba(["Col1", "Col2", "Col3", "Col4"]);
valoresDeMapeo()
document.getElementById("mappingContinueBtn").disabled
```

Expected: los cuatro valores son `""`, y `mappingContinueBtn.disabled` es `true`.

7. **Caso 5 — el mapeo guardado manda sobre la autodetección:**

```js
subirCsvDePrueba(["Nombre", "SKU", "Stock", "Stock mínimo"]);
document.getElementById("mappingContinueBtn").click();
```

(El click intentará seguir a la vista previa y fallará al comprobar el inventario por no haber sesión real — eso es esperado y no afecta a esta prueba, porque el mapeo se guarda en `localStorage` *antes* de ese fallo.) Comprueba que se guardó:

```js
JSON.parse(localStorage.getItem("panelbasico-import-mapping"))
```

Expected: un objeto con la clave `"Nombre|SKU|Stock|Stock mínimo"` y como valor `{"Nombre":"nombre","SKU":"sku","Stock":"stock","Stock mínimo":"stockMinimo"}`.

Ahora vuelve a abrir el modal y sube el mismo archivo otra vez:

```js
document.getElementById("importCloseBtn").click();
document.getElementById("importOpenBtn").click();
subirCsvDePrueba(["Nombre", "SKU", "Stock", "Stock mínimo"]);
valoresDeMapeo()
```

Expected: sigue siendo `["nombre", "sku", "stock", "stockMinimo"]`, pero esta vez proviene del mapeo guardado, no de la autodetección (compruébalo cambiando a mano el tercer valor a `""` con `document.querySelectorAll(".mapping-select")[2].value = ""` y disparando su evento `change`, pulsando "Continuar" de nuevo, y repitiendo la subida una tercera vez — la tercera vez debe mostrar `["nombre", "sku", "", "stockMinimo"]`, demostrando que el cambio manual guardado se respeta en vez de volver a autodetectar "stock").

8. Cierra el modal y recarga la página al terminar, para no dejar mapeos de prueba residuales afectando a una sesión real posterior. Si quieres dejar el navegador limpio del todo: `localStorage.removeItem("panelbasico-import-mapping")`.

9. Revisa visualmente (con el modal abierto en la pantalla de mapeo) que el nuevo párrafo explicativo y la opción "No se usa este dato" se leen bien en modo claro y en modo oscuro.

- [ ] **Step 6: Commit**

```bash
cd panel-basico
git add js/import.js index.html
git commit -m "feat: autodetecta columnas al mapear el Excel y aclara los textos"
```
