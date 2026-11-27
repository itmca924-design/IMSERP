import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [RouterLink, MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="policy-page">
      <header class="policy-topbar">
        <div class="topbar-inner">
          <div class="brand-group">
            <div class="brand-badge">
              <mat-icon>verified_user</mat-icon>
            </div>
            <div>
              <h1 class="brand-name">Jnandeep Software</h1>
              <span class="brand-sub">School &amp; Campus Management Platform</span>
            </div>
          </div>
          <a routerLink="/login" mat-stroked-button class="back-btn">
            <mat-icon>arrow_back</mat-icon>
            <span>Back to Login</span>
          </a>
        </div>
      </header>

      <main class="policy-container">
        <article class="policy-card">
          <div class="policy-hero">
            <span class="compliance-pill">Meta WhatsApp Business API &amp; Data Protection</span>
            <h2>Privacy Policy</h2>
            <p class="hero-meta">
              <strong>Platform:</strong> Jnandeep School Management Software (<a href="https://jnandeep.in" target="_blank" rel="noopener">https://jnandeep.in</a>)
              &bull; <strong>Effective Date:</strong> November 2026
            </p>
            <p class="hero-intro">
              Jnandeep Software provides cloud-based school and institute administration software to partner educational institutions.
              This Privacy Policy explains how student and parent information is collected, used, and protected when schools use our platform and automated WhatsApp / SMS communication services.
            </p>
          </div>

          <section class="policy-section">
            <div class="sec-head">
              <span class="sec-num">1</span>
              <h3>Information We Collect</h3>
            </div>
            <p>
              We only process data entered or authorized by partner schools and educational institutions for academic and fee administration:
            </p>
            <ul>
              <li><strong>Student Information:</strong> Student names, admission/roll numbers, and class/section details.</li>
              <li><strong>Academic &amp; Attendance Records:</strong> Daily attendance status (Present, Absent, Late) and exam/academic updates.</li>
              <li><strong>Fee &amp; Billing Details:</strong> Monthly fee invoices, balance due amounts, due dates, and payment receipt records.</li>
              <li><strong>Parent / Guardian Contact Details:</strong> Parent/guardian names and mobile/WhatsApp numbers provided by the partner school.</li>
            </ul>
          </section>

          <section class="policy-section">
            <div class="sec-head">
              <span class="sec-num">2</span>
              <h3>How We Use Information</h3>
            </div>
            <p>
              Information collected through partner schools is used strictly to deliver essential school-to-parent communication via WhatsApp and SMS on behalf of the respective school, including:
            </p>
            <ul>
              <li><strong>Daily Absentee Alerts:</strong> Notifying parents promptly if their ward is marked absent.</li>
              <li><strong>Fee Due Reminders:</strong> Sending advance monthly fee payment notices and due-date reminders.</li>
              <li><strong>Fee Payment Receipts:</strong> Issuing instant digital fee payment confirmation receipts.</li>
            </ul>
          </section>

          <section class="policy-section">
            <div class="sec-head">
              <span class="sec-num">3</span>
              <h3>Data Sharing &amp; Security</h3>
            </div>
            <ul>
              <li><strong>No Third-Party Selling or Marketing:</strong> We do <strong>not</strong> sell, rent, trade, or share parent or student personal data with any third parties for advertising or marketing purposes.</li>
              <li><strong>Strict School Isolation:</strong> Each partner school's data is strictly isolated and used solely for official school administration and parent notifications.</li>
              <li><strong>Technical Safeguards:</strong> All communications are transmitted over HTTPS (TLS/SSL encryption), and messaging is dispatched exclusively through authorized Meta WhatsApp Cloud API channels.</li>
            </ul>
          </section>

          <section class="policy-section">
            <div class="sec-head">
              <span class="sec-num">4</span>
              <h3>Data Deletion &amp; Opt-Out</h3>
            </div>
            <p>
              Parents and guardians have full control over their contact details and notification preferences. To update phone numbers, opt out of automated WhatsApp alerts, or request deletion of contact information, parents may:
            </p>
            <ul>
              <li>Contact their respective <strong>School Administration Office</strong> directly, or</li>
              <li>Email our Data Protection Desk at <a href="mailto:nikky.singh88737@gmail.com">nikky.singh88737&#64;gmail.com</a> with the student's name, school name, and mobile number.</li>
            </ul>
          </section>

          <section class="policy-section contact-section">
            <div class="sec-head">
              <span class="sec-num">5</span>
              <h3>Contact Information</h3>
            </div>
            <div class="contact-box">
              <div><strong>Organization:</strong> Jnandeep Software</div>
              <div><strong>Website:</strong> <a href="https://jnandeep.in" target="_blank" rel="noopener">https://jnandeep.in</a></div>
              <div><strong>Email:</strong> <a href="mailto:nikky.singh88737@gmail.com">nikky.singh88737&#64;gmail.com</a></div>
            </div>
          </section>
        </article>
      </main>

      <footer class="policy-footer">
        <span>&copy; 2026 Jnandeep Software (jnandeep.in). All rights reserved.</span>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: #f8fafc;
      color: #0f172a;
      font-family: 'Inter', 'Segoe UI', Roboto, sans-serif;
    }

    .policy-topbar {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 14px 20px;
      position: sticky;
      top: 0;
      z-index: 20;
    }

    .topbar-inner {
      max-width: 920px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .brand-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-badge {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
    }

    .brand-name {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: #1e3a8a;
      line-height: 1.2;
    }

    .brand-sub {
      font-size: 0.78rem;
      color: #3b82f6;
      font-weight: 500;
    }

    .back-btn {
      background: #ffffff;
      border-color: #bfdbfe !important;
      color: #1e40af !important;
      font-weight: 600;
    }

    .policy-container {
      max-width: 920px;
      margin: 28px auto;
      padding: 0 16px;
    }

    .policy-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 28px 32px;
      box-shadow: 0 4px 18px rgba(15, 23, 42, 0.04);
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .policy-hero {
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 20px;

      h2 {
        margin: 10px 0 6px;
        font-size: 1.75rem;
        font-weight: 800;
        color: #1e3a8a;
      }

      .hero-meta {
        margin: 0 0 12px;
        font-size: 0.85rem;
        color: #475569;

        a {
          color: #2563eb;
          text-decoration: none;
          font-weight: 600;
          &:hover { text-decoration: underline; }
        }
      }

      .hero-intro {
        margin: 0;
        font-size: 0.94rem;
        line-height: 1.65;
        color: #334155;
      }
    }

    .compliance-pill {
      display: inline-block;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      font-size: 0.74rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
    }

    .policy-section {
      display: flex;
      flex-direction: column;
      gap: 10px;

      p, li {
        font-size: 0.92rem;
        line-height: 1.65;
        color: #334155;
        margin: 0;
      }

      ul {
        margin: 0;
        padding-left: 20px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      a {
        color: #2563eb;
        font-weight: 600;
        text-decoration: none;
        &:hover { text-decoration: underline; }
      }
    }

    .sec-head {
      display: flex;
      align-items: center;
      gap: 10px;

      h3 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 700;
        color: #0f172a;
      }
    }

    .sec-num {
      width: 26px;
      height: 26px;
      border-radius: 8px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      font-size: 0.82rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .contact-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 18px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 0.9rem;
      color: #1e293b;
    }

    .policy-footer {
      text-align: center;
      padding: 12px 16px 28px;
      font-size: 0.8rem;
      color: #64748b;
    }

    @media (max-width: 640px) {
      .policy-card {
        padding: 20px 16px;
      }
      .policy-hero h2 {
        font-size: 1.4rem;
      }
    }
  `]
})
export class PrivacyPolicyComponent {}
