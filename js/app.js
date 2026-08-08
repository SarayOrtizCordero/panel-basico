const AVATAR_COLORS = 6;
const DONUT_RADIUS = 50;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

const productsBody = document.getElementById("productsBody");

function getInitials(nombre) {
  return nombre
    .split(" ")
    .filter(Boolean)
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

  tr.innerHTML = `
    <td class="col-photo">
      <div class="avatar ${colorClass}">${getInitials(p.nombre)}</div>
    </td>
    <td>
      <div class="product-name">${p.nombre}</div>
      <span class="low-badge"><i class="low-dot"></i>¡Stock Bajo!</span>
    </td>
    <td class="sku">${p.sku}</td>
    <td><span class="stock-value" id="stock-${p.id}">${p.stock}</span></td>
    <td class="col-actions">
      <button class="btn-restock" data-id="${p.id}" aria-label="Reponer stock de ${p.nombre}" title="Reponer stock">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"></path><path d="M1 3h22v5H1z"></path><line x1="10" y1="12" x2="14" y2="12"></line><line x1="12" y1="10" x2="12" y2="14"></line></svg>
      </button>
      <button class="btn-qty btn-minus" data-id="${p.id}" data-action="dec" aria-label="Restar unidad de ${p.nombre}">−</button>
      <button class="btn-qty btn-plus" data-id="${p.id}" data-action="inc" aria-label="Sumar unidad de ${p.nombre}">+</button>
    </td>
  `;

  return tr;
}

function renderTable() {
  productsBody.innerHTML = "";
  PRODUCTS.forEach((p, index) => productsBody.appendChild(renderRow(p, index)));
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

  product.stock = Math.max(0, product.stock + delta);
  updateRow(product);
  updateDashboard();
}

productsBody.addEventListener("click", (event) => {
  const restockBtn = event.target.closest(".btn-restock");
  if (restockBtn) {
    openRestockModal(Number(restockBtn.dataset.id));
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

addProductForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const nombre = document.getElementById("newProductNombre").value.trim();
  const sku = document.getElementById("newProductSku").value.trim();
  const stock = Math.max(0, Number(document.getElementById("newProductStock").value));
  const stockMinimo = Math.max(0, Number(document.getElementById("newProductStockMinimo").value));
  if (!nombre || !sku) return;

  const id = PRODUCTS.reduce((max, p) => Math.max(max, p.id), 0) + 1;
  PRODUCTS.push({ id, nombre, sku, stock, stockMinimo });

  renderTable();
  updateDashboard();
  closeAddProductModal();
  showToast(`${nombre} añadido al inventario`, "ok");
});

document.getElementById("addProductOpenBtn").addEventListener("click", openAddProductModal);
document.getElementById("addProductClose").addEventListener("click", closeAddProductModal);
addProductModal.addEventListener("click", (event) => {
  if (event.target === addProductModal) closeAddProductModal();
});

renderTable();

// Doble rAF para forzar un frame de pintado antes de animar el donut
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    updateDashboard();
  });
});
