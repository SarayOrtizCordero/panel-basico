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

let importRun = 0;

function openImportModal() {
  showImportState("idle");
  importModal.classList.add("open");
}

function closeImportModal() {
  importRun++;
  importModal.classList.remove("open");
}

function showImportState(state) {
  importIdleState.hidden = state !== "idle";
  importProgressState.hidden = state !== "progress";
  importSuccessState.hidden = state !== "success";
}

function startImport() {
  const run = ++importRun;
  showImportState("progress");
  importProgressBar.style.width = "0%";
  importProgressText.textContent = "0%";

  const duration = 2000;
  const start = performance.now();

  function step(now) {
    if (run !== importRun) return;

    const elapsed = now - start;
    const pct = Math.min(100, Math.round((elapsed / duration) * 100));
    importProgressBar.style.width = `${pct}%`;
    importProgressText.textContent = `${pct}%`;

    if (elapsed < duration) {
      requestAnimationFrame(step);
    } else {
      finishImport(run);
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

async function finishImport(run) {
  if (run !== importRun) return;

  const count = Math.floor(Math.random() * 6) + 15; // 15–20 productos
  const generated = generateFakeProducts(count);

  try {
    const added = await insertProductsBatch(generated);
    if (run !== importRun) return; // el usuario cerró el modal mientras se insertaba

    PRODUCTS.push(...added);

    importSuccessCount.textContent = added.length;
    showImportState("success");

    setTimeout(() => {
      if (run !== importRun) return;
      closeImportModal();
      renderTable();
      updateDashboard();
      showToast(`${added.length} productos importados correctamente`, "ok");
    }, 900);
  } catch (error) {
    console.error(error);
    if (run !== importRun) return;
    showImportState("idle");
    const message = error.code === "23505" ? "Ya existe un producto con ese SKU. Inténtalo de nuevo." : "No se pudo completar la importación. Inténtalo de nuevo.";
    showToast(message, "error");
  }
}

document.getElementById("importOpenBtn").addEventListener("click", openImportModal);
document.getElementById("importCloseBtn").addEventListener("click", closeImportModal);
importStartBtn.addEventListener("click", () => {
  const confirmed = window.confirm("¿Importar productos de ejemplo? Esto añadirá productos nuevos de verdad al inventario.");
  if (!confirmed) return;
  startImport();
});
importModal.addEventListener("click", (event) => {
  if (event.target === importModal) closeImportModal();
});
