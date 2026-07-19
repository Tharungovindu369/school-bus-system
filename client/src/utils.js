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

export function getFeeStatusDetails(student, currentDateStr = todayStr()) {
  if ((student.fee_status || '').toUpperCase() === 'DUE') {
    return { status: 'EXPIRED', colorClass: 'bg-due text-white', label: 'Fee Expired' };
  }
  const paidUntil = student.fee_paid_until;
  if (!paidUntil || paidUntil.trim() === '') {
    return { status: 'PAID', colorClass: 'bg-paid text-white', label: 'Fee Paid' };
  }
  
  const today = new Date(currentDateStr);
  today.setHours(0,0,0,0);
  const expiry = new Date(paidUntil);
  expiry.setHours(0,0,0,0);
  
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { status: 'EXPIRED', colorClass: 'bg-due text-white', label: 'Fee Expired' };
  } else if (diffDays <= 3) {
    return { status: 'EXPIRING_SOON', colorClass: 'bg-amber-500 text-white', label: `Expiring Soon (${diffDays}d)` };
  }
  return { status: 'PAID', colorClass: 'bg-paid text-white', label: 'Fee Paid' };
}

