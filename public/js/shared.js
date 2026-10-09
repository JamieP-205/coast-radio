// Small helpers used by more than one part of the website.

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function formatHour(hour) {
  if (hour === 0 || hour === 24) return 'midnight';
  if (hour === 12) return '12 noon';
  return hour > 12 ? `${hour - 12}pm` : `${hour}am`;
}

// Choices remembered on this device. Some browsers block this, for example
// in private browsing, so the website carries on without it.

export function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The choice still applies until the page is closed.
  }
}

export function recall(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
