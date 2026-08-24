# Autodetección de columnas al mapear el Excel — Plan Básico

Fecha: 2026-08-24
Alcance: `panel-basico/` únicamente. No se toca `panel-intermedio/` ni
`panel-completo/`.

## Contexto

Tras probar la importación real desde Excel (ver
`2026-08-23-importacion-excel-real-design.md`), la primera cliente que la
usó encontró la pantalla de mapeo de columnas poco intuitiva: no le quedaba
claro por qué tenía que asignar manualmente cada columna de su archivo a un
campo (Nombre/SKU/Stock/Stock mínimo), y en particular no entendía qué
significaba ni cuándo usar la opción "Ignorar esta columna". Los avisos de
filas inválidas y el resto del flujo (vista previa, sustituir/sumar,
importación por lotes) funcionaron correctamente — el problema es solo la
fricción de la pantalla de mapeo en sí.

Este documento añade **autodetección de columnas**: al llegar a la pantalla
de mapeo, el sistema intenta adivinar por sí solo qué columna es cada dato
mirando el texto de la cabecera, de forma que en el caso normal el cliente
solo tiene que revisar y pulsar "Continuar" en vez de rellenar cada
desplegable a mano. También se aclaran los textos de esa pantalla.

## 1. Algoritmo de autodetección

Para cada cabecera del archivo (el texto tal cual viene, ya recortado de
espacios), se normaliza a minúsculas y sin acentos, y se compara contra
listas de palabras por campo, **en este orden de prioridad** (los grupos
más específicos se comprueban antes que los genéricos, para que "Stock
mínimo" no se confunda con "Stock" por contener esa palabra dentro):

1. **Stock mínimo** — la cabecera normalizada contiene `"minimo"`.
2. **SKU** — contiene `"sku"`, `"codigo"`, `"referencia"` o `"ref"`.
3. **Stock** — contiene `"stock"`, `"cantidad"`, `"existencias"` o
   `"unidades"`.
4. **Nombre** — contiene `"nombre"`, `"producto"`, `"articulo"` o
   `"item"`.

Se recorren las cabeceras de izquierda a derecha. Para cada una, se
prueban los cuatro grupos en el orden de arriba y se toma el primero que
encaje; si ese campo **ya ha sido asignado** por una cabecera anterior
(por ejemplo, el archivo tiene tanto "Producto" como "Nombre" y ambas
encajarían con Nombre), la cabecera actual se deja sin asignar ("No se usa
este dato") en vez de robarle el campo a la anterior — así nunca hay dos
columnas peleándose por el mismo campo, y el cliente decide a mano ese caso
raro si hace falta. Una cabecera que no encaja con ningún grupo también se
deja sin asignar.

Ejemplo: cabeceras `["Producto", "Referencia", "Stock mínimo", "Stock",
"Categoría"]` se autodetectan como `Nombre, SKU, Stock mínimo, Stock,
(sin asignar)`.

## 2. Prioridad frente al mapeo guardado

`panel-basico` ya recuerda en `localStorage` el mapeo elegido la última vez
para un conjunto exacto de cabeceras (ver spec de la importación real,
sección 1). Esa memoria **tiene prioridad sobre la autodetección**: si
existe un mapeo guardado para las cabeceras del archivo actual, se usa tal
cual (autodetección no se ejecuta en absoluto). La autodetección solo entra
en juego cuando no hay ningún mapeo guardado para ese conjunto exacto de
cabeceras — típicamente la primera vez que el cliente sube un archivo con
esas columnas.

## 3. Cambios de texto en la pantalla de mapeo

- La opción del desplegable "Ignorar esta columna" pasa a llamarse **"No
  se usa este dato"**.
- Encima de la lista de columnas, el texto actual ("Indica qué columna es
  cada dato:") se sustituye por:

  > Hemos intentado adivinar qué columna es cada dato — revisa que esté
  > bien y cambia lo que haga falta. Si tu archivo tiene alguna columna
  > que no necesitamos (como categoría o proveedor), déjala en "No se usa
  > este dato".

Estos dos cambios de texto se aplican siempre, tanto si la pantalla se ha
rellenado por autodetección como si viene de un mapeo guardado o vacía.

## 4. Qué no cambia

- La estructura de la pantalla de mapeo (lista de cabeceras + desplegable
  cada una, más el selector de sustituir/sumar) es la misma — no se añaden
  pantallas ni pasos nuevos.
- La validación de "Continuar" sigue igual: desactivado hasta que Nombre y
  SKU tengan una columna asignada (por autodetección, por mapeo guardado, o
  a mano). Si la autodetección no encuentra Nombre o SKU en ninguna
  cabecera, el botón sigue desactivado hasta que el cliente los asigne él
  mismo — no hay ningún aviso adicional para ese caso, el botón desactivado
  ya lo comunica, igual que ahora.
- El resto del flujo (vista previa, sustituir/sumar, importación por
  lotes, resultado) no se toca.
- No se guarda ni se distingue en ningún sitio si un campo se rellenó por
  autodetección o a mano — una vez el cliente pulsa "Continuar", el mapeo
  se guarda igual que hoy (ver sección 2 de la spec anterior).

## Fuera de alcance (no-goals)

- Solo `panel-basico`. `panel-intermedio` y `panel-completo` no se tocan.
- Sin cambios de CSS ni de maquetación — mismos elementos, mismo diseño
  visual, solo cambia qué valor trae cada `<select>` al renderizarse y dos
  textos.
- Sin indicador visual de "esto se adivinó automáticamente" junto a cada
  campo — se consideró y se descarta por ahora para no añadir complejidad
  a una pantalla que precisamente se está intentando simplificar.
- Sin ampliar ni personalizar la lista de palabras clave por parte del
  cliente (no hay configuración) — es una lista fija en el código.

## Plan de pruebas manuales

1. Subir un archivo con cabeceras exactas `Nombre, SKU, Stock, Stock
   mínimo` (sin mapeo guardado previo para ese conjunto) → los cuatro
   campos deben aparecer ya asignados correctamente al llegar a la
   pantalla de mapeo.
2. Subir un archivo con cabeceras distintas pero reconocibles, por ejemplo
   `Producto, Referencia, Cantidad, Categoría` → deben autodetectarse como
   Nombre, SKU, Stock y "No se usa este dato" respectivamente.
3. Subir un archivo con dos cabeceras que encajarían con el mismo campo,
   por ejemplo `Nombre, Producto, SKU, Stock` → solo "Nombre" (la primera)
   debe quedar asignada a Nombre; "Producto" debe quedar en "No se usa este
   dato".
4. Repetir el archivo del punto 1 una segunda vez → el mapeo debe venir del
   mapeo guardado (idéntico comportamiento a antes), no de la
   autodetección — cambiar a mano un campo, confirmar, y comprobar que la
   tercera vez se respeta el cambio manual guardado en vez de volver a
   autodetectar.
5. Subir un archivo cuyas cabeceras no encajan con ningún campo (p. ej.
   `Col1, Col2, Col3, Col4`) → todos los campos deben quedar en "No se usa
   este dato" y el botón "Continuar" debe seguir desactivado hasta mapear
   Nombre y SKU a mano.
6. Comprobar visualmente que los dos textos nuevos (la opción del
   desplegable y la frase explicativa) aparecen correctamente en modo
   claro y oscuro.
