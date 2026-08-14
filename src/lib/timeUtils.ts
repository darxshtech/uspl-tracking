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

/**
 * Calculates duration in decimal hours between two 12-hour or 24-hour time strings
 */
export function calculateHoursDifference(startTimeStr: string, endTimeStr: string): number {
  try {
    const parseTimeToMinutes = (timeStr: string): number => {
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
        return h * 60 + (m || 0);
      }
    };

    const startMin = parseTimeToMinutes(startTimeStr);
    const endMin = parseTimeToMinutes(endTimeStr);
    const diffMin = endMin >= startMin ? endMin - startMin : (24 * 60 - startMin + endMin);
    return Math.round((diffMin / 60) * 100) / 100;
  } catch (_) {
    return 0;
  }
}
