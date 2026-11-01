// S1-32 · The candidate's QR code: the profile URL with the random public_id, nothing else.
// Anyone can scan a QR code; only logged-in companies can open what it points to (design §2.4).
import QRCode from "qrcode";

export const QR_SIZE = 800; // pixels: large enough to scan from a phone screen

export function profileUrl(appUrl: string, publicId: string) {
  return `${appUrl.replace(/\/+$/, "")}/p/${publicId}`;
}

export function qrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, { type: "png", width: QR_SIZE, margin: 2, errorCorrectionLevel: "M" });
}

// "Hélène Dupré" → "qr-helene-dupre.png". Only a-z, 0-9 and dashes, so the name can't break the file name.
export function qrFileName(name: string | null | undefined) {
  const slug = (name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `qr-${slug}.png` : "qr-code.png";
}
