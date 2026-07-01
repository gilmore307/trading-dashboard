export function formatPercent(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0%';
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function formatTimestamp(value?: string): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

export function startCase(value?: string | null): string {
  if (!value) return 'None';
  return value
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
