-- Panel de Inventario — Básico
-- Ejecuta este script completo en Supabase → SQL Editor (proyecto nuevo, una sola vez).

create table if not exists public.products (
  id bigint generated always as identity primary key,
  nombre text not null,
  sku text not null unique,
  stock integer not null default 0 check (stock >= 0),
  stock_minimo integer not null default 0 check (stock_minimo >= 0),
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

-- Solo usuarios que han iniciado sesión pueden ver o modificar el inventario.
-- No se concede ningún permiso al rol "anon" (visitante sin login).
create policy "Usuarios autenticados pueden ver productos"
  on public.products for select
  to authenticated
  using (true);

create policy "Usuarios autenticados pueden crear productos"
  on public.products for insert
  to authenticated
  with check (true);

create policy "Usuarios autenticados pueden actualizar productos"
  on public.products for update
  to authenticated
  using (true)
  with check (true);

grant usage on schema public to authenticated;
grant select, insert, update on public.products to authenticated;

-- Datos de ejemplo (los mismos 10 productos de la demo original).
-- Seguro de re-ejecutar: si el SKU ya existe, no duplica la fila.
insert into public.products (nombre, sku, stock, stock_minimo) values
  ('Camiseta básica',      'CAM-001', 24, 8),
  ('Pantalón vaquero',     'PAN-002', 15, 5),
  ('Sudadera con capucha', 'SUD-003', 9,  6),
  ('Zapatillas running',   'ZAP-004', 12, 4),
  ('Gorra deportiva',      'GOR-005', 30, 10),
  ('Chaqueta impermeable', 'CHA-006', 7,  5),
  ('Vestido de verano',    'VES-007', 11, 5),
  ('Bufanda de lana',      'BUF-008', 2,  5),
  ('Calcetines (pack 3)',  'CAL-009', 40, 12),
  ('Guantes térmicos',     'GUA-010', 6,  6)
on conflict (sku) do nothing;
