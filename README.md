# Panel de Inventario — Básico

Panel de inventario funcional con login y datos persistidos en una base de
datos real (Supabase / Postgres). Sin build step — HTML + CSS + JS vainilla,
más el SDK de Supabase cargado por CDN.

## Funcionalidades

- **Acceso con usuario y contraseña:** el inventario solo es visible tras
  iniciar sesión (Supabase Auth). Sin sesión no se puede ni leer ni escribir
  ningún dato — lo aplica la Row Level Security de la base de datos, no solo
  la pantalla de login.
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
- **Importar desde Excel (simulado):** botón que abre un modal, simula la
  subida de un archivo con una barra de progreso de ~2s y **inserta de
  verdad** entre 15 y 20 productos generados en la base de datos.
- **Alerta de stock bajo:** cuando `stock <= stockMinimo`, la fila muestra un
  borde izquierdo rojo pulsante y la insignia "¡Stock Bajo!".

## Configuración de Supabase (una sola vez)

1. Crea una cuenta y un proyecto gratuito en [supabase.com](https://supabase.com).
2. En el proyecto, ve a **SQL Editor** → pega y ejecuta todo el contenido de
   [`supabase/schema.sql`](supabase/schema.sql). Esto crea la tabla
   `products`, activa la Row Level Security y carga los 10 productos de
   ejemplo.
3. Ve a **Authentication → Providers → Email** y desactiva **"Allow new
   users to sign up"**. Importante: sin este paso, cualquiera con la anon
   key podría crearse una cuenta propia y entrar al panel.
4. Ve a **Authentication → Users → Add user** y crea la cuenta con la que
   entrará el cliente (correo + contraseña). Ese es el login del panel —
   no hay registro público.
5. Ve a **Project Settings → API** y copia:
   - **Project URL**
   - **anon / public key**
6. Pégalos en [`js/config.js`](js/config.js), sustituyendo los marcadores
   `TU-PROYECTO` y `TU-ANON-KEY`.

> **Si ya tenías este proyecto Supabase creado antes de añadir el borrado de
> productos:** `schema.sql` no se vuelve a ejecutar solo. Ve a **SQL Editor**
> y ejecuta únicamente esto una vez:
>
> ```sql
> create policy "Usuarios autenticados pueden eliminar productos"
>   on public.products for delete
>   to authenticated
>   using (true);
>
> grant delete on public.products to authenticated;
> ```

Con eso, abrir `index.html` (con doble clic o sirviéndolo con
`python -m http.server 8000`) ya pide login y lee/escribe en Supabase.

## Estructura

```
basico/
├── index.html
├── css/
│   └── styles.css        Variables de color (claro/oscuro), login, tarjetas, tabla
├── supabase/
│   └── schema.sql         Tabla products + Row Level Security + datos de ejemplo
└── js/
    ├── config.js           URL y anon key de tu proyecto Supabase (a rellenar)
    ├── supabaseClient.js   Inicializa el cliente ("db")
    ├── data.js              fetch/insert/update/delete de productos contra Supabase
    ├── auth.js              Login, logout y qué pantalla se muestra
    ├── theme.js              Toggle de modo claro/oscuro
    ├── app.js                Render de la tabla, dashboard y eventos
    └── import.js             Simulación de importación desde Excel
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
- La anon key en `js/config.js` está pensada para ir en el navegador — no es
  un secreto por sí sola. Quien de verdad protege los datos es la Row Level
  Security del esquema (`to authenticated`), no la key.
- No hay pestaña de proveedores, variantes ni importación — eso empieza en
  el nivel [`intermedio/`](https://github.com/SarayOrtizCordero/panel-intermedio/blob/main/README.md). Este nivel está pensado
  para quedarse simple a propósito.
