import QRCode from 'qrcode';

export function buildStudentQrPayload(studentCode: string): string {
  return `EDU:${studentCode.trim()}`;
}

export async function generateQrSvgString(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 1,
    width: 180,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 220,
    errorCorrectionLevel: 'M',
  });
}
