import { Injectable, signal, computed, effect } from '@angular/core';

export type SupportedLanguage = 'en' | 'hi';

const STORAGE_KEY = 'imserp_lang';

export function getStoredLanguage(): SupportedLanguage {
  try {
    if (typeof localStorage !== 'undefined') {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local === 'hi') return 'hi';
      if (local === 'en') return 'en';
    }
    if (typeof document !== 'undefined') {
      if (document.cookie.indexOf('googtrans=/en/hi') !== -1) {
        return 'hi';
      }
      if (document.documentElement.getAttribute('lang') === 'hi') {
        return 'hi';
      }
    }
  } catch {}
  return 'en';
}

export function clearAllGoogleTransCookies(): void {
  if (typeof document === 'undefined') return;
  try {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    const domains: string[] = ['', hostname, `.${hostname}`];
    if (parts.length > 2) {
      const rootDomain = parts.slice(-2).join('.');
      domains.push(rootDomain, `.${rootDomain}`);
    }
    const paths = ['/', '', '/coaching', '/school', '/dashboard'];
    const names = ['googtrans', '_googtrans', 'googtrans_en'];
    const past = 'Thu, 01 Jan 1970 00:00:00 GMT; max-age=0;';

    domains.forEach(d => {
      paths.forEach(p => {
        names.forEach(name => {
          let str = `${name}=; expires=${past}`;
          if (p) str += ` path=${p};`;
          if (d) str += ` domain=${d};`;
          document.cookie = str;
        });
      });
    });

    document.documentElement.classList.remove('translated-ltr', 'translated-rtl');
    document.body?.classList.remove('translated-ltr', 'translated-rtl');
  } catch (e) {
    console.warn('Error clearing googtrans cookies:', e);
  }
}

export function setHindiGoogleTransCookie(): void {
  if (typeof document === 'undefined') return;
  try {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();

    document.cookie = `googtrans=/en/hi; expires=${expires}; path=/;`;
    if (hostname && hostname !== 'localhost') {
      document.cookie = `googtrans=/en/hi; expires=${expires}; path=/; domain=.${hostname};`;
      document.cookie = `googtrans=/en/hi; expires=${expires}; path=/; domain=${hostname};`;
      if (parts.length > 2) {
        const rootDomain = parts.slice(-2).join('.');
        document.cookie = `googtrans=/en/hi; expires=${expires}; path=/; domain=.${rootDomain};`;
        document.cookie = `googtrans=/en/hi; expires=${expires}; path=/; domain=${rootDomain};`;
      }
    }
  } catch (e) {
    console.warn('Error setting googtrans cookie:', e);
  }
}

export const HINDI_MENU_DICTIONARY: Record<string, string> = {
  // Navigation & Breadcrumbs
  'Home': 'होम',
  'Executive Dashboard': 'कार्यकारी डैशबोर्ड',

  // Main Categories
  'Dashboard': 'डैशबोर्ड',
  'Master Management': 'मास्टर मैनेजमेंट',
  'Attendance Management': 'उपस्थिति प्रबंधन',
  'HRMS & Staff': 'मानव संसाधन और कर्मचारी',
  'Faculty Operations': 'संकाय संचालन',
  'Coaching Operations': 'कोचिंग संचालन',
  'Academic Operations': 'शैक्षणिक संचालन',
  'Fee Management': 'शुल्क प्रबंधन',
  'Finance & Accounts': 'वित्त एवं लेखा',
  'Admin Settings': 'व्यवस्थापक सेटिंग्स',
  'Stock & Inventory': 'स्टॉक और इन्वेंटरी',
  'Front Desk': 'फ्रंट डेस्क',
  'Campus Chat': 'कैंपस चैट',
  'My Student Center': 'मेरा छात्र केंद्र',

  // Master Management Submenu
  'Classes & Sections': 'कक्षाएं और वर्ग',
  'Period & Bell Timings': 'घंटी और समय सारिणी',
  'Classrooms Master': 'कक्षा कक्ष प्रबंधन',
  'Subject Master': 'विषय मास्टर',
  'Students Master': 'छात्र मास्टर',
  'Teachers Master': 'शिक्षक मास्टर',
  'Admission Enquiries': 'प्रवेश पूछताछ',
  'Holiday Master': 'अवकाश मास्टर',
  'Events & Celebrations': 'कार्यक्रम और उत्सव',
  'My 360° Profile & Wall of Fame': 'मेरी 360° प्रोफाइल और वॉल ऑफ फेम',
  'Apply Student Leave': 'छात्र अवकाश आवेदन',

  // Attendance Submenu
  'Student Attendance': 'छात्र उपस्थिति',
  'Student Leaves': 'छात्र अवकाश',
  'Student Gate Pass': 'छात्र गेट पास',
  'Staff & Faculty Attendance': 'स्टाफ उपस्थिति',
  'Attendance Reports': 'उपस्थिति रिपोर्ट',
  'Biometric Devices': 'बायोमेट्रिक डिवाइस',
  'Shift & Policy Settings': 'शिफ्ट और नीतियां',

  // HRMS & Staff Submenu
  'Staff Directory': 'स्टाफ निर्देशिका',
  'Salary Structure': 'वेतन संरचना',
  'Salary Payments': 'वेतन भुगतान',
  'Salary Advances': 'वेतन अग्रिम',
  'Leave Management': 'अवकाश प्रबंधन',
  'Payroll & Staff Reports': 'पेरोल रिपोर्ट',
  'Promotions & Appraisals': 'पदोन्नति और मूल्यांकन',
  'Exit & FNF Settlement': 'अंतिम निपटान',

  // Faculty Operations Submenu
  'Batch Assignments': 'बैच आवंटन',
  'Proxy & Substitution': 'प्रतिनियुक्ति और प्रतिस्थापन',
  'Daily Lesson Diary': 'दैनिक पाठ डायरी',
  'Test Exams & Marks Entry': 'परीक्षा और अंक प्रविष्टि',
  'Faculty Workload': 'शिक्षक कार्यभार',

  // Coaching Operations Submenu
  'Batches & Courses': 'बैच और पाठ्यक्रम',
  'Student Batch Allocation': 'छात्र बैच आवंटन',
  'Batch Daily Attendance': 'बैच दैनिक उपस्थिति',
  'Batch Student Leaves': 'बैच छात्र अवकाश',
  'Tests & Test Series': 'टेस्ट और टेस्ट सीरीज',
  'DPP & Study Material': 'अध्ययन सामग्री (DPP)',
  'Batch Timetable & Routine': 'समय सारणी और दिनचर्या',
  'Coaching Student ID Cards': 'आईडी कार्ड',
  'Batch Fee Vouchers & Dues': 'शुल्क वाउचर और बकाया',
  'Coaching Analytics & Reports': 'विश्लेषण और रिपोर्ट',

  // Academic Operations Submenu
  'Homework & Daily Diary': 'गृहकार्य और दैनिक डायरी',
  'Class Timetable & Routine': 'कक्षा समय सारणी',
  'Study Material & PYQ Bank': 'अध्ययन सामग्री और प्रश्न बैंक',
  'Monthly Student Performance': 'मासिक छात्र प्रदर्शन',
  'Good Manners & Behaviour': 'सदाचार और व्यवहार',
  'School Examinations': 'विद्यालय परीक्षाएं',
  'Student Promotion': 'छात्र पदोन्नति',
  'Academic & Exam Workflow': 'शैक्षणिक वर्कफ़्लो',
  'School Notices': 'विद्यालय सूचनाएं',
  'WhatsApp Logs': 'व्हाट्सएप लॉग',
  'Campus & Class Chat': 'कैंपस चैट',
  'Library Books': 'पुस्तकालय पुस्तकें',
  'Issue & Return Desk': 'पुस्तक निर्गम एवं वापसी',
  'Library Shifts & Plans': 'पुस्तकालय योजनाएं',
  'Hostel Management': 'छात्रावास प्रबंधन',
  'Transport & Fleet': 'परिवहन प्रबंधन',
  'Front Desk & Visitors': 'आगंतुक प्रबंधन',
  'Infirmary & Sick Bay': 'प्राथमिक चिकित्सा',
  'PTM Scheduler': 'पीटीएम शेड्यूलर',
  'Grievance Helpdesk': 'शिकायत निवारण',
  'My Fee Ledger & Receipts': 'मेरी फीस और रसीदें',
  'My Fee Card': 'मेरा फीस कार्ड',
  'My Exams & Datesheet': 'मेरी परीक्षाएं और डेटशीट',

  // Fee Management Submenu
  'Fee Structures & Heads': 'शुल्क संरचना और हेड',
  'Collect Student Fees': 'शुल्क वसूली',
  'Fee Recovery Agent Desk': 'रिकवरी एजेंट डेस्क',
  'Student Fee Ledgers': 'छात्र शुल्क बहीखाता',
  'Fee Due Statements': 'बकाया शुल्क विवरण',
  'Fee Receipts & History': 'शुल्क रसीदें और इतिहास',
  'Fee Defaulters & Dues': 'शुल्क डिफाल्टर सूची',
  'Fee Discount Policies': 'शुल्क छूट नीतियां',
  'Fee Analytics & Reports': 'शुल्क विश्लेषण और रिपोर्ट',
  'Online Payment Gateways': 'ऑनलाइन भुगतान गेटवे',

  // Finance & Accounts Submenu
  'Day Book & Daily Register': 'डे बुक और दैनिक रजिस्टर',
  'Cash & Bank Accounts': 'कैश और बैंक खाते',
  'Income & Expense Vouchers': 'आय और व्यय वाउचर',
  'Profit & Loss Statement': 'लाभ और हानि विवरण',
  'Balance Sheet': 'बैलेंस शीट',
  'Ledger Accounts & Groups': 'खाता बही और समूह',
  'Financial Year Settings': 'वित्तीय वर्ष सेटिंग्स',

  // Admin Settings Submenu
  'General Institute Settings': 'सामान्य संस्थान सेटिंग्स',
  'Branch Management': 'शाखा प्रबंधन',
  'Role Permissions & Access': 'भूमिका और अनुमतियां',
  'User Accounts': 'उपयोगकर्ता खाते',
  'Audit Logs & Security': 'ऑडिट लॉग और सुरक्षा',
  'System Backup & Restore': 'बैकअप और रीस्टोर',
  'SMS & WhatsApp Templates': 'एसएमएस और व्हाट्सएप टेम्प्लेट',

  // Stock & Inventory Submenu
  'Inventory Items': 'इन्वेंटरी आइटम',
  'Stock Inward & Outward': 'स्टॉक आवक और जावक',
  'Vendors & Suppliers': 'विक्रेता और आपूर्तिकर्ता',
  'Purchase Orders': 'खरीद आदेश',
  'Inventory Reports': 'इन्वेंटरी रिपोर्ट'
};

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  readonly currentLang = signal<SupportedLanguage>(getStoredLanguage());

  readonly isHindi = computed(() => this.currentLang() === 'hi');
  readonly isEnglish = computed(() => this.currentLang() === 'en');

  constructor() {
    const initialLang = getStoredLanguage();
    this.currentLang.set(initialLang);

    // Keep localStorage synchronized
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, initialLang);
      }
    } catch {}

    // Keep html lang attribute in sync with currentLang signal
    effect(() => {
      const lang = this.currentLang();
      try {
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('lang', lang);
        }
      } catch {}
    });

    // Synchronize Google Translate with active language on boot
    if (initialLang === 'hi') {
      this.applyTranslation('hi');
    } else {
      clearAllGoogleTransCookies();
    }
  }

  setLanguage(lang: SupportedLanguage): void {
    if (this.currentLang() === lang) {
      return;
    }

    this.currentLang.set(lang);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, lang);
      }
    } catch {}

    this.applyTranslation(lang);
  }

  toggleLanguage(): void {
    const nextLang = this.currentLang() === 'en' ? 'hi' : 'en';
    this.setLanguage(nextLang);
  }

  retranslate(): void {
    if (this.isHindi()) {
      setTimeout(() => this.applyTranslation('hi'), 100);
      setTimeout(() => this.applyTranslation('hi'), 300);
    }
  }

  applyTranslation(lang: SupportedLanguage, retryCount = 0): void {
    if (typeof document === 'undefined') return;

    try {
      const isHindi = lang === 'hi';

      if (isHindi) {
        setHindiGoogleTransCookie();
      } else {
        clearAllGoogleTransCookies();
      }

      // Ensure Google Translate script is injected if not already
      if (!document.getElementById('google-translate-script')) {
        const s = document.createElement('script');
        s.id = 'google-translate-script';
        s.type = 'text/javascript';
        s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        s.async = true;
        document.body.appendChild(s);
      }

      const combo = document.querySelector<HTMLSelectElement>('.goog-te-combo');
      if (combo) {
        if (isHindi) {
          combo.value = 'hi';
        } else {
          combo.value = '';
          combo.selectedIndex = 0;

          try {
            const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe');
            iframes.forEach(f => {
              try {
                const btn = f.contentDocument?.querySelector<HTMLElement>('.goog-close-link, [id$=".restore"]');
                if (btn) btn.click();
              } catch {}
            });
          } catch {}

          document.documentElement.classList.remove('translated-ltr', 'translated-rtl');
          document.body?.classList.remove('translated-ltr', 'translated-rtl');
        }

        combo.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof (combo as any).onchange === 'function') {
          (combo as any).onchange();
        }
        return;
      }

      // Retry up to 30 times (every 100ms for 3.0s) while Google Translate initializes
      if (retryCount < 30) {
        setTimeout(() => this.applyTranslation(lang, retryCount + 1), 100);
      }
    } catch (e) {
      console.warn('Google Translate sync exception:', e);
    }
  }

  translate(keyOrText: string): string {
    if (!keyOrText) return '';
    if (!this.isHindi()) return keyOrText;
    const trimmed = keyOrText.trim();
    return HINDI_MENU_DICTIONARY[trimmed] || keyOrText;
  }

  t(keyOrText: string): string {
    return this.translate(keyOrText);
  }
}
