-- PASO PREVIO: crear el usuario desde Supabase Dashboard > Authentication > Users.
-- Reemplazar el correo por el correo exacto del usuario propietario y ejecutar este SQL.
-- No se crea ni modifica ninguna contraseña aquí.
insert into public.profiles (id, full_name, role, active)
select id, 'Propietario SÚPERVECINO', 'owner', true
from auth.users
where email = 'REEMPLAZAR_POR_TU_CORREO'
on conflict (id) do update
set full_name = excluded.full_name,
    role = 'owner',
    active = true;
