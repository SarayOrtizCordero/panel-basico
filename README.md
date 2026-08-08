# Panel de Inventario — Básico

Demo estática de un panel de inventario con el "efecto wow" mínimo: ver el
stock cambiar al instante y una alerta visual clara de stock bajo. Sin
backend, sin build step — HTML + CSS + JS vainilla.

## Funcionalidades

- **Dashboard simple:** tarjetas de total de productos y "listos para
  vender", más un gráfico donut (SVG) animado que se dibuja al cargar.
- **Tabla de productos:** foto (avatar de iniciales con color por producto),
  nombre, SKU y stock actual.
- **Acciones rápidas:** botones `+`/`−` junto a cada producto que actualizan
  el stock al instante, sin recargar la página, con un pequeño flash de
  color y una animación de pulso en el número.
- **Alerta de stock bajo:** cuando `stock <= stockMinimo`, la fila muestra un
  borde izquierdo rojo pulsante y la insignia "¡Stock Bajo!".

## Cómo previsualizar

Es 100% estático — basta con abrir `index.html` con doble clic, o servirlo:

```bash
python -m http.server 8000
```

y visitar `http://localhost:8000`.

## Estructura

```
basico/
├── index.html
├── css/
│   └── styles.css     Variables de color, tarjetas, tabla, animaciones
└── js/
    ├── data.js         10 productos de ejemplo (estáticos)
    └── app.js           Render de la tabla, dashboard y eventos +/-
```

## Datos de ejemplo

`js/data.js` define un array `PRODUCTS` con `id, nombre, sku, stock,
stockMinimo`. Todo vive en memoria: **los cambios de stock se pierden al
recargar la página**, ya que no hay backend ni almacenamiento. El producto
"Bufanda de lana" se deja deliberadamente con `stock: 2` y `stockMinimo: 5`
para que la alerta de stock bajo sea visible nada más cargar.

## Notas para extender

- El sistema de color vive en variables CSS (`--primary`, `--ok`,
  `--danger`, `--amber`, `--bg`, `--surface`…) en `:root` de `styles.css`.
  Cambiar el tema es tocar solo ese bloque.
- Los elementos que aparecen animados (`.card`, `.product-row`) usan
  `opacity:0; animation: fadeInUp … both;` con `animation-delay` escalonado
  por índice — sigue este patrón si añades nuevas filas o tarjetas.
- Cuidado si combinas el atributo `hidden` con una regla propia de
  `display` sobre el mismo elemento: una regla de autor como
  `.mi-clase { display: flex }` gana sobre `[hidden]` y lo deja visible
  igualmente. Si necesitas ambos, añade `.mi-clase[hidden] { display: none; }`.
- No hay pestaña de proveedores, variantes ni importación — eso empieza en
  el nivel [`intermedio/`](https://github.com/SarayOrtizCordero/panel-intermedio/blob/main/README.md). Este nivel está pensado
  para quedarse simple a propósito.
