import axios from 'axios';
import { config } from '../config.js';
import { formatBusNumber, formatISTTime, getTrackingLink, getISTDateString } from '../utils.js';

function normalizePhone(phone) {
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 10) cleaned = '91' + cleaned;
  return cleaned;
}

async function sendMessage(phone, message) {
  if (process.env.NOTIFICATIONS_ENABLED === 'false') {
    return { success: true, method: 'disabled', message: 'Notifications disabled' };
  }

  if (!phone) {
    return { success: false, method: 'none', message: 'No WhatsApp number' };
  }

  if (config.watiApiKey && config.watiApiEndpoint) {
    try {
      const endpoint = config.watiApiEndpoint.replace(/\/$/, '');
      await axios.post(
        `${endpoint}/api/v1/sendSessionMessage/${phone}`,
        { messageText: message },
        {
          headers: {
            Authorization: `Bearer ${config.watiApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return { success: true, method: 'wati', message: 'Sent via WATI' };
    } catch (err) {
      console.error('WATI error:', err.response?.data || err.message);
      const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      return { success: false, method: 'wati_failed', waLink, message: err.message };
    }
  }

  const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  return { success: true, method: 'wa_me', waLink, message: 'WATI not configured — use wa.me link' };
}

export async function sendBoardingNotification({ parentWhatsapp, studentName, busNumber }) {
  const bus = formatBusNumber(busNumber);
  const time = formatISTTime();
  const trackingLink = getTrackingLink(busNumber);
  const message = `✅ ${studentName} has boarded ${bus} at ${time}
🔗 Track live: ${trackingLink}`;
  return sendMessage(normalizePhone(parentWhatsapp), message);
}

export async function sendCrossBusBoardingNotification({
  parentWhatsapp,
  studentName,
  actualBus,
  assignedBus,
}) {
  const actual = formatBusNumber(actualBus);
  const assigned = formatBusNumber(assignedBus);
  const time = formatISTTime();
  const trackingLink = getTrackingLink(actualBus);
  const message = `✅ ${studentName} has boarded ${actual} today (different from usual ${assigned})
Time: ${time}
🔗 Track live: ${trackingLink}`;
  return sendMessage(normalizePhone(parentWhatsapp), message);
}

export async function sendCrossBusReturnBoardingNotification({
  parentWhatsapp,
  studentName,
  actualBus,
  assignedBus,
}) {
  const actual = formatBusNumber(actualBus);
  const assigned = formatBusNumber(assignedBus);
  const time = formatISTTime();
  const trackingLink = getTrackingLink(actualBus);
  const message = `✅ ${studentName} has boarded ${actual} for return journey today (different from usual ${assigned})
Time: ${time}
🔗 Track live: ${trackingLink}`;
  return sendMessage(normalizePhone(parentWhatsapp), message);
}

export async function sendReturnBoardingNotification({ parentWhatsapp, studentName, busNumber }) {
  const bus = formatBusNumber(busNumber);
  const time = formatISTTime();
  const message = `✅ ${studentName} has boarded ${bus} for return journey at ${time}`;
  return sendMessage(normalizePhone(parentWhatsapp), message);
}

export async function sendDropoffNotification({ parentWhatsapp, studentName, busNumber, stopName }) {
  const bus = formatBusNumber(busNumber);
  const time = formatISTTime();
  const message = `📍 ${studentName} has been dropped off from ${bus}
Drop location: ${stopName}
Time: ${time}
✅ Your child has safely reached their stop.
— ${config.schoolName} Transport`;
  return sendMessage(normalizePhone(parentWhatsapp), message);
}

export async function sendBusStartedNotification({ parentWhatsapp, busNumber, driverName }) {
  const bus = formatBusNumber(busNumber);
  const time = formatISTTime();
  const trackingLink = getTrackingLink(busNumber);
  const message = `🚌 ${bus} has started its route.
Driver: ${driverName}
Start Time: ${time}
🔗 Track live: ${trackingLink}
— ${config.schoolName} Transport`;
  return sendMessage(normalizePhone(parentWhatsapp), message);
}

export async function sendReturnJourneyStartedNotification({ parentWhatsapp, busNumber, driverName }) {
  const bus = formatBusNumber(busNumber);
  const time = formatISTTime();
  const trackingLink = getTrackingLink(busNumber);
  const message = `🚌 ${bus} has started the return journey.
Driver: ${driverName}
Departure Time: ${time}
🔗 Track live: ${trackingLink}
Your child will reach their stop shortly.
— ${config.schoolName} Transport`;
  return sendMessage(normalizePhone(parentWhatsapp), message);
}

export async function sendMorningTripEndedNotification({ parentWhatsapp, busNumber, driverName }) {
  const bus = formatBusNumber(busNumber);
  const time = formatISTTime();
  const message = `🚌 ${bus} has completed its morning trip and reached the college.
Driver: ${driverName}
Arrival Time: ${time}
— ${config.schoolName} Transport`;
  return sendMessage(normalizePhone(parentWhatsapp), message);
}

export async function sendReturnJourneyEndedNotification({ parentWhatsapp, busNumber, driverName }) {
  const bus = formatBusNumber(busNumber);
  const time = formatISTTime();
  const message = `🚌 ${bus} has completed its return journey.
Driver: ${driverName}
Completion Time: ${time}
All students have reached their stops safely.
— ${config.schoolName} Transport`;
  return sendMessage(normalizePhone(parentWhatsapp), message);
}

export async function sendCollegeArrivalNotification({ parentWhatsapp, studentName, busNumber, withBus }) {
  const time = formatISTTime();
  const message = withBus
    ? `✅ ${studentName} has safely arrived at college.
Bus: ${formatBusNumber(busNumber)}
Arrival Time: ${time}
— ${config.schoolName}`
    : `✅ ${studentName} has safely arrived at college.
Arrival Time: ${time}
— ${config.schoolName}`;
  return sendMessage(normalizePhone(parentWhatsapp), message);
}

export async function sendAdminMissedScanAlert({ studentName, busNumber, driverName }) {
  const date = getISTDateString();
  const message = `🚨 DRIVER ALERT: ${studentName} from ${formatBusNumber(busNumber)} was NOT scanned by the driver today.
Driver: ${driverName}
Date: ${date}
Please investigate immediately.`;
  return sendMessage(normalizePhone(config.adminWhatsapp), message);
}

export async function sendWhatsAppNotification({
  parentWhatsapp,
  studentName,
  busNumber,
  stopName,
  scanType = 'boarding',
  scan_type,
}) {
  const actualScanType = scanType !== 'boarding' ? scanType : (scan_type || 'boarding');

  if (actualScanType === 'dropoff') {
    return sendDropoffNotification({ parentWhatsapp, studentName, busNumber, stopName });
  }
  if (actualScanType === 'return_boarding') {
    return sendReturnBoardingNotification({ parentWhatsapp, studentName, busNumber });
  }
  if (actualScanType === 'gate') {
    return sendCollegeArrivalNotification({ parentWhatsapp, studentName, busNumber, withBus: false });
  }
  return sendBoardingNotification({ parentWhatsapp, studentName, busNumber });
}
