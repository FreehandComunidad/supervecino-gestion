-- Usuario sintético requerido por la migración histórica de inicialización OASIS.
-- Este archivo solo se copia al workspace efímero de GitHub Actions.
-- Nunca forma parte de supabase/migrations ni se ejecuta en producción.
begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '00000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'ci-oasis-bootstrap-owner@supervecino.local',
  '',
  now(),
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role, active)
values (
  '00000000-0000-4000-8000-000000000001',
  'CI OASIS Bootstrap Owner',
  'owner',
  true
)
on conflict (id) do update
set full_name = excluded.full_name, role = 'owner', active = true;

commit;
