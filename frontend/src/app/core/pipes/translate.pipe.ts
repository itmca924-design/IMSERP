import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationService } from '../services/translation.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false // Enables instant reactive re-evaluation when language signal toggles
})
export class TranslatePipe implements PipeTransform {
  private translationService = inject(TranslationService);

  transform(keyOrText: string | null | undefined, params?: Record<string, any>): string {
    if (!keyOrText) return '';
    return this.translationService.translate(keyOrText, params);
  }
}
