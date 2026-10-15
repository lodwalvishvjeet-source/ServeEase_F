/**
 * ServeEase — Client Date & Time Utility for Asia/Kolkata Standard Time
 * 
 * Provides consistent timezone conversion and slot validation for booking UI.
 */

export const STANDARD_TIME_SLOTS = [
  '09:00 AM - 10:00 AM',
  '10:00 AM - 11:00 AM',
  '11:00 AM - 12:00 PM',
  '12:00 PM - 01:00 PM',
  '02:00 PM - 03:00 PM',
  '03:00 PM - 04:00 PM',
  '04:00 PM - 05:00 PM',
  '05:00 PM - 06:00 PM',
  '06:00 PM - 07:00 PM'
];

/**
 * Returns current timestamp details in Asia/Kolkata timezone
 * @param {Date} date - Reference Date object (defaults to new Date())
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number, second: number, dateStr: string }}
 */
export const getKolkataNow = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  }).formatToParts(date);

  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = parseInt(p.value, 10);
  }

  const hour = map.hour === 24 ? 0 : map.hour;
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${map.year}-${pad(map.month)}-${pad(map.day)}`;

  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour,
    minute: map.minute,
    second: map.second,
    dateStr
  };
};

/**
 * Parse standard slot string
 * @param {string} slotStr 
 */
export const parseSlotTimes = (slotStr) => {
  if (!slotStr || typeof slotStr !== 'string') return null;
  const trimmed = slotStr.trim();

  // Range format: "09:00 AM - 10:00 AM"
  const rangeMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (rangeMatch) {
    let [, startH, startM, startP, endH, endM, endP] = rangeMatch;
    let sHour = parseInt(startH, 10);
    const sMin = parseInt(startM, 10);
    let eHour = parseInt(endH, 10);
    const eMin = parseInt(endM, 10);

    if (startP.toUpperCase() === 'PM' && sHour !== 12) sHour += 12;
    if (startP.toUpperCase() === 'AM' && sHour === 12) sHour = 0;

    if (endP.toUpperCase() === 'PM' && eHour !== 12) eHour += 12;
    if (endP.toUpperCase() === 'AM' && eHour === 12) eHour = 0;

    return {
      startHour: sHour,
      startMinute: sMin,
      endHour: eHour,
      endMinute: eMin,
      startMinutes: sHour * 60 + sMin,
      endMinutes: eHour * 60 + eMin
    };
  }

  // Single time format: "10:00 AM" or "10:00"
  const singleMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (singleMatch) {
    let [, startH, startM, period] = singleMatch;
    let sHour = parseInt(startH, 10);
    const sMin = parseInt(startM, 10);
    if (period) {
      if (period.toUpperCase() === 'PM' && sHour !== 12) sHour += 12;
      if (period.toUpperCase() === 'AM' && sHour === 12) sHour = 0;
    }
    const eHour = (sHour + 1) % 24;
    return {
      startHour: sHour,
      startMinute: sMin,
      endHour: eHour,
      endMinute: sMin,
      startMinutes: sHour * 60 + sMin,
      endMinutes: (sHour + 1) * 60 + sMin
    };
  }

  return null;
};

/**
 * Filter slots available for a given date in Asia/Kolkata
 * @param {string} bookingDate - 'YYYY-MM-DD'
 * @param {object} [nowKolkata] 
 * @returns {string[]}
 */
export const getAvailableSlotsForDate = (bookingDate, nowKolkata = getKolkataNow()) => {
  if (!bookingDate || bookingDate < nowKolkata.dateStr) return [];
  if (bookingDate > nowKolkata.dateStr) return [...STANDARD_TIME_SLOTS];

  const currentTotalMinutes = nowKolkata.hour * 60 + nowKolkata.minute;
  return STANDARD_TIME_SLOTS.filter(slot => {
    const parsed = parseSlotTimes(slot);
    // Start time must be strictly in the future
    return parsed && parsed.startMinutes > currentTotalMinutes;
  });
};
