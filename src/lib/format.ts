export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(timeStr: string): string {
  // timeStr is "HH:MM:SS" or "HH:MM"
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  return `${parts[0]}:${parts[1]}`;
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AGE_CATEGORIES = ['SMP', 'SMA', 'PRANIKAH'] as const;

export const VILLAGES = [
  'Pamulang',
  'Babakan',
  'Pondok Benda',
  'Sarua Barokah',
  'Bambu Apus',
  'Ciputat Barokah',
  'Pondok Cabe',
  'Jombang',
] as const;
