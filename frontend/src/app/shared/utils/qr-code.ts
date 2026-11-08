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

    // Standard ISO/IEC 18004 Quiet Zone: minimum 4 modules for reliable camera optical recognition
    const margin = Math.max(4, options.margin !== undefined ? options.margin : 4);
    const moduleCount = qr.getModuleCount();
    const totalModules = moduleCount + margin * 2;

    // High-resolution integer pixel module size to eliminate any fractional anti-aliasing distortion
    const targetWidth = Math.max(options.width ?? 320, 256);
    const moduleSize = Math.max(3, Math.round(targetWidth / totalModules));
    const dimension = totalModules * moduleSize;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Unable to access the canvas rendering context.');
    }

    canvas.width = dimension;
    canvas.height = dimension;
    context.imageSmoothingEnabled = false;

    // Solid White Quiet Zone Background
    context.fillStyle = options.color?.light ?? '#ffffff';
    context.fillRect(0, 0, dimension, dimension);

    // Pure Dark Contrast Modules
    context.fillStyle = options.color?.dark ?? '#000000';

    for (let row = 0; row < moduleCount; row++) {
      for (let column = 0; column < moduleCount; column++) {
        if (qr.isDark(row, column)) {
          const x = (column + margin) * moduleSize;
          const y = (row + margin) * moduleSize;
          context.fillRect(x, y, moduleSize, moduleSize);
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
