export const EAT_TIMEZONE = 'Africa/Addis_Ababa';
export const DAY_MS = 24 * 60 * 60 * 1_000;
const EAT_OFFSET_MS = 3 * 60 * 60 * 1_000;

export function eatDayStart(value: Date): Date {
  const eat = new Date(value.getTime() + EAT_OFFSET_MS);
  return new Date(
    Date.UTC(eat.getUTCFullYear(), eat.getUTCMonth(), eat.getUTCDate()) - EAT_OFFSET_MS,
  );
}

export function addEatDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

export function eatDateKey(value: Date): string {
  return new Date(value.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10);
}
