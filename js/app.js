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
  const btn = event.target.closest(".btn-qty");
  if (!btn) return;

  const id = Number(btn.dataset.id);
  const isIncrement = btn.dataset.action === "inc";
  const flashClass = isIncrement ? "flash-plus" : "flash-minus";

  btn.classList.remove("flash-plus", "flash-minus");
  void btn.offsetWidth; // reinicia la animación
  btn.classList.add(flashClass);
  btn.addEventListener("animationend", () => btn.classList.remove(flashClass), { once: true });

  changeStock(id, isIncrement ? 1 : -1);
});

renderTable();

// Doble rAF para forzar un frame de pintado antes de animar el donut
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    updateDashboard();
  });
});
