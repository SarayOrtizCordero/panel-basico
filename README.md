# Panel de Inventario — Básico

Panel de inventario funcional con login y datos persistidos en el propio
navegador (`localStorage`). Sin build step — HTML + CSS + JS vainilla, más
SheetJS (para leer archivos Excel/CSV) cargado por CDN.

> **Sin backend por ahora:** este panel usaba Supabase (Postgres + Auth real),
> pero el proyecto gratuito se quedó sin plan y se pausó. Mientras se decide
> si se retoma esa migración, el login usa un usuario y contraseña fijos
> comprobados en el propio código (`js/config.js`) y los productos se guardan
> en `localStorage` en vez de en una base de datos — o sea, sin seguridad real
> y los datos solo viven en este navegador. `supabase/schema.sql` se deja tal
> cual para cuando se retome esa migración.

## Funcionalidades

- **Acceso con usuario y contraseña:** el inventario solo es visible tras
  iniciar sesión. Por ahora es una comprobación fija en el propio navegador
  (ver nota de arriba), no una autenticación real de servidor.
- **Modo claro / oscuro:** botón en la cabecera que cambia el tema y lo
  recuerda entre visitas (`localStorage`); si el usuario nunca lo ha tocado,
  se usa el tema del sistema operativo.
- **Dashboard simple:** tarjetas de total de productos y "listos para
  vender", más un gráfico donut (SVG) animado que se dibuja al cargar.
- **Tabla de productos:** foto (avatar de iniciales con color por producto),
  nombre, SKU y stock actual.
- **Acciones rápidas:** botones `+`/`−` junto a cada producto, y un botón
  "Reponer stock" para sumar una cantidad concreta de golpe. Todo se guarda
  al instante en la base de datos (con reversión y aviso si falla la
  conexión).
- **Añadir producto:** da de alta artículos nuevos directamente desde el
  panel.
- **Eliminar producto:** botón de papelera en cada fila, con confirmación
  antes de borrar de verdad en la base de datos.
- **Importar desde Excel:** sube un `.xlsx`, `.xls` o `.csv` real, indica
  qué columna es el nombre/SKU/stock/stock mínimo (el mapeo se recuerda
  para la próxima vez), revisa una vista previa con los productos nuevos y
  las actualizaciones antes de confirmar, y elige si el stock de productos
  ya existentes se sustituye o se suma al actual. Las filas inválidas se
  listan sin bloquear la importación del resto.
- **Alerta de stock bajo:** cuando `stock <= stockMinimo`, la fila muestra un
  borde izquierdo rojo pulsante y la insignia "¡Stock Bajo!".

## Cómo entrar

Abre `index.html` (con doble clic o sirviéndolo con
`python -m http.server 8000`) y entra con el usuario y contraseña definidos en
[`js/config.js`](js/config.js) (`DEMO_LOGIN_EMAIL` / `DEMO_LOGIN_PASSWORD`).
Cámbialos ahí si quieres otras credenciales — no hay registro ni servidor,
solo se comparan en el navegador.

## Estructura

```
basico/
├── index.html
├── css/
│   └── styles.css        Variables de color (claro/oscuro), login, tarjetas, tabla
├── supabase/
│   └── schema.sql         Tabla products + Row Level Security (sin usar por ahora, ver nota al principio)
└── js/
    ├── config.js           Usuario y contraseña fijos del login de demo
    ├── data.js              fetch/insert/update/delete de productos contra localStorage
    ├── auth.js              Login, logout y qué pantalla se muestra
    ├── theme.js              Toggle de modo claro/oscuro
    ├── app.js                Render de la tabla, dashboard y eventos
    └── import.js             Importación real desde Excel (parseo, mapeo, vista previa y envío por lotes)
```

## Notas para extender

- El sistema de color vive en variables CSS (`--primary`, `--danger`,
  `--ok`, `--bg`, `--surface`…) en `:root` de `styles.css`, con una segunda
  definición bajo `:root[data-theme="dark"]` para el tema oscuro. Cambiar
  cualquiera de los dos temas es tocar solo ese bloque.
- El toast (`#toast`) usa un fondo oscuro fijo (no ligado a `--text`) a
  propósito: si siguiera la variable de texto, en modo oscuro `--text` es
  claro y el aviso se volvería ilegible.
- Los elementos que aparecen animados (`.card`, `.product-row`) usan
  `opacity:0; animation: fadeInUp … both;` con `animation-delay` escalonado
  por índice — sigue este patrón si añades nuevas filas o tarjetas.
- Cuidado si combinas el atributo `hidden` con una regla propia de
  `display` sobre el mismo elemento: una regla de autor como
  `.mi-clase { display: flex }` gana sobre `[hidden]` y lo deja visible
  igualmente (por eso `.login-screen[hidden]` y `.session-loading[hidden]`
  tienen su propio `display: none` explícito).
- El usuario/contraseña de `js/config.js` y los productos de `localStorage`
  son solo para la demo — cualquiera con el código fuente puede leerlos o
  editar el storage del navegador. No uses este login tal cual con datos
  reales.
- No hay pestaña de proveedores ni variantes — eso empieza en el nivel
  [`intermedio/`](https://github.com/SarayOrtizCordero/panel-intermedio/blob/main/README.md).
  La importación desde Excel de este nivel es real y permite mapeo de
  columnas; intermedio añade además proveedores y variantes reales.
  Este nivel está pensado
  para quedarse simple a propósito.
