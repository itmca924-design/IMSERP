import { Injectable, signal, NgZone } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface FeeAiCommandResult {
  studentName?: string;
  rollNumber?: string;
  invoiceNumber?: string;
  amount?: number;
  paymentMode?: 'Cash' | 'UPI' | 'Cheque' | 'Bank Transfer';
  paymentModeId?: number;
  remarks?: string;
  confidence: number;
}

export interface AttendanceAiCommandResult {
  absentRolls: string[];
  presentRolls: string[];
  lateRolls: string[];
  halfDayRolls: string[];
  markRestPresent: boolean;
  markRestAbsent?: boolean;
  confidence: number;
  summary: string;
}

export interface ExpenseAiCommandResult {
  title?: string;
  amount?: number;
  categoryId?: string;
  categoryName?: string;
  paymentMode?: number; // 1 = Cash, 2 = UPI, 3 = Cheque, 4 = NetBanking
  paidTo?: string;
  remarks?: string;
  expenseDate?: string;
  confidence: number;
}

export interface EnquiryAiCommandResult {
  studentName?: string;
  parentName?: string;
  phone?: string;
  alternatePhone?: string;
  classId?: string;
  className?: string;
  batchId?: string;
  batchName?: string;
  priority?: 'High' | 'Normal' | 'Low';
  source?: string;
  remarks?: string;
  confidence: number;
}

export interface HomeworkAiCommandResult {
  title?: string;
  subject?: string;
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  teacherId?: string;
  teacherName?: string;
  batchId?: string;
  dueDate?: string;
  description?: string;
  confidence: number;
}

export interface MarksAiCommandResult {
  entries: { rollNumber: string; studentName?: string; marks?: number; isAbsent?: boolean }[];
  confidence: number;
  summary: string;
}

export interface NoticeAiCommandResult {
  title: string;
  category: string;
  targetAudience: string;
  priority: string;
  content: string;
}

export interface ExecutiveQueryResult {
  question: string;
  answer: string;
  metricType?: 'students' | 'fees' | 'attendance' | 'teachers' | 'dues' | 'general';
  highlightValue?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiErpCopilotService {
  // Executive Dashboard Copilot Visibility (defaults to false on page load for optimum performance)
  public isExecutiveCopilotVisible = signal<boolean>(false);

  public toggleExecutiveCopilot(): void {
    const next = !this.isExecutiveCopilotVisible();
    this.isExecutiveCopilotVisible.set(next);
    if (!next) {
      this.stopListening();
    }
  }

  public setExecutiveCopilotVisible(visible: boolean): void {
    this.isExecutiveCopilotVisible.set(visible);
    if (!visible) {
      this.stopListening();
    }
  }

  private recognition: any = null;
  private isListening = false;
  private shouldBeListening = false;
  private currentLang = 'hi-IN';
  private transcript$ = new Subject<string>();
  private speechStatus$ = new Subject<'started' | 'stopped' | 'error' | 'unsupported'>();

  constructor(private ngZone: NgZone) {
    this.initSpeechEngine();
  }

  // ════════════════════════════════════════════════════════════
  // 1. BULLETPROOF CENTRALIZED SPEECH RECOGNITION ENGINE
  // ════════════════════════════════════════════════════════════

  private createFreshRecognition(lang: string = 'hi-IN'): any {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
      this.recognition = null;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;

    rec.onresult = (event: any) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript + ' ';
      }
      const text = fullTranscript.trim();
      if (text) {
        this.ngZone.run(() => {
          this.transcript$.next(text);
        });
      }
    };

    rec.onerror = (err: any) => {
      console.warn('AI Copilot Speech error:', err?.error || err);
      this.ngZone.run(() => {
        if (err?.error === 'not-allowed') {
          this.shouldBeListening = false;
          this.isListening = false;
          this.speechStatus$.next('error');
        }
      });
    };

    rec.onend = () => {
      this.ngZone.run(() => {
        if (this.shouldBeListening && this.recognition === rec) {
          try {
            rec.start();
            this.isListening = true;
            this.speechStatus$.next('started');
          } catch {
            this.isListening = false;
            this.shouldBeListening = false;
            this.speechStatus$.next('stopped');
          }
        } else {
          this.isListening = false;
          this.speechStatus$.next('stopped');
        }
      });
    };

    this.recognition = rec;
    return rec;
  }

  private initSpeechEngine(): void {
    // Check support on initialization
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech API is not supported in this browser.');
    }
  }

  public isSpeechSupported(): boolean {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    return !!SpeechRecognition;
  }

  public getSpeechTranscript(): Observable<string> {
    return this.transcript$.asObservable();
  }

  public getSpeechStatus(): Observable<'started' | 'stopped' | 'error' | 'unsupported'> {
    return this.speechStatus$.asObservable();
  }

  public startListening(lang: string = 'hi-IN'): void {
    const rec = this.createFreshRecognition(lang);
    if (!rec) {
      this.speechStatus$.next('unsupported');
      return;
    }
    this.currentLang = lang;
    this.shouldBeListening = true;
    try {
      rec.start();
      this.isListening = true;
      this.speechStatus$.next('started');
    } catch (e) {
      console.warn('Could not start recognition:', e);
    }
  }

  public stopListening(): void {
    this.shouldBeListening = false;
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
      this.recognition = null;
      this.isListening = false;
      this.speechStatus$.next('stopped');
    }
  }

  public restartListening(lang: string = this.currentLang): void {
    this.stopListening();
    setTimeout(() => {
      this.startListening(lang);
    }, 80);
  }

  public restartWithLanguage(lang: string): void {
    this.restartListening(lang);
  }

  // ════════════════════════════════════════════════════════════
  // 1.1 DEVANAGARI TO LATIN TRANSLITERATION & PHONETIC ENGINE
  // ════════════════════════════════════════════════════════════
  public devanagariToLatin(input: string): string {
    if (!input) return '';

    const digitsMap: Record<string, string> = {
      '०':'0','१':'1','२':'2','३':'3','४':'4','५':'5','६':'6','७':'7','८':'8','९':'9'
    };

    const consonantMap: Record<string, string> = {
      'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'ng',
      'च':'ch','छ':'chh','ज':'j','झ':'jh','ञ':'ny',
      'ट':'t','ठ':'th','ड':'d','ढ':'dh','ण':'n',
      'त':'t','थ':'th','द':'d','ध':'dh','न':'n',
      'प':'p','फ':'f','ब':'b','भ':'bh','म':'m',
      'य':'y','र':'r','ल':'l','व':'v','श':'sh','ष':'sh','स':'s','ह':'h',
      'क्ष':'ksh','त्र':'tr','ज्ञ':'gy'
    };

    const vowelMap: Record<string, string> = {
      'अ':'a','आ':'aa','इ':'i','ई':'ee','उ':'u','ऊ':'oo','ऋ':'ri',
      'ए':'e','ऐ':'ai','ओ':'o','औ':'au','अं':'an','अः':'ah'
    };

    const matraMap: Record<string, string> = {
      'ा':'a','ि':'i','ी':'i','ु':'u','ू':'u','ृ':'ri',
      'े':'e','ै':'ai','ो':'o','ौ':'au','ं':'n','ँ':'n','ः':'h','्':''
    };

    let result = '';
    const chars = Array.from(input);
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (digitsMap[ch]) {
        result += digitsMap[ch];
      } else if (vowelMap[ch]) {
        result += vowelMap[ch];
      } else if (matraMap[ch]) {
        result += matraMap[ch];
      } else if (consonantMap[ch]) {
        result += consonantMap[ch];
        const next = chars[i + 1];
        if (next && !matraMap[next] && consonantMap[next]) {
          result += 'a';
        }
      } else {
        result += ch;
      }
    }
    return result.trim().toLowerCase();
  }

  public normalizePhonetic(str: string): string {
    return (str || '')
      .toLowerCase()
      .trim()
      .replace(/ee/g, 'i')
      .replace(/oo/g, 'u')
      .replace(/w/g, 'v')
      .replace(/k/g, 'c')
      .replace(/sh/g, 's')
      .replace(/th/g, 't')
      .replace(/ph/g, 'f')
      .replace(/aa/g, 'a')
      .replace(/e/g, 'i') // Indian phonetic vowel normalization: e -> i (e.g. renu/reenu -> rinu)
      .replace(/[^a-z0-9]/g, '');
  }

  // ════════════════════════════════════════════════════════════
  // 2. MODULE 1: FEE COLLECTION NLP PARSER
  // "Aman Kumar 2000 cash" or "Roll 12 1500 online UPI" or "गुलशन 350 कैश"
  // ════════════════════════════════════════════════════════════
  public parseFeeCommand(rawText: string): FeeAiCommandResult {
    let text = (rawText || '').trim();
    if (!text) return { confidence: 0 };

    // Convert any Devanagari digits ०-९ to 0-9
    text = text.replace(/[०-९]/g, d => '0123456789'['०१२३४५६७८९'.indexOf(d)]);

    let amount: number | undefined;
    let studentName: string | undefined;
    let rollNumber: string | undefined;
    let invoiceNumber: string | undefined;
    let paymentMode: 'Cash' | 'UPI' | 'Cheque' | 'Bank Transfer' = 'Cash';
    let paymentModeId = 1;

    // Detect Invoice Number first: e.g. "INV-202611-150", "INV 202611-150", "inv 978", "invoice 150"
    const invMatch = text.match(/\b(INV[-\s]?[A-Za-z0-9]+(?:[-\s]?[A-Za-z0-9]+)*)\b/i) ||
                     text.match(/(?:invoice|inv|बिल|इनवॉइस)\s*[:\-#]?\s*([A-Za-z0-9\-]+)/i);
    if (invMatch) {
      invoiceNumber = invMatch[1].replace(/\s+/g, '-').trim();
    }

    // Text isolated for amount, roll, and name extraction (without the invoice number token)
    let textForRest = text;
    if (invoiceNumber) {
      textForRest = textForRest.replace(new RegExp(invoiceNumber.replace(/[-]/g, '[-]?'), 'gi'), ' ');
      textForRest = textForRest.replace(/(?:invoice|inv|बिल|इनवॉइस)/gi, ' ');
    }

    // Detect Payment Mode (English + Hindi)
    if (/\b(upi|online|qr|phonepe|gpay|paytm|google\s*pay)\b|ऑनलाइन|यूपीआई|गूगल\s*पे|फोन\s*पे|पेटीएम|क्यूआर/i.test(text)) {
      paymentMode = 'UPI';
      paymentModeId = 2;
    } else if (/\b(cheque|check)\b|चेक/i.test(text)) {
      paymentMode = 'Cheque';
      paymentModeId = 3;
    } else if (/\b(bank|transfer|neft|rtgs|imps)\b|बैंक|खाता|ट्रांसफर/i.test(text)) {
      paymentMode = 'Bank Transfer';
      paymentModeId = 4;
    } else {
      paymentMode = 'Cash';
      paymentModeId = 1;
    }

    // Amount match: "2000", "2000 rupaye", "₹1500", "fees 3000", "300 कैश" (extracted from textForRest)
    const amountMatches = Array.from(textForRest.matchAll(/(?:₹|\brs\.?|\brupees?|\bfee[s]?\s*(?:of)?|\bamount\s*)?\s*(\d{2,6})\s*(?:rs|rupees?|rupaye|रुपये|रुपए|रु)?/gi));
    if (amountMatches.length > 0) {
      for (let i = amountMatches.length - 1; i >= 0; i--) {
        const val = parseInt(amountMatches[i][1], 10);
        if (val >= 50) {
          amount = val;
          break;
        }
      }
    }

    // Roll Number: "roll 5", "roll number 12", "रोल नंबर 8"
    const rollMatch = textForRest.match(/(?:roll(?:\s*no\.?|\s*number)?|रोल\s*(?:नंबर)?)\s*[:\-]?\s*([A-Za-z0-9\-]+)/i);
    if (rollMatch) {
      rollNumber = rollMatch[1].trim();
    }

    // Student Name: extract words by removing amount, roll, payment modes, and action words (Hindi + English)
    const cleaned = textForRest
      .replace(/(?:roll(?:\s*no\.?|\s*number)?|रोल\s*(?:नंबर)?)\s*[:\-]?\s*([A-Za-z0-9\-]+)/gi, ' ')
      .replace(/(?:₹|\brs\.?|\brupees?|\bfee[s]?\s*(?:of)?|\bamount\s*)?\s*(\d{2,6})\s*(?:rs|rupees?|rupaye|रुपये|रुपए|रु)?/gi, ' ')
      .replace(/\b(upi|online|qr|phonepe|gpay|paytm|cash|cheque|bank|transfer)\b/gi, ' ')
      .replace(/(?:कैश|नकद|नगद|ऑनलाइन|यूपीआई|चेक|बैंक|ट्रांसफर)/gi, ' ')
      .replace(/(?:जमा\s*करो|जमा\s*करना|जमा|फीस|ले\s*लो|pay|paid|collect|received?|discount|का|की|को|के|रुपये|रुपए|रु)/gi, ' ')
      .replace(/\b(ka|ki|ko|ke|for|of|fee|fees|deposit|pay|paid)\b/gi, ' ')
      .trim();

    if (cleaned.length >= 2) {
      studentName = cleaned.replace(/\s+/g, ' ');
    }

    return {
      studentName,
      rollNumber,
      invoiceNumber,
      amount,
      paymentMode,
      paymentModeId,
      confidence: (invoiceNumber ? 0.9 : 0) + (amount ? 0.5 : 0) + (studentName || rollNumber ? 0.5 : 0)
    };
  }

  // ════════════════════════════════════════════════════════════
  // 3. MODULE 2: DAILY ATTENDANCE NLP PARSER
  // "Roll 5, 12, 18 absent baaki present" or "Roll 3 late, 8 absent" or "रोल नंबर वन को लेट कर दो"
  // ════════════════════════════════════════════════════════════
  public parseAttendanceCommand(rawText: string): AttendanceAiCommandResult {
    const raw = (rawText || '').trim();
    const absentRolls: string[] = [];
    const presentRolls: string[] = [];
    const lateRolls: string[] = [];
    const halfDayRolls: string[] = [];

    if (!raw) {
      return { absentRolls, presentRolls, lateRolls, halfDayRolls, markRestPresent: true, markRestAbsent: false, confidence: 0, summary: '' };
    }

    // Number words mapping (English, Hindi phonetics, Hindi native)
    const NUMBER_WORDS: Record<string, number> = {
      'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
      'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
      'thirty': 30, 'forty': 40, 'fifty': 50,
      // Hindi phonetic transcription of English numbers (very common in Indian Web Speech API)
      'वन': 1, 'टू': 2, 'थ्री': 3, 'फोर': 4, 'फाइव': 5,
      'सिक्स': 6, 'सेवन': 7, 'एट': 8, 'नाइन': 9, 'टेन': 10,
      'इलेवन': 11, 'ट्वेल्व': 12, 'थर्टीन': 13, 'फोर्टीन': 14, 'फीफटीन': 15,
      'सिक्सटीन': 16, 'सेवन्टीन': 17, 'एइटीन': 18, 'नाइन्टीन': 19, 'ट्वेंटी': 20,
      'थर्टी': 30, 'फोर्टी': 40, 'फिफ्टी': 50,
      // Hindi native numbers (1-50)
      'शून्य': 0, 'जीरो': 0,
      'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5,
      'छह': 6, 'छः': 6, 'छे': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
      'ग्यारह': 11, 'बारह': 12, 'तेरह': 13, 'चौदह': 14, 'पंद्रह': 15, 'पन्द्रह': 15,
      'सोलह': 16, 'सत्रह': 17, 'अट्ठारह': 18, 'उन्नीस': 19, 'बीस': 20,
      'इक्कीस': 21, 'बाईस': 22, 'तेईस': 23, 'चौबीस': 24, 'पच्चीस': 25,
      'छब्बीस': 26, 'सत्ताईस': 27, 'अट्ठाईस': 28, 'उनतीस': 29, 'तीस': 30,
      'इकत्तीस': 31, 'बत्तीस': 32, 'तैंतीस': 33, 'चौंतीस': 34, 'पैंतीस': 35,
      'छत्तीस': 36, 'सैंतीस': 37, 'अड़तीस': 38, 'उनतालीस': 39, 'चालीस': 40
    };

    let t = ' ' + raw + ' ';

    // 1. Convert Devanagari numerals ०-९ to 0-9
    t = t.replace(/[०-९]/g, d => '0123456789'['०१२३४५६७८९'.indexOf(d)]);

    // 2. Remove auxiliary verbs first (before converting 'दो' to 2, so 'कर दो' is not treated as 'कर 2')
    t = t.replace(/(?:कर\s*दो|कर\s*दें|कर\s*दीजिए|कर\s*दीजिये|करो|लगा\s*दो|लगा\s*दें|लगाओ|बना\s*दो|मार्क\s*करो|मार्क\s*कर\s*दो|कर\s*देना)/gi, ' ');
    t = t.replace(/(?:है|हैं|था|थे|हो\s*गया|आया|आया\s*है|आई|आयी|गया|गई)/gi, ' ');

    // 3. Convert word numbers to digits
    for (const [w, n] of Object.entries(NUMBER_WORDS)) {
      t = t.replace(new RegExp('(^|[\\s,]+)' + w + '(?=[\\s,]+|$)', 'gi'), '$1' + n + ' ');
    }

    // 4. Normalize Status keywords (including speech-to-text typos like 'अपसेट' for absent, 'हाफ' for halfday)
    // ABSENT: absent, एब्सेंट, अपसेट, अप्सेट, एबसेंट, ऑफसेट, अनुपस्थित, गैरहाजिर, गैर हाजिर, गैर-हाजिर
    t = t.replace(/(?:absent|एब्सेंट|अपसेट|अप्सेट|एबसेंट|ऑफसेट|अनुपस्थित|गैरहाजिर|गैर\s*हाजिर|गैर-हाजिर)/gi, ' __ABSENT__ ');
    // HALFDAY / HALF: half\s*day, halfday, हाफ\s*डे, हाफ़\s*डे, half, हाफ, हाफ़, half\s*time, आधा\s*दिन
    t = t.replace(/(?:half\s*day|halfday|हाफ\s*डे|हाफ़\s*डे|हाफडे|हाफ़डे|half\s*time|आधा\s*दिन|half|हाफ|हाफ़)/gi, ' __HALFDAY__ ');
    // LATE: late, लेट, देर, देर\s*से, विलंब, delay, विलम्ब
    t = t.replace(/(?:late|लेट|देर(?:\s*से)?|विलंब|delay|विलम्ब)/gi, ' __LATE__ ');
    // PRESENT: present, प्रेजेंट, प्रजेंट, उपस्थित, हाजिर
    t = t.replace(/(?:present|प्रेजेंट|उपस्थित|हाजिर|प्रजेंट)/gi, ' __PRESENT__ ');

    // Detect explicit rest / baaki status:
    // e.g. "बाकी को अपसेट" -> "baaki __ABSENT__", "बाकी सब प्रेजेंट" -> "baaki __PRESENT__"
    let restStatus: 'Present' | 'Absent' | null = null;
    if (/(?:baaki|rest|remaining|बाकी)\s*(?:sab|सब)?\s*(?:ko|को)?\s*__ABSENT__/i.test(t)) {
      restStatus = 'Absent';
    } else if (/(?:baaki|rest|remaining|बाकी)\s*(?:sab|सब)?\s*(?:ko|को)?\s*__PRESENT__/i.test(t)) {
      restStatus = 'Present';
    }

    // 5. Normalize roll prefix
    t = t.replace(/(?:roll\s*(?:no\.?|number|s)?|रोल\s*(?:नंबर|नं|न\.)?|रौल\s*(?:नंबर)?)/gi, ' roll ');

    // 6. Connectors & postpositions
    t = t.replace(/(?:^|[\s,]+)(?:को|ko|का|ki|ke|pe|par|पर)(?=[\s,]+|$)/gi, ' ');
    t = t.replace(/(?:और|and|तथा|एवं)/gi, ' , ');
    t = t.replace(/\s+/g, ' ').trim();

    const extractRollNumbers = (segment: string): string[] => {
      const nums: string[] = [];
      const cleanSeg = segment.replace(/(?:baaki|rest|remaining|बाकी|sab|सब)/gi, ' ');
      const rangeMatches = Array.from(cleanSeg.matchAll(/\b(\d{1,4})\s*(?:to|-|–|se|से)\s*(\d{1,4})\b/gi));
      for (const rm of rangeMatches) {
        const start = parseInt(rm[1], 10);
        const end = parseInt(rm[2], 10);
        if (start <= end && end - start <= 100) {
          for (let r = start; r <= end; r++) nums.push(String(r));
        }
      }
      const matches = cleanSeg.matchAll(/\b(\d{1,4}[A-Za-z]?)\b/g);
      for (const m of matches) {
        if (!nums.includes(m[1])) nums.push(m[1]);
      }
      return nums;
    };

    const matchStatus = (token: string, list: string[]) => {
      // 1. Look for numbers before the token (e.g. "roll 1, 2 __LATE__" or "1 __LATE__")
      const p1 = new RegExp('(?:(?:roll\\s*)?([0-9,\\s\\-–to seसेbaaki rest बाकी सब]+?)\\s*' + token + ')', 'gi');
      // 2. Look for numbers after the token (e.g. "__LATE__ roll 1" or "__LATE__ 1")
      const p2 = new RegExp('(?:' + token + '\\s*(?:roll\\s*)?([0-9,\\s\\-–to seसे]+?)(?=\\s*__|\\s*$|,))', 'gi');

      for (const m of t.matchAll(p1)) {
        extractRollNumbers(m[1]).forEach(n => { if (!list.includes(n)) list.push(n); });
      }
      for (const m of t.matchAll(p2)) {
        extractRollNumbers(m[1]).forEach(n => { if (!list.includes(n)) list.push(n); });
      }
    };

    matchStatus('__LATE__', lateRolls);
    matchStatus('__ABSENT__', absentRolls);
    matchStatus('__HALFDAY__', halfDayRolls);
    matchStatus('__PRESENT__', presentRolls);

    let markRestPresent = false;
    let markRestAbsent = false;

    if (restStatus === 'Absent') {
      markRestAbsent = true;
    } else if (restStatus === 'Present') {
      markRestPresent = true;
    } else if (!restStatus && (absentRolls.length > 1 || /baaki|rest/i.test(raw))) {
      markRestPresent = true;
    }

    // Summary description
    const parts: string[] = [];
    if (absentRolls.length > 0) parts.push(`Absent: Roll ${absentRolls.join(', ')}`);
    if (lateRolls.length > 0) parts.push(`Late: Roll ${lateRolls.join(', ')}`);
    if (halfDayRolls.length > 0) parts.push(`Half-Day: Roll ${halfDayRolls.join(', ')}`);
    if (presentRolls.length > 0) parts.push(`Present: Roll ${presentRolls.join(', ')}`);
    if (markRestPresent) parts.push('All other students set to Present');
    if (markRestAbsent) parts.push('All other students set to Absent');

    return {
      absentRolls,
      presentRolls,
      lateRolls,
      halfDayRolls,
      markRestPresent,
      markRestAbsent,
      confidence: absentRolls.length > 0 || lateRolls.length > 0 || halfDayRolls.length > 0 || presentRolls.length > 0 ? 0.95 : 0.3,
      summary: parts.join(' | ') || 'No specific rolls detected'
    };
  }

  // ════════════════════════════════════════════════════════════
  // 4. MODULE 3: DAILY EXPENSE NLP PARSER
  // "Generator diesel 1500 cash" or "Stationery register 650 UPI paid to Ratan"
  // ════════════════════════════════════════════════════════════
  public parseExpenseCommand(rawText: string, categories: { id: string; name: string }[] = []): ExpenseAiCommandResult {
    const text = (rawText || '').trim();
    if (!text) return { confidence: 0 };

    let amount: number | undefined;
    let paymentMode = 1; // 1 = Cash
    let title: string | undefined;
    let paidTo: string | undefined;
    let matchedCategoryId: string | undefined;
    let matchedCategoryName: string | undefined;

    // Detect Payment Mode
    if (/\b(upi|online|qr|phonepe|gpay|paytm|google\s*pay)\b/i.test(text)) {
      paymentMode = 2; // UPI
    } else if (/\b(cheque|check)\b/i.test(text)) {
      paymentMode = 3; // Cheque
    } else if (/\b(bank|transfer|neft|rtgs|imps|net\s*banking)\b/i.test(text)) {
      paymentMode = 4; // NetBanking
    } else {
      paymentMode = 1; // Cash
    }

    // Match Amount
    const amtMatch = text.match(/(?:₹|\brs\.?|\brupees?|\bkharcha\s*)?\s*(\d{2,6})\s*(?:rs|rupees?|rupaye|रुपये)?/i);
    if (amtMatch) {
      amount = parseInt(amtMatch[1], 10);
    }

    // Match "paid to" or "vendor"
    const vendorMatch = text.match(/(?:paid\s*to|vendor|vendor\s*name|giver|diya)\s*[:\-]?\s*([A-Za-z\s]+?)(?:\s*(?:cash|upi|online|\d|$))/i);
    if (vendorMatch) {
      paidTo = vendorMatch[1].trim();
    }

    // Match Category dynamically from tenant categories
    if (categories && categories.length > 0) {
      for (const cat of categories) {
        const catPattern = new RegExp(`\\b${cat.name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        if (catPattern.test(text)) {
          matchedCategoryId = cat.id;
          matchedCategoryName = cat.name;
          break;
        }
      }
      // Keyword fallbacks for common educational expense categories
      if (!matchedCategoryId) {
        const low = text.toLowerCase();
        for (const cat of categories) {
          const cName = cat.name.toLowerCase();
          if ((low.includes('diesel') || low.includes('fuel') || low.includes('generator')) && (cName.includes('fuel') || cName.includes('diesel') || cName.includes('generator'))) {
            matchedCategoryId = cat.id;
            matchedCategoryName = cat.name;
            break;
          }
          if ((low.includes('stationary') || low.includes('stationery') || low.includes('paper') || low.includes('pen') || low.includes('register')) && (cName.includes('stationery') || cName.includes('office'))) {
            matchedCategoryId = cat.id;
            matchedCategoryName = cat.name;
            break;
          }
          if ((low.includes('tea') || low.includes('chai') || low.includes('snack') || low.includes('refreshment')) && (cName.includes('refreshment') || cName.includes('tea') || cName.includes('hospitality'))) {
            matchedCategoryId = cat.id;
            matchedCategoryName = cat.name;
            break;
          }
          if ((low.includes('electricity') || low.includes('bijli') || low.includes('power')) && (cName.includes('electricity') || cName.includes('utility'))) {
            matchedCategoryId = cat.id;
            matchedCategoryName = cat.name;
            break;
          }
        }
      }
    }

    // Title / Purpose: Extract clean description
    let cleanTitle = text
      .replace(/(?:₹|\brs\.?|\brupees?|\bkharcha\s*)?\s*(\d{2,6})\s*(?:rs|rupees?|rupaye|रुपये)?/gi, '')
      .replace(/\b(cash|upi|online|qr|cheque|bank|transfer)\b/gi, '')
      .replace(/(?:paid\s*to|vendor|diya)\s*[:\-]?\s*([A-Za-z\s]+)/gi, '')
      .replace(/\b(खर्चा| वाउचर| जोड़ो| add| expense| voucher)\b/gi, '')
      .trim();

    if (cleanTitle.length > 2) {
      title = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
    }

    return {
      title: title || 'General Expense',
      amount,
      categoryId: matchedCategoryId,
      categoryName: matchedCategoryName,
      paymentMode,
      paidTo,
      confidence: amount ? 0.8 : 0.4
    };
  }

  // ════════════════════════════════════════════════════════════
  // 5. MODULE 4: ADMISSION ENQUIRY NLP PARSER
  // "Rahul Verma father Suresh Verma phone 9876543210 class 9th"
  // ════════════════════════════════════════════════════════════
  public parseEnquiryCommand(rawText: string, classes: { id: string; name: string }[] = []): EnquiryAiCommandResult {
    const text = (rawText || '').trim();
    if (!text) return { confidence: 0 };

    let studentName: string | undefined;
    let parentName: string | undefined;
    let phone: string | undefined;
    let classId: string | undefined;
    let className: string | undefined;
    let priority: 'High' | 'Normal' | 'Low' = 'Normal';

    // Phone: 10-digit mobile number
    const phoneMatch = text.match(/\b([6-9]\d{9})\b/);
    if (phoneMatch) {
      phone = phoneMatch[1];
    }

    // Priority
    if (/\b(urgent|high|priority|turant|important)\b/i.test(text)) {
      priority = 'High';
    }

    // Father / Parent Name
    const parentMatch = text.match(/(?:father(?:\s*name)?|parent|पिता(?:\s*का\s*नाम)?)\s*[:\-]?\s*([A-Za-z\s]+?)(?:\s*(?:phone|mobile|class|student|address|$))/i);
    if (parentMatch) {
      parentName = parentMatch[1].trim();
    }

    // Match Class
    if (classes && classes.length > 0) {
      for (const c of classes) {
        const cRegex = new RegExp(`\\b${c.name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        if (cRegex.test(text)) {
          classId = c.id;
          className = c.name;
          break;
        }
      }
    }
    if (!className) {
      const clsNumMatch = text.match(/(?:class|कक्षा)\s*(\d{1,2}(?:th|st|nd|rd)?|[A-Za-z]+)/i);
      if (clsNumMatch) {
        className = `Class ${clsNumMatch[1]}`;
      }
    }

    // Student Name
    const nameMatch = text.match(/(?:student(?:\s*name)?|enquiry\s*for|नाम)\s*[:\-]?\s*([A-Za-z\s]+?)(?:\s*(?:father|parent|phone|mobile|class|$))/i);
    if (nameMatch) {
      studentName = nameMatch[1].trim();
    } else {
      // Fallback: take leading words
      const cleaned = text
        .replace(/\b([6-9]\d{9})\b/g, '')
        .replace(/(?:father(?:\s*name)?|parent|पिता)\s*[:\-]?\s*([A-Za-z\s]+)/gi, '')
        .replace(/(?:class|कक्षा)\s*(\d{1,2}(?:th|st|nd|rd)?|[A-Za-z]+)/gi, '')
        .replace(/\b(high|priority|urgent|enquiry|admission)\b/gi, '')
        .trim();
      const firstChunk = cleaned.split(/\s+/).slice(0, 3).join(' ');
      if (firstChunk.length >= 3) {
        studentName = firstChunk;
      }
    }

    return {
      studentName,
      parentName,
      phone,
      classId,
      className,
      priority,
      confidence: (studentName ? 0.4 : 0) + (phone ? 0.4 : 0) + (className ? 0.2 : 0)
    };
  }

  // ════════════════════════════════════════════════════════════
  // 6. MODULE 5: HOMEWORK & DAILY DIARY NLP PARSER
  // "Class 10th Math: Chapter 4 Exercise 4.2 solve all questions due tomorrow"
  // ════════════════════════════════════════════════════════════
  public parseHomeworkCommand(
    rawText: string,
    classes: { id: string; name: string; sections?: { id: string; name: string }[] }[] = [],
    subjects: string[] = [],
    teachers: { id: string; fullName?: string; name?: string }[] = []
  ): HomeworkAiCommandResult {
    let text = (rawText || '').trim();
    if (!text) return { confidence: 0 };

    let classId: string | undefined;
    let className: string | undefined;
    let sectionId: string | undefined;
    let sectionName: string | undefined;
    let teacherId: string | undefined;
    let teacherName: string | undefined;
    let subject: string | undefined;
    let title: string | undefined;
    let description: string | undefined;
    let dueDate: string | undefined;

    // 1. Due Date (boundary-checked so "कल" doesn't match inside "कलर" or "कला")
    const today = new Date();
    const formatYmd = (d: Date) => d.toISOString().split('T')[0];
    if (/(?:^|[\s,]+)(?:कल|kal|tomorrow)(?=[\s,]+|$)/i.test(text)) {
      const tom = new Date(today);
      tom.setDate(today.getDate() + 1);
      dueDate = formatYmd(tom);
    } else if (/(?:^|[\s,]+)(?:परसों|parson|day\s*after\s*tomorrow)(?=[\s,]+|$)/i.test(text)) {
      const dat = new Date(today);
      dat.setDate(today.getDate() + 2);
      dueDate = formatYmd(dat);
    } else if (/(?:^|[\s,]+)(?:आज|aaj|today)(?=[\s,]+|$)/i.test(text)) {
      dueDate = formatYmd(today);
    }

    // 2. Teacher Incharge Matching (Hindi & English)
    let matchedTeacherObj: any = null;
    if (teachers && teachers.length > 0) {
      const latinText = this.devanagariToLatin(text);
      const normText = this.normalizePhonetic(latinText || text);

      for (const t of teachers) {
        const tFullName = (t.fullName || t.name || '').trim();
        if (!tFullName) continue;
        const cleanName = tFullName.replace(/^(?:dr\.?|mr\.?|mrs\.?|ms\.?|prof\.?|shri|smt\.?)\s+/i, '');
        const normFull = this.normalizePhonetic(tFullName);
        const normClean = this.normalizePhonetic(cleanName);
        const firstWord = cleanName.split(/\s+/)[0];
        const normFirst = this.normalizePhonetic(firstWord);

        if (
          normText.includes(normFull) ||
          normText.includes(normClean) ||
          (normFirst.length >= 3 && normText.includes(normFirst))
        ) {
          teacherId = t.id;
          teacherName = tFullName;
          matchedTeacherObj = t;
          break;
        }
      }
    }

    // 3. Class Matching (Multi-lingual & Phonetic Aliases)
    const classAliases: { key: string; patterns: RegExp[]; matcher: (c: { id: string; name: string }) => boolean }[] = [
      {
        key: 'playgroup',
        patterns: [/play\s*group/i, /(?:^|[\s,]+)pg(?=[\s,]+|$)/i, /प्ले\s*ग्रुप/i, /प्लेग्रुप/i, /(?:^|[\s,]+)पीजी(?=[\s,]+|$)/i],
        matcher: c => /play|pg/i.test(c.name)
      },
      {
        key: 'nursery',
        patterns: [/nursery/i, /(?:^|[\s,]+)nur(?=[\s,]+|$)/i, /नर्सरी/i, /नरसरी/i],
        matcher: c => /nursery|nur/i.test(c.name)
      },
      {
        key: 'lkg',
        patterns: [/l\.?k\.?g\.?/i, /elkg/i, /lower\s*k/i, /एलकेजी/i, /एल\s*के\s*जी/i, /(?:^|[\s,]+)एलजी(?=[\s,]+|$)/i, /(?:^|[\s,]+)एल\s*जी(?=[\s,]+|$)/i],
        matcher: c => /l\.?k\.?g/i.test(c.name) || /lower/i.test(c.name)
      },
      {
        key: 'ukg',
        patterns: [/u\.?k\.?g\.?/i, /upper\s*k/i, /यूकेजी/i, /यू\s*के\s*जी/i, /(?:^|[\s,]+)यूजी(?=[\s,]+|$)/i, /(?:^|[\s,]+)यू\s*जी(?=[\s,]+|$)/i],
        matcher: c => /u\.?k\.?g/i.test(c.name) || /upper/i.test(c.name)
      },
      {
        key: 'balvatika',
        patterns: [/bal\s*vatika/i, /बालवाटिका/i, /बाल\s*वाटिका/i],
        matcher: c => /bal\s*vatika|बालवाटिका/i.test(c.name)
      },
      {
        key: '12',
        patterns: [/(?:class|कक्षा|क्लास)?\s*(?:12th|twelfth|12|twelve|बारह|बारहवीं)(?=[\s,]+|$)/i],
        matcher: c => /\b12th\b|\b12\b/i.test(c.name)
      },
      {
        key: '11',
        patterns: [/(?:class|कक्षा|क्लास)?\s*(?:11th|eleventh|11|eleven|ग्यारह|ग्यारहवीं)(?=[\s,]+|$)/i],
        matcher: c => /\b11th\b|\b11\b/i.test(c.name)
      },
      {
        key: '10',
        patterns: [/(?:class|कक्षा|क्लास)?\s*(?:10th|tenth|10|ten|टेन|दस|दसवीं)(?=[\s,]+|$)/i],
        matcher: c => /\b10th\b|\b10\b/i.test(c.name)
      },
      {
        key: '9',
        patterns: [/(?:class|कक्षा|क्लास)?\s*(?:9th|ninth|9|nine|नाइन|नौ|नौवीं)(?=[\s,]+|$)/i],
        matcher: c => /\b9th\b|\b9\b/i.test(c.name)
      },
      {
        key: '8',
        patterns: [/(?:class|कक्षा|क्लास)?\s*(?:8th|eighth|8|eight|एट|आठ|आठवीं)(?=[\s,]+|$)/i],
        matcher: c => /\b8th\b|\b8\b/i.test(c.name)
      },
      {
        key: '7',
        patterns: [/(?:class|कक्षा|क्लास)?\s*(?:7th|seventh|7|seven|सेवन|सात|सातवीं)(?=[\s,]+|$)/i],
        matcher: c => /\b7th\b|\b7\b/i.test(c.name)
      },
      {
        key: '6',
        patterns: [/(?:class|कक्षा|क्लास)?\s*(?:6th|sixth|6|six|सिक्स|छह|छठी)(?=[\s,]+|$)/i],
        matcher: c => /\b6th\b|\b6\b/i.test(c.name)
      },
      {
        key: '5',
        patterns: [/(?:class|कक्षा|क्लास)?\s*(?:5th|fifth|5|five|फाइव|पाँच|पाँचवीं)(?=[\s,]+|$)/i],
        matcher: c => /\b5th\b|\b5\b/i.test(c.name)
      },
      {
        key: '4',
        patterns: [/(?:class|कक्षा|क्लास)?\s*(?:4th|fourth|4|four|फोर|चार|चौथी|चतुर्थ)(?=[\s,]+|$)/i],
        matcher: c => /\b4th\b|\b4\b/i.test(c.name)
      },
      {
        key: '3',
        patterns: [/(?:class|कक्षा|क्लास)?\s*(?:3rd|third|3|three|थ्री|तीन|तीसरी|तृतीय)(?=[\s,]+|$)/i],
        matcher: c => /\b3rd\b|\b3\b/i.test(c.name)
      },
      {
        key: '2',
        patterns: [/(?:class|कक्षा|क्लास)?\s*(?:2nd|second|2|two|टू|दो|दूसरी|द्वितीय)(?=[\s,]+|$)/i],
        matcher: c => /\b2nd\b|\b2\b/i.test(c.name)
      },
      {
        key: '1',
        patterns: [/(?:class|कक्षा|क्लास)?\s*(?:1st|first|1|one|वन|एक|पहली|प्रथम)(?=[\s,]+|$)/i],
        matcher: c => /\b1st\b|\b1\b/i.test(c.name)
      }
    ];

    let matchedClassAlias: any = null;
    let foundClassObj: any = null;
    if (classes && classes.length > 0) {
      for (const alias of classAliases) {
        if (alias.patterns.some(p => p.test(text))) {
          const found = classes.find(alias.matcher);
          if (found) {
            classId = found.id;
            className = found.name;
            matchedClassAlias = alias;
            foundClassObj = found;
            break;
          }
        }
      }
      if (!classId) {
        for (const c of classes) {
          const cleanCName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanText = text.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanCName.length >= 2 && cleanText.includes(cleanCName)) {
            classId = c.id;
            className = c.name;
            foundClassObj = c;
            break;
          }
        }
      }
    }

    // 4. Section Matching (e.g. "Section A", "सेक्शन बी", "वर्ग सी")
    const secMatch = text.match(/(?:section|sec|वर्ग|सेक्शन)\s*[:\-]?\s*([A-Za-z0-9])/i);
    if (secMatch) {
      const secLetter = secMatch[1].toUpperCase();
      sectionName = secLetter;
      if (foundClassObj?.sections?.length) {
        const foundSec = foundClassObj.sections.find((s: any) =>
          s.name.toUpperCase().includes(secLetter) ||
          s.name.toUpperCase() === secLetter
        );
        if (foundSec) {
          sectionId = foundSec.id;
        }
      }
    }

    // 5. Subject Matching (Multi-lingual & Phonetic Aliases)
    const subjectAliases = [
      { name: 'Mathematics', patterns: [/(?:^|[\s,]+)(?:math|mathematics|maths|गणित|मैथ|मैथ्स|अंकगणित)(?=[\s,]+|$)/i] },
      { name: 'English', patterns: [/(?:^|[\s,]+)(?:english|eng|अंग्रेजी|अंग्रेज़ी|इंग्लिश)(?=[\s,]+|$)/i] },
      { name: 'Hindi', patterns: [/(?:^|[\s,]+)(?:hindi|हिंदी|हिन्दी)(?=[\s,]+|$)/i] },
      { name: 'Science', patterns: [/(?:^|[\s,]+)(?:science|sci|विज्ञान|साइंस)(?=[\s,]+|$)/i] },
      { name: 'Art & Craft / Drawing', patterns: [/(?:^|[\s,]+)(?:art|drawing|कला|चित्रकला|ड्राइंग|आर्ट|क्राफ्ट)(?=[\s,]+|$)/i] },
      { name: 'Social Science', patterns: [/(?:^|[\s,]+)(?:social|sst|सामाजिक\s*विज्ञान|सोशल\s*साइंस|सोशल|एसएसटी)(?=[\s,]+|$)/i] },
      { name: 'Sanskrit', patterns: [/(?:^|[\s,]+)(?:sanskrit|संस्कृत)(?=[\s,]+|$)/i] },
      { name: 'Computer', patterns: [/(?:^|[\s,]+)(?:computer|it|कंप्यूटर|कम्प्यूटर)(?=[\s,]+|$)/i] },
      { name: 'EVS', patterns: [/(?:^|[\s,]+)(?:evs|पर्यावरण|ईवीएस)(?=[\s,]+|$)/i] },
      { name: 'Physics', patterns: [/(?:^|[\s,]+)(?:physics|भौतिकी|भौतिक\s*विज्ञान)(?=[\s,]+|$)/i] },
      { name: 'Chemistry', patterns: [/(?:^|[\s,]+)(?:chemistry|केमिस्ट्री|रसायन|रसायन\s*विज्ञान)(?=[\s,]+|$)/i] },
      { name: 'Biology', patterns: [/(?:^|[\s,]+)(?:biology|बायोलॉजी|जीव\s*विज्ञान)(?=[\s,]+|$)/i] }
    ];

    for (const sAlias of subjectAliases) {
      if (sAlias.patterns.some(p => p.test(text))) {
        const foundSubject = subjects.find(s =>
          s.toLowerCase().includes(sAlias.name.toLowerCase()) ||
          sAlias.name.toLowerCase().includes(s.toLowerCase())
        );
        subject = foundSubject || sAlias.name;
        break;
      }
    }

    // 6. Clean Remaining Text by removing matched tokens:
    let cleanRemaining = text
      .replace(/(?:due\s*date|जमा\s*की\s*तारीख|तक|due|date)?\s*(?:कल|परसों|आज|tomorrow|kal|today|parson)\b/gi, ' ')
      .trim();

    // Remove Teacher name & title prefixes
    if (matchedTeacherObj) {
      const tFullName = (matchedTeacherObj.fullName || matchedTeacherObj.name || '').trim();
      const cleanTName = tFullName.replace(/^(?:dr\.?|mr\.?|mrs\.?|ms\.?|prof\.?|shri|smt\.?)\s+/i, '');
      const tWords = cleanTName.split(/\s+/).filter((w: string) => w.length >= 3);
      for (const w of tWords) {
        cleanRemaining = cleanRemaining.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' ');
      }
      cleanRemaining = cleanRemaining
        .replace(/(?:टीचर|शिक्षक|अध्यापक|सर|मैडम|डॉक्टर|डॉ\.?|teacher|dr\.?|mr\.?|sir|madam)/gi, ' ')
        .trim();
    }

    // Remove Class tokens
    if (matchedClassAlias) {
      for (const p of matchedClassAlias.patterns) {
        cleanRemaining = cleanRemaining.replace(p, ' ').trim();
      }
    }

    // Remove Section tokens
    if (secMatch) {
      cleanRemaining = cleanRemaining.replace(/(?:section|sec|वर्ग|सेक्शन)\s*[:\-]?\s*([A-Za-z0-9])/gi, ' ').trim();
    }

    // Remove Subject tokens
    if (subject) {
      cleanRemaining = cleanRemaining
        .replace(/math|mathematics|maths|गणित|मैथ|मैथ्स|english|अंग्रेजी|अंग्रेज़ी|इंग्लिश|hindi|हिंदी|हिन्दी|science|विज्ञान|साइंस|art|drawing|कला|ड्राइंग|आर्ट|क्राफ्ट|social|sst|सामाजिक|computer|कंप्यूटर|sanskrit|संस्कृत/gi, ' ')
        .trim();
    }

    cleanRemaining = cleanRemaining.replace(/^[:\-,.\s]+/, '').replace(/[:\-,.\s]+$/, '').trim();

    // 7. Particular Assignment of Title vs Description
    // Only set Title & Description if actual assignment content was spoken!
    if (cleanRemaining.length >= 3) {
      const chMatch = cleanRemaining.match(/(?:chapter|ch\.?|unit|topic|पाठ|अध्याय|प्रश्नावली|अभ्यास|पेज)\s*[:\-]?\s*([^\n,]+)/i);
      if (chMatch) {
        title = chMatch[0].trim().substring(0, 50);
        const descRest = cleanRemaining.replace(chMatch[0], ' ').trim();
        description = descRest.length >= 3 ? descRest : cleanRemaining;
      } else {
        title = cleanRemaining.substring(0, 50);
        description = cleanRemaining;
      }
    }

    return {
      classId,
      className,
      sectionId,
      sectionName,
      teacherId,
      teacherName,
      subject,
      title,
      description,
      dueDate,
      confidence: (className ? 0.3 : 0) + (subject ? 0.3 : 0) + (teacherId ? 0.2 : 0) + (title ? 0.2 : 0)
    };
  }

  // ════════════════════════════════════════════════════════════
  // 7. MODULE 6: EXAM MARKS ENTRY NLP PARSER
  // "Roll 1 ko 45, Roll 2 ko 38, Roll 3 absent, Roll 4 ko 42"
  // ════════════════════════════════════════════════════════════
  public parseMarksCommand(rawText: string, maxMarks: number = 100): MarksAiCommandResult {
    const text = (rawText || '').trim();
    const entries: { rollNumber: string; studentName?: string; marks?: number; isAbsent?: boolean }[] = [];

    if (!text) return { entries, confidence: 0, summary: '' };

    // Matches "Roll 1 ko 45", "Roll 2 38", "Roll 3 absent"
    const pattern = /(?:roll\s*(?:no\.?|number)?\s*[:\-]?\s*)?([0-9A-Za-z\-]+)\s*(?:ko|marks?|=|-|:)?\s*(?:(\d{1,3}(?:\.\d+)?)|absent|अनुपस्थित|गैरहाजिर)/gi;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const roll = match[1].trim();
      const valStr = match[2];
      const fullSubstr = match[0].toLowerCase();

      if (fullSubstr.includes('absent') || fullSubstr.includes('अनुपस्थित') || fullSubstr.includes('गैरहाजिर')) {
        entries.push({ rollNumber: roll, isAbsent: true });
      } else if (valStr) {
        let mVal = parseFloat(valStr);
        if (mVal > maxMarks) mVal = maxMarks; // Clamp
        entries.push({ rollNumber: roll, marks: mVal, isAbsent: false });
      }
    }

    const summary = entries.length > 0
      ? `Parsed marks for ${entries.length} roll numbers.`
      : 'No roll numbers parsed.';

    return {
      entries,
      confidence: entries.length > 0 ? 0.9 : 0.2,
      summary
    };
  }

  // ════════════════════════════════════════════════════════════
  // 8. MODULE 7: NOTICE & CIRCULAR GENERATOR
  // ════════════════════════════════════════════════════════════
  public generateNoticeDraft(
    brief: string,
    instituteName: string = 'Our Institution',
    category: string = 'General Notice'
  ): NoticeAiCommandResult {
    const raw = (brief || '').trim();
    const cleanBrief = raw.replace(/\b(circular|notice|likho|generate|banao)\b/gi, '').trim();

    const title = cleanBrief.length > 0
      ? cleanBrief.charAt(0).toUpperCase() + cleanBrief.slice(1)
      : 'Important Official Notice & Circular';

    const content = `Dear Students, Parents & Respected Staff Members,

This is an official communication from the administration of ${instituteName}.

Please be informed regarding: ${title}.

All concerned are requested to kindly take note of this update and adhere to the scheduled timelines accordingly. For any clarification or assistance, please contact the campus administrative office.

By Order,
Principal / Director
${instituteName}`;

    return {
      title,
      category,
      targetAudience: 'All',
      priority: 'Normal',
      content
    };
  }

  // ════════════════════════════════════════════════════════════
  // 9. MODULE 8: EXECUTIVE DIRECTOR QUERY COPILOT
  // ════════════════════════════════════════════════════════════
  public queryExecutiveDashboard(
    rawQuery: string,
    summary: any,
    instituteName: string = 'Institute'
  ): ExecutiveQueryResult {
    const q = (rawQuery || '').toLowerCase().trim();

    // Student Count
    if (q.includes('student') || q.includes('admission') || q.includes('bachhe') || q.includes('enroll')) {
      const count = summary?.totalStudents ?? 0;
      return {
        question: rawQuery,
        answer: `At ${instituteName}, there are currently **${count}** active enrolled students across School and Coaching wings.`,
        metricType: 'students',
        highlightValue: `${count} Students`
      };
    }

    // Fee Collection
    if (q.includes('collection') || q.includes('fees collected') || q.includes('aaj kitna') || q.includes('month fee') || q.includes('payment')) {
      const col = summary?.totalFeeCollectedThisMonth ?? 0;
      return {
        question: rawQuery,
        answer: `Total fee collected this month at ${instituteName} stands at **₹${col.toLocaleString('en-IN')}**.`,
        metricType: 'fees',
        highlightValue: `₹${col.toLocaleString('en-IN')}`
      };
    }

    // Pending Dues / Receivables
    if (q.includes('due') || q.includes('pending') || q.includes('bakaya') || q.includes('balance') || q.includes('receivable')) {
      const due = summary?.pendingFeesTotal ?? 0;
      return {
        question: rawQuery,
        answer: `Total outstanding fee dues across all enrolled students is **₹${due.toLocaleString('en-IN')}**.`,
        metricType: 'dues',
        highlightValue: `₹${due.toLocaleString('en-IN')}`
      };
    }

    // Teachers / Staff
    if (q.includes('teacher') || q.includes('staff') || q.includes('faculty') || q.includes('shikshak')) {
      const tc = summary?.totalTeachers ?? summary?.activeTeachers ?? 0;
      return {
        question: rawQuery,
        answer: `${instituteName} has **${tc}** active teachers & staff members managing classes and coaching batches.`,
        metricType: 'teachers',
        highlightValue: `${tc} Faculty`
      };
    }

    // Default Overview
    return {
      question: rawQuery,
      answer: `Here is the current executive summary for ${instituteName}: **${summary?.totalStudents ?? 0} Students**, **₹${(summary?.totalFeeCollectedThisMonth ?? 0).toLocaleString('en-IN')}** collected this month, and **₹${(summary?.pendingFeesTotal ?? 0).toLocaleString('en-IN')}** pending dues.`,
      metricType: 'general',
      highlightValue: `${summary?.totalStudents ?? 0} Students`
    };
  }
}

