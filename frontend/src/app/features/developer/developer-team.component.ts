import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-developer-team',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule
  ],
  template: `
    <div class="page-container">
      <!-- Top Banner Header (Page Matching White Card Theme) -->
      <div class="header-banner mat-elevation-z1">
        <div class="banner-header-left">
          <div class="banner-icon-box">
            <mat-icon>engineering</mat-icon>
          </div>
          <div class="banner-content">
            <div class="banner-badge">
              <span class="pulse-indicator"></span>
              <span>Core Engineering &amp; Platform Support</span>
            </div>
            <h1 class="banner-title">Developer &amp; Technical Architecture Team</h1>
            <p class="banner-desc">
              The core engineering team behind IMSERP — powering multi-tenant academic, finance, and campus operations across India.
            </p>
          </div>
        </div>
        <div class="banner-stats">
          <div class="stat-pill">
            <mat-icon class="stat-icon">verified</mat-icon>
            <div class="stat-meta">
              <span class="stat-val">99.98%</span>
              <span class="stat-lbl">Uptime SLA</span>
            </div>
          </div>
          <div class="stat-pill">
            <mat-icon class="stat-icon">support_agent</mat-icon>
            <div class="stat-meta">
              <span class="stat-val">&lt; 15 Min</span>
              <span class="stat-lbl">Response SLA</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Developer Profile Card -->
      <mat-card class="developer-hero-card mat-elevation-z3">
        <div class="hero-layout">
          <!-- Left: Developer Avatar with Status Halo -->
          <div class="avatar-column">
            <div class="avatar-frame">
              <img
                src="assets/images/developer-profile.jpg"
                alt="Lead Developer Photo"
                class="developer-img"
                (error)="onImgError($event)" />
              <div class="online-tag" matTooltip="Available for Technical Support">
                <span class="live-dot"></span>
                <span>Active</span>
              </div>
            </div>
            <div class="verified-developer-badge">
              <mat-icon class="badge-icon">workspace_premium</mat-icon>
              <span>Lead System Architect</span>
            </div>
          </div>

          <!-- Right: Bio, Credentials & Direct Contacts -->
          <div class="bio-column">
            <div class="title-row">
              <div>
                <h2 class="dev-name">Core Developer &amp; Technical Architect</h2>
                <p class="dev-role">Chief Platform Engineer &bull; Enterprise Education ERP Systems</p>
              </div>
              <div class="tech-rating-box">
                <div class="stars">
                  <mat-icon class="star">star</mat-icon>
                  <mat-icon class="star">star</mat-icon>
                  <mat-icon class="star">star</mat-icon>
                  <mat-icon class="star">star</mat-icon>
                  <mat-icon class="star">star</mat-icon>
                </div>
                <span class="rating-text">Tier-1 Enterprise Support</span>
              </div>
            </div>

            <p class="dev-about">
              Dedicated full-stack system architect with deep expertise in <strong>.NET Core, Angular Material, High-Availability MS SQL Server</strong>, and enterprise multi-branch educational infrastructures. Architected the complete end-to-end <strong>Dual-Tier Multi-Tenant isolation</strong>, automated fee sequencers, biometric IoT bridges, and roll number auto-sequencers for schools and coaching institutes.
            </p>

            <!-- Contact & Location Deck -->
            <div class="contact-deck">
              <!-- Mobile Phone Card -->
              <div class="contact-unit">
                <div class="unit-icon-box phone-box">
                  <mat-icon>call</mat-icon>
                </div>
                <div class="unit-info">
                  <span class="unit-label">Mobile &amp; Support Hotline</span>
                  <a href="tel:+918088377282" class="unit-val primary-link" matTooltip="Click to Call">
                    +91 80883 77282
                  </a>
                  <span class="unit-sub">Direct Voice &bull; Mon &ndash; Sat: 9 AM &ndash; 8 PM IST</span>
                </div>
                <button mat-icon-button color="primary" (click)="copyToClipboard('8088377282', 'Phone Number')" matTooltip="Copy Phone Number">
                  <mat-icon>content_copy</mat-icon>
                </button>
              </div>

              <!-- WhatsApp Direct Card -->
              <div class="contact-unit">
                <div class="unit-icon-box whatsapp-box">
                  <mat-icon>chat</mat-icon>
                </div>
                <div class="unit-info">
                  <span class="unit-label">Instant WhatsApp Desk</span>
                  <a href="https://wa.me/919540553975?text=Hello%20Developer%2C%20I%20need%20support%20with%20IMSERP" target="_blank" rel="noopener noreferrer" class="unit-val whatsapp-link" matTooltip="Open WhatsApp Chat">
                    +91 95405 53975
                  </a>
                  <span class="unit-sub">Instant Messaging &bull; Priority Ticketing</span>
                </div>
                <a mat-icon-button color="accent" href="https://wa.me/919540553975?text=Hello%20Developer%2C%20I%20need%20support%20with%20IMSERP" target="_blank" rel="noopener noreferrer" matTooltip="Chat on WhatsApp">
                  <mat-icon>open_in_new</mat-icon>
                </a>
              </div>

              <!-- Official Address Card -->
              <div class="contact-unit address-unit">
                <div class="unit-icon-box location-box">
                  <mat-icon>location_on</mat-icon>
                </div>
                <div class="unit-info">
                  <span class="unit-label">Office &amp; Engineering Hub Address</span>
                  <strong class="unit-val address-text">
                    JP Nagar, Bangalore, Karnataka, India &bull; PIN: 560078
                  </strong>
                  <span class="unit-sub">Tech Development Operations &amp; Cloud Infrastructure Center</span>
                </div>
                <button mat-icon-button color="primary" (click)="copyToClipboard('JP Nagar, Bangalore, Karnataka - 560078', 'Address')" matTooltip="Copy Full Address">
                  <mat-icon>content_copy</mat-icon>
                </button>
              </div>
            </div>

            <!-- Quick Action Buttons -->
            <div class="cta-row">
              <a mat-raised-button color="primary" href="tel:+918088377282" class="cta-btn primary-btn">
                <mat-icon>call</mat-icon>
                <span>Call Developer</span>
              </a>

              <a mat-raised-button class="cta-btn whatsapp-btn" href="https://wa.me/919540553975?text=Hello%20Developer%2C%20I%20need%20support%20with%20IMSERP" target="_blank" rel="noopener noreferrer">
                <mat-icon>chat</mat-icon>
                <span>Chat on WhatsApp</span>
              </a>

              <button mat-stroked-button color="primary" class="cta-btn copy-all-btn" (click)="copyAllDetails()">
                <mat-icon>assignment</mat-icon>
                <span>Copy Full Contact Card</span>
              </button>
            </div>
          </div>
        </div>
      </mat-card>

      <!-- Technical Architecture & Competencies Grid -->
      <div class="competencies-grid">
        <!-- Card 1: Core Technologies -->
        <mat-card class="info-card mat-elevation-z2">
          <div class="card-head">
            <div class="card-head-icon blue">
              <mat-icon>memory</mat-icon>
            </div>
            <div>
              <h3 class="card-title">Core Architecture &amp; Stack</h3>
              <p class="card-sub">Engineering framework powering IMSERP</p>
            </div>
          </div>
          <div class="chip-container">
            <span class="tech-chip">.NET 10 Kestrel WebAPI</span>
            <span class="tech-chip">Angular 18+ Material</span>
            <span class="tech-chip">MS SQL Server HA</span>
            <span class="tech-chip">Entity Framework Core</span>
            <span class="tech-chip">Multi-Tenant Isolation</span>
            <span class="tech-chip">Biometric IoT Engine</span>
            <span class="tech-chip">Dynamic Token Engine</span>
            <span class="tech-chip">Zero Hardcoding Standard</span>
          </div>
        </mat-card>

        <!-- Card 2: Support Commitments -->
        <mat-card class="info-card mat-elevation-z2">
          <div class="card-head">
            <div class="card-head-icon green">
              <mat-icon>shield</mat-icon>
            </div>
            <div>
              <h3 class="card-title">Enterprise Support Commitments</h3>
              <p class="card-sub">Guaranteed response &amp; resolution SLAs</p>
            </div>
          </div>
          <ul class="feature-list">
            <li>
              <mat-icon class="list-bullet">check_circle</mat-icon>
              <span><strong>15-Minute Emergency Response</strong> for critical billing, admissions, or test hall issues.</span>
            </li>
            <li>
              <mat-icon class="list-bullet">check_circle</mat-icon>
              <span><strong>Remote Desktop Assistance</strong> via AnyDesk / TeamViewer for instant resolution.</span>
            </li>
            <li>
              <mat-icon class="list-bullet">check_circle</mat-icon>
              <span><strong>Custom Feature Rollouts</strong> tailored directly to campus &amp; coaching requirements.</span>
            </li>
            <li>
              <mat-icon class="list-bullet">check_circle</mat-icon>
              <span><strong>Automated Encrypted Backups</strong> and database maintenance monitoring.</span>
            </li>
          </ul>
        </mat-card>

        <!-- Card 3: Location & Timezone Details -->
        <mat-card class="info-card mat-elevation-z2">
          <div class="card-head">
            <div class="card-head-icon purple">
              <mat-icon>business</mat-icon>
            </div>
            <div>
              <h3 class="card-title">Bangalore Tech Hub</h3>
              <p class="card-sub">Operations &amp; Research Center</p>
            </div>
          </div>
          <div class="location-summary">
            <div class="loc-row">
              <mat-icon class="loc-ico">place</mat-icon>
              <div>
                <strong>JP Nagar, Bangalore</strong>
                <p>Karnataka, India &bull; PIN Code: 560078</p>
              </div>
            </div>
            <div class="loc-row">
              <mat-icon class="loc-ico">schedule</mat-icon>
              <div>
                <strong>Operating Timezone</strong>
                <p>Indian Standard Time (IST - Asia/Kolkata, UTC +05:30)</p>
              </div>
            </div>
            <div class="loc-row">
              <mat-icon class="loc-ico">security</mat-icon>
              <div>
                <strong>Data Sovereignty</strong>
                <p>100% On-Premises &amp; Local Host Compliant (No Docker)</p>
              </div>
            </div>
          </div>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .page-container {
      padding: 0 0 40px;
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 24px;
      font-family: inherit;
    }

    /* Top Banner Header (Page Matching White Card Theme) */
    .header-banner {
      background: #ffffff;
      color: #0f172a;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 24px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      flex-wrap: wrap;
      box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.05);
    }

    .banner-header-left {
      display: flex;
      align-items: center;
      gap: 18px;
      max-width: 720px;
    }

    .banner-icon-box {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 8px -1px rgba(37, 99, 235, 0.28);
      flex-shrink: 0;

      mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }
    }

    .banner-content {
      flex: 1;
      min-width: 0;
    }

    .banner-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .pulse-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #16a34a;
      box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7);
      animation: pulseGreen 2s infinite;
    }

    @keyframes pulseGreen {
      0% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7); }
      70% { box-shadow: 0 0 0 8px rgba(22, 163, 74, 0); }
      100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }
    }

    .banner-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin: 0 0 4px;
      line-height: 1.3;
      color: #0f172a;
    }

    .banner-desc {
      font-size: 0.92rem;
      color: #64748b;
      margin: 0;
      line-height: 1.5;
    }

    .banner-stats {
      display: flex;
      gap: 14px;
    }

    .stat-pill {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 18px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
      transition: all 0.2s ease;

      &:hover {
        background: #eff6ff;
        border-color: #bfdbfe;
      }
    }

    .stat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: #2563eb;
    }

    .stat-meta {
      display: flex;
      flex-direction: column;
    }

    .stat-val {
      font-size: 1.2rem;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.1;
    }

    .stat-lbl {
      font-size: 0.75rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }

    /* Main Developer Hero Card */
    .developer-hero-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      padding: 32px;
      overflow: hidden;
      box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.05);
    }

    .hero-layout {
      display: flex;
      gap: 36px;
      align-items: flex-start;
    }

    /* Avatar Column */
    .avatar-column {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      flex-shrink: 0;
    }

    .avatar-frame {
      position: relative;
      width: 170px;
      height: 170px;
      border-radius: 20px;
      padding: 6px;
      background: linear-gradient(135deg, #2563eb, #60a5fa, #3b82f6);
      box-shadow: 0 10px 25px -4px rgba(37, 99, 235, 0.35);
    }

    .developer-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 16px;
      background: #f1f5f9;
      display: block;
    }

    .online-tag {
      position: absolute;
      bottom: -6px;
      right: -6px;
      background: #16a34a;
      color: #ffffff;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 20px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
      border: 2px solid #ffffff;
    }

    .live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #ffffff;
    }

    .verified-developer-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 700;
    }

    .badge-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #2563eb;
    }

    /* Bio Column */
    .bio-column {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 18px;
      min-width: 0;
    }

    .title-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .dev-name {
      font-size: 1.25rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
      line-height: 1.3;
    }

    .dev-role {
      font-size: 0.95rem;
      color: #2563eb;
      font-weight: 600;
      margin: 4px 0 0;
    }

    .tech-rating-box {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .stars {
      display: flex;
      gap: 2px;
      color: #f59e0b;
    }

    .star {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .rating-text {
      font-size: 0.72rem;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }

    .dev-about {
      font-size: 0.94rem;
      color: #334155;
      line-height: 1.6;
      margin: 0;
      background: #f8fafc;
      padding: 14px 18px;
      border-radius: 12px;
      border-left: 4px solid #2563eb;
    }

    /* Contact Deck Units */
    .contact-deck {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .contact-unit {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 14px;
      transition: all 0.2s ease-in-out;
    }

    .contact-unit:hover {
      background: #ffffff;
      border-color: #93c5fd;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
      transform: translateY(-1px);
    }

    .address-unit {
      grid-column: span 2;
    }

    .unit-icon-box {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: #ffffff;
    }

    .phone-box {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    }

    .whatsapp-box {
      background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
    }

    .location-box {
      background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    }

    .unit-info {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }

    .unit-label {
      font-size: 0.74rem;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .unit-val {
      font-size: 1.05rem;
      font-weight: 700;
      margin: 2px 0;
      text-decoration: none;
      word-break: break-word;
    }

    .primary-link {
      color: #1e40af;
      transition: color 0.2s;
    }
    .primary-link:hover {
      color: #2563eb;
      text-decoration: underline;
    }

    .whatsapp-link {
      color: #15803d;
      transition: color 0.2s;
    }
    .whatsapp-link:hover {
      color: #16a34a;
      text-decoration: underline;
    }

    .address-text {
      color: #0f172a;
      font-size: 0.95rem;
    }

    .unit-sub {
      font-size: 0.74rem;
      color: #94a3b8;
    }

    /* CTA Action Buttons */
    .cta-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 4px;
    }

    .cta-btn {
      font-weight: 700;
      padding: 10px 22px;
      border-radius: 10px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
    }

    .primary-btn {
      background: #2563eb !important;
      color: #ffffff !important;
    }

    .whatsapp-btn {
      background: #16a34a !important;
      color: #ffffff !important;
    }

    .whatsapp-btn:hover {
      background: #15803d !important;
    }

    .copy-all-btn {
      color: #1e3a8a;
      border-color: #bfdbfe;
    }
    .copy-all-btn:hover {
      background: #eff6ff;
    }

    /* Competencies & Support Grid */
    .competencies-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 20px;
    }

    .info-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 24px;
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .card-head {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .card-head-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: #ffffff;
    }

    .card-head-icon.blue {
      background: #2563eb;
    }
    .card-head-icon.green {
      background: #16a34a;
    }
    .card-head-icon.purple {
      background: #7c3aed;
    }

    .card-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
      line-height: 1.25;
    }

    .card-sub {
      font-size: 0.78rem;
      color: #64748b;
      margin: 2px 0 0;
    }

    .chip-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .tech-chip {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .feature-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .feature-list li {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.86rem;
      color: #334155;
      line-height: 1.45;
    }

    .list-bullet {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #16a34a;
      margin-top: 2px;
      flex-shrink: 0;
    }

    .location-summary {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .loc-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      font-size: 0.86rem;
    }

    .loc-ico {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #7c3aed;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .loc-row strong {
      color: #0f172a;
      display: block;
    }

    .loc-row p {
      margin: 2px 0 0;
      color: #64748b;
    }

    /* 100% RESPONSIVE DESIGN */
    @media (max-width: 1024px) {
      .hero-layout {
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
      .title-row {
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
      .tech-rating-box {
        align-items: center;
      }
      .contact-deck {
        grid-template-columns: 1fr;
      }
      .address-unit {
        grid-column: span 1;
      }
      .cta-row {
        justify-content: center;
      }
    }

    @media (max-width: 640px) {
      .header-banner {
        padding: 20px 16px;
        border-radius: 12px;
      }
      .banner-header-left {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }
      .banner-title {
        font-size: 1.15rem;
      }
      .banner-stats {
        width: 100%;
        flex-direction: column;
      }
      .developer-hero-card {
        padding: 20px 16px;
      }
      .avatar-frame {
        width: 140px;
        height: 140px;
      }
      .dev-name {
        font-size: 1.15rem;
      }
      .cta-btn {
        width: 100%;
        justify-content: center;
      }
      .contact-unit {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `]
})
export class DeveloperTeamComponent {
  constructor(private confirmDialog: ConfirmDialogService) {}

  onImgError(event: any): void {
    // Fallback if image path has issue
    event.target.src = 'assets/images/developer-profile.jpg';
  }

  copyToClipboard(text: string, label: string): void {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.confirmDialog.alert('Copied to Clipboard', `${label} (${text}) has been copied!`, 'success');
      });
    } else {
      this.confirmDialog.alert('Contact Details', `${label}: ${text}`, 'info');
    }
  }

  copyAllDetails(): void {
    const fullText = `IMSERP Core Developer Details:\n` +
      `Mobile / Voice Hotline: +91 80883 77282\n` +
      `WhatsApp Support: +91 95405 53975 (https://wa.me/919540553975)\n` +
      `Location: JP Nagar, Bangalore, Karnataka, India - PIN 560078\n` +
      `Role: Lead Technical Architect & Core Full-Stack Systems Engineer`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullText).then(() => {
        this.confirmDialog.alert('Full Contact Card Copied', 'All developer and support details have been copied to your clipboard!', 'success');
      });
    } else {
      this.confirmDialog.alert('Developer Card', fullText, 'info');
    }
  }
}
