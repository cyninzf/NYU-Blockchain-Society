import "server-only";
import QRCode from "qrcode";
import { baseUrl } from "./base-url";

// Check-in QR codes, generated on our own server (no third-party QR service). Dark violet on
// white, error correction M and a quiet zone, so print and phone cameras both read it.

const OPTS = { errorCorrectionLevel: "M" as const, margin: 4, color: { dark: "#1C0533", light: "#FFFFFF" } };

/** The URL a printed QR points to: production → the canonical domain; a preview → itself. */
export const checkinUrl = (slug: string) => `${baseUrl()}/events/${slug}/checkin`;

export const qrSvg = (url: string) => QRCode.toString(url, { ...OPTS, type: "svg" });

/** 2048 px square: sharp at A4/Letter print sizes. */
export const qrPng = (url: string) => QRCode.toBuffer(url, { ...OPTS, type: "png", width: 2048 });
