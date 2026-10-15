/**
 * ServeEase — Date & Time Utility for Asia/Kolkata Standard Time
 * 
 * Provides consistent timezone conversion and slot validation.
 * Standard operating slots: 09:00 AM to 07:00 PM.
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

  // Handle midnight 24 edge case
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
 * Parses standard slot string into 24-hour hour and minute
 * e.g. "09:00 AM - 10:00 AM" -> { startHour: 9, startMinute: 0, endHour: 10, endMinute: 0, startMinutes: 540 }
 * @param {string} slotStr 
 * @returns {object|null}
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
 * Checks whether a booking slot is strictly in the future
 * - If bookingDate is in the past: false
 * - If bookingDate is in the future: true (if slot valid)
 * - If bookingDate is today: slot start time must be STRICTLY in the future (startMinutes > currentMinutes)
 * 
 * @param {string} bookingDate - 'YYYY-MM-DD'
 * @param {string} slotStr - e.g. '09:00 AM - 10:00 AM' or '10:00 AM'
 * @param {object} [nowKolkata] - optional mocked Kolkata timestamp
 * @returns {{ isValid: boolean, reason?: string }}
 */
export const validateBookingSlot = (bookingDate, slotStr, nowKolkata = getKolkataNow()) => {
  if (!bookingDate || !/^\d{4}-\d{2}-\d{2}$/.test(bookingDate.trim())) {
    return { isValid: false, reason: 'Booking date must be in YYYY-MM-DD format.' };
  }

  const cleanDate = bookingDate.trim();
  if (cleanDate < nowKolkata.dateStr) {
    return { isValid: false, reason: 'Appointment date cannot be in the past. Please select today or a future date.' };
  }

  const parsed = parseSlotTimes(slotStr);
  if (!parsed) {
    return { isValid: false, reason: 'Invalid booking time format. Please select an authorized time slot.' };
  }

  if (cleanDate === nowKolkata.dateStr) {
    const currentTotalMinutes = nowKolkata.hour * 60 + nowKolkata.minute;
    // Slot must be strictly in the future (start time > current time)
    if (parsed.startMinutes <= currentTotalMinutes) {
      return {
        isValid: false,
        reason: 'Selected time slot has already started or ended. Please choose a future time slot.'
      };
    }
  }

  return { isValid: true };
};

/**
 * Filter slots available for a given date
 * @param {string} bookingDate 
 * @param {object} [nowKolkata] 
 * @returns {string[]}
 */
export const getAvailableSlotsForDate = (bookingDate, nowKolkata = getKolkataNow()) => {
  if (!bookingDate || bookingDate < nowKolkata.dateStr) return [];
  if (bookingDate > nowKolkata.dateStr) return [...STANDARD_TIME_SLOTS];

  const currentTotalMinutes = nowKolkata.hour * 60 + nowKolkata.minute;
  return STANDARD_TIME_SLOTS.filter(slot => {
    const parsed = parseSlotTimes(slot);
    return parsed && parsed.startMinutes > currentTotalMinutes;
  });
};
