import { describe, it, expect } from 'vitest';
import { parseSchedule, shouldDeliverOn, getNextDeliveryDate } from '../../src/utils/schedule-matcher.js';

describe('schedule-matcher', () => {
  describe('parseSchedule', () => {
    it('should parse weekly schedule', () => {
      const result = parseSchedule('weekly:monday');
      expect(result).toEqual({ type: 'weekly', dayOfWeek: 1 });
    });

    it('should parse biweekly schedule', () => {
      const result = parseSchedule('biweekly:friday');
      expect(result).toEqual({ type: 'biweekly', dayOfWeek: 5 });
    });

    it('should parse monthly schedule', () => {
      const result = parseSchedule('monthly:1,15');
      expect(result).toEqual({ type: 'monthly', daysOfMonth: [1, 15] });
    });

    it('should parse monthly schedule with multiple days', () => {
      const result = parseSchedule('monthly:1,11,21');
      expect(result).toEqual({ type: 'monthly', daysOfMonth: [1, 11, 21] });
    });

    it('should return null for invalid format', () => {
      expect(parseSchedule('invalid')).toBeNull();
      expect(parseSchedule('weekly')).toBeNull();
      expect(parseSchedule('weekly:invalidday')).toBeNull();
      expect(parseSchedule('monthly:abc')).toBeNull();
      expect(parseSchedule('')).toBeNull();
    });

    it('should be case insensitive', () => {
      expect(parseSchedule('WEEKLY:MONDAY')).toEqual({ type: 'weekly', dayOfWeek: 1 });
      expect(parseSchedule('Weekly:Tuesday')).toEqual({ type: 'weekly', dayOfWeek: 2 });
    });
  });

  describe('shouldDeliverOn', () => {
    it('should return true when no schedule is defined', () => {
      expect(shouldDeliverOn(undefined)).toBe(true);
    });

    it('should match weekly schedule on correct day', () => {
      // Monday: 2024-12-16
      const monday = new Date('2024-12-16T09:00:00');
      expect(shouldDeliverOn('weekly:monday', monday)).toBe(true);
      expect(shouldDeliverOn('weekly:tuesday', monday)).toBe(false);
    });

    it('should match monthly schedule on correct days', () => {
      const first = new Date('2024-12-01T09:00:00');
      const fifteenth = new Date('2024-12-15T09:00:00');
      const tenth = new Date('2024-12-10T09:00:00');

      expect(shouldDeliverOn('monthly:1,15', first)).toBe(true);
      expect(shouldDeliverOn('monthly:1,15', fifteenth)).toBe(true);
      expect(shouldDeliverOn('monthly:1,15', tenth)).toBe(false);
    });

    it('should handle biweekly schedule correctly', () => {
      const week1Monday = new Date('2024-12-02T09:00:00');
      const week2Monday = new Date('2024-12-09T09:00:00');
      const week3Monday = new Date('2024-12-16T09:00:00');

      // First delivery (no lastDeliveredAt) should deliver
      expect(shouldDeliverOn('biweekly:monday', week1Monday, undefined)).toBe(true);

      // After 1 week, should not deliver
      expect(shouldDeliverOn('biweekly:monday', week2Monday, week1Monday)).toBe(false);

      // After 2 weeks, should deliver
      expect(shouldDeliverOn('biweekly:monday', week3Monday, week1Monday)).toBe(true);
    });

    it('should return false for invalid schedule', () => {
      expect(shouldDeliverOn('invalid:format', new Date())).toBe(false);
    });
  });

  describe('getNextDeliveryDate', () => {
    it('should return current date when no schedule', () => {
      const now = new Date('2024-12-14T09:00:00');
      const result = getNextDeliveryDate(undefined, now);
      // Result should be same date (time normalized to midnight local)
      expect(result?.getDate()).toBe(now.getDate());
    });

    it('should find next Monday for weekly:monday', () => {
      // Saturday 2024-12-14
      const saturday = new Date('2024-12-14T09:00:00');
      const result = getNextDeliveryDate('weekly:monday', saturday);
      // Next Monday is 2024-12-16
      expect(result?.getDate()).toBe(16);
      expect(result?.getDay()).toBe(1); // Monday
    });

    it('should return same day if it matches schedule', () => {
      // Monday 2024-12-16
      const monday = new Date('2024-12-16T09:00:00');
      const result = getNextDeliveryDate('weekly:monday', monday);
      expect(result?.getDate()).toBe(16);
    });

    it('should find next monthly date', () => {
      const dec10 = new Date('2024-12-10T09:00:00');
      const result = getNextDeliveryDate('monthly:1,15', dec10);
      expect(result?.getDate()).toBe(15);
    });

    it('should return null for invalid schedule', () => {
      expect(getNextDeliveryDate('invalid', new Date())).toBeNull();
    });
  });
});
