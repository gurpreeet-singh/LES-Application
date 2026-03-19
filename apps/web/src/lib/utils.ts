export function getMasteryColor(pct: number) {
  if (pct === 0) return { bg: '#F3F4F6', txt: '#9CA3AF', dot: '#D1D5DB' };
  if (pct >= 80) return { bg: '#D4EDDA', txt: '#1E7E34', dot: '#28A745' };
  if (pct >= 60) return { bg: '#FEF3C7', txt: '#92400E', dot: '#F59E0B' };
  return { bg: '#FEE2E2', txt: '#991B1B', dot: '#EF4444' };
}

export function getMasteryLabel(pct: number) {
  if (pct === 0) return 'Locked';
  if (pct >= 80) return 'Mastered';
  if (pct >= 60) return 'In Progress';
  return 'At Risk';
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
