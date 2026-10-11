import { defineConfig } from 'astro/config';

// Netlify subdomain until the custom domain is connected (see docs/PROJECT.md).
const SITE_URL = process.env.SITE_URL ?? 'https://nicolas-osorio.netlify.app';

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
