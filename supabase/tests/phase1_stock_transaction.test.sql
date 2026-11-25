begin;

select plan(16);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '00000000-0000-4000-8000-000000000096',
  'authenticated',
  'authenticated',
  'ci-stock-manager@supervecino.local',
  '',
  now(),
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role, active)
values ('00000000-0000-4000-8000-000000000096', 'CI Stock Manager', 'manager', true)
on conflict (id) do update set role = 'manager', active = true;

insert into public.products (id, name, sale_price, cost_price, stock, min_stock, manages_stock, active)
values (
  '00000000-0000-4000-8000-000000000096',
  'CI Stock Product',
  100,
  50,
  5,
  0,
  true,
  true
)
on conflict (id) do nothing;

insert into public.suppliers (id, name, active)
values ('00000000-0000-4000-8000-000000000096', 'CI Synthetic Supplier', true)
on conflict (id) do nothing;

insert into public.purchases (
  id, supplier_id, purchase_date, status, subtotal, tax_total, total, created_by
)
values (
  '00000000-0000-4000-8000-000000000096',
  '00000000-0000-4000-8000-000000000096',
  current_date,
  'draft',
  200,
  42,
  242,
  '00000000-0000-4000-8000-000000000096'
)
on conflict (id) do nothing;

insert into public.purchase_items (
  purchase_id, product_id, quantity, unit_cost_net, vat_rate, line_total
)
values (
  '00000000-0000-4000-8000-000000000096',
  '00000000-0000-4000-8000-000000000096',
  4,
  50,
  21,
  242
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000096', true);

select lives_ok(
  $$select public.adjust_product_stock('00000000-0000-4000-8000-000000000096', 3, 'CI adjustment in')$$,
  'manager can increase stock'
);
select is(
  (select stock from public.products where id = '00000000-0000-4000-8000-000000000096'),
  8::numeric,
  'positive adjustment increments stock'
);
select is(
  (select count(*)::integer from public.stock_movements where product_id = '00000000-0000-4000-8000-000000000096' and movement_type = 'adjustment'),
  1,
  'adjustment uses the allowed movement type'
);

select lives_ok(
  $$select public.adjust_product_stock('00000000-0000-4000-8000-000000000096', -2, 'CI adjustment out')$$,
  'manager can decrease stock'
);
select is(
  (select stock from public.products where id = '00000000-0000-4000-8000-000000000096'),
  6::numeric,
  'negative adjustment decrements stock'
);
select throws_ok(
  $$select public.adjust_product_stock('00000000-0000-4000-8000-000000000096', -10, 'CI invalid adjustment')$$,
  'P0001',
  'El ajuste dejaría el stock negativo.',
  'adjustment cannot make stock negative'
);
select is(
  (select stock from public.products where id = '00000000-0000-4000-8000-000000000096'),
  6::numeric,
  'failed adjustment rolls back stock change'
);
select is(
  (select count(*)::integer from public.stock_movements where product_id = '00000000-0000-4000-8000-000000000096' and movement_type = 'adjustment'),
  2,
  'failed adjustment does not create a movement'
);

select lives_ok(
  $$select public.receive_purchase('00000000-0000-4000-8000-000000000096')$$,
  'manager can receive a draft purchase'
);
select is(
  (select stock from public.products where id = '00000000-0000-4000-8000-000000000096'),
  10::numeric,
  'purchase receipt increments stock once'
);
select is(
  (select count(*)::integer from public.stock_movements where reference_id = '00000000-0000-4000-8000-000000000096' and movement_type = 'purchase'),
  1,
  'purchase receipt uses the allowed movement type exactly once'
);
select is(
  (select status from public.purchases where id = '00000000-0000-4000-8000-000000000096'),
  'received',
  'purchase status changes to received atomically'
);
select is(
  (select last_cost_net from public.supplier_products where supplier_id = '00000000-0000-4000-8000-000000000096' and product_id = '00000000-0000-4000-8000-000000000096'),
  50::numeric,
  'supplier product cost is updated on receipt'
);

select throws_ok(
  $$select public.receive_purchase('00000000-0000-4000-8000-000000000096')$$,
  'P0001',
  'La compra ya fue procesada.',
  'receiving the same purchase twice is rejected'
);
select is(
  (select stock from public.products where id = '00000000-0000-4000-8000-000000000096'),
  10::numeric,
  'duplicate purchase receipt does not change stock'
);
select is(
  (select count(*)::integer from public.stock_movements where reference_id = '00000000-0000-4000-8000-000000000096' and movement_type = 'purchase'),
  1,
  'duplicate purchase receipt does not create a second movement'
);

select * from finish();
rollback;
