// Retratos de perfil para el equipo OASIS HQ.
export const oasisAvatars: Record<string, string> = {
  atlas: 'https://randomuser.me/api/portraits/men/32.jpg',
  vera: 'https://randomuser.me/api/portraits/women/44.jpg',
  bruno: 'https://randomuser.me/api/portraits/men/46.jpg',
  mia: 'https://randomuser.me/api/portraits/women/68.jpg',
  gael: 'https://randomuser.me/api/portraits/men/52.jpg',
  alma: 'https://randomuser.me/api/portraits/women/32.jpg',
  luca: 'https://randomuser.me/api/portraits/men/75.jpg',
  noa: 'https://randomuser.me/api/portraits/women/79.jpg',
  elias: 'https://randomuser.me/api/portraits/men/22.jpg',
};
export function oasisAvatarKey(slug: string, name: string) {
  const key = (slug || name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
  return oasisAvatars[key] ? key : 'atlas';
}
