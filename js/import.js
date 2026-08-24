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
let importHeaderRowIndex = 0;

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

    const headerIndex = rows.findIndex((row) => row.some((cell) => String(cell).trim() !== ""));
    const dataRows = headerIndex === -1 ? [] : rows.slice(headerIndex + 1);
    const hasData = dataRows.some((row) => row.some((cell) => String(cell).trim() !== ""));

    if (headerIndex === -1 || !hasData) {
      throw new Error("El archivo no tiene filas de datos, solo la cabecera (o está vacío).");
    }

    importHeaders = rows[headerIndex].map((h) => String(h).trim());
    importDataRows = dataRows;
    importHeaderRowIndex = headerIndex;
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
    const rowNumber = importHeaderRowIndex + i + 2; // fila real del archivo (la cabecera ocupa la fila importHeaderRowIndex + 1)
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
