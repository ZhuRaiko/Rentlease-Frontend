/** One peso formatter for the posting flow: the peso sign, thousands separators, and centavos only when the amount has them. */
export function formatPeso(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  const abs = Math.round(Math.abs(amount) * 100) / 100, whole = Number.isInteger(abs);
  return `${amount < 0 && abs > 0 ? '-' : ''}\u20b1${abs.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}
