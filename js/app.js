const AVATAR_COLORS = 6;
const DONUT_RADIUS = 50;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

const productsBody = document.getElementById("productsBody");

function getInitials(nombre) {
  const words = nombre.match(/[\p{L}\p{N}]+/gu) || [];
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function isLowStock(p) {
  return p.stock <= p.stockMinimo;
}

function renderRow(p, index) {
  const low = isLowStock(p);
  const colorClass = `avatar--${(p.id % AVATAR_COLORS) + 1}`;

  const tr = document.createElement("tr");
  tr.className = `product-row${low ? " is-low" : ""}`;
  tr.dataset.id = p.id;
  tr.style.animationDelay = `${0.35 + index * 0.04}s`;

  const safeNombre = escapeHtml(p.nombre);

  tr.innerHTML = `
    <td class="col-photo">
      <div class="avatar ${colorClass}">${escapeHtml(getInitials(p.nombre))}</div>
    </td>
    <td>
      <div class="product-name">${safeNombre}</div>
      <span class="low-badge"><i class="low-dot"></i>¡Stock Bajo!</span>
    </td>
    <td class="sku">${escapeHtml(p.sku)}</td>
    <td><span class="stock-value" id="stock-${p.id}">${p.stock}</span></td>
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
  `;

  return tr;
}

function renderTable() {
  productsBody.innerHTML = "";

  if (PRODUCTS.length === 0) {
    productsBody.innerHTML = '<tr><td colspan="5" class="table-loading">Todavía no hay productos. Añade el primero con "Añadir producto".</td></tr>';
    return;
  }

  PRODUCTS.forEach((p, index) => productsBody.appendChild(renderRow(p, index)));
}

function showLoadingState() {
  productsBody.innerHTML = '<tr><td colspan="5" class="table-loading">Cargando productos…</td></tr>';
}

function updateDashboard() {
  const total = PRODUCTS.length;
  const listos = PRODUCTS.filter((p) => !isLowStock(p)).length;
  const percent = total === 0 ? 0 : Math.round((listos / total) * 100);

  document.getElementById("totalProductos").textContent = total;
  document.getElementById("totalListos").textContent = listos;
  document.getElementById("donutPercent").textContent = `${percent}%`;

  const donutFg = document.getElementById("donutFg");
  const offset = DONUT_CIRCUMFERENCE * (1 - percent / 100);
  donutFg.style.strokeDashoffset = `${offset}`;
}

function updateRow(p) {
  const row = productsBody.querySelector(`tr[data-id="${p.id}"]`);
  if (!row) return;

  const stockEl = document.getElementById(`stock-${p.id}`);
  stockEl.textContent = p.stock;

  stockEl.classList.remove("pulse");
  void stockEl.offsetWidth; // reinicia la animación
  stockEl.classList.add("pulse");

  row.classList.toggle("is-low", isLowStock(p));
}

function changeStock(id, delta) {
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) return;

  const previousStock = product.stock;
  const newStock = Math.max(0, product.stock + delta);
  if (newStock === previousStock) return;

  product.stock = newStock;
  updateRow(product);
  updateDashboard();

  updateProductStock(id, newStock).catch((error) => {
    console.error(error);
    product.stock = previousStock;
    updateRow(product);
    updateDashboard();
    showToast("No se pudo guardar el cambio de stock. Inténtalo de nuevo.", "error");
  });
}

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
  if (btn) {
    const id = Number(btn.dataset.id);
    const isIncrement = btn.dataset.action === "inc";
    const flashClass = isIncrement ? "flash-plus" : "flash-minus";

    btn.classList.remove("flash-plus", "flash-minus");
    void btn.offsetWidth; // reinicia la animación
    btn.classList.add(flashClass);
    btn.addEventListener("animationend", () => btn.classList.remove(flashClass), { once: true });

    changeStock(id, isIncrement ? 1 : -1);
  }
});

// --- Toast ---
const toastEl = document.getElementById("toast");
let toastTimer = null;

function showToast(message, tone) {
  toastEl.textContent = message;
  toastEl.className = `toast show${tone ? ` toast--${tone}` : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3000);
}

// --- Modal: reponer stock ---
const restockModal = document.getElementById("restockModal");
const restockForm = document.getElementById("restockForm");
const restockTitle = document.getElementById("restockTitle");
const restockQty = document.getElementById("restockQty");
let restockProductId = null;

function openRestockModal(id) {
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) return;

  restockProductId = id;
  restockTitle.textContent = product.nombre;
  restockQty.value = 10;
  restockModal.classList.add("open");
  restockQty.focus();
}

function closeRestockModal() {
  restockModal.classList.remove("open");
  restockProductId = null;
}

restockForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const qty = Number(restockQty.value);
  if (!restockProductId || !Number.isFinite(qty) || qty <= 0) return;

  const product = PRODUCTS.find((p) => p.id === restockProductId);
  changeStock(restockProductId, qty);
  closeRestockModal();
  showToast(`+${qty} uds. añadidas a ${product.nombre}`, "ok");
});

document.getElementById("restockClose").addEventListener("click", closeRestockModal);
restockModal.addEventListener("click", (event) => {
  if (event.target === restockModal) closeRestockModal();
});

// --- Modal: añadir producto ---
const addProductModal = document.getElementById("addProductModal");
const addProductForm = document.getElementById("addProductForm");

function openAddProductModal() {
  addProductForm.reset();
  document.getElementById("newProductStockMinimo").value = 5;
  document.getElementById("newProductStock").value = 0;
  addProductModal.classList.add("open");
  document.getElementById("newProductNombre").focus();
}

function closeAddProductModal() {
  addProductModal.classList.remove("open");
}

addProductForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const nombre = document.getElementById("newProductNombre").value.trim();
  const sku = document.getElementById("newProductSku").value.trim();
  const stock = Math.max(0, Number(document.getElementById("newProductStock").value));
  const stockMinimo = Math.max(0, Number(document.getElementById("newProductStockMinimo").value));
  if (!nombre || !sku) return;

  const submitBtn = addProductForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const product = await insertProduct({ nombre, sku, stock, stockMinimo });
    PRODUCTS.push(product);
    renderTable();
    updateDashboard();
    closeAddProductModal();
    showToast(`${nombre} añadido al inventario`, "ok");
  } catch (error) {
    console.error(error);
    const message = error.code === "23505" ? "Ya existe un producto con ese SKU." : "No se pudo añadir el producto. Inténtalo de nuevo.";
    showToast(message, "error");
  } finally {
    submitBtn.disabled = false;
  }
});

document.getElementById("addProductOpenBtn").addEventListener("click", openAddProductModal);
document.getElementById("addProductClose").addEventListener("click", closeAddProductModal);
addProductModal.addEventListener("click", (event) => {
  if (event.target === addProductModal) closeAddProductModal();
});

// --- Carga inicial (se dispara desde auth.js tras iniciar sesión) ---
async function initApp() {
  showLoadingState();
  try {
    await fetchProducts();
    renderTable();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        updateDashboard();
      });
    });
  } catch (error) {
    console.error(error);
    productsBody.innerHTML = '<tr><td colspan="5" class="table-loading">No se pudieron cargar los productos. Recarga la página.</td></tr>';
    showToast("No se pudieron cargar los productos.", "error");
  }
}
