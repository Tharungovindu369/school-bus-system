import { config } from './config.js';

const TIMEZONE = 'Asia/Kolkata';

export function busNumberKey(bus) {
  if (bus == null || bus === '') return '';
  return String(bus).replace(/^bus\s*/i, '').trim();
}

export function formatBusNumber(bus) {
  const key = busNumberKey(bus);
  if (!key) return '';
  return `Bus ${key}`;
}

export function busesMatch(a, b) {
  return busNumberKey(a) === busNumberKey(b);
}

export function getISTDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(date);
}

export function formatISTTime(date = new Date()) {
  return date.toLocaleTimeString('en-IN', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function getISTMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function parseTimeToMinutes(timeStr) {
  const [h, m] = String(timeStr || '00:00').split(':').map(Number);
  return h * 60 + (m || 0);
}

export function getScanType(date = new Date()) {
  return 'boarding';
}

export function getDriverScanType(bus, date = new Date()) {
  const isReturn =
    bus?.journey_type === 'return' || bus?.current_status === 'return_running';
  if (isReturn) return 'dropoff';
  return 'boarding';
}

export function getTrackingLink(busNumber) {
  const key = busNumberKey(busNumber);
  const base = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${base}/track/${key}`;
}

export const FEE_ALERT_MESSAGE =
  '⚠️ Fee Not Paid — Please visit the administration at the main branch by end of the day. Otherwise transport services will be stopped.';

export function parseSheetDate(val) {
  if (!val) return '';
  const num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  return String(val);
}

export function parseSheetTime(val) {
  if (!val) return '';
  const num = Number(val);
  if (!isNaN(num) && num >= 0 && num < 1) {
    const totalMinutes = Math.round(num * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = String(minutes).padStart(2, '0');
    return `${String(displayHours).padStart(2, '0')}:${displayMinutes} ${ampm}`;
  }
  return String(val);
}
export function isFeeDue(student, currentDateStr = getISTDateString()) {
  if (!student.fee_paid_until) return true;
  return currentDateStr > student.fee_paid_until;
}
