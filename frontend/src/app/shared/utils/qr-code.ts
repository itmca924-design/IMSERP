import qrcode from 'qrcode-generator';

export interface QrCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

type QrCodeCallback = (error: Error | null, canvas?: HTMLCanvasElement) => void;

qrcode.stringToBytes = (value: string): number[] => Array.from(new TextEncoder().encode(value));

export function toCanvas(
  canvas: HTMLCanvasElement,
  value: string,
  options: QrCodeOptions,
  callback: QrCodeCallback
): void;
export function toCanvas(
  canvas: HTMLCanvasElement,
  value: string,
  options?: QrCodeOptions
): Promise<HTMLCanvasElement>;
export function toCanvas(
  canvas: HTMLCanvasElement,
  value: string,
  options: QrCodeOptions = {},
  callback?: QrCodeCallback
): Promise<HTMLCanvasElement> | void {
  const render = Promise.resolve().then(() => {
    const qr = qrcode(0, options.errorCorrectionLevel ?? 'M');
    qr.addData(value, 'Byte');
    qr.make();

    const margin = Math.max(0, options.margin ?? 4);
    const moduleCount = qr.getModuleCount();
    const dimension = Math.max(
      Math.floor(options.width ?? 256),
      moduleCount + margin * 2
    );
    const moduleSize = dimension / (moduleCount + margin * 2);
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Unable to access the canvas rendering context.');
    }

    canvas.width = dimension;
    canvas.height = dimension;
    context.imageSmoothingEnabled = false;
    context.fillStyle = options.color?.light ?? '#ffffff';
    context.fillRect(0, 0, dimension, dimension);
    context.fillStyle = options.color?.dark ?? '#000000';

    for (let row = 0; row < moduleCount; row++) {
      for (let column = 0; column < moduleCount; column++) {
        if (qr.isDark(row, column)) {
          const x = Math.floor((column + margin) * moduleSize);
          const y = Math.floor((row + margin) * moduleSize);
          const right = Math.ceil((column + margin + 1) * moduleSize);
          const bottom = Math.ceil((row + margin + 1) * moduleSize);
          context.fillRect(x, y, right - x, bottom - y);
        }
      }
    }

    return canvas;
  });

  if (callback) {
    void render.then(
      (result) => callback(null, result),
      (error: unknown) => callback(error instanceof Error ? error : new Error(String(error)))
    );
    return;
  }

  return render;
}

export function toDataURL(value: string, options: QrCodeOptions = {}): Promise<string> {
  return toCanvas(document.createElement('canvas'), value, options)
    .then((canvas) => canvas.toDataURL('image/png'));
}
