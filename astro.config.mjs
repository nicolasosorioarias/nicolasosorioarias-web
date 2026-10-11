import { defineConfig } from 'astro/config';

// Canonical origin (Cloudflare Pages custom domain). Override with SITE_URL for previews.
const SITE_URL = process.env.SITE_URL ?? 'https://nicolasosorioarias.com';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'ignore',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    routing: { prefixDefaultLocale: false },
  },
  build: { inlineStylesheets: 'always' },
  compressHTML: true,
});
