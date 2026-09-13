import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'localDatetime',
  standalone: true
})
export class LocalDatetimePipe implements PipeTransform {
  transform(
    value: string | Date | null | undefined,
    format: 'datetime' | 'date' | 'time' | 'shortTime' | 'time24' | 'timeWithSeconds' = 'datetime',
    timeZone?: string
  ): string {
    if (!value) return '';

    let dateObj: Date;

    if (typeof value === 'string') {
      let normalizedStr = value.trim();
      // Ensure UTC ISO string parsing if missing 'Z' or offset suffix
      if (normalizedStr.includes('T') || normalizedStr.includes(' ')) {
        const hasTimezone = /[zZ]|[+-]\d{2}(?::?\d{2})?$/.test(normalizedStr);
        if (!hasTimezone) {
          normalizedStr = normalizedStr.replace(' ', 'T') + 'Z';
        }
      }
      dateObj = new Date(normalizedStr);
    } else if (value instanceof Date) {
      dateObj = value;
    } else {
      dateObj = new Date(value);
    }

    if (isNaN(dateObj.getTime())) return '';

    // Default to Indian Standard Time (IST - Asia/Kolkata)
    const tz = timeZone || 'Asia/Kolkata';

    if (format === 'date') {
      const dateStr = dateObj.toLocaleDateString('en-GB', {
        timeZone: tz,
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      return dateStr.replace('Sept', 'Sep');
    }

    if (format === 'time' || format === 'shortTime') {
      return dateObj.toLocaleTimeString('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }

    if (format === 'time24') {
      return dateObj.toLocaleTimeString('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }

    if (format === 'timeWithSeconds') {
      return dateObj.toLocaleTimeString('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    }

    // Default 'datetime' format: e.g. 04 Sep 2026, 09:00 AM
    const datePart = dateObj.toLocaleDateString('en-GB', {
      timeZone: tz,
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).replace('Sept', 'Sep');

    const timePart = dateObj.toLocaleTimeString('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    return `${datePart}, ${timePart}`;
  }
}
