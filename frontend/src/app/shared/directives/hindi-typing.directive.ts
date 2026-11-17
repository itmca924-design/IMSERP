import { Directive, ElementRef, Input, HostListener, Optional, Self } from '@angular/core';
import { NgControl } from '@angular/forms';
import { HindiTransliterationService } from '../../core/services/hindi-transliteration.service';

@Directive({
  selector: 'textarea[appHindiTyping], input[appHindiTyping]',
  standalone: true
})
export class HindiTypingDirective {
  /**
   * When true, English words typed before space/enter/punctuation
   * are automatically transliterated to Hindi Devanagari.
   */
  @Input('appHindiTyping') enabled: boolean = true;

  private isProcessing = false;

  constructor(
    private el: ElementRef<HTMLTextAreaElement | HTMLInputElement>,
    private hindiService: HindiTransliterationService,
    @Optional() @Self() private ngControl?: NgControl
  ) {}

  @HostListener('keydown', ['$event'])
  async onKeydown(rawEvent: Event): Promise<void> {
    if (!this.enabled || this.isProcessing) return;

    const event = rawEvent as KeyboardEvent;
    // Ignore composition (IME) or key combinations (Ctrl, Alt, Meta)
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;

    // Trigger on Space, Enter, or common punctuation marks
    const triggerKeys = [' ', 'Enter', ',', '.', '?', '!', ';'];
    if (!triggerKeys.includes(event.key)) return;

    const input = this.el.nativeElement;
    const selStart = input.selectionStart;
    const selEnd = input.selectionEnd;

    // Only process when there is a collapsed cursor (no text selection range)
    if (selStart === null || selStart !== selEnd) return;

    const val = input.value || '';
    const beforeCursor = val.slice(0, selStart);
    const afterCursor = val.slice(selStart);

    // Extract the English word immediately before the cursor
    const match = beforeCursor.match(/([a-zA-Z0-9'"`]+)$/);
    if (!match) return;

    const rawWord = match[1];

    // Must contain at least one English letter to transliterate
    if (!/[a-zA-Z]/.test(rawWord)) return;

    // Prevent default insertion of the trigger key while we await the transliteration
    event.preventDefault();
    this.isProcessing = true;

    try {
      const converted = await this.hindiService.transliterateWord(rawWord);
      const prefix = beforeCursor.slice(0, beforeCursor.length - rawWord.length);
      const delimiter = event.key === 'Enter' ? '\n' : event.key;

      const nextVal = prefix + converted + delimiter + afterCursor;
      input.value = nextVal;

      // Update Angular form control / ngModel if present
      if (this.ngControl?.control) {
        this.ngControl.control.setValue(nextVal);
        this.ngControl.control.markAsDirty();
      }

      // Dispatch native input event so two-way bindings ([(ngModel)]) update immediately
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // Restore cursor position right after the converted word + delimiter
      const newCursorPos = prefix.length + converted.length + delimiter.length;
      setTimeout(() => {
        input.setSelectionRange(newCursorPos, newCursorPos);
        input.focus();
      }, 0);
    } catch {
      // In case of any unexpected error, safely insert the delimiter without losing work
      const delimiter = event.key === 'Enter' ? '\n' : event.key;
      const fallbackVal = beforeCursor + delimiter + afterCursor;
      input.value = fallbackVal;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const fallbackPos = beforeCursor.length + delimiter.length;
      input.setSelectionRange(fallbackPos, fallbackPos);
    } finally {
      this.isProcessing = false;
    }
  }

  @HostListener('blur')
  async onBlur(): Promise<void> {
    if (!this.enabled || this.isProcessing) return;

    const input = this.el.nativeElement;
    const val = input.value || '';
    if (!val.trim()) return;

    // If the entire text ends with a trailing English word that was not followed by space,
    // convert that trailing word on blur
    const match = val.match(/([a-zA-Z0-9'"`]+)$/);
    if (match && /[a-zA-Z]/.test(match[1])) {
      const rawWord = match[1];
      this.isProcessing = true;
      try {
        const converted = await this.hindiService.transliterateWord(rawWord);
        const prefix = val.slice(0, val.length - rawWord.length);
        const nextVal = prefix + converted;
        input.value = nextVal;

        if (this.ngControl?.control) {
          this.ngControl.control.setValue(nextVal);
          this.ngControl.control.markAsDirty();
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
      } catch {
        // ignore on blur
      } finally {
        this.isProcessing = false;
      }
    }
  }
}
