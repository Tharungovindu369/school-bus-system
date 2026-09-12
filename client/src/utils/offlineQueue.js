/**
 * Offline scan queue utilities using localStorage for resilience
 * during cellular dead zones on bus routes.
 */

const DRIVER_QUEUE_KEY = 'schoolbus_offline_scans';
const RECEPTION_QUEUE_KEY = 'schoolbus_reception_offline_scans';

export function getOfflineQueue(key = DRIVER_QUEUE_KEY) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to read offline queue:', err);
    return [];
  }
}

export function saveOfflineQueue(queue, key = DRIVER_QUEUE_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(queue));
  } catch (err) {
    console.error('Failed to persist offline queue:', err);
  }
}

export function enqueueOfflineScan(scanPayload, key = DRIVER_QUEUE_KEY) {
  const queue = getOfflineQueue(key);
  // Avoid duplicate queueing of same student within the offline buffer
  const exists = queue.some(item => item.student_id === scanPayload.student_id);
  if (!exists) {
    queue.push({
      ...scanPayload,
      queuedAt: new Date().toISOString(),
      id: `${scanPayload.student_id}_${Date.now()}`
    });
    saveOfflineQueue(queue, key);
  }
  return queue.length;
}

export function removeOfflineScan(id, key = DRIVER_QUEUE_KEY) {
  const queue = getOfflineQueue(key).filter(item => item.id !== id);
  saveOfflineQueue(queue, key);
  return queue.length;
}

export function clearOfflineQueue(key = DRIVER_QUEUE_KEY) {
  try {
    localStorage.removeItem(key);
  } catch (_) {}
}
