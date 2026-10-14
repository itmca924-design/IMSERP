import { Injectable } from '@angular/core';

export const HINDI_QUICK_PRESETS: string[] = [
  "'अ' से 'अः' तक",
  "'क' से 'ज्ञ' तक",
  "'कि' से 'की' तक",
  "दो अक्षर वाले शब्द",
  "तीन अक्षर वाले शब्द",
  "चार अक्षर वाले शब्द",
  "मात्रा अभ्यास",
  "सुलेख (1 पेज)",
  "कविता याद करना",
  "चित्र देखकर नाम लिखो",
  "खाली स्थान भरो",
  "वर्णमाला अभ्यास"
];

// Offline common dictionary for instantaneous & reliable zero-latency school keywords
const HINDI_COMMON_WORDS: Record<string, string> = {
  ki: 'कि',
  kee: 'की',
  ka: 'का',
  ke: 'के',
  ko: 'को',
  se: 'से',
  tak: 'तक',
  k: 'क',
  kh: 'ख',
  g: 'ग',
  gh: 'घ',
  ch: 'च',
  j: 'ज',
  t: 'ट',
  th: 'ठ',
  d: 'ड',
  ta: 'त',
  tha: 'थ',
  da: 'द',
  dha: 'ध',
  na: 'न',
  p: 'प',
  ph: 'फ',
  b: 'ब',
  bh: 'भ',
  m: 'म',
  y: 'य',
  r: 'र',
  l: 'ल',
  v: 'व',
  w: 'व',
  s: 'स',
  sh: 'श',
  h: 'ह',
  gya: 'ज्ञ',
  ksha: 'क्ष',
  tra: 'त्र',
  likho: 'लिखो',
  likhna: 'लिखना',
  padho: 'पढ़ो',
  padhna: 'पढ़ना',
  yaad: 'याद',
  karo: 'करो',
  karna: 'करना',
  aur: 'और',
  ek: 'एक',
  do: 'दो',
  teen: 'तीन',
  char: 'चार',
  paanch: 'पांच',
  chhah: 'छह',
  saat: 'सात',
  aath: 'आठ',
  nau: 'नौ',
  das: 'दस',
  shabd: 'शब्द',
  akshar: 'अक्षर',
  matra: 'मात्रा',
  sulekh: 'सुलेख',
  kavita: 'कविता',
  abhyas: 'अभ्यास',
  prashn: 'प्रश्न',
  uttar: 'उत्तर',
  paath: 'पाठ',
  page: 'पेज',
  naam: 'नाम',
  rang: 'रंग',
  bharo: 'भरो',
  chitra: 'चित्र',
  dekhkar: 'देखकर',
  khalistan: 'खाली स्थान',
  varnamala: 'वर्णमाला',
  swar: 'स्वर',
  vyanjan: 'व्यंजन',
  koshish: 'कोशिश',
  kary: 'कार्य',
  karya: 'कार्य',
  shuddha: 'शुद्ध',
  ashuddha: 'अशुद्ध',
  vakya: 'वाक्य',
  banao: 'बनाओ',
  kahani: 'कहानी',
  geet: 'गीत',
  namaste: 'नमस्ते',
  dhanyawad: 'धन्यवाद',
  shubh: 'शुभ',
  prabhat: 'प्रभात'
};

@Injectable({
  providedIn: 'root'
})
export class HindiTransliterationService {
  private cache = new Map<string, string>();

  constructor() {
    // Pre-populate cache with common words
    for (const [en, hi] of Object.entries(HINDI_COMMON_WORDS)) {
      this.cache.set(en.toLowerCase(), hi);
    }
  }

  /**
   * Returns true if subject name represents Hindi or Sanskrit
   */
  isHindiSubject(subjectName: string | null | undefined): boolean {
    if (!subjectName) return false;
    const s = subjectName.toLowerCase().trim();
    return (
      s.includes('hindi') ||
      s.includes('हिंदी') ||
      s.includes('हिन्दी') ||
      s.includes('sanskrit') ||
      s.includes('संस्कृत')
    );
  }

  /**
   * Transliterates a single English word to Hindi Devanagari.
   */
  /**
   * Transliterates a single English word to Hindi Devanagari.
   */
  async transliterateWord(rawWord: string): Promise<string> {
    const cleanWord = rawWord.trim();
    if (!cleanWord) return rawWord;

    // Check if word is already Devanagari (contains characters in range \u0900-\u097F)
    if (/[\u0900-\u097F]/.test(cleanWord)) {
      return cleanWord;
    }

    const lower = cleanWord.toLowerCase();

    // 1. Check in-memory cache / common dictionary
    if (this.cache.has(lower)) {
      return this.cache.get(lower)!;
    }

    // 2. Call backend proxy endpoint (which forwards to Google Input Tools with zero CORS blocks)
    try {
      const url = `http://localhost:5000/api/homework/transliterate?text=${encodeURIComponent(cleanWord)}&num=4`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const json = await resp.json();
        if (json?.success && json?.result) {
          let chosen = json.result;
          if (lower === 'ki' && json.candidates?.includes('कि')) {
            chosen = 'कि';
          }
          this.cache.set(lower, chosen);
          return chosen;
        }
      }
    } catch {
      // Network error or timeout; fallback to local rule-based phonetic engine
    }

    // 3. Fallback to local rule-based phonetic engine
    const local = this.localPhoneticFallback(cleanWord);
    this.cache.set(lower, local);
    return local;
  }

  /**
   * Transliterates an entire string/sentence of English text into Hindi Devanagari.
   */
  async transliterateSentence(text: string): Promise<string> {
    if (!text || !text.trim()) return text;

    // If text has English characters, try translating the full sentence via backend proxy first
    if (/[a-zA-Z]/.test(text)) {
      try {
        const url = `http://localhost:5000/api/homework/transliterate?text=${encodeURIComponent(text.trim())}&num=2`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (resp.ok) {
          const json = await resp.json();
          if (json?.success && json?.result) {
            return json.result;
          }
        }
      } catch {
        // Fallback to token-by-token below
      }
    }

    // Split keeping whitespace and punctuation
    const tokens = text.split(/(\s+|[.,;!?()[\]{}'"`]+)/);
    const result: string[] = [];

    for (const token of tokens) {
      if (!token) continue;
      // If token is word (alphanumeric) and not already Devanagari
      if (/^[a-zA-Z0-9]+$/.test(token) && !/[\u0900-\u097F]/.test(token)) {
        const hi = await this.transliterateWord(token);
        result.push(hi);
      } else {
        result.push(token);
      }
    }

    return result.join('');
  }

  /**
   * Local rule-based transliterator engine for offline / instant fallback.
   */
  private localPhoneticFallback(word: string): string {
    const lower = word.toLowerCase();
    if (HINDI_COMMON_WORDS[lower]) {
      return HINDI_COMMON_WORDS[lower];
    }

    // Basic syllabic phonetic transliteration
    const vowels: Record<string, string> = {
      aa: 'आ', ee: 'ई', oo: 'ऊ', ai: 'ऐ', au: 'औ',
      a: 'अ', i: 'इ', u: 'उ', e: 'ए', o: 'ओ'
    };
    const matras: Record<string, string> = {
      aa: 'ा', ee: 'ी', oo: 'ू', ai: 'ै', au: 'ौ',
      a: '', i: 'ि', u: 'ु', e: 'े', o: 'ो'
    };
    const consonants: Record<string, string> = {
      ksha: 'क्ष', gya: 'ज्ञ', tra: 'त्र',
      chh: 'छ', kh: 'ख', gh: 'घ', jh: 'झ', th: 'ठ', dh: 'ढ',
      ph: 'फ', bh: 'भ', shh: 'ष', sh: 'श',
      k: 'क', g: 'ग', ch: 'च', j: 'ज', t: 'त', d: 'द',
      n: 'न', p: 'प', b: 'ब', m: 'म', y: 'य', r: 'र',
      l: 'ल', v: 'व', w: 'व', s: 'स', h: 'ह'
    };

    let result = '';
    let i = 0;
    let prevIsConsonant = false;

    while (i < lower.length) {
      // Check 4-char, 3-char, 2-char, 1-char matches
      let matched = false;

      // Consonants first
      for (const len of [4, 3, 2, 1]) {
        if (i + len <= lower.length) {
          const sub = lower.slice(i, i + len);
          if (consonants[sub]) {
            result += consonants[sub];
            i += len;
            prevIsConsonant = true;
            matched = true;
            break;
          }
        }
      }
      if (matched) continue;

      // Vowels / Matras
      for (const len of [2, 1]) {
        if (i + len <= lower.length) {
          const sub = lower.slice(i, i + len);
          if (prevIsConsonant && matras[sub] !== undefined) {
            result += matras[sub];
            i += len;
            prevIsConsonant = false;
            matched = true;
            break;
          } else if (!prevIsConsonant && vowels[sub]) {
            result += vowels[sub];
            i += len;
            prevIsConsonant = false;
            matched = true;
            break;
          }
        }
      }
      if (matched) continue;

      // Other char (numbers, punctuation, unmapped letters)
      result += lower[i];
      prevIsConsonant = false;
      i++;
    }

    return result || word;
  }
}
