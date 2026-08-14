/**
 * India Standard Time (IST) utility functions
 */

export function getCurrentISTDate(): string {
  // Returns 'YYYY-MM-DD' in Asia/Kolkata
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

export function getCurrentISTTime12(): string {
  // Returns 'hh:mm:ss A' in Asia/Kolkata (e.g. '09:30:15 AM')
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(new Date());
}

export function getCurrentISTTime24(): string {
  // Returns 'HH:mm' in Asia/Kolkata
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return formatter.format(new Date());
}

/**
 * Converts any 12h or 24h time string to minutes from midnight (0 - 1439)
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const is12Hour = /am|pm/i.test(timeStr);
  if (is12Hour) {
    const parts = timeStr.trim().split(/[:\s]/);
    let hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10) || 0;
    const meridian = (parts[parts.length - 1] || '').toUpperCase();

    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  } else {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }
}

/**
 * Calculates duration in decimal hours between two time strings.
 * Accurately handles cross-midnight overnight shifts (e.g. 08:00 AM -> 01:00 AM next day = 17.0 hrs).
 */
export function calculateHoursDifference(startTimeStr: string, endTimeStr: string, isOvernight: boolean = false): number {
  try {
    const startMin = timeStringToMinutes(startTimeStr);
    const endMin = timeStringToMinutes(endTimeStr);

    let diffMin = 0;
    if (isOvernight || endMin < startMin) {
      // Crossed midnight
      diffMin = (24 * 60 - startMin) + endMin;
    } else {
      diffMin = endMin - startMin;
    }

    return Math.round((diffMin / 60) * 100) / 100;
  } catch (_) {
    return 0;
  }
}

/**
 * Validates that a requested checkout time is not more than `maxMinutesAhead` (e.g. 30 min) in the future.
 * Returns true if valid, false if exceeds future limit.
 */
export function validateCheckoutTimeBuffer(
  requestedCheckoutTimeStr: string, 
  currentISTTimeStr: string = getCurrentISTTime12(), 
  maxMinutesAhead: number = 30,
  isOvernight: boolean = false
): boolean {
  if (isOvernight) return true; // Overnight shift from previous day is already past midnight

  const requestedMin = timeStringToMinutes(requestedCheckoutTimeStr);
  const currentMin = timeStringToMinutes(currentISTTimeStr);

  // If requested is in the future
  if (requestedMin > currentMin) {
    return (requestedMin - currentMin) <= maxMinutesAhead;
  }

  return true; // Past or current time is always allowed
}
