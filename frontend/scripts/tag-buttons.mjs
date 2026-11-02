// One-off codemod: tag matButton="filled" buttons with semantic classes based on literal label text.
// Usage: node scripts/tag-buttons.mjs [--write]
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const write = process.argv.includes('--write');
const root = new URL('../src/app', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const CANCEL = /^(cancel|close|back|dismiss|no|skip|not now|discard|later|no,? keep.*|go back|reset|clear|clear filters?)$/i;
const DELETE = /^(delete|remove|deactivate|revoke|delete .+|remove .+)$/i;
const UPDATE = /\b(update|edit|modify)\b|save changes/i;
const SAVE = /\bsave\b/i;

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|html)$/.test(f)) out.push(p);
  }
  return out;
}

function labelOf(inner) {
  const text = inner
    .replace(/<mat-icon[^>]*>[\s\S]*?<\/mat-icon>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

function addClass(attrs, cls) {
  if (attrs.includes(cls)) return attrs;
  const m = attrs.match(/(^|\s)class="([^"]*)"/);
  if (m) return attrs.replace(m[0], `${m[1]}class="${m[2]} ${cls}"`);
  return `${attrs} class="${cls}"`;
}

function addAttribute(attrs, name, value) {
  if (attrs.includes(name)) return attrs;
  return `${attrs} ${name}="${value}"`;
}

function dynamicActionBindings(inner) {
  const ternary = /([A-Za-z_$][\w$.]*)\s*\?\s*(['"])([^'"]*)\2\s*:\s*(['"])([^'"]*)\4/gi;
  for (const match of inner.matchAll(ternary)) {
    const [, condition, , truthyLabel, , falsyLabel] = match;
    const truthyIsUpdate = /update|save changes/i.test(truthyLabel);
    const falsyIsUpdate = /update|save changes/i.test(falsyLabel);
    if (!truthyIsUpdate && !falsyIsUpdate) continue;

    const updateCondition = truthyIsUpdate ? condition : `!(${condition})`;
    const saveLabel = truthyIsUpdate ? falsyLabel : truthyLabel;
    const saveCondition = truthyIsUpdate ? `!(${condition})` : condition;
    const bindings = [['[class.app-button-update]', updateCondition]];
    if (/save|create|add|publish|schedule|submit|record|assign|confirm|upload|generate/i.test(saveLabel)) {
      bindings.push(['[class.app-button-save]', saveCondition]);
    }
    return bindings;
  }
  return '';
}

const stats = { cancel: 0, delete: 0, update: 0, save: 0, files: 0 };
const re = /<button\b([^>]*?\bmatButton="filled"[^>]*)>([\s\S]*?)<\/button>/g;

for (const file of walk(root)) {
  const src = readFileSync(file, 'utf8');
  let changed = false;
  const out = src.replace(re, (full, attrs, inner) => {
    const dynamicBindings = dynamicActionBindings(inner);
    if (dynamicBindings) {
      const newAttrs = dynamicBindings.reduce(
        (result, [name, value]) => addAttribute(result, name, value),
        attrs
      );
      if (newAttrs !== attrs) {
        stats.update++;
        if (dynamicBindings.some(([name]) => name.includes('app-button-save'))) stats.save++;
        changed = true;
        return `<button${newAttrs}>${inner}</button>`;
      }
      return full;
    }

    const label = labelOf(inner);
    let cls = null;
    if (CANCEL.test(label)) cls = 'app-button-cancel';
    else if (DELETE.test(label)) cls = 'app-button-delete';
    else if (UPDATE.test(label)) cls = 'app-button-update';
    else if (SAVE.test(label)) cls = 'app-button-save';
    if (!cls) return full;
    const newAttrs = addClass(attrs, cls);
    if (newAttrs === attrs) return full;
    stats[cls.replace('app-button-', '')]++;
    changed = true;
    return `<button${newAttrs}>${inner}</button>`;
  });
  if (changed) {
    stats.files++;
    if (write) writeFileSync(file, out, 'utf8');
  }
}
console.log(write ? 'WRITTEN' : 'DRY RUN', stats);
