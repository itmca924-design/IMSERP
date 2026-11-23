import { Component, Inject, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TransportService, RouteLiveLocationDto, TransportRouteDto } from '../../core/services/transport.service';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';

export interface StudentTransitGpsDialogData {
  student: any;
}

@Component({
  selector: 'app-student-transit-gps-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
    IstDatetimeDirective
  ],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div class="transit-dialog-container">
      <!-- Standard Light-Blue Gradient Header -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>directions_bus</mat-icon>
          </div>
          <div class="header-text">
            <h2 class="dialog-title">Academic &amp; Live Transit 360</h2>
            <p class="dialog-subtitle">
              Allocation profile &bull; <strong>{{ student.studentName }}</strong> (Roll: {{ student.rollNumber || student.admissionNumber || 'N/A' }})
            </p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="close()" matTooltip="Close dialog">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Single Prominent Smooth Loader -->
      @if (loading) {
        <mat-progress-bar mode="indeterminate" class="dialog-loader"></mat-progress-bar>
      }

      <div class="dialog-body">
        <!-- 1. Student Identity Header Banner -->
        <div class="student-hero-banner">
          <div class="hero-avatar">
            @if (student.photoUrl) {
              <img [src]="student.photoUrl" alt="{{ student.studentName }}" class="avatar-img" />
            } @else {
              <div class="avatar-fallback">
                {{ student.studentName?.charAt(0) || 'S' }}
              </div>
            }
          </div>
          <div class="hero-info">
            <div class="hero-name-row">
              <h3 class="hero-name">{{ student.studentName }}</h3>
              <span class="gender-pill">{{ student.gender || 'Student' }}</span>
              @if (student.isTransportStudent) {
                <span class="transit-live-badge">
                  <span class="pulse-radar-dot"></span> Transit Enrolled
                </span>
              }
            </div>
            <div class="hero-meta-row">
              <span class="meta-tag">
                <mat-icon>school</mat-icon>
                <strong>{{ student.className || 'Class' }}</strong> - Sec {{ student.sectionName || 'A' }}
              </span>
              @if (student.admissionNumber) {
                <span class="meta-tag">
                  <mat-icon>badge</mat-icon>
                  Adm: <strong>{{ student.admissionNumber }}</strong>
                </span>
              }
              @if (student.parentName) {
                <span class="meta-tag">
                  <mat-icon>family_restroom</mat-icon>
                  Guardian: <strong>{{ student.parentName }}</strong>
                </span>
              }
            </div>
          </div>
        </div>

        <!-- 2. Academic & Class Teacher Info -->
        <div class="info-card academic-card">
          <div class="card-title-row">
            <div class="icon-tag blue-tag">
              <mat-icon>menu_book</mat-icon>
            </div>
            <h4>Academic Classroom Allocation</h4>
          </div>
          <div class="card-grid">
            <div class="grid-item">
              <span class="item-label">Assigned Class &amp; Section</span>
              <span class="item-value bold">{{ student.className || 'Class' }} &bull; Section {{ student.sectionName || 'A' }}</span>
            </div>
            <div class="grid-item">
              <span class="item-label">Class Teacher (CT)</span>
              <span class="item-value">
                {{ student.classTeacherName || 'Not Assigned' }}
                @if (student.classTeacherPhone) {
                  <a [href]="'tel:' + student.classTeacherPhone" class="phone-link" matTooltip="Call Class Teacher">
                    <mat-icon>call</mat-icon> {{ student.classTeacherPhone }}
                  </a>
                }
              </span>
            </div>
          </div>
        </div>

        <!-- 3. Transit Route, Vehicle & Driver Hub -->
        @if (student.isTransportStudent) {
          <div class="info-card transport-card">
            <div class="card-title-row">
              <div class="icon-tag amber-tag">
                <mat-icon>commute</mat-icon>
              </div>
              <h4>Assigned Bus Route &amp; Crew</h4>
              @if ((liveGps?.speed || 0) > 2) {
                <span class="motion-pill moving">
                  <mat-icon>speed</mat-icon> On Route (Moving)
                </span>
              } @else {
                <span class="motion-pill idle">
                  <mat-icon>pause_circle</mat-icon> Idle / Stationary
                </span>
              }
            </div>

            <div class="card-grid">
              <div class="grid-item full-width-item">
                <span class="item-label">Transit Route</span>
                <span class="item-value bold text-indigo">{{ student.transportRouteName || routeDetails?.routeName || 'Institutional Route' }}</span>
              </div>
              <div class="grid-item">
                <span class="item-label">Designated Boarding Stop</span>
                <span class="item-value bold text-amber">
                  <mat-icon class="mini-inline-icon">place</mat-icon>
                  {{ student.transportStopName || 'Campus Main Gate' }}
                </span>
              </div>
              <div class="grid-item">
                <span class="item-label">Monthly Fare Slab</span>
                <span class="item-value bold text-green">
                  ₹{{ student.monthlyTransportFare || routeDetails?.stops?.[0]?.monthlyFare || 0 }}/month
                </span>
              </div>
              <div class="grid-item">
                <span class="item-label">Assigned Vehicle</span>
                <span class="item-value bold">
                  {{ liveGps?.vehicleNumber || routeDetails?.vehicleNumber || 'School Bus' }}
                </span>
              </div>
              <div class="grid-item">
                <span class="item-label">Assigned Driver</span>
                <span class="item-value">
                  {{ liveGps?.driverName || routeDetails?.driverName || 'Designated Driver' }}
                  @if (routeDetails?.driverPhone) {
                    <a [href]="'tel:' + routeDetails?.driverPhone" class="phone-link" matTooltip="Call Driver">
                      <mat-icon>call</mat-icon> {{ routeDetails?.driverPhone }}
                    </a>
                  }
                </span>
              </div>
            </div>

            <!-- Live GPS Telemetry Strip -->
            <div class="gps-telemetry-strip">
              <div class="telemetry-item">
                <mat-icon class="pulse-icon">satellite_alt</mat-icon>
                <div>
                  <span class="tel-label">GPS Signal Status</span>
                  <span class="tel-val text-green">
                    {{ liveGps?.isLive ? 'Live Satellite Link' : 'Standby / Ready' }}
                  </span>
                </div>
              </div>
              <div class="telemetry-item">
                <mat-icon>speed</mat-icon>
                <div>
                  <span class="tel-label">Current Velocity</span>
                  <span class="tel-val">
                    {{ (liveGps?.speed || 0) | number:'1.0-1' }} km/h
                  </span>
                </div>
              </div>
              <div class="telemetry-item">
                <mat-icon>update</mat-icon>
                <div>
                  <span class="tel-label">Last Position Sync</span>
                  <span class="tel-val">
                    @if (liveGps?.updatedAtUtc) {
                      <span [appIstDatetime]="liveGps!.updatedAtUtc" format="shortTime"></span>
                    } @else if (liveGps?.updatedAtFormatted) {
                      {{ liveGps?.updatedAtFormatted }}
                    } @else {
                      Synced Today
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        } @else {
          <div class="not-enrolled-banner">
            <mat-icon>directions_walk</mat-icon>
            <div>
              <strong>Self Commuter / Not Enrolled in Transport</strong>
              <p>This student currently walks or uses private conveyance. To assign a bus route, use the student edit profile desk.</p>
            </div>
          </div>
        }

        <!-- 4. Hostel & Library Scope (if applicable) -->
        @if (student.isHostelStudent || student.isLibraryMember) {
          <div class="card-grid two-cards-grid">
            @if (student.isHostelStudent) {
              <div class="compact-amenity-card purple">
                <mat-icon>hotel</mat-icon>
                <div>
                  <strong>{{ student.hostelName || 'Hostel Campus' }}</strong>
                  <p>Room: {{ student.roomNumber || 'N/A' }} &bull; Bed: {{ student.bedCode || 'Allocated' }}</p>
                </div>
              </div>
            }
            @if (student.isLibraryMember) {
              <div class="compact-amenity-card teal">
                <mat-icon>local_library</mat-icon>
                <div>
                  <strong>{{ student.libraryMembershipType || 'Library Member' }}</strong>
                  <p>Book Quota: {{ student.maxLibraryBooks || 2 }} books &bull; Monthly: ₹{{ student.monthlyLibraryFee || 0 }}</p>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Action Footer -->
      <div class="dialog-actions">
        <button mat-button class="cancel-btn" (click)="close()">
          Close
        </button>
        @if (student.isTransportStudent) {
          <button mat-flat-button color="primary" class="radar-action-btn" (click)="goToFleetRadar()">
            <mat-icon>radar</mat-icon>
            <span>Open Fleet Radar &amp; Transit Map</span>
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    /* Google Material Entrance Animation */
    @keyframes materialPop {
      0% {
        opacity: 0;
        transform: scale(0.94) translateY(10px);
      }
      100% {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .transit-dialog-container {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      animation: materialPop 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* Strict Project Rule: Light-Blue Gradient Header */
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;

      .header-left {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .header-icon-box {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        background: #2563eb;
        color: #ffffff;
        border-radius: 10px;
        box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);

        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
        }
      }

      .dialog-title {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 700;
        color: #1e3a8a;
      }

      .dialog-subtitle {
        margin: 2px 0 0;
        font-size: 0.82rem;
        color: #3b82f6;

        strong {
          color: #1e40af;
        }
      }

      .close-btn {
        color: #64748b;
        transition: color 0.15s ease;

        &:hover {
          color: #1e293b;
        }
      }
    }

    .dialog-loader {
      height: 3px;
    }

    .dialog-body {
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
      -webkit-overflow-scrolling: touch;
    }

    /* Hero Banner */
    .student-hero-banner {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 14px 18px;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border: 1px solid #e2e8f0;
      border-radius: 12px;

      .hero-avatar {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        overflow: hidden;
        flex-shrink: 0;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);

        .avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .avatar-fallback {
          width: 100%;
          height: 100%;
          background: #2563eb;
          color: #ffffff;
          font-size: 1.5rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      }

      .hero-info {
        flex: 1;
        min-width: 0;
      }

      .hero-name-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 6px;

        .hero-name {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 700;
          color: #0f172a;
        }

        .gender-pill {
          font-size: 0.72rem;
          padding: 2px 8px;
          border-radius: 20px;
          background: #e2e8f0;
          color: #475569;
          font-weight: 600;
        }

        .transit-live-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 20px;
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;

          .pulse-radar-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #10b981;
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
            animation: radarPulse 1.8s infinite;
          }
        }
      }

      .hero-meta-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        font-size: 0.82rem;
        color: #475569;

        .meta-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;

          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
            color: #64748b;
          }

          strong {
            color: #0f172a;
          }
        }
      }
    }

    @keyframes radarPulse {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
      }
    }

    /* Cards */
    .info-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      background: #ffffff;

      .card-title-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
        padding-bottom: 10px;
        border-bottom: 1px solid #f1f5f9;

        h4 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 700;
          color: #1e293b;
          flex: 1;
        }

        .icon-tag {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
          }

          &.blue-tag {
            background: #eff6ff;
            color: #2563eb;
          }

          &.amber-tag {
            background: #fffbeb;
            color: #d97706;
          }
        }

        .motion-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;

          mat-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
          }

          &.moving {
            background: #ecfdf5;
            color: #059669;
          }

          &.idle {
            background: #f1f5f9;
            color: #64748b;
          }
        }
      }

      .card-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;

        @media (max-width: 600px) {
          grid-template-columns: 1fr;
        }

        .grid-item {
          display: flex;
          flex-direction: column;
          gap: 2px;

          &.full-width-item {
            grid-column: 1 / -1;
          }

          .item-label {
            font-size: 0.72rem;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            font-weight: 600;
          }

          .item-value {
            font-size: 0.88rem;
            color: #1e293b;

            &.bold {
              font-weight: 700;
            }

            &.text-indigo {
              color: #4338ca;
            }

            &.text-amber {
              color: #b45309;
            }

            &.text-green {
              color: #059669;
            }

            .mini-inline-icon {
              font-size: 15px;
              width: 15px;
              height: 15px;
              vertical-align: text-bottom;
            }
          }

          .phone-link {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            margin-left: 6px;
            font-size: 0.8rem;
            color: #2563eb;
            text-decoration: none;
            font-weight: 600;

            mat-icon {
              font-size: 13px;
              width: 13px;
              height: 13px;
            }

            &:hover {
              text-decoration: underline;
            }
          }
        }
      }
    }

    /* GPS Telemetry Strip */
    .gps-telemetry-strip {
      margin-top: 14px;
      padding: 12px 14px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 10px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
        gap: 8px;
      }

      .telemetry-item {
        display: flex;
        align-items: center;
        gap: 10px;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
          color: #3b82f6;

          &.pulse-icon {
            color: #10b981;
          }
        }

        .tel-label {
          display: block;
          font-size: 0.68rem;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 600;
        }

        .tel-val {
          display: block;
          font-size: 0.85rem;
          font-weight: 700;
          color: #0f172a;

          &.text-green {
            color: #059669;
          }
        }
      }
    }

    .not-enrolled-banner {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px;
      border-radius: 10px;
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #e2e8f0;

      mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
        color: #94a3b8;
      }

      strong {
        display: block;
        color: #1e293b;
        font-size: 0.9rem;
      }

      p {
        margin: 2px 0 0;
        font-size: 0.78rem;
        color: #64748b;
      }
    }

    .two-cards-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }

      .compact-amenity-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        border-radius: 10px;

        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
        }

        strong {
          display: block;
          font-size: 0.85rem;
        }

        p {
          margin: 2px 0 0;
          font-size: 0.75rem;
          color: #64748b;
        }

        &.purple {
          background: #faf5ff;
          border: 1px solid #f3e8ff;
          mat-icon { color: #9333ea; }
          strong { color: #6b21a8; }
        }

        &.teal {
          background: #f0fdfa;
          border: 1px solid #ccfbf1;
          mat-icon { color: #0d9488; }
          strong { color: #0f766e; }
        }
      }
    }

    /* Actions Footer */
    .dialog-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;

      .radar-action-btn {
        background: #2563eb;
        color: #ffffff;
        font-weight: 600;
        border-radius: 8px;
        padding: 0 18px;

        mat-icon {
          margin-right: 6px;
        }

        &:hover {
          background: #1d4ed8;
        }
      }
    }
  `]
})
export class StudentTransitGpsDialogComponent implements OnInit {
  student: any;
  liveGps?: RouteLiveLocationDto;
  routeDetails?: TransportRouteDto;
  loading: boolean = false;

  private router = inject(Router);

  constructor(
    public dialogRef: MatDialogRef<StudentTransitGpsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: StudentTransitGpsDialogData,
    private transportService: TransportService
  ) {
    this.student = data.student || {};
  }

  ngOnInit(): void {
    if (this.student.isTransportStudent && this.student.transportRouteId) {
      this.fetchRouteTelemetry();
    }
  }

  fetchRouteTelemetry(): void {
    this.loading = true;
    const routeId = this.student.transportRouteId;
    this.transportService.getRouteLiveLocation(routeId).subscribe({
      next: (telemetry) => {
        this.liveGps = telemetry;
        this.loading = false;
      },
      error: () => {
        // Fallback to route details
        this.transportService.getRoute(routeId).subscribe({
          next: (r) => {
            this.routeDetails = r;
            this.loading = false;
          },
          error: () => {
            this.loading = false;
          }
        });
      }
    });
  }

  goToFleetRadar(): void {
    this.dialogRef.close();
    this.router.navigate(['/transport']);
  }

  close(): void {
    this.dialogRef.close();
  }
}
