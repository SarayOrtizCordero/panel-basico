// Escapa texto antes de insertarlo en innerHTML — nombre y SKU vienen de
// datos guardados por usuarios (o de la base de datos), nunca deben tratarse
// como HTML de confianza.
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

// Datos de ejemplo + persistencia en localStorage (demo sin backend, ver
// js/config.js). PRODUCTS vive en memoria como caché local que la pantalla
// renderiza; cada función de aquí abajo la refleja también en localStorage
// para que sobreviva a recargar la página. El mismo inventario de partida
// que supabase/schema.sql, por si más adelante se retoma esa migración.
const PRODUCTS_STORAGE_KEY = "panelbasico-products-v1";

const SEED_PRODUCTS = [
  { id: 1, nombre: "Camiseta básica", sku: "CAM-001", stock: 24, stockMinimo: 8 },
  { id: 2, nombre: "Pantalón vaquero", sku: "PAN-002", stock: 15, stockMinimo: 5 },
  { id: 3, nombre: "Sudadera con capucha", sku: "SUD-003", stock: 9, stockMinimo: 6 },
  { id: 4, nombre: "Zapatillas running", sku: "ZAP-004", stock: 12, stockMinimo: 4 },
  { id: 5, nombre: "Gorra deportiva", sku: "GOR-005", stock: 30, stockMinimo: 10 },
  { id: 6, nombre: "Chaqueta impermeable", sku: "CHA-006", stock: 7, stockMinimo: 5 },
  { id: 7, nombre: "Vestido de verano", sku: "VES-007", stock: 11, stockMinimo: 5 },
  { id: 8, nombre: "Bufanda de lana", sku: "BUF-008", stock: 2, stockMinimo: 5 },
  { id: 9, nombre: "Calcetines (pack 3)", sku: "CAL-009", stock: 40, stockMinimo: 12 },
  { id: 10, nombre: "Guantes térmicos", sku: "GUA-010", stock: 6, stockMinimo: 6 },
];

let PRODUCTS = [];

function readStoredProducts() {
  try {
    const raw = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (error) {
    // localStorage corrupto o no disponible: se regenera desde los datos base.
  }
  return null;
}

function writeStoredProducts(products) {
  try {
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
  } catch (error) {
    // Cuota excedida o modo privado: los cambios solo viven en memoria de esta pestaña.
  }
}

function nextProductId(products) {
  return products.reduce((max, p) => Math.max(max, p.id), 0) + 1;
}

async function fetchProducts() {
  const stored = readStoredProducts();
  if (stored) {
    PRODUCTS = stored;
  } else {
    PRODUCTS = SEED_PRODUCTS.map((p) => ({ ...p }));
    writeStoredProducts(PRODUCTS);
  }
  return PRODUCTS;
}

async function updateProductStock(id, newStock) {
  // El llamador ya actualizó el stock en el objeto de PRODUCTS antes de
  // invocar esto (actualización optimista) — solo queda persistirlo.
  writeStoredProducts(PRODUCTS);
}

async function insertProduct({ nombre, sku, stock, stockMinimo }) {
  if (PRODUCTS.some((p) => p.sku === sku)) {
    const error = new Error("Ya existe un producto con ese SKU.");
    error.code = "23505";
    throw error;
  }

  const product = { id: nextProductId(PRODUCTS), nombre, sku, stock, stockMinimo };
  writeStoredProducts([...PRODUCTS, product]);
  return product;
}

async function deleteProduct(id) {
  if (!PRODUCTS.some((p) => p.id === id)) {
    throw new Error("No se pudo eliminar el producto: no se encontró o no tienes permiso.");
  }
  writeStoredProducts(PRODUCTS.filter((p) => p.id !== id));
}

async function upsertProductsChunk(rows) {
  let nextId = nextProductId(PRODUCTS);
  const bySku = new Map(PRODUCTS.map((p) => [p.sku, p]));
  const result = [];

  rows.forEach(({ nombre, sku, stock, stockMinimo }) => {
    const existing = bySku.get(sku);
    const product = existing
      ? { ...existing, nombre, stock, stockMinimo }
      : { id: nextId++, nombre, sku, stock, stockMinimo };
    bySku.set(sku, product);
    result.push(product);
  });

  writeStoredProducts([...bySku.values()]);
  return result;
}
