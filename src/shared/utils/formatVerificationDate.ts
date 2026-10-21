// Display only: Supabase timestamptz values remain UTC instants in data/state.
// Explicit timezone/clock prevents emulator or travel settings changing Philippine verification times.
const formatter = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  year: 'numeric', month: 'short', day: 'numeric',
  hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
});

export function formatVerificationDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return `${formatter.format(date)} PHT`;
}
