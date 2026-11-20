import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudentTimetableComponent } from '../students/student-timetable.component';

@Component({
  selector: 'app-coaching-timetable',
  standalone: true,
  imports: [CommonModule, StudentTimetableComponent],
  template: `
    <app-student-timetable [forcedScope]="'coaching'"></app-student-timetable>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachingTimetableComponent {}
