import type { APIRoute } from 'astro';

// Both locales, each listing the other as its hreflang alternate.
export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('https://nicolasosorioarias.com');
  const en = new URL('/', origin).href;
  const es = new URL('/es/', origin).href;
  const alternates = [
    `<xhtml:link rel="alternate" hreflang="en" href="${en}"/>`,
    `<xhtml:link rel="alternate" hreflang="es" href="${es}"/>`,
    `<xhtml:link rel="alternate" hreflang="x-default" href="${en}"/>`,
  ].join('');
  const url = (loc: string) => `<url><loc>${loc}</loc>${alternates}</url>`;
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${url(en)}${url(es)}</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
