export async function fetchWikiPage(url: string) {
  const res = await fetch(url)
  const json = await res.json() as any
  return json.parse.text['*']
}

export async function downloadImage(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/png,image/*,*/*',
        'Referer': 'https://zenless-zone-zero.fandom.com/',
      },
    })
    if (!res.ok) {
      console.error(`Failed to download image: ${url} (${res.status})`)
      return null
    }
    return await res.arrayBuffer()
  }
  catch (e) {
    console.error(`Error downloading image: ${url}`, e)
    return null
  }
}
