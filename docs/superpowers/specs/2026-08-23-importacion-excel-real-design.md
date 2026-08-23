# Importación real desde Excel — Plan Básico

Fecha: 2026-08-23
Alcance: `panel-basico/` únicamente. No se toca `panel-intermedio/` ni
`panel-completo/`.

## Contexto

`panel-basico` tiene actualmente un botón "Importar desde Excel" que es una
**simulación**: sube un archivo falso, anima una barra de progreso de ~2s y
al terminar inserta productos generados aleatoriamente en la base de datos
(ver `js/import.js`). Este documento sustituye esa simulación por una
importación real: el cliente sube su propio Excel/CSV, el sistema lo lee de
verdad en el navegador, deja que el cliente diga qué columna es qué, y
añade/actualiza productos reales en Supabase. El objetivo es que esta
función esté completamente operativa tanto en las pruebas del panel como en
el producto final que compren los clientes — no queda ningún modo de
simulación tras este cambio.

## 1. Flujo de pantallas

El modal `#importModal` pasa de 3 estados (idle/progreso/éxito) a 5:

1. **Idle** — `<input type="file" accept=".xlsx,.xls,.csv">` real, sustituye
   la tarjeta de archivo falso actual. Texto breve explicando qué se espera
   (un Excel o CSV con los productos).
2. **Mapeo de columnas** — tras elegir el archivo, se parsea con SheetJS
   (ver sección 2) y se toma la primera fila como cabeceras. Se muestra una
   lista con cada cabecera detectada y, junto a ella, un `<select>` para
   asignarla a uno de: **Nombre**, **SKU**, **Stock**, **Stock mínimo**, o
   **Ignorar esta columna** (valor por defecto para cualquier cabecera que
   no coincida con un mapeo guardado — ver más abajo). Nombre y SKU son
   obligatorios: el botón "Continuar" está desactivado hasta que ambos
   estén asignados a una columna.
   - En esta misma pantalla hay un control (radio) **"Al actualizar
     productos que ya existen: ○ Sustituir su stock ○ Sumar al stock
     actual"**, por defecto "Sustituir".
   - **Mapeo recordado:** al confirmar el mapeo en el paso 3, se guarda en
     `localStorage` una entrada `panelbasico-import-mapping` keyed por la
     lista ordenada de cabeceras detectadas (ej. clave =
     `"Nombre|SKU|Stock|Stock mínimo"`, valor = qué campo se asignó a cada
     una). La próxima vez que se suba un archivo cuyas cabeceras coincidan
     exactamente con una clave guardada, los `<select>` se rellenan solos
     con ese mapeo (el cliente puede cambiarlo antes de continuar).
3. **Vista previa** — se procesan todas las filas de datos (todas menos la
   cabecera) con el mapeo elegido:
   - Se valida cada fila (ver sección 4): las válidas se clasifican en
     *nuevas* (SKU no existe en `PRODUCTS`) o *actualización* (SKU ya
     existe); las inválidas se listan aparte con el motivo.
   - Se muestra: contador "N nuevas · M actualizaciones · K con error", una
     tabla de muestra con las primeras 10 filas válidas (nombre, SKU, stock
     final que quedaría, stock mínimo), y si K > 0, una lista desplegable
     con "fila <n>: <motivo>" para cada fila inválida.
   - Botón "Confirmar importación", desactivado si N + M = 0.
   - Botón "Volver" para corregir el mapeo sin tener que volver a
     seleccionar el archivo.
4. **Importando** — progreso real, no temporizador: las filas válidas se
   envían a Supabase en lotes (ver sección 3) y la barra avanza según
   lotes completados ("Lote X de Y").
5. **Resultado** — resumen final: "N productos añadidos, M actualizados"
   (y, si hubo filas inválidas, se repite el aviso "K filas omitidas, ver
   detalle" con la misma lista de la vista previa). Botón "Cerrar" que
   además refresca la tabla principal y el dashboard.

Cerrar el modal en cualquier punto con la `×` o haciendo click fuera
reinicia el flujo a "Idle" la próxima vez que se abra (no conserva el
archivo ni el mapeo de la sesión anterior en pantalla, aunque el mapeo por
cabecera sí sigue guardado en `localStorage` para la próxima vez).

## 2. Lectura del archivo: SheetJS

Se añade la librería **SheetJS (`xlsx`), Community Edition**, cargada por
CDN (`cdn.sheetjs.com`, build completo para navegador, sin instalación ni
build step) — la versión exacta a fijar en `index.html` se confirma en el
momento de escribir el plan de implementación, verificándola contra la
documentación oficial de SheetJS en ese momento para no pinnear una versión
obsoleta.

Parseo: `file.arrayBuffer()` → `XLSX.read(buffer, { type: "array" })` →
`XLSX.utils.sheet_to_json(hoja, { header: 1 })` para obtener un array de
filas (cada fila un array de celdas), de donde la fila `[0]` son las
cabeceras y el resto son datos. Se usa siempre la primera hoja del libro
(`workbook.SheetNames[0]`) — este panel no soporta libros con varias hojas.

Formatos aceptados: `.xlsx`, `.xls`, `.csv` (los tres los lee la misma
librería).

## 3. Añadir vs. actualizar (upsert por SKU)

`sku` ya es `unique` en `public.products` (`supabase/schema.sql`), así que
se usa `db.from("products").upsert(filas, { onConflict: "sku" })`. Como
Supabase no puede "sumar" un valor dentro de un upsert declarativo, el
stock final de cada fila se calcula **en el cliente antes de enviarla**:

- Se busca el SKU de la fila en el `PRODUCTS` ya cargado en memoria
  (viene de `fetchProducts()` al iniciar sesión).
- Si no existe → alta nueva. Stock = el de la fila (0 si no se mapeó esa
  columna o venía vacía). Stock mínimo = el de la fila, o 5 por defecto
  (mismo valor por defecto que usa el modal "Añadir producto") si no se
  mapeó o venía vacío.
- Si ya existe → actualización. Nombre y stock mínimo se sustituyen por el
  valor de la fila **solo si esa columna fue mapeada y la celda no está
  vacía** (si la columna no se mapeó, ese campo del producto existente no
  se toca). El stock sigue el modo elegido en la pantalla de mapeo:
  - *Sustituir*: stock final = stock de la fila.
  - *Sumar*: stock final = stock actual del producto + stock de la fila.

Las filas se envían a Supabase en lotes de 50 (una llamada `upsert` por
lote) para no mandar una única petición gigante ni sufrir mucho por un
fallo puntual de red a mitad de una importación grande. Si un lote falla,
se detiene ahí: se informa cuántos productos sí se llegaron a
añadir/actualizar (los lotes previos que tuvieron éxito) y cuáles no, con
opción de reintentar solo con las filas restantes.

**Duplicados dentro del mismo archivo:** si dos filas del Excel comparten
SKU, se procesan en el orden en que aparecen y la última sobreescribe (o
suma sobre, si el modo es "sumar") el resultado de la anterior — no se
trata como error.

## 4. Validación de filas

Una fila es inválida si, tras aplicar el mapeo:

- La columna mapeada a **Nombre** está vacía → error: "sin nombre".
- La columna mapeada a **SKU** está vacía → error: "sin SKU".
- La columna mapeada a **Stock** (si se mapeó) contiene algo que no es un
  número entero ≥ 0 → error: "stock inválido".
- La columna mapeada a **Stock mínimo** (si se mapeó) contiene algo que no
  es un número entero ≥ 0 → error: "stock mínimo inválido".

Las filas totalmente vacías (todas las celdas en blanco) se ignoran de
forma silenciosa, sin contar como error ni como fila procesada (son huecos
habituales al final de una hoja de cálculo).

Las filas inválidas no bloquean la importación de las válidas: se excluyen
del envío a Supabase y se listan en la vista previa y en el resultado
final con el número de fila (contando la cabecera como fila 1, para que
coincida con lo que el cliente ve al abrir el Excel) y el motivo.

## 5. Qué se elimina del código actual

Todo el mecanismo de simulación en `js/import.js` desaparece:
`IMPORT_PRODUCT_NAMES`, `nextImportSku`/`importCounter`,
`generateFakeProducts`, el bucle `requestAnimationFrame` de la barra de
progreso falsa, y la llamada a `insertProductsBatch`. La función
`insertProductsBatch` en `js/data.js` (que solo la usaba la simulación) se
sustituye por la nueva función de upsert por lotes descrita en la sección
3. El HTML del modal (`#importModal` en `index.html`) se reestructura para
los 5 estados nuevos en vez de los 3 actuales, y el CSS de los estados de
importación (`.import-state`, `.file-card`, `.progress-*`, `.import-success`)
se adapta/amplía para las pantallas de mapeo y vista previa.

## Fuera de alcance (no-goals)

- Solo `panel-basico`. `panel-intermedio` y `panel-completo` no se tocan
  en este documento.
- Sin plantilla de Excel descargable — el mapeo de columnas ya permite
  subir cualquier archivo que ya tenga el cliente, con cualquier nombre de
  columna.
- Sin soporte para libros con varias hojas — se usa siempre la primera.
- Sin límite de filas por archivo, salvo el troceado en lotes de 50 para
  el envío (que es un detalle de implementación, no una restricción visible
  para el cliente).
- Sin arrastrar y soltar (drag & drop) el archivo — solo el selector de
  archivo estándar del `<input type="file">`.
- No se cambia nada del resto del panel (borrado de productos, mascota,
  pie de página) — este documento es solo la importación.

## Plan de pruebas manuales

1. Subir un `.xlsx` con cabeceras "Nombre", "SKU", "Stock", "Stock mínimo"
   en ese orden → deben autodetectarse en el mapeo si coinciden con un
   mapeo guardado previamente, o aparecer todas en "Ignorar" la primera vez.
2. Mapear manualmente Nombre y SKU únicamente (dejar Stock y Stock mínimo
   sin mapear) → la vista previa debe mostrar stock 0 y stock mínimo 5 para
   las filas nuevas.
3. Subir un archivo con una fila cuyo SKU ya existe en el inventario →debe
   clasificarse como "actualización" en la vista previa, no como "nueva".
4. Probar el modo "Sustituir" y el modo "Sumar" sobre el mismo producto
   existente y comprobar que el stock final en la vista previa coincide con
   lo esperado en cada modo.
5. Incluir una fila con SKU vacío y otra con texto en la columna de stock →
   deben aparecer como inválidas en la vista previa, con el motivo
   correcto, y el resto de filas válidas debe importarse igualmente al
   confirmar.
6. Subir un `.csv` con las mismas columnas → debe funcionar igual que el
   `.xlsx`.
7. Cerrar el modal a mitad del mapeo y reabrirlo → debe volver a "Idle"
   limpio (sin arrastrar el archivo anterior).
8. Repetir una importación con el mismo archivo/cabeceras que una vez
   anterior → el mapeo debe aparecer ya rellenado.
9. Comprobar en Supabase (tabla `products`) que tras confirmar una
   importación, tanto las altas como las actualizaciones se reflejan
   correctamente, incluyendo que un producto actualizado con la columna de
   nombre mapeada cambia de nombre, y uno sin esa columna mapeada conserva
   el nombre que ya tenía.
