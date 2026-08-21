# Mejoras Plan Básico — eliminar productos, importar Excel (simulado) y mascota Melray

Fecha: 2026-08-21
Alcance: `panel-basico/` únicamente. No se toca `panel-intermedio/` ni `panel-completo/`.

## Contexto

`panel-basico` es un panel de inventario HTML+CSS+JS vainilla (sin build step)
respaldado por Supabase. Es el primer escalón de tres demos de producto
(básico / intermedio / completo) pensadas para mostrar funcionalidades
crecientes por plan. `panel-intermedio` ya tiene una importación "desde
Excel" simulada (sube un archivo falso con barra de progreso y luego inserta
productos de ejemplo reales en la base de datos). Este documento añade al
plan básico: borrado de productos, la misma importación simulada, y la
mascota de marca ("fueguito") en cabecera y pie de página.

## 1. Eliminar productos

**Objetivo:** poder borrar un producto del inventario desde la tabla.

**UI:** un botón de papelera en `.col-actions` de cada fila
(`js/data.js`/`renderRow` en `js/app.js`), junto a los botones existentes
(reponer, `−`, `+`). Mismo estilo visual que `.btn-restock` (30×30,
`border-radius: 8px`, icono SVG de 14px) pero en tono `--danger` en vez de
`--primary`, para diferenciarlo como acción destructiva.

**Confirmación:** `window.confirm('¿Eliminar "<nombre>"? Esta acción no se
puede deshacer.')`. No se construye un modal nuevo — es una acción binaria
simple y ya existe este patrón de simplicidad en el resto del panel (no hay
modales de confirmación en ningún otro flujo).

**Flujo:**
1. Click en la papelera → `confirm()`.
2. Si se cancela, no pasa nada.
3. Si se confirma: se llama a `deleteProduct(id)` (nuevo, en `js/data.js`),
   que hace `db.from("products").delete().eq("id", id)`.
4. Si la llamada falla: toast de error, la fila no se toca (no hay cambio
   optimista que revertir, a diferencia de `changeStock`, porque aquí se
   espera la confirmación del servidor antes de tocar el DOM).
5. Si la llamada tiene éxito: se quita el producto de `PRODUCTS`, se elimina
   la fila del DOM (con una transición corta de opacidad/altura para que no
   sea un salto brusco), se llama a `updateDashboard()`, y se muestra un
   toast de éxito ("<nombre> eliminado del inventario").
6. Si tras borrar `PRODUCTS.length === 0`, se vuelve a pintar el mensaje de
   tabla vacía ya existente ("Todavía no hay productos…").

**Base de datos:** `supabase/schema.sql` solo concede `select, insert,
update` a `authenticated` y no tiene política de `delete`. Se añade:

```sql
create policy "Usuarios autenticados pueden eliminar productos"
  on public.products for delete
  to authenticated
  using (true);

grant delete on public.products to authenticated;
```

Esto se añade al `schema.sql` completo (para proyectos Supabase nuevos) y
además se documenta en el `README.md` como paso adicional para quien ya
tenga un proyecto Supabase creado con el script anterior — `schema.sql` no
se re-ejecuta automáticamente, así que instalaciones existentes necesitan
correr manualmente ese fragmento en el SQL Editor.

## 2. Importar desde Excel (simulado)

**Objetivo:** replicar en básico la importación simulada que ya existe en
intermedio, adaptada a que básico no tiene proveedores ni ventas mensuales.

**UI:** botón "Importar desde Excel" en `.table-header`, junto al botón
"Añadir producto" existente (básico no tiene la barra de pestañas/toolbar de
intermedio, así que este es el sitio natural). Mismo estilo `.btn-import`
que en intermedio (fondo `--primary`, icono de subida).

**Modal:** se añade `#importModal` a `index.html` con los mismos tres
estados que en intermedio (reutilizando las clases CSS ya probadas allí:
`.import-state`, `.file-card`, `.progress-track`, `.progress-fill`,
`.import-success`):
- **Idle:** tarjeta de archivo falso (`inventario.xlsx`, tamaño de ejemplo)
  + botón "Subir archivo".
- **Progreso:** barra que va de 0% a 100% en ~2s vía `requestAnimationFrame`
  (idéntico mecanismo a `panel-intermedio/js/import.js`).
- **Éxito:** icono de check + "N productos importados correctamente".

**Datos generados:** nuevo `js/import.js`. Genera entre 15 y 20 productos
falsos combinando nombres de ropa/calzado en la línea de los 10 productos
semilla ya existentes (camiseta, pantalón, sudadera, zapatillas, gorra,
chaqueta, vestido, bufanda, calcetines, guantes — con sufijo de tanda para
evitar nombres duplicados, igual que hace intermedio), con SKU generado a
partir de `Date.now()` (mismo patrón `IMP-<base36>` que intermedio, para no
chocar con SKUs de una importación anterior), stock aleatorio 1–40 y stock
mínimo aleatorio 3–10. Sin proveedor ni ventas del mes, porque básico no
tiene esos campos.

**Persistencia:** nuevo `insertProductsBatch(products)` en `js/data.js` que
hace un único `db.from("products").insert([...]).select(...)` con todas las
filas generadas y devuelve las filas mapeadas con `mapRow`.

**Flujo tras éxito:** añade los productos devueltos a `PRODUCTS`, cierra el
modal (con el mismo pequeño delay de intermedio para que se vea el estado de
éxito antes de cerrar), vuelve a pintar tabla y dashboard, y muestra un
toast.

**Manejo de error:** si `insertProductsBatch` falla, se vuelve al estado
idle del modal y se muestra un toast de error, igual que intermedio.

## 3. Mascota "fueguito" y pie de página Melray

**Mascota como SVG propio:** no se dispone del archivo de la imagen de
referencia (se pegó en el chat, no hay ruta de archivo accesible), así que
se recrea como SVG inline: una llama redondeada con degradado naranja→rojo
usando los mismos tonos de marca ya presentes en `styles.css`
(`#fb7b15` → `#df3314`, los mismos que `.brand-mark`), con dos ojos (puntos
oscuros) y una sonrisa simple, en el mismo estilo "friendly icon" que el
resto de iconografía del panel.

**Cabecera del panel:** se sustituye el icono genérico actual (el escudo
dentro de `.brand-icon`, junto al texto "Panel de Inventario" en `.topbar`)
por el SVG del fueguito. Mismo tamaño (26×26) y mismo contenedor —
solo cambia el `<svg>` interno.

**Pantalla de login:** se sustituye también el icono dentro de
`.brand-mark` (el círculo naranja de 56×56 antes del título "Panel de
Inventario" en la pantalla de acceso) por el mismo fueguito, para que las
dos pantallas usen la misma mascota en vez de mezclar el escudo genérico
con la llama nueva.

**Pie de página de propiedad:** se añade un `<footer class="app-footer">`
al final de `.app`, después de `.table-section`. Contenido: el fueguito en
tamaño pequeño (18–20px) + el texto **"Panel creado por Melray"**, en
`--text-muted`, centrado, con un margen superior generoso para separarlo
visualmente de la tabla. Estilo discreto (no es un CTA ni un enlace, es una
atribución de marca), consistente con el resto de la paleta y con soporte
para modo claro/oscuro vía las variables CSS existentes.

## Fuera de alcance (no-goals)

- No se toca `panel-intermedio` ni `panel-completo`.
- La importación de Excel sigue siendo simulada (no se parsea ningún
  archivo `.xlsx` real) — igual que en intermedio, por consistencia entre
  planes.
- No se añade papelera de reciclaje ni "deshacer" tras borrar un producto:
  el borrado es definitivo, coherente con que ya hay un `confirm()` previo.
- No se cambia el resto de iconografía del panel (solo el icono de marca en
  topbar y login).

## Plan de pruebas manuales

1. Añadir un producto, comprobar que aparece la papelera, borrarlo con
   confirmación → desaparece de la tabla y del dashboard (totales bajan).
2. Cancelar el diálogo de confirmación → el producto sigue ahí.
3. Pulsar "Importar desde Excel", completar la simulación → aparecen los
   nuevos productos en la tabla y el dashboard se actualiza.
4. Comprobar en modo claro y oscuro que el fueguito y el pie de página se
   ven bien (contraste, colores).
5. Comprobar responsive (móvil, `max-width: 720px`) de los botones nuevos y
   del pie de página.
6. Ejecutar la política SQL de borrado en un proyecto Supabase de prueba y
   confirmar que sin ella el borrado falla (RLS bloquea) y con ella
   funciona.
