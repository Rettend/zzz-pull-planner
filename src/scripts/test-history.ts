import fs from 'node:fs/promises'

const AUTH_KEY = 'VG6jmFkWCVi56yAt7VXCMQlwJZUQiJRAJHW00RuQhcNbGB63eUlgleRht2%2fTnfnbJZ4LyJbapkmj4Yuob07QfwE1%2fwh3R9FcgpTAJqRypxokZ198SDQKDU3z%2b5JoZ%2fuT99LTTP1XeaG1wy3FT4XpDh9uCfqGYjecMejRCM7k2Cc0VXwaSUuA%2fZ2EWCaCYWU5YzhVOtSOUcng6Go9BGlYs1Q7xHM54a9%2fXNeLhqY%2bY1nAvO1ndh%2fqeRYPAVjifEAdYdFvGOlu3yI6fubcDxbEtaarbaQ02pAr%2bbJ8APQ0p35Fxr7PQR1sqFkXveIWw%2feqX4gNM8BncduVyJERGkAwRmOn3N0%2fTErgNfXxt2Jw%2f7kYmC1d4x5NPWToG7CUNEHay70%2bxkoEvoHnePS70OUDmBsY35B6TqzYWqR2JK00OXJcBpPnkZ%2fGmORP9IpYjO2NPU788bAIu0nhax%2boZs63XVcuvhbbCyq%2f0RUY0u9thF29SGx1bKDBCJH4Rt1PYFA1pBWAB0%2bpZGjKmMt7dp3nItFc1aGUtBGDYt%2bSM344IfXuyRkzs1pBgvAmX4RIIJpgFcRl8Nbv0O3eO31dP5KywJhQKhddJaYoC9P6LvplKtglNAg5wWKExEdSumnHSNjvuatIdqPT43GmYFQg4nXgedpzsJSb%2f6tSTG9Ev4E3AfVn3qtC0BQG9ZAOXAYIXFenSge%2fLchzmWCQNJdJGIYOawZ3ae9WmItaaUDPATseiyjnA%2fJgpZsOXxSPMP7PYIF0'

const BASE_URL = 'https://public-operation-nap-sg.hoyoverse.com/common/gacha_record/api/getGachaLog'

// 1001: Standard, 2001: Limited Agent, 3001: Limited W-Engine, 5001: Bangboo
const TARGET_TYPES = [1001, 2001, 3001, 5001]

async function fetchGachaHistory(type: number) {
  const allItems: any[] = []
  let endId = '0'
  let page = 1

  console.log(`Starting fetch for type ${type}...`)

  while (true) {
    const params = new URLSearchParams({
      authkey_ver: '1',
      sign_type: '2',
      authkey: decodeURIComponent(AUTH_KEY),
      lang: 'en',
      game_biz: 'nap_global',
      gacha_type: type.toString(),
      page: page.toString(),
      size: '20',
      end_id: endId,
    })

    const url = `${BASE_URL}?${params.toString()}`

    try {
      const res = await fetch(url)
      const data = await res.json() as any

      if (data.retcode !== 0) {
        console.error(`Error fetching type ${type} page ${page}: ${data.message}`)
        // If auth key is invalid, we should probably stop completely, but for now break loop
        break
      }

      const list = data.data?.list ?? []
      if (list.length === 0) {
        console.log(`Type ${type}: Reached end of history at page ${page}`)
        break
      }

      allItems.push(...list)
      endId = list[list.length - 1].id
      page++

      console.log(`Type ${type}: Fetched page ${page - 1}, total items: ${allItems.length}, last id: ${endId}`)

      // Sleep to avoid rate limits
      await new Promise(r => setTimeout(r, 500))
    }
    catch (e) {
      console.error(`Exception fetching type ${type}:`, e)
      break
    }
  }

  return allItems
}

async function run() {
  for (const type of TARGET_TYPES) {
    const history = await fetchGachaHistory(type)
    const filteredHistory = history.filter(item => item.rank_type === '3' || item.rank_type === '4')
    const filename = `history_${type}.json`
    await fs.writeFile(filename, JSON.stringify(filteredHistory, null, 2))
    console.log(`Saved ${filteredHistory.length} items (filtered from ${history.length}) to ${filename}`)
    console.log('---')
  }
}

run()
