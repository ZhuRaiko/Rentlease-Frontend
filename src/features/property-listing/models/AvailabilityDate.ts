// Calendar dates are local calendar values, never UTC instants.
export function availabilityDateFromLocal(date: Date): string {
  if (!Number.isFinite(date.getTime()) || date.getFullYear() < 1 || date.getFullYear() > 9999) throw new Error('Invalid availability date');
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth()+1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function availabilityDateToLocal(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year,month,day]=value.split('-').map(Number) as [number,number,number];
  const date=new Date(2000,0,1,12); date.setFullYear(year,month-1,day);
  return year >= 1 && availabilityDateFromLocal(date) === value ? date : null;
}
export function availabilityDateLabel(value: string): string {
  const date=availabilityDateToLocal(value);
  return date ? new Intl.DateTimeFormat('en-PH',{month:'short',day:'numeric',year:'numeric'}).format(date) : 'Select date';
}
