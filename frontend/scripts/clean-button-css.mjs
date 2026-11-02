// One-off codemod: strip visual overrides (colour, shape, size, shadow, font) from component CSS
// rules whose classes are used EXCLUSIVELY on matButton="filled" buttons. The global M3 rule in
// styles.scss owns the look. Layout props (display, width, margin, gap, ...) are left untouched.
// Usage: node scripts/clean-button-css.mjs [--write] [--verbose]
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const write = process.argv.includes('--write');
const verbose = process.argv.includes('--verbose');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app');

const VISUAL = new Set([
  'background', 'background-color', 'background-image', 'color', 'border', 'border-color', 'border-width',
  'border-style', 'border-radius', 'border-top', 'border-bottom', 'border-left', 'border-right', 'box-shadow',
  'font-weight', 'font-size', 'font-family', 'letter-spacing', 'text-transform', 'height', 'min-height',
  'line-height', 'padding', 'padding-left', 'padding-right', 'padding-top', 'padding-bottom', 'transition',
  'transform', 'filter', 'backdrop-filter'
]);

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const ELEMENT_RE = /<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

function analyseTemplate(tpl) {
  const filled = new Set();
  const other = new Set();
  let m;
  ELEMENT_RE.lastIndex = 0;
  while ((m = ELEMENT_RE.exec(tpl))) {
    const attrs = m[2];
    const isFilled = /\bmatButton="filled"/.test(attrs);
    const classes = [];
    const cm = attrs.match(/(?:^|\s)class="([^"]*)"/);
    if (cm) classes.push(...cm[1].split(/\s+/).filter(Boolean));
    for (const c of classes) {
      if (/[{}$]/.test(c)) continue;
      (isFilled ? filled : other).add(c);
    }
  }
  const exclusive = new Set([...filled].filter(c => !other.has(c) && !c.startsWith('app-button-')));
  return exclusive;
}

function splitTop(sel, ch) {
  const parts = []; let d = 0, cur = '';
  for (const c of sel) {
    if (c === '(' || c === '[') d++;
    if (c === ')' || c === ']') d--;
    if (c === ch && d === 0) { parts.push(cur); cur = ''; } else cur += c;
  }
  parts.push(cur);
  return parts;
}

function selectorMatches(sel, classSet) {
  const parts = splitTop(sel, ',').map(s => s.trim()).filter(Boolean);
  if (!parts.length) return false;
  return parts.every(p => {
    const compounds = p.split(/\s*[>+~]\s*|\s+(?![^(\[]*[)\]])/).filter(Boolean);
    const last = compounds[compounds.length - 1] || '';
    const classes = [...last.matchAll(/\.([\w-]+)/g)].map(x => x[1]);
    return classes.length > 0 && classes.some(c => classSet.has(c));
  });
}

function isVisualDecl(decl) {
  const idx = decl.indexOf(':');
  if (idx < 0) return false;
  const prop = decl.slice(0, idx).replace(/\/\*[\s\S]*?\*\//g, '').trim().toLowerCase();
  return VISUAL.has(prop) || prop.startsWith('--mdc-') || prop.startsWith('--mat-');
}

let removedDecls = 0, removedRules = 0;

function processBody(body, ctxMatched, classSet) {
  let i = 0, out = '';
  while (i < body.length) {
    let j = i, dp = 0, q = null;
    for (; j < body.length; j++) {
      const c = body[j];
      if (q) { if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '(') dp++; else if (c === ')') dp--;
      else if (dp === 0 && (c === '{' || c === ';')) break;
    }
    if (j >= body.length) {
      const rest = body.slice(i);
      if (ctxMatched && rest.trim() && isVisualDecl(rest)) { removedDecls++; } else out += rest;
      break;
    }
    if (body[j] === ';') {
      const decl = body.slice(i, j + 1);
      if (ctxMatched && isVisualDecl(decl)) { removedDecls++; } else out += decl;
      i = j + 1;
    } else {
      const sel = body.slice(i, j);
      let k = j + 1, d = 1, qq = null;
      for (; k < body.length && d > 0; k++) {
        const c = body[k];
        if (qq) { if (c === qq) qq = null; continue; }
        if (c === '"' || c === "'") { qq = c; continue; }
        if (c === '{') d++; else if (c === '}') d--;
      }
      const inner = body.slice(j + 1, k - 1);
      const st = sel.replace(/\/\*[\s\S]*?\*\//g, '').trim();
      let matched = false;
      if (st.startsWith('@')) matched = ctxMatched;
      else if (ctxMatched && st.startsWith('&')) matched = true;
      else matched = selectorMatches(st, classSet);
      const newInner = processBody(inner, matched, classSet);
      if (matched && !st.startsWith('@') && newInner.replace(/\/\*[\s\S]*?\*\//g, '').trim() === '') {
        removedRules++;
        if (verbose) console.log('   dropped rule:', st.replace(/\s+/g, ' '));
      } else {
        out += sel + '{' + newInner + '}';
      }
      i = k;
    }
  }
  return out;
}

const STYLES_RE = /(styles:\s*\[?\s*`)([\s\S]*?)(`\s*\]?)/g;

const files = walk(root);
const byBase = new Map();
for (const f of files) {
  const m = f.match(/^(.*)\.(ts|html|scss|css)$/);
  if (!m) continue;
  if (!byBase.has(m[1])) byBase.set(m[1], {});
  byBase.get(m[1])[m[2]] = f;
}

let touched = 0;
for (const [, g] of byBase) {
  const before = removedDecls;
  const jobs = [];
  if (g.ts) {
    const src = readFileSync(g.ts, 'utf8');
    if (/matButton="filled"/.test(src) || (g.html && /matButton="filled"/.test(readFileSync(g.html, 'utf8')))) {
      const tplSrc = g.html ? readFileSync(g.html, 'utf8') : src;
      const cls = analyseTemplate(tplSrc);
      if (cls.size) {
        // inline styles
        const out = src.replace(STYLES_RE, (all, a, css, c) => a + processBody(css, false, cls) + c);
        if (out !== src) jobs.push([g.ts, out]);
        // external styles
        for (const ext of ['scss', 'css']) {
          if (g[ext]) {
            const css = readFileSync(g[ext], 'utf8');
            const o2 = processBody(css, false, cls);
            if (o2 !== css) jobs.push([g[ext], o2]);
          }
        }
      }
    }
  }
  if (jobs.length && removedDecls > before) {
    touched += jobs.length;
    if (verbose) console.log(jobs.map(j => j[0]).join(', '), '->', removedDecls - before, 'decls');
    if (write) for (const [f, c] of jobs) writeFileSync(f, c, 'utf8');
  }
}
console.log(write ? 'WRITTEN' : 'DRY RUN', { filesTouched: touched, removedDecls, removedRules });

