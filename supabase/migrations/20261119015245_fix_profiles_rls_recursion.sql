drop policy if exists profiles_read_active_staff on public.profiles;
drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_authenticated on public.profiles
for select to authenticated using (true);
notify pgrst, 'reload schema';
