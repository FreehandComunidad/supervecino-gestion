-- Synthetic-only fixtures for GitHub Actions local Supabase tests.
insert into public.cryptic_guests (id, display_name, points)
values
  ('00000000-0000-4000-8000-000000000001', 'CI Guest One', 0),
  ('00000000-0000-4000-8000-000000000002', 'CI Guest Two', 0)
on conflict (id) do nothing;
