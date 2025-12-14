import type { ScheduleConfig } from '../types/index.js';

/**
 * Day of week mapping (lowercase)
 */
const DAY_OF_WEEK_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Parse schedule configuration
 */
interface ParsedSchedule {
  type: 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek?: number; // 0-6 for weekly/biweekly
  daysOfMonth?: number[]; // 1-31 for monthly
}

/**
 * Parse a schedule string into a structured format
 */
export function parseSchedule(schedule: ScheduleConfig): ParsedSchedule | null {
  if (!schedule || typeof schedule !== 'string') {
    return null;
  }

  const parts = schedule.toLowerCase().split(':');
  if (parts.length !== 2) {
    return null;
  }

  const [type, value] = parts;

  if (type === 'weekly' || type === 'biweekly') {
    const dayOfWeek = DAY_OF_WEEK_MAP[value];
    if (dayOfWeek === undefined) {
      return null;
    }
    return { type, dayOfWeek };
  }

  if (type === 'monthly') {
    const days = value.split(',').map(d => parseInt(d.trim(), 10));
    if (days.some(d => isNaN(d) || d < 1 || d > 31)) {
      return null;
    }
    return { type: 'monthly', daysOfMonth: days };
  }

  return null;
}

/**
 * Check if a theme should be delivered on the given date
 * @param schedule - Schedule configuration string
 * @param targetDate - Date to check (defaults to today)
 * @param lastDeliveredAt - Last delivery date (for biweekly calculation)
 * @returns true if the theme should be delivered on the target date
 */
export function shouldDeliverOn(
  schedule: ScheduleConfig | undefined,
  targetDate: Date = new Date(),
  lastDeliveredAt?: Date
): boolean {
  // No schedule means always deliver
  if (!schedule) {
    return true;
  }

  const parsed = parseSchedule(schedule);
  if (!parsed) {
    console.warn(`[ScheduleMatcher] Invalid schedule format: ${schedule}`);
    return false;
  }

  const dayOfWeek = targetDate.getDay();
  const dayOfMonth = targetDate.getDate();

  switch (parsed.type) {
    case 'weekly':
      return dayOfWeek === parsed.dayOfWeek;

    case 'biweekly':
      if (dayOfWeek !== parsed.dayOfWeek) {
        return false;
      }
      // If no lastDeliveredAt, deliver on matching day
      if (!lastDeliveredAt) {
        return true;
      }
      // Calculate weeks since last delivery
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weeksSinceLastDelivery = Math.floor(
        (targetDate.getTime() - lastDeliveredAt.getTime()) / msPerWeek
      );
      // Deliver every 2 weeks
      return weeksSinceLastDelivery >= 2;

    case 'monthly':
      return parsed.daysOfMonth?.includes(dayOfMonth) ?? false;

    default:
      return false;
  }
}

/**
 * Get the next delivery date for a schedule
 * @param schedule - Schedule configuration string
 * @param fromDate - Start date to calculate from
 * @param lastDeliveredAt - Last delivery date (for biweekly)
 * @returns Next delivery date or null if schedule is invalid
 */
export function getNextDeliveryDate(
  schedule: ScheduleConfig | undefined,
  fromDate: Date = new Date(),
  lastDeliveredAt?: Date
): Date | null {
  if (!schedule) {
    return fromDate; // No schedule means immediate delivery
  }

  const parsed = parseSchedule(schedule);
  if (!parsed) {
    return null;
  }

  const result = new Date(fromDate);
  result.setHours(0, 0, 0, 0);

  // Look up to 62 days ahead (covers 2 months)
  for (let i = 0; i < 62; i++) {
    if (shouldDeliverOn(schedule, result, lastDeliveredAt)) {
      return result;
    }
    result.setDate(result.getDate() + 1);
  }

  return null;
}
