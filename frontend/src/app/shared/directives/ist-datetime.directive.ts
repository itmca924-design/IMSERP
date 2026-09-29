import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';

@Directive({
  selector: '[appIstDatetime]',
  standalone: true
})
export class IstDatetimeDirective implements OnChanges {
  @Input('appIstDatetime') value: string | Date | null | undefined;
  @Input() format: 'datetime' | 'date' | 'time' | 'shortTime' | 'time24' | 'shortDatetime' = 'shortDatetime';
  @Input() prefix = '';
  @Input() suffix = '';
  @Input() timeZone = 'Asia/Kolkata';

  constructor(private el: ElementRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    this.render();
  }

  private render(): void {
    if (!this.value) {
      this.el.nativeElement.textContent = '';
      return;
    }

    let dateObj: Date;

    if (typeof this.value === 'string') {
      let normalizedStr = this.value.trim();
      // Ensure UTC ISO string parsing if missing 'Z' or offset suffix
      if (normalizedStr.includes('T') || normalizedStr.includes(' ')) {
        const hasTimezone = /[zZ]|[+-]\d{2}(?::?\d{2})?$/.test(normalizedStr);
        if (!hasTimezone) {
          normalizedStr = normalizedStr.replace(' ', 'T') + 'Z';
        }
      }
      dateObj = new Date(normalizedStr);
    } else if (this.value instanceof Date) {
      dateObj = this.value;
    } else {
      dateObj = new Date(this.value);
    }

    if (isNaN(dateObj.getTime())) {
      this.el.nativeElement.textContent = '';
      return;
    }

    const tz = this.timeZone || 'Asia/Kolkata';
    let formatted = '';

    if (this.format === 'date') {
      formatted = dateObj.toLocaleDateString('en-GB', {
        timeZone: tz,
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).replace('Sept', 'Sep');
    } else if (this.format === 'time' || this.format === 'shortTime') {
      formatted = dateObj.toLocaleTimeString('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } else if (this.format === 'time24') {
      formatted = dateObj.toLocaleTimeString('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } else if (this.format === 'datetime') {
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

      formatted = `${datePart}, ${timePart}`;
    } else {
      // 'shortDatetime' e.g. 29 Sep, 01:44 PM
      const datePart = dateObj.toLocaleDateString('en-GB', {
        timeZone: tz,
        day: '2-digit',
        month: 'short'
      }).replace('Sept', 'Sep');

      const timePart = dateObj.toLocaleTimeString('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      formatted = `${datePart}, ${timePart}`;
    }

    this.el.nativeElement.textContent = `${this.prefix}${formatted}${this.suffix}`;
  }
}
