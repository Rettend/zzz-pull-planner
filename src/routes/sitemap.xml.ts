import type { APIEvent } from '@solidjs/start/server'

export function GET({ request }: APIEvent) {
  const BASE_URL = 'https://zzz.rettend.me'
  const url = new URL(request.url)
  const origin = import.meta.env.PROD ? BASE_URL : url.origin

  const pages = [
    '', // Home page
  ]

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${pages
    .map((path) => {
      return `
  <url>
    <loc>${origin}/${path}</loc>
    <changefreq>weekly</changefreq>
    <priority>${path === '' ? '1.0' : '0.8'}</priority>
  </url>`
    })
    .join('')}
</urlset>`

  return new Response(sitemap.trim(), {
    headers: {
      'Content-Type': 'application/xml',
    },
  })
}
