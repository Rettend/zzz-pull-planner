import type { Env } from './types'

export async function uploadToR2(env: Env, key: string, data: ArrayBuffer, contentType: string) {
  try {
    await env.ASSETS_BUCKET.put(key, data, {
      httpMetadata: {
        contentType,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    })
    // eslint-disable-next-line no-console
    console.log(`Uploaded to R2: ${key}`)
    return true
  }
  catch (e) {
    console.error(`Failed to upload to R2: ${key}`, e)
    return false
  }
}

export async function checkR2FileExists(env: Env, key: string) {
  try {
    const obj = await env.ASSETS_BUCKET.head(key)
    return !!obj
  }
  catch {
    return false
  }
}
