export async function fetchWikiPage(url: string) {
  const res = await fetch(url)
  const json = await res.json() as any
  return json.parse.text['*']
}

export async function downloadImage(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'image/webp,image/png,image/*,*/*',
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
