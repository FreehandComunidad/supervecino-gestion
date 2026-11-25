begin;

select plan(20);

select has_table('public', 'cryptic_guests', 'public leaderboard table exists');
select has_table('public', 'cryptic_attempts', 'private attempt table exists');
select has_table('public', 'cryptic_completions', 'private completion table exists');

select ok(
  not has_function_privilege('anon', 'public.record_cryptic_attempt(uuid,integer,boolean,integer)', 'EXECUTE'),
  'anonymous users cannot award cryptic points directly'
);
select ok(
  has_function_privilege('service_role', 'public.record_cryptic_attempt(uuid,integer,boolean,integer)', 'EXECUTE'),
  'only the server role can record cryptic attempts'
);
select ok(
  not has_function_privilege('anon', 'public.reset_cryptic_ranking()', 'EXECUTE'),
  'anonymous users cannot reset the ranking'
);
select ok(
  has_function_privilege('authenticated', 'public.reset_cryptic_ranking()', 'EXECUTE'),
  'authenticated sessions can call the owner-guarded reset function'
);
select ok(
  not has_column_privilege('authenticated', 'public.products', 'cost_price', 'SELECT'),
  'employees cannot read internal product cost directly'
);
select ok(
  has_column_privilege('authenticated', 'public.products', 'sale_price', 'SELECT'),
  'employees can read the sale price required by the POS'
);

select lives_ok(
  $$select public.record_cryptic_attempt('00000000-0000-4000-8000-000000000001', 1, false, 0)$$,
  'first incorrect answer is recorded'
);
select is(
  (select attempts_used from public.cryptic_attempts where guest_id = '00000000-0000-4000-8000-000000000001' and stage_number = 1),
  1,
  'first attempt count is one'
);
select lives_ok(
  $$select public.record_cryptic_attempt('00000000-0000-4000-8000-000000000001', 1, true, 0)$$,
  'correct answer completes the stage'
);
select is(
  (select points from public.cryptic_guests where id = '00000000-0000-4000-8000-000000000001'),
  90,
  'second-attempt completion awards ninety points'
);
select lives_ok(
  $$select public.record_cryptic_attempt('00000000-0000-4000-8000-000000000001', 1, true, 0)$$,
  'repeated correct submission is safely idempotent'
);
select is(
  (select points from public.cryptic_guests where id = '00000000-0000-4000-8000-000000000001'),
  90,
  'duplicate submission does not award points twice'
);

select lives_ok(
  $select public.record_cryptic_attempt('00000000-0000-4000-8000-000000000002', 2, false, 0)
    from generate_series(1, 5)$,
  'five incorrect attempts can be recorded'
);
select is(
  (select attempts_used from public.cryptic_attempts where guest_id = '00000000-0000-4000-8000-000000000002' and stage_number = 2),
  5,
  'server stores a maximum of five attempts'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '00000000-0000-4000-8000-000000000099',
  'authenticated',
  'authenticated',
  'ci-owner@supervecino.local',
  '',
  now(),
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role, active)
values ('00000000-0000-4000-8000-000000000099', 'CI Owner', 'owner', true)
on conflict (id) do update set role = 'owner', active = true;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000099', true);
select lives_ok(
  $$select public.reset_cryptic_ranking()$$,
  'authenticated owner can reset scores'
);
select is(
  (select count(*)::integer from public.cryptic_guests),
  2,
  'ranking reset preserves all participant rows'
);
select is(
  (select sum(points)::integer from public.cryptic_guests),
  0,
  'ranking reset returns all participant points to zero'
);

select * from finish();
rollback;
