import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// ── Global Accessibility Fix: Chrome "Blocked aria-hidden on focused element" ──
// Chrome 122+ logs a warning synchronously inside Element::setAttribute when an element or its ancestor
// has aria-hidden="true" while holding focus (e.g. CDK dialog setting aria-hidden on app-root, or mat-tab pagination).
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // 1. Intercept console.warn
  const _origWarn = console.warn;
  console.warn = function (...args: any[]) {
    if (typeof args[0] === 'string' && args[0].includes('Blocked aria-hidden on an element because its descendant retained focus')) {
      return;
    }
    _origWarn.apply(console, args);
  };

  // 2. Synchronously blur focused descendants BEFORE aria-hidden="true" is set on any container (like app-root)
  const origSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name: string, value: string) {
    if (typeof name === 'string' && name.toLowerCase() === 'aria-hidden' && String(value) === 'true') {
      if (this.classList && this.classList.contains('mat-mdc-tab-header-pagination')) {
        return;
      }
      const active = document.activeElement;
      if (active && (active === this || this.contains(active))) {
        if (active instanceof HTMLElement) {
          active.blur();
        }
      }
    }
    return origSetAttribute.call(this, name, value);
  };

  const origSetAttributeNode = Element.prototype.setAttributeNode;
  Element.prototype.setAttributeNode = function (attr: Attr) {
    if (attr && attr.name && attr.name.toLowerCase() === 'aria-hidden' && attr.value === 'true') {
      if (this.classList && this.classList.contains('mat-mdc-tab-header-pagination')) {
        return null;
      }
      const active = document.activeElement;
      if (active && (active === this || this.contains(active))) {
        if (active instanceof HTMLElement) {
          active.blur();
        }
      }
    }
    return origSetAttributeNode.call(this, attr);
  };

  // 3. Clear aria-hidden on any element that receives focus
  const cleanFocusedAriaHidden = (target: EventTarget | null) => {
    let el = target instanceof HTMLElement ? target : null;
    while (el && el !== document.documentElement) {
      if (el.getAttribute('aria-hidden') === 'true') {
        el.removeAttribute('aria-hidden');
      }
      el = el.parentElement;
    }
  };

  window.addEventListener('focusin', (e) => cleanFocusedAriaHidden(e.target), true);
  window.addEventListener('pointerdown', (e) => cleanFocusedAriaHidden(e.target), true);
  window.addEventListener('mousedown', (e) => cleanFocusedAriaHidden(e.target), true);

  // 4. Sanitize aria-hidden from pagination buttons
  const sanitizeAriaHidden = (root: Node = document.documentElement) => {
    if (root instanceof HTMLElement) {
      if (root.classList?.contains('mat-mdc-tab-header-pagination') && root.hasAttribute('aria-hidden')) {
        root.removeAttribute('aria-hidden');
      }
      const btns = root.querySelectorAll?.('.mat-mdc-tab-header-pagination[aria-hidden]');
      btns?.forEach((b) => b.removeAttribute('aria-hidden'));
    }
  };

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'aria-hidden') {
        const target = m.target as HTMLElement;
        if (target?.classList?.contains('mat-mdc-tab-header-pagination')) {
          target.removeAttribute('aria-hidden');
        }
      } else if (m.type === 'childList') {
        for (const node of Array.from(m.addedNodes)) {
          sanitizeAriaHidden(node);
        }
      }
    }
  });

  if (document.documentElement) {
    sanitizeAriaHidden();
    observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['aria-hidden']
    });
  }
}

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));

