# DATA

## Script

```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12; Invoke-Expression (New-Object Net.WebClient).DownloadString("https://zzz.rng.moe/scripts/get_signal_link_os.ps1")
```

```powershell
# Copyright 2024 Star Rail Station
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

Add-Type -AssemblyName System.Web

$ProgressPreference = 'SilentlyContinue'

$game_path = ""

Write-Output "Attempting to locate Search History url!"

if ($set_path) {
    $game_path = $set_path
} else {
    $app_data = [Environment]::GetFolderPath('ApplicationData')
    $locallow_path = "$app_data\..\LocalLow\miHoYo\ZenlessZoneZero\"

    $log_path = "$locallow_path\Player.log"

    if (-Not [IO.File]::Exists($log_path)) {
        Write-Output "Failed to locate log file!"
        Write-Output "Try using the Chinese region script?"
        return
    }

    $log_lines = Get-Content $log_path -First 16

    if ([string]::IsNullOrEmpty($log_lines)) {
        $log_path = "$locallow_path\Player-prev.log"

        if (-Not [IO.File]::Exists($log_path)) {
            Write-Output "Failed to locate log file!"
            Write-Output "Try using the Chinese region script?"
            return
        }

        $log_lines = Get-Content $log_path -First 16
    }

    if ([string]::IsNullOrEmpty($log_lines)) {
        Write-Output "Failed to locate game path! (1)"
        Write-Output "Please contact support at discord.gg/e48fzqxuPM"
        return
    }

    $log_lines = $log_lines.split([Environment]::NewLine)

    for ($i = 0; $i -lt 16; $i++) {
        $log_line = $log_lines[$i]

        if ($log_line.startsWith("[Subsystems] Discovering subsystems at path ")) {
            $game_path = $log_line.replace("[Subsystems] Discovering subsystems at path ", "").replace("UnitySubsystems", "")
            break
        }
    }
}

if ([string]::IsNullOrEmpty($game_path)) {
    Write-Output "Failed to locate game path! (2)"
    Write-Output "Please contact support at discord.gg/e48fzqxuPM"
    return
}

$copy_path = [IO.Path]::GetTempPath() + [Guid]::NewGuid().ToString()

$cache_path = "$game_path/webCaches/Cache/Cache_Data/data_2"
$cache_folders = Get-ChildItem "$game_path/webCaches/" -Directory
$max_version = 0

for ($i = 0; $i -le $cache_folders.Length; $i++) {
    $cache_folder = $cache_folders[$i].Name
    if ($cache_folder -match '^\d+\.\d+\.\d+\.\d+$') {
        $version = [int]-join($cache_folder.Split(".") | ForEach-Object { $_.PadLeft(3, "0") })
        if ($version -ge $max_version) {
            $max_version = $version
            $cache_path = "$game_path/webCaches/$cache_folder/Cache/Cache_Data/data_2"
        }
    }
}

Copy-Item -Path $cache_path -Destination $copy_path
$cache_data = Get-Content -Encoding UTF8 -Raw $copy_path
Remove-Item -Path $copy_path

$cache_data_split = $cache_data -split '1/0/'

for ($i = $cache_data_split.Length - 1; $i -ge 0; $i--) {
    $line = $cache_data_split[$i]

    if ($line.StartsWith('http') -and $line.Contains("getGachaLog")) {
        $url = ($line -split "\0")[0]

        $res = Invoke-WebRequest -Uri $url -ContentType "application/json" -UseBasicParsing | ConvertFrom-Json

        if ($res.retcode -eq 0) {
            $uri = [Uri]$url
            $query = [Web.HttpUtility]::ParseQueryString($uri.Query)

            $keys = $query.AllKeys
            foreach ($key in $keys) {
                # Retain required params
                if ($key -eq "authkey") { continue }
                if ($key -eq "authkey_ver") { continue }
                if ($key -eq "sign_type") { continue }
                if ($key -eq "game_biz") { continue }
                if ($key -eq "lang") { continue }

                $query.Remove($key)
            }

            $latest_url = $uri.Scheme + "://" + $uri.Host + $uri.AbsolutePath + "?" + $query.ToString()

            Write-Output "Search History Url Found!"
            Write-Output $latest_url
            Set-Clipboard -Value $latest_url
            Write-Output "Search History Url has been saved to clipboard."
            return;
        }
    }
}

Write-Output "Could not locate Search History Url."
Write-Output "Please make sure to open the Search history before running the script."
```

## Search History URL

```env
AUTH_KEY=VG6jmFkWCVi56yAt7VXCMQlwJZUQiJRAJHW00RuQhcNbGB63eUlgleRht2%2fTnfnbJZ4LyJbapkmj4Yuob07QfwE1%2fwh3R9FcgpTAJqRypxokZ198SDQKDU3z%2b5JoZ%2fuT99LTTP1XeaG1wy3FT4XpDh9uCfqGYjecMejRCM7k2Cc0VXwaSUuA%2fZ2EWCaCYWU5YzhVOtSOUcng6Go9BGlYs1Q7xHM54a9%2fXNeLhqY%2bY1nAvO1ndh%2fqeRYPAVjifEAdYdFvGOlu3yI6fubcDxbEtaarbaQ02pAr%2bbJ8APQ0p35Fxr7PQR1sqFkXveIWw%2feqX4gNM8BncduVyJERGkAwRmOn3N0%2fTErgNfXxt2Jw%2f7kYmC1d4x5NPWToG7CUNEHay70%2bxkoEvoHnePS70OUDmBsY35B6TqzYWqR2JK00OXJcBpPnkZ%2fGmORP9IpYjO2NPU788bAIu0nhax%2boZs63XVcuvhbbCyq%2f0RUY0u9thF29SGx1bKDBCJH4Rt1PYFA1pBWAB0%2bpZGjKmMt7dp3nItFc1aGUtBGDYt%2bSM344IfXuyRkzs1pBgvAmX4RIIJpgFcRl8Nbv0O3eO31dP5KywJhQKhddJaYoC9P6LvplKtglNAg5wWKExEdSumnHSNjvuatIdqPT43GmYFQg4nXgedpzsJSb%2f6tSTG9Ev4E3AfVn3qtC0BQG9ZAOXAYIXFenSge%2fLchzmWCQNJdJGIYOawZ3ae9WmItaaUDPATseiyjnA%2fJgpZsOXxSPMP7PYIF0
```

```txt
https://public-operation-nap-sg.hoyoverse.com/common/gacha_record/api/getGachaLog?authkey_ver=1&sign_type=2&authkey=VG6jmFkWCVi56yAt7VXCMQlwJZUQiJRAJHW00RuQhcNbGB63eUlgleRht2%2fTnfnbJZ4LyJbapkmj4Yuob07QfwE1%2fwh3R9FcgpTAJqRypxokZ198SDQKDU3z%2b5JoZ%2fuT99LTTP1XeaG1wy3FT4XpDh9uCfqGYjecMejRCM7k2Cc0VXwaSUuA%2fZ2EWCaCYWU5YzhVOtSOUcng6Go9BGlYs1Q7xHM54a9%2fXNeLhqY%2bY1nAvO1ndh%2fqeRYPAVjifEAdYdFvGOlu3yI6fubcDxbEtaarbaQ02pAr%2bbJ8APQ0p35Fxr7PQR1sqFkXveIWw%2feqX4gNM8BncduVyJERGkAwRmOn3N0%2fTErgNfXxt2Jw%2f7kYmC1d4x5NPWToG7CUNEHay70%2bxkoEvoHnePS70OUDmBsY35B6TqzYWqR2JK00OXJcBpPnkZ%2fGmORP9IpYjO2NPU788bAIu0nhax%2boZs63XVcuvhbbCyq%2f0RUY0u9thF29SGx1bKDBCJH4Rt1PYFA1pBWAB0%2bpZGjKmMt7dp3nItFc1aGUtBGDYt%2bSM344IfXuyRkzs1pBgvAmX4RIIJpgFcRl8Nbv0O3eO31dP5KywJhQKhddJaYoC9P6LvplKtglNAg5wWKExEdSumnHSNjvuatIdqPT43GmYFQg4nXgedpzsJSb%2f6tSTG9Ev4E3AfVn3qtC0BQG9ZAOXAYIXFenSge%2fLchzmWCQNJdJGIYOawZ3ae9WmItaaUDPATseiyjnA%2fJgpZsOXxSPMP7PYIF0&lang=en&game_biz=nap_global
```

## Gacha Types (Discovered)

Based on testing with `getGachaLog`:

- `1001` (returns `gacha_type: "1"`): Likely **Standard Channel** (Stable Channel). Contains Agents and W-Engines.
- `2001` (returns `gacha_type: "2"`): Likely **Exclusive Channel** (Limited Agent). Contains Agents and W-Engines.
- `3001` (returns `gacha_type: "3"`): Likely **W-Engine Channel** (Limited Weapon). Contains W-Engines.
- `5001` (returns `gacha_type: "5"`): Likely **Bangboo Channel**. (Note: you also get misc items)

## API Response Examples

### Type 1001 (Standard)

```json
{
  "uid": "1505547628",
  "gacha_id": "0",
  "gacha_type": "1",
  "item_id": "1081",
  "count": "1",
  "time": "2025-12-01 11:10:45",
  "name": "Billy",
  "lang": "en-us",
  "item_type": "Agents",
  "rank_type": "3",
  "id": "1764583200000047628"
}
```

### Type 2001 (Limited Agent)

```json
{
  "uid": "1505547628",
  "gacha_id": "0",
  "gacha_type": "2",
  "item_id": "12007",
  "count": "1",
  "time": "2025-11-26 21:27:34",
  "name": "[Vortex] Revolver",
  "lang": "en-us",
  "item_type": "W-Engines",
  "rank_type": "2",
  "id": "1764187200000173628"
}
```

### Type 3001 (Limited W-Engine)

```json
{
  "uid": "1505547628",
  "gacha_id": "0",
  "gacha_type": "3",
  "item_id": "14118",
  "count": "1",
  "time": "2025-10-19 23:14:15",
  "name": "Fusion Compiler",
  "lang": "en-us",
  "item_type": "W-Engines",
  "rank_type": "4",
  "id": "1760911200000038428"
}
```

### Type 5001 (Bangboo)

```json
{
  "uid": "1505547628",
  "gacha_id": "0",
  "gacha_type": "5",
  "item_id": "12004",
  "count": "1",
  "time": "2025-10-31 00:51:31",
  "name": "[Reverb] Mark I",
  "lang": "en-us",
  "item_type": "W-Engines",
  "rank_type": "2",
  "id": "1761865200000046028"
}
```
