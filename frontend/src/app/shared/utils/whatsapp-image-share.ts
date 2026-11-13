import html2canvas from 'html2canvas/dist/html2canvas.esm.js';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

export interface WhatsAppShareOptions {
  element: HTMLElement;
  fileName: string;
  phone?: string | null;
  messageText: string;
  shareTitle?: string;
  confirmDialog?: ConfirmDialogService;
}

export async function shareElementOnWhatsApp(options: WhatsAppShareOptions): Promise<boolean> {
  const { element, fileName, phone, messageText, shareTitle, confirmDialog } = options;
  if (!element) return false;

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      ignoreElements: (el: Element) => {
        return el.classList?.contains('hide-on-print') || el.classList?.contains('no-print');
      }
    });

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      openWhatsAppTextOnly(phone, messageText);
      return false;
    }

    const safeFileName = fileName.endsWith('.png') ? fileName : `${fileName}.png`;
    const file = new File([blob], safeFileName, { type: 'image/png' });

    // 1. Mobile Web Share API: Direct attachment in WhatsApp
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: shareTitle || 'IMSERP Document',
          text: messageText
        });
        return true;
      } catch (err: any) {
        if (err?.name === 'AbortError') return true; // User dismissed
      }
    }

    // 2. Desktop: Copy image to Clipboard
    let copied = false;
    if (navigator.clipboard && (window as any).ClipboardItem) {
      try {
        window.focus();
        const item = new (window as any).ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        copied = true;
      } catch (e) {
        console.warn('Clipboard write warning:', e);
      }
    }

    // Open WhatsApp Web / chat
    openWhatsAppTextOnly(phone, messageText);

    return true;
  } catch (err) {
    console.error('Error generating image for WhatsApp:', err);
    openWhatsAppTextOnly(phone, messageText);
    return false;
  }
}

export function openWhatsAppTextOnly(phone?: string | null, text?: string): void {
  const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const encodedText = text ? encodeURIComponent(text) : '';

  let url = '';
  if (formattedPhone && formattedPhone.length >= 10) {
    url = `https://wa.me/${formattedPhone}?text=${encodedText}`;
  } else {
    url = `https://wa.me/?text=${encodedText}`;
  }
  window.open(url, '_blank');
}

