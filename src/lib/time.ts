import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';

export const TZ = 'America/New_York';

export function todayInTZ(): string {
  return formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
}

export function formatDateHeader(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return format(new Date(y, m - 1, d), 'EEE, MMM d yyyy');
}

export function formatTime(iso: string): string {
  return formatInTimeZone(iso, TZ, 'h:mm a');
}

export function shiftDay(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return format(dt, 'yyyy-MM-dd');
}

export function dayBoundsUtc(ymd: string): { startIso: string; endIso: string } {
  const startLocal = `${ymd} 00:00:00`;
  const endLocal = `${shiftDay(ymd, 1)} 00:00:00`;
  return {
    startIso: fromZonedTime(startLocal, TZ).toISOString(),
    endIso: fromZonedTime(endLocal, TZ).toISOString(),
  };
}

export function isoToLocalDate(iso: string): Date {
  return toZonedTime(iso, TZ);
}

export function nowIsoUtc(): string {
  return new Date().toISOString();
}

export function takenAtForDate(ymd: string): string {
  if (ymd === todayInTZ()) return nowIsoUtc();
  const hhmmss = formatInTimeZone(new Date(), TZ, 'HH:mm:ss');
  const local = `${ymd} ${hhmmss}`;
  return fromZonedTime(local, TZ).toISOString();
}

export function isoToHHmm(iso: string): string {
  return formatInTimeZone(iso, TZ, 'HH:mm');
}

export function isoToYmd(iso: string): string {
  return formatInTimeZone(iso, TZ, 'yyyy-MM-dd');
}

export function hhmmToIso(ymd: string, hhmm: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  const local = `${ymd} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  return fromZonedTime(local, TZ).toISOString();
}
