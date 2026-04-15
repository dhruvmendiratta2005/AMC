export const BTS_TOWERS = [
  { id: 'north', name: 'BTS North', accent: '#38bdf8', glow: 'rgba(56, 189, 248, 0.45)' },
  { id: 'east', name: 'BTS East', accent: '#2dd4bf', glow: 'rgba(45, 212, 191, 0.45)' },
  { id: 'south', name: 'BTS South', accent: '#f97316', glow: 'rgba(249, 115, 22, 0.45)' },
  { id: 'west', name: 'BTS West', accent: '#f43f5e', glow: 'rgba(244, 63, 94, 0.45)' },
];

export function getTowerForUser(user) {
  const rawSeed = `${user?.phone_number || user?.id || 0}`.replace(/\D/g, '');
  const numericSeed = Number.parseInt(rawSeed.slice(-2), 10);
  const fallbackSeed = Number(user?.id || 0);
  const stableSeed = Number.isNaN(numericSeed) ? fallbackSeed : numericSeed;
  return BTS_TOWERS[stableSeed % BTS_TOWERS.length];
}

export function describeUserWithTower(user) {
  const tower = getTowerForUser(user);
  return {
    tower,
    label: `${user.username} (${user.phone_number})`,
  };
}
