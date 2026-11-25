begin;

select plan(16);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
 ('00000000-0000-4000-8000-000000000101','authenticated','authenticated','ci-cash-manager@supervecino.local','',now(),now(),now()),
 ('00000000-0000-4000-8000-000000000102','authenticated','authenticated','ci-cash-one@supervecino.local','',now(),now(),now()),
 ('00000000-0000-4000-8000-000000000103','authenticated','authenticated','ci-cash-two@supervecino.local','',now(),now(),now()),
 ('00000000-0000-4000-8000-000000000104','authenticated','authenticated','ci-cash-owner@supervecino.local','',now(),now(),now())
on conflict (id) do nothing;

insert into public.profiles(id,full_name,role,active)
values
 ('00000000-0000-4000-8000-000000000101','CI Cash Manager','manager',true),
 ('00000000-0000-4000-8000-000000000102','CI Cashier One','cashier',true),
 ('00000000-0000-4000-8000-000000000103','CI Cashier Two','cashier',true),
 ('00000000-0000-4000-8000-000000000104','CI Cash Owner','owner',true)
on conflict (id) do update set role=excluded.role,active=true;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
set local role authenticated;
select lives_ok('select public.open_cash_session(100)','manager opens the single shared shift cash session');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
set local role authenticated;
select lives_ok('select public.register_cash_movement(''in'',50,''CI shared cash income'')','cashier can record a validated cash income');
select is((select count(*)::integer from public.cash_sessions where closed_at is null),1,'cashier sees the open shared shift session');
select is((select count(*)::integer from public.cash_movements),1,'cashier sees movements in the shared open session');
select throws_ok(
 'insert into public.cash_movements(session_id,movement_type,amount,description,created_by) select id,''in'',1,''direct insert'',auth.uid() from public.cash_sessions where closed_at is null',
 '42501',
 'permission denied for table cash_movements',
 'cashier cannot bypass the cash movement RPC with direct INSERT'
);
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
set local role authenticated;
select lives_ok('select public.register_cash_movement(''out'',10,''CI shared cash expense'')','second cashier can record an expense in the shared session');
select is((select count(*)::integer from public.cash_movements),2,'both cashiers can see the movements while the shared session is open');
select throws_ok('select public.open_cash_session(0)','P0001','Ya existe una caja abierta','second cashier cannot create a second simultaneous session');
select throws_ok('select public.close_cash_session(140,null)','P0001','Solo quien abrió la caja o un encargado puede cerrarla','cashier cannot close another employee''s session');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
set local role authenticated;
select lives_ok('select public.close_cash_session(140,null)','manager can close the shared session');
select is((select expected_amount from public.cash_sessions where closed_at is not null),140::numeric,'close reconciles opening plus income minus expense');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
set local role authenticated;
select is((select count(*)::integer from public.cash_sessions),0,'cashier cannot see a closed session opened and closed by the manager');
select is((select count(*)::integer from public.cash_movements),1,'after close cashier sees only their own movement');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
set local role authenticated;
select is((select count(*)::integer from public.cash_movements),1,'second cashier sees only their own movement after close');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000104',true);
set local role authenticated;
select is((select count(*)::integer from public.cash_sessions),1,'owner can see the closed session');
select is((select count(*)::integer from public.cash_movements),2,'owner can audit all movements in the session');
reset role;

select * from finish();
rollback;
