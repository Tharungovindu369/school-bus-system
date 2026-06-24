const TIMEZONE = 'Asia/Kolkata';

export const SCHOOL_NAME = 'Prathibha Junior College';

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

export function todayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
}

export const FEE_ALERT_MESSAGE =
  '⚠️ Fee Not Paid — Please visit the administration at the main branch by end of the day. Otherwise transport services will be stopped.';

export function isFeeDue(student, currentDateStr = todayStr()) {
  if (!student.fee_paid_until) return true;
  return currentDateStr > student.fee_paid_until;
}

