begin;

select plan(12);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '00000000-0000-4000-8000-000000000098',
  'authenticated',
  'authenticated',
  'ci-pos-owner@supervecino.local',
  '',
  now(),
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role, active)
values ('00000000-0000-4000-8000-000000000098', 'CI POS Owner', 'owner', true)
on conflict (id) do update set role = 'owner', active = true;

insert into public.products (id, name, sale_price, cost_price, stock, min_stock, manages_stock, active)
values (
  '00000000-0000-4000-8000-000000000098',
  'CI Synthetic Product',
  100,
  50,
  10,
  0,
  true,
  true
)
on conflict (id) do nothing;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000098', true);

select lives_ok(
  $$select public.open_cash_session(100)$$,
  'owner can open a local cash session'
);

select is(
  (select stock from public.products where id = '00000000-0000-4000-8000-000000000098'),
  10::numeric,
  'synthetic product starts with ten units'
);

select lives_ok(
  $$select public.create_pos_sale(
    '[{"product_id":"00000000-0000-4000-8000-000000000098","quantity":1}]'::jsonb,
    '[{"method":"cash","amount":100}]'::jsonb,
    0,
    null,
    null,
    '00000000-0000-4000-8000-000000000088'::uuid
  )$$,
  'first idempotent sale is created'
);

select is(
  (
    public.create_pos_sale(
      '[{"product_id":"00000000-0000-4000-8000-000000000098","quantity":1}]'::jsonb,
      '[{"method":"cash","amount":100}]'::jsonb,
      0,
      null,
      null,
      '00000000-0000-4000-8000-000000000088'::uuid
    )->>'duplicate'
  )::boolean,
  true,
  'retry with same key and payload returns existing sale'
);

select is(
  (select count(*)::integer from public.sales where idempotency_key = '00000000-0000-4000-8000-000000000088'),
  1,
  'only one sale row exists for the idempotency key'
);

select is(
  (select stock from public.products where id = '00000000-0000-4000-8000-000000000098'),
  9::numeric,
  'stock is deducted exactly once'
);

select is(
  (select count(*)::integer from public.stock_movements where reference_id = (select id from public.sales where idempotency_key = '00000000-0000-4000-8000-000000000088')),
  1,
  'stock movement is created exactly once'
);

select is(
  (select count(*)::integer from public.payments where sale_id = (select id from public.sales where idempotency_key = '00000000-0000-4000-8000-000000000088')),
  1,
  'payment row is created exactly once'
);

select is(
  (select count(*)::integer from public.cash_movements where movement_type = 'sale'),
  1,
  'cash movement is created exactly once'
);

select throws_ok(
  $$select public.create_pos_sale(
    '[{"product_id":"00000000-0000-4000-8000-000000000098","quantity":2}]'::jsonb,
    '[{"method":"cash","amount":200}]'::jsonb,
    0,
    null,
    null,
    '00000000-0000-4000-8000-000000000088'::uuid
  )$$,
  'P0001',
  'La clave de idempotencia ya fue utilizada para otra operación.',
  'same key with a different payload is rejected'
);

select is(
  (select count(*)::integer from public.sales where idempotency_key = '00000000-0000-4000-8000-000000000088'),
  1,
  'mismatched retry does not create a second sale'
);

select * from finish();
rollback;
