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

// Acceso a datos vía Supabase. PRODUCTS vive en memoria como caché local
// (así el resto de app.js no cambia) pero la fuente real es la tabla
// "products" — ver supabase/schema.sql.
let PRODUCTS = [];

function mapRow(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    sku: row.sku,
    stock: row.stock,
    stockMinimo: row.stock_minimo,
  };
}

async function fetchProducts() {
  const { data, error } = await db
    .from("products")
    .select("id, nombre, sku, stock, stock_minimo")
    .order("id", { ascending: true });

  if (error) throw error;

  PRODUCTS = data.map(mapRow);
  return PRODUCTS;
}

async function updateProductStock(id, newStock) {
  const { error } = await db.from("products").update({ stock: newStock }).eq("id", id);
  if (error) throw error;
}

async function insertProduct({ nombre, sku, stock, stockMinimo }) {
  const { data, error } = await db
    .from("products")
    .insert({ nombre, sku, stock, stock_minimo: stockMinimo })
    .select("id, nombre, sku, stock, stock_minimo")
    .single();

  if (error) throw error;
  return mapRow(data);
}

async function deleteProduct(id) {
  const { data, error } = await db.from("products").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("No se pudo eliminar el producto: no se encontró o no tienes permiso.");
  }
}

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
