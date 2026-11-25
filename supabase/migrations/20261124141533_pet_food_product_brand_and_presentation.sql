alter table public.products
 add column if not exists brand text,
 add column if not exists presentation text;
create unique index if not exists products_barcode_unique_active
 on public.products (barcode)
 where barcode is not null and btrim(barcode) <> '' and active = true;
comment on column public.products.brand is 'Marca comercial del producto';
comment on column public.products.presentation is 'Presentación o tamaño comercial, por ejemplo 3 kg, 7.5 kg o 20 kg';
notify pgrst, 'reload schema';
