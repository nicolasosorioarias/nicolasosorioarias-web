import en from '../content/en.json';
import es from '../content/es.json';

export type Locale = 'en' | 'es';
export type Content = typeof en;

const dictionaries: Record<Locale, Content> = { en, es };

export function getContent(locale: Locale): Content {
  return dictionaries[locale];
}

export const CV_FILES = {
  en: '/assets/cv/Nicolas_Osorio_CV_General_EN_Web.pdf',
  es: '/assets/cv/Nicolas_Osorio_CV_General_ES_Web.pdf',
} as const;

export const PORTRAIT = {
  avif: { 480: '/assets/profile/portrait-480.avif', 960: '/assets/profile/portrait-960.avif' },
  webp: { 480: '/assets/profile/portrait-480.webp', 960: '/assets/profile/portrait-960.webp' },
  square: '/assets/profile/portrait-square.jpg',
} as const;

const PENDING = /(\[PENDING[^\]]*\])/;

/** Splits copy into plain and [PENDING] segments so gaps stay visible on the page. */
export function splitPending(text: string): { text: string; pending: boolean }[] {
  return text
    .split(PENDING)
    .map((part, index) => ({ text: part, pending: index % 2 === 1 }))
    .filter((part) => part.text.length > 0);
}
