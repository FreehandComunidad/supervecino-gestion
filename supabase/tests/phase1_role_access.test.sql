begin;

select plan(10);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000091', 'authenticated', 'authenticated', 'ci-cashier-one@supervecino.local', '', now(), now(), now()),
  ('00000000-0000-4000-8000-000000000092', 'authenticated', 'authenticated', 'ci-cashier-two@supervecino.local', '', now(), now(), now()),
  ('00000000-0000-4000-8000-000000000093', 'authenticated', 'authenticated', 'ci-manager@supervecino.local', '', now(), now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role, active)
values
  ('00000000-0000-4000-8000-000000000091', 'CI Cashier One', 'cashier', true),
  ('00000000-0000-4000-8000-000000000092', 'CI Cashier Two', 'cashier', true),
  ('00000000-0000-4000-8000-000000000093', 'CI Manager', 'manager', true)
on conflict (id) do update set role = excluded.role, active = true;

insert into public.sales (cashier_id, subtotal, total)
values
  ('00000000-0000-4000-8000-000000000091', 100, 100),
  ('00000000-0000-4000-8000-000000000092', 200, 200);

insert into public.app_settings (key, value)
values ('ci-test-setting', '{"enabled":true}'::jsonb)
on conflict (key) do update set value = excluded.value;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000093', true);
set local role authenticated;
select lives_ok(
  $$select public.open_cash_session(100)$$,
  'manager can open the shared cash session'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000091', true);
set local role authenticated;

select is(
  (select count(*)::integer from public.sales),
  1,
  'cashier sees only their own sales'
);
select is(
  (select count(*)::integer from public.profiles),
  1,
  'cashier sees only their own profile'
);
select is(
  (select count(*)::integer from public.cash_sessions where closed_at is null),
  1,
  'cashier can see the shared open cash session'
);
select is(
  (select count(*)::integer from public.app_settings where key = 'ci-test-setting'),
  0,
  'cashier cannot read internal app settings'
);
select throws_ok(
  $$select count(*) from public.get_products_management()$$,
  'P0001',
  'No tenés permisos para consultar costos y rentabilidad.',
  'cashier cannot access internal product cost RPC'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000093', true);
set local role authenticated;
select is(
  (select count(*)::integer from public.sales),
  2,
  'manager can see all sales'
);
select is(
  (select count(*)::integer from public.profiles),
  3,
  'manager can see all staff profiles'
);
select lives_ok(
  $select count(*) from public.get_products_management()$,
  'manager can access the protected product management RPC'
);
select is(
  (select count(*)::integer from public.app_settings where key = 'ci-test-setting'),
  1,
  'manager can read internal app settings'
);
reset role;

select * from finish();
rollback;
