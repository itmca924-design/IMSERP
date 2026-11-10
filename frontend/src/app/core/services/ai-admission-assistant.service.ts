import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { SchoolClassDto, SchoolSectionDto } from './school.service';
import { BatchDto } from './batches.service';

export interface AiParsedAdmissionData {
  isSchoolStudent?: boolean;
  isCoachingStudent?: boolean;
  isHostelStudent?: boolean;
  isLibraryMember?: boolean;
  isTransportStudent?: boolean;

  // School Academic
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  admissionNumber?: string;
  schoolRollNumber?: string;
  joiningDate?: string;

  // Coaching
  batchId?: string;
  batchName?: string;
  customMonthlyFee?: number;
  coachingJoiningDate?: string;
  coachingRollNumber?: string;

  // Personal & Family
  studentName?: string;
  gender?: 'Male' | 'Female' | 'Other';
  dateOfBirth?: string;
  parentName?: string;
  motherName?: string;
  bloodGroup?: string;
  parentWhatsAppPhone?: string;
  address?: string;

  // Compliance
  aadhaarNumber?: string;
  penNumber?: string;
  apaarId?: string;
  category?: 'General' | 'OBC' | 'SC' | 'ST' | 'EWS';
  religion?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  previousSchoolName?: string;
  previousBoard?: string;

  // Meta
  summaryList: string[];
  confidence: number;
}

@Injectable({
  providedIn: 'root'
})
export class AiAdmissionAssistantService {
  private recognition: any = null;
  private isListening = false;
  private shouldBeListening = false;
  private currentLang = 'hi-IN';
  private transcript$ = new Subject<string>();
  private speechStatus$ = new Subject<'started' | 'stopped' | 'error' | 'unsupported'>();

  constructor(private http: HttpClient) {
    this.initSpeechRecognition();
  }

  // --- 1. SPEECH RECOGNITION (BULLETPROOF REAL-TIME ENGINE) ---

  private initSpeechRecognition(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'hi-IN'; // Native Hindi & Indian English support

      this.recognition.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript + ' ';
        }
        const text = fullTranscript.trim();
        if (text) {
          this.transcript$.next(text);
        }
      };

      this.recognition.onerror = (err: any) => {
        console.warn('AI Speech error:', err?.error || err);
        if (err?.error === 'not-allowed') {
          this.shouldBeListening = false;
          this.isListening = false;
          this.speechStatus$.next('error');
        }
      };

      this.recognition.onend = () => {
        if (this.shouldBeListening) {
          try {
            this.recognition.start();
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
      };
    }
  }

  public isSpeechSupported(): boolean {
    return !!this.recognition;
  }

  public getSpeechTranscript(): Observable<string> {
    return this.transcript$.asObservable();
  }

  public getSpeechStatus(): Observable<'started' | 'stopped' | 'error' | 'unsupported'> {
    return this.speechStatus$.asObservable();
  }

  public startListening(lang: string = 'hi-IN'): void {
    if (!this.recognition) {
      this.speechStatus$.next('unsupported');
      return;
    }
    this.currentLang = lang;
    this.shouldBeListening = true;
    try {
      this.recognition.lang = lang;
      this.recognition.start();
      this.isListening = true;
      this.speechStatus$.next('started');
    } catch (e) {
      // If already started or pending, restart cleanly
      try {
        this.recognition.abort();
        setTimeout(() => {
          if (this.shouldBeListening) {
            this.recognition.lang = lang;
            this.recognition.start();
            this.isListening = true;
            this.speechStatus$.next('started');
          }
        }, 150);
      } catch (innerErr) {
        console.warn('Could not start recognition:', innerErr);
      }
    }
  }

  public stopListening(): void {
    this.shouldBeListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.isListening = false;
      this.speechStatus$.next('stopped');
    }
  }

  public restartWithLanguage(lang: string): void {
    if (!this.recognition) return;
    this.currentLang = lang;
    this.shouldBeListening = true;
    try {
      this.recognition.abort();
    } catch {
      // ignore
    }
    this.isListening = false;
    setTimeout(() => {
      if (this.shouldBeListening) {
        this.startListening(lang);
      }
    }, 200);
  }

  // --- 2. OPTIONAL GEMINI FREE API INTEGRATION ---

  public getSavedGeminiKey(): string {
    return localStorage.getItem('imserp_gemini_api_key') || '';
  }

  public saveGeminiKey(key: string): void {
    if (key) {
      localStorage.setItem('imserp_gemini_api_key', key.trim());
    } else {
      localStorage.removeItem('imserp_gemini_api_key');
    }
  }

  // --- 3. HIGH-PRECISION NATURAL LANGUAGE PARSER (OFFLINE & INSTANT) ---

  public async parseAdmissionInput(
    rawText: string,
    classes: SchoolClassDto[] = [],
    sections: SchoolSectionDto[] = [],
    batches: BatchDto[] = []
  ): Promise<AiParsedAdmissionData> {
    const text = (rawText || '').trim();
    if (!text) {
      return { summaryList: [], confidence: 0 };
    }

    const geminiKey = this.getSavedGeminiKey();
    if (geminiKey) {
      try {
        const geminiResult = await this.parseWithGemini(text, geminiKey, classes, batches);
        if (geminiResult && geminiResult.studentName) {
          return geminiResult;
        }
      } catch (e) {
        console.warn('Gemini call failed, falling back to local NLP parser:', e);
      }
    }

    // Default: High-Precision Local Zero-Latency NLP Engine
    return this.parseLocally(text, classes, sections, batches);
  }

  private parseLocally(
    rawText: string,
    classes: SchoolClassDto[],
    sections: SchoolSectionDto[],
    batches: BatchDto[]
  ): AiParsedAdmissionData {
    // 0. Normalize Devanagari numerals (०-९) to ASCII 0-9
    const text = (rawText || '').replace(/[\u0966-\u096F]/g, d => String(d.charCodeAt(0) - 0x0966));
    const lower = text.toLowerCase();
    const result: AiParsedAdmissionData = {
      summaryList: [],
      confidence: 0.9
    };

    // Common boundary delimiter lookahead (covers both English & Hindi keywords)
    const boundaryKeywords = "(?:father|mother|class|kailash|mobile|phone|contact|whatsapp|dob|janm|address|pata|batch|coaching|fee|kaksha|pita|mata|gender|stream|joining|admission|फादर|पिता|माता|मदर|क्लास|कक्षा|मोबाइल|फोन|नंबर|पता|एड्रेस|बैच|कोचिंग|फीस|फी|जेंडर|लिंग|स्ट्रीम|जॉइनिंग|एडमिशन|दाखिला|जन्म|तारीख|तिथि|$)";

    // 1. Phone number (10 digits, handling spoken spaces like "80883 77 284", taking the LAST mentioned valid phone)
    let cleanPhone = '';
    const phoneKwRegex = /(?:mobile|phone|contact|whatsapp|मोबाइल|फ़ोन|फोन|सम्पर्क|व्हाट्सएप|नंबर)?[\s:-]*(?:number|नंबर)?[\s:-]*((?:\+91[\s-]?)?[6-9][\d\s-]{8,22}\d)/gi;
    let pm: RegExpExecArray | null;
    while ((pm = phoneKwRegex.exec(text)) !== null) {
      const d = pm[1].replace(/\D/g, '');
      if (d.length >= 10) {
        cleanPhone = d.slice(-10); // Last match wins!
      }
    }
    if (!cleanPhone) {
      const allDigits = text.replace(/\D/g, '');
      const match = allDigits.match(/[6-9]\d{9}/g);
      if (match && match.length > 0) cleanPhone = match[match.length - 1]; // Last match wins!
    }
    if (cleanPhone) {
      result.parentWhatsAppPhone = cleanPhone;
      result.summaryList.push(`📱 Mobile: ${cleanPhone}`);
    }

    // 2. Aadhaar number (12 digits)
    const aadhaarMatches = Array.from(text.matchAll(/\b\d{4}\s?\d{4}\s?\d{4}\b/g));
    for (let i = aadhaarMatches.length - 1; i >= 0; i--) {
      const cand = aadhaarMatches[i][0].replace(/\s/g, '');
      if (cand !== result.parentWhatsAppPhone && cand.length === 12) {
        result.aadhaarNumber = cand;
        result.summaryList.push(`🪪 Aadhaar: ${cand}`);
        break;
      }
    }

    // 3. Streams detection (English + Hindi, supports coaching vs school)
    const hasCoachingMention = /\b(coaching|tution|batch|jee|neet|foundation|evening)\b|कोचिंग|ट्यूशन|बैच|फाउंडेशन/i.test(lower);
    const hasSchoolMention = /\b(school|kaksha|class|admit|regular|morning|nursery|lkg|ukg)\b|स्कूल|विद्यालय|कक्षा|क्लास|नर्सरी/i.test(lower);
    const hasHostelMention = /\b(hostel|room|bed|niwas|mess)\b|हॉस्टल|कमरा|छात्रावास/i.test(lower);
    const hasLibraryMention = /\b(library|pustakalay|reading)\b|लाइब्रेरी|पुस्तकालय/i.test(lower);
    const hasTransportMention = /\b(transport|bus|van|pickup|drop|stoppage)\b|ट्रांसपोर्ट|बस|गाड़ी|वाहन/i.test(lower);

    if (hasCoachingMention && hasSchoolMention) {
      result.isSchoolStudent = true;
      result.isCoachingStudent = true;
      result.summaryList.push(`⚡ Streams: School + Coaching (Hybrid)`);
    } else if (hasCoachingMention && !hasSchoolMention) {
      result.isSchoolStudent = false;
      result.isCoachingStudent = true;
      result.summaryList.push(`🎯 Stream: Coaching Only`);
    } else {
      result.isSchoolStudent = true;
      result.isCoachingStudent = false;
      result.summaryList.push(`🏫 Stream: School Enrollment`);
    }

    if (hasHostelMention) {
      result.isHostelStudent = true;
      result.summaryList.push(`🏢 Hostel: Resident Opted`);
    }
    if (hasLibraryMention) {
      result.isLibraryMember = true;
      result.summaryList.push(`📚 Library: Member Opted`);
    }
    if (hasTransportMention) {
      result.isTransportStudent = true;
      result.summaryList.push(`🚌 Transport: Facility Opted`);
    }

    // 4. Class detection (Last Mention Wins! Supports early named classes, Hindi ordinal classes, and digits)
    const hindiClassWords: Record<string, string> = {
      'नर्सरी': 'nursery', 'एलकेजी': 'lkg', 'यूकेजी': 'ukg',
      'पहली': '1', 'प्रथम': '1', 'दूसरी': '2', 'द्वितीय': '2',
      'तीसरी': '3', 'तृतीय': '3', 'चौथी': '4', 'चतुर्थ': '4',
      'पांचवी': '5', 'पांचवीं': '5', 'पंचम': '5',
      'छठी': '6', 'षष्ठ': '6', 'सातवीं': '7', 'सातवी': '7', 'सप्तम': '7',
      'आठवीं': '8', 'आठवी': '8', 'अष्टम': '8',
      'नौवीं': '9', 'नौवी': '9', 'नवम': '9',
      'दसवीं': '10', 'दसवी': '10', 'दशम': '10',
      'ग्यारहवीं': '11', 'ग्यारहवी': '11', 'बारहवीं': '12', 'बारहवी': '12'
    };

    let matchedClass: SchoolClassDto | undefined;
    // Scan all occurrences of class keywords in reverse (Last Mention Wins)
    const classCandidateRegex = /\b(?:class|kailash|kalas|kaksha|std|standard|grade|कक्षा|क्लास)\s*(nursery|lkg|ukg|playgroup|pre-kg|kg|\d{1,2}(?:th|st|nd|rd)?|[ivxlcdm]+|[^\s,;]+)\b/gi;
    const allClassMatches = Array.from(text.matchAll(classCandidateRegex));

    if (allClassMatches.length > 0) {
      for (let i = allClassMatches.length - 1; i >= 0; i--) {
        const rawTarget = allClassMatches[i][1].toLowerCase().replace(/(th|st|nd|rd)$/, '');
        const target = hindiClassWords[rawTarget] || rawTarget;
        const found = classes.find(c => {
          const cn = ((c.name || (c as any).className) || '').toLowerCase();
          return cn === target || cn === `class ${target}` || cn.includes(`${target}th`) || cn.includes(target);
        });
        if (found) {
          matchedClass = found;
          break;
        }
      }
    }

    if (!matchedClass) {
      // Direct named early classes check (nursery / lkg / ukg / नर्सरी)
      for (const [hWord, target] of Object.entries(hindiClassWords)) {
        if (lower.includes(hWord)) {
          matchedClass = classes.find(c => {
            const cn = ((c.name || (c as any).className) || '').toLowerCase();
            return cn.includes(target) || cn.includes(`${target}th`);
          });
          if (matchedClass) break;
        }
      }
    }

    if (!matchedClass) {
      const namedClassMatch = text.match(/\b(nursery|lkg|ukg|playgroup|pre-kg|kg)\b/i);
      if (namedClassMatch) {
        const target = namedClassMatch[1].toLowerCase();
        matchedClass = classes.find(c => {
          const cn = ((c.name || (c as any).className) || '').toLowerCase();
          return cn.includes(target);
        });
      }
    }

    if (matchedClass) {
      result.classId = matchedClass.id;
      result.className = matchedClass.name || (matchedClass as any).className;
      result.summaryList.push(`🎓 Class: ${result.className}`);
    }

    // 5. Section detection (Sec A, B, C... Sec 1...)
    const secMatches = Array.from(lower.matchAll(/(?:section|sec|सेक्शन)[\s:-]*([a-f])/gi));
    if (secMatches.length > 0) {
      const secLetter = secMatches[secMatches.length - 1][1].toUpperCase(); // Last mention wins
      const matchedSec = sections.find(s => ((s.name || (s as any).sectionName) || '').toUpperCase() === secLetter);
      if (matchedSec) {
        result.sectionId = matchedSec.id;
        result.sectionName = matchedSec.name || (matchedSec as any).sectionName;
      } else {
        result.sectionName = secLetter;
      }
      result.summaryList.push(`📋 Section: ${secLetter}`);
    }

    // 6. Coaching Batch & Monthly Fee (ONLY if coaching is enabled)
    if (result.isCoachingStudent && batches.length > 0) {
      for (const b of batches) {
        const bname = (b.name || '').toLowerCase();
        const distinctiveName = bname.replace(/^(class|batch|group)\s+/i, '').trim();
        if (distinctiveName.length >= 3 && lower.includes(distinctiveName)) {
          result.batchId = b.id;
          result.batchName = b.name;
          result.summaryList.push(`🎯 Coaching Batch: ${b.name}`);
          break;
        } else if (lower.includes(bname)) {
          result.batchId = b.id;
          result.batchName = b.name;
          result.summaryList.push(`🎯 Coaching Batch: ${b.name}`);
          break;
        }
      }
    }
    const feeMatches = Array.from(lower.matchAll(/(?:fee|fees|monthly|tuition|shulk|फीस|फी)[\s:-]*(?:₹|rs\.?)?\s*(\d{3,5})/g));
    if (feeMatches.length > 0) {
      result.customMonthlyFee = Number(feeMatches[feeMatches.length - 1][1]); // Last mention wins
      result.summaryList.push(`💰 Monthly Fee: ₹${result.customMonthlyFee}`);
    }

    // 7. Student Name (Phonetic typo-tolerant: student/stunt/stdnt/vidyarthi/स्टूडेंट/विद्यार्थी/छात्र का नाम)
    // Last Mention Wins!
    let sName = '';
    const studentRegex = new RegExp(`(?:student(?:\\s*name)?|stunt(?:\\s*name)?|stdnt(?:\\s*name)?|vidyarthi|स्टूडेंट(?:\\s*नाम)?|विद्यार्थी|छात्र(?:\\s*का\\s*नाम)?)\\s*[:=-]?\\s*([^,:;\\n]+?)(?=\\s+${boundaryKeywords})`, 'gi');
    let sm: RegExpExecArray | null;
    while ((sm = studentRegex.exec(text)) !== null) {
      let cand = sm[1].replace(/['"]+/g, '').trim();
      cand = cand.replace(/\s+(?:ka|ki|ko|ke|admission|का|की|के|को)$/i, '').trim();
      if (cand.length > 1) sName = cand; // Last match wins!
    }
    if (!sName) {
      // Fallback: Check capitalized Latin names or Hindi name prefix
      const hindiNameMatch = text.match(/(?:^|\s)(?:नाम|naam)[\s:-]+([^,:;\n]+?)(?=\s+(?:पिता|फादर|father|class|$))/i);
      if (hindiNameMatch) {
        sName = hindiNameMatch[1].trim();
      } else {
        const capMatch = text.match(/\b([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,})\b/);
        if (capMatch) sName = capMatch[1].trim();
      }
    }
    if (sName) {
      result.studentName = sName;
      result.summaryList.push(`👤 Student: ${sName}`);
    }

    // 8. Father's / Guardian's Name (Last Mention Wins! Never captures student name)
    let fName = '';
    const fatherRegex = new RegExp(`(?:father(?:\\s*'?s)?(?:\\s+name)?|pita|guardian|s\\/o|d\\/o|फादर(?:\\s+का\\s+नाम)?|पिता(?:जी)?(?:\\s+का\\s+नाम)?|अभिभावक)\\s*[:=-]?\\s*([^,:;\\n]+?)(?=\\s+${boundaryKeywords})`, 'gi');
    let fm: RegExpExecArray | null;
    while ((fm = fatherRegex.exec(text)) !== null) {
      let cand = fm[1].replace(/['"]+/g, '').trim();
      cand = cand.replace(/\s+(?:ka|ki|ko|ke|mobile|phone|number|का|की|के|को|मोबाइल|फोन|नंबर)$/i, '').trim();
      if (cand.length > 1) fName = cand; // Last match wins!
    }
    if (fName) {
      result.parentName = fName;
      result.summaryList.push(`👨 Father: ${fName}`);
    } else if (result.studentName) {
      const allNames = Array.from(text.matchAll(/\b([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,})\b/g)).map(m => m[1]);
      const otherNames = allNames.filter(n => n !== result.studentName);
      if (otherNames.length > 0) {
        result.parentName = otherNames[otherNames.length - 1];
        result.summaryList.push(`👨 Father/Guardian: ${result.parentName}`);
      }
    }

    // 9. Mother's Name (Last Mention Wins!)
    let mName = '';
    const motherRegex = new RegExp(`(?:mother(?:\\s*'?s)?(?:\\s+name)?|mata|maa|मदर(?:\\s+का\\s+नाम)?|माता(?:जी)?(?:\\s+का\\s+नाम)?|माँ)\\s*[:=-]?\\s*([^,:;\\n]+?)(?=\\s+${boundaryKeywords})`, 'gi');
    let mm: RegExpExecArray | null;
    while ((mm = motherRegex.exec(text)) !== null) {
      let cand = mm[1].replace(/['"]+/g, '').trim();
      if (cand.length > 1) mName = cand;
    }
    if (mName) {
      result.motherName = mName;
      result.summaryList.push(`👩 Mother: ${mName}`);
    }

    // 10. Gender (English + Hindi, auto-detects from honorifics/names or explicit mention)
    if (/female|girl|ladki|kumari|devi|beti|monica|monika|sunita|priya|anjali|pooja|sneha|फीमेल|महिला|लड़की|छात्रा|कुमारी|देवी/i.test(lower) || /kumari|devi|कुमारी|देवी/i.test(result.studentName || '')) {
      result.gender = 'Female';
    } else {
      result.gender = 'Male';
    }
    result.summaryList.push(`🚻 Gender: ${result.gender}`);

    // 11. Admission / Joining Date (Last Mention Wins! If user corrects e.g. "1 Jan ... 1 August 2026", final takes effect)
    let parsedJoiningDate = '';
    const joinDateRegex = /(?:joining(?:\s+date)?|admission(?:\s+date)?|join(?:\s+date)?|dakhila(?:\s+tarikh)?|जॉइनिंग(?:\s+डेट)?|एडमिशन(?:\s+डेट)?|दाखिला(?:\s+तारीख)?)[\s:-]+(\d{1,2})(?:st|nd|rd|th)?[\s\/\-]+([a-zA-Z\u0900-\u097F]+|\d{1,2})(?:[\s\/\-]+(\d{2,4}))?/gi;
    let jm: RegExpExecArray | null;
    while ((jm = joinDateRegex.exec(text)) !== null) {
      const pd = this.parseFlexibleDate(jm[1], jm[2], jm[3]);
      if (pd) parsedJoiningDate = pd; // Last match wins!
    }
    if (!parsedJoiningDate) {
      const joinIsoMatch = text.match(/(?:joining(?:\s+date)?|admission(?:\s+date)?|join(?:\s+date)?)[\s:-]+(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/i);
      if (joinIsoMatch) {
        const parsed = this.parseFlexibleDate(joinIsoMatch[3], joinIsoMatch[2], joinIsoMatch[1]);
        if (parsed) parsedJoiningDate = parsed;
      }
    }

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    result.joiningDate = parsedJoiningDate || todayStr;
    result.coachingJoiningDate = result.joiningDate;
    if (parsedJoiningDate) {
      result.summaryList.push(`📅 Admission Date: ${result.joiningDate}`);
    }

    // Coaching-specific Entry Date (if mentioned distinctly)
    const coachDateRegex = /(?:coaching(?:\s+entry|\s+joining)?(?:\s+date)?|coach(?:\s+date)?|कोचिंग(?:\s+जॉइनिंग|\s+तारीख)?)[\s:-]+(\d{1,2})(?:st|nd|rd|th)?[\s\/\-]+([a-zA-Z\u0900-\u097F]+|\d{1,2})(?:[\s\/\-]+(\d{2,4}))?/gi;
    let cm: RegExpExecArray | null;
    while ((cm = coachDateRegex.exec(text)) !== null) {
      const parsedCoach = this.parseFlexibleDate(cm[1], cm[2], cm[3]);
      if (parsedCoach) {
        result.coachingJoiningDate = parsedCoach; // Last match wins!
        result.summaryList.push(`🎯 Coaching Entry Date: ${parsedCoach}`);
      }
    }

    // 12. Date of Birth Detection (Last Mention Wins!)
    let parsedDob = '';
    const dobRegex = /(?:dob|birth(?:\s+date)?|janm(?:\s+tarikh|\s+tithi)?|जन्म(?:\s+तारीख|\s+तिथि)?)[\s:-]+(\d{1,2})(?:st|nd|rd|th)?[\s\/\-]+([a-zA-Z\u0900-\u097F]+|\d{1,2})(?:[\s\/\-]+(\d{2,4}))?/gi;
    let dm: RegExpExecArray | null;
    while ((dm = dobRegex.exec(text)) !== null) {
      const pd = this.parseFlexibleDate(dm[1], dm[2], dm[3]);
      if (pd) parsedDob = pd; // Last match wins!
    }
    if (parsedDob && parsedDob !== result.joiningDate) {
      result.dateOfBirth = parsedDob;
      result.summaryList.push(`🎂 DOB: ${parsedDob}`);
    }

    // 13. Address Detection (English + Hindi)
    const addrRegex = new RegExp(`(?:address|pata|rehne\\s+wala|vill|village|at|post|एड्रेस|पता|ग्राम|गाँव|स्थान|मोहल्ला)[\\s:-]+([^,:;\\n]+?)(?=\\s+${boundaryKeywords})`, 'gi');
    let am: RegExpExecArray | null;
    let cleanAddr = '';
    while ((am = addrRegex.exec(text)) !== null) {
      let cand = am[1].trim().replace(/,+$/, '');
      cand = cand.replace(/\s+(?:school|coaching|स्कूल|कोचिंग)$/i, '').trim();
      if (cand.length > 2) cleanAddr = cand; // Last match wins!
    }
    if (cleanAddr) {
      result.address = cleanAddr;
      result.summaryList.push(`📍 Address: ${cleanAddr}`);
    } else {
      const locMatch = text.match(/\b(Parsa|Saran|Anjani|Patna|Chhapra|Bihar|Banjari|Dighwara|Garkha|अंजनी|परसा|सारण|पटना|छपरा)\b/i);
      if (locMatch) {
        result.address = locMatch[0] + ', Bihar';
        result.summaryList.push(`📍 Address: ${result.address}`);
      }
    }

    // 14. Category Detection (Strict word boundaries to avoid matching 'August', '1st', etc.)
    if (/\bobc\b|ओबीसी/i.test(lower)) result.category = 'OBC';
    else if (/\bsc\b|एससी/i.test(lower)) result.category = 'SC';
    else if (/\bst\b|एसटी/i.test(lower)) result.category = 'ST';
    else if (/\bews\b|ईडब्ल्यूएस/i.test(lower)) result.category = 'EWS';
    else result.category = 'General';

    if (result.category && result.category !== 'General') {
      result.summaryList.push(`🏷️ Category: ${result.category}`);
    }

    // 15. Blood Group
    const bgMatch = text.match(/\b(A|B|AB|O)[+-]\b/i);
    if (bgMatch) {
      result.bloodGroup = bgMatch[0].toUpperCase();
      result.summaryList.push(`🩸 Blood Group: ${result.bloodGroup}`);
    }

    return result;
  }

  private parseFlexibleDate(dayStr: string, monthStr: string, yearStr?: string): string | null {
    const monthMap: Record<string, number> = {
      // English / Hinglish
      jan: 1, january: 1, janvari: 1,
      feb: 2, february: 2, farvari: 2,
      mar: 3, march: 3,
      apr: 4, april: 4, aprail: 4,
      may: 5, mai: 5,
      jun: 6, june: 6,
      jul: 7, july: 7, julai: 7,
      aug: 8, august: 8, agast: 8,
      sep: 9, sept: 9, september: 9, sitambar: 9,
      oct: 10, octo: 10, october: 10, aktubar: 10,
      nov: 11, november: 11, navambar: 11,
      dec: 12, december: 12, disambar: 12,
      // Devanagari Hindi
      'जनवरी': 1, 'फरवरी': 2, 'मार्च': 3, 'अप्रैल': 4,
      'मई': 5, 'जून': 6, 'जुलाई': 7, 'अगस्त': 8,
      'सितंबर': 9, 'सितम्बर': 9, 'अक्टूबर': 10, 'नवंबर': 11, 'नवम्बर': 11, 'दिसंबर': 12, 'दिसम्बर': 12
    };

    let day = parseInt(dayStr, 10);
    let month = 0;
    const mClean = (monthStr || '').trim().toLowerCase();
    if (monthMap[mClean]) {
      month = monthMap[mClean];
    } else if (monthMap[monthStr]) {
      month = monthMap[monthStr];
    } else {
      month = parseInt(monthStr, 10);
    }
    let year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1950 && year <= 2035) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return null;
  }

  // --- 4. GOOGLE GEMINI FLASH API CALLER ---

  private async parseWithGemini(
    text: string,
    apiKey: string,
    classes: SchoolClassDto[],
    batches: BatchDto[]
  ): Promise<AiParsedAdmissionData | null> {
    const classNames = classes.map(c => c.name || (c as any).className).join(', ');
    const batchNames = batches.map(b => b.name).join(', ');

    const prompt = `You are an intelligent ERP student admission extraction assistant.
Extract structured student admission details from this voice note / raw text:
"${text}"

Available classes in school: [${classNames}]
Available coaching batches: [${batchNames}]

Return strictly a valid JSON object matching this schema with NO markdown and NO explanation:
{
  "studentName": "full name of student",
  "gender": "Male" or "Female",
  "dateOfBirth": "YYYY-MM-DD" or null,
  "parentName": "father or guardian full name",
  "motherName": "mother name or null",
  "parentWhatsAppPhone": "10-digit mobile number",
  "address": "residential address",
  "category": "General" or "OBC" or "SC" or "ST" or "EWS",
  "bloodGroup": "A+" etc or null,
  "aadhaarNumber": "12-digit number without spaces or null",
  "isSchoolStudent": true or false,
  "isCoachingStudent": true or false,
  "isHostelStudent": true or false,
  "isLibraryMember": true or false,
  "isTransportStudent": true or false,
  "className": "matching class name from list or null",
  "sectionName": "A", "B", etc or null,
  "batchName": "matching batch name from list or null",
  "customMonthlyFee": number or null
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    };

    const response: any = await this.http.post(url, payload).toPromise();
    const rawJson = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) return null;

    const parsed = JSON.parse(rawJson);
    const summary: string[] = [];

    if (parsed.studentName) summary.push(`👤 Student: ${parsed.studentName}`);
    if (parsed.parentName) summary.push(`👨 Father: ${parsed.parentName}`);
    if (parsed.parentWhatsAppPhone) summary.push(`📱 Mobile: ${parsed.parentWhatsAppPhone}`);
    if (parsed.className) summary.push(`🎓 Class: ${parsed.className}`);
    if (parsed.batchName) summary.push(`🎯 Batch: ${parsed.batchName}`);
    if (parsed.customMonthlyFee) summary.push(`💰 Monthly Fee: ₹${parsed.customMonthlyFee}`);
    if (parsed.address) summary.push(`📍 Address: ${parsed.address}`);

    const matchedClass = classes.find(c => (c.name || (c as any).className)?.toLowerCase() === parsed.className?.toLowerCase());
    const matchedBatch = batches.find(b => b.name?.toLowerCase() === parsed.batchName?.toLowerCase());

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return {
      ...parsed,
      classId: matchedClass?.id,
      batchId: matchedBatch?.id,
      joiningDate: todayStr,
      coachingJoiningDate: todayStr,
      summaryList: summary,
      confidence: 0.98
    };
  }
}
