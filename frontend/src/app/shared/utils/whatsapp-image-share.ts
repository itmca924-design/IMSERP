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
  const { phone, messageText } = options;
  openWhatsAppTextOnly(phone, messageText);
  return true;
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

