import qrcode from 'qrcode-generator';

export function generateQrSvg(text: string, cellSize = 2, margin = 2): string {
  if (!text) return '';
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize, margin, scalable: true });
}
