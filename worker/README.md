# SkinROI hemma-worker (prototyp)

Ett litet Node-program som gör extensionens CSFloat-jobb utan att Chrome
behöver vara öppet:

- **Snipes:** hämtar de senaste CSFloat-listningarna och skickar dem till
  SkinROI, och slår upp lägsta pris för de (max 2) items som servern frågar om.
- **Säljpriser på Portfolio:** lägsta CSFloat-pris för dina items (max 3 anrop
  per runda, varje pris sparas 48 h).

Det körs på din dator (eller en Raspberry Pi) med din hemma-IP, i en egen
Playwright-Chromium där du har loggat in på csfloat.com en gång. Anropen görs
inne i en öppen csfloat.com-flik med sidans egen `fetch()`, alltså precis som
extensionen gör, och skickas till samma endpoints på SkinROI med samma
Bearer-hemlighet. Servern behöver inga ändringar.

**Steam-trades sköts inte här.** De kräver din Steam-inloggning och görs
fortfarande av extensionen.

## Takt (samma budget som extensionen)

- En enda kö för alla CSFloat-anrop, **18 s mellan varje** (max 3 i minuten).
  Att sidan laddas räknas också som ett anrop.
- En runda var 5:e minut: 1 flöde + 2 uppslag + 3 säljpriser = högst 6 anrop.
- Vid **429** pausas allt tills `Retry-After` / `X-RateLimit-Reset`, annars
  10 min som dubblas upp till 60 min. Pausen sparas på disk, så en omstart
  nollställer den inte.
- Inga proxies, inga extra konton.
- **Windows:** om din vanliga Chrome är öppen hoppar workern över rundan,
  eftersom extensionen då gör samma sak. Annars skulle CSFloat få dubbla anrop
  från samma IP och SkinROI:s Redis dubbla skrivningar.

## Installera (PowerShell)

Kräver Node 20 eller nyare (`node -v`).

```powershell
cd C:\Users\ludvi\Documents\Programmering\Projekt\skinroi\worker
npm run setup                     # npm install + laddar ner Chromium (ca 150 MB)
Copy-Item env.example .env
notepad .env
```

## Koppla till ditt konto

Välj **ett** av sätten.

**A. Återanvänd extensionens hemlighet (rekommenderas).** Då ändras ingenting
på servern.

1. Öppna `chrome://extensions`, hitta SkinROI och klicka på länken
   **service worker** (under "Inspect views").
2. I fönstret som öppnas, gå till fliken **Console** och kör:
   ```js
   chrome.storage.local.get('skinroi_secret').then(r => console.log(r.skinroi_secret))
   ```
   (Chrome kan be dig skriva `allow pasting` först.)
3. Klistra in den långa strängen i `.env`: `SKINROI_SECRET=...`

**B. Ny parkopplingskod.** Skapa en kod i kontomenyn på skinroi.com och kör:

```powershell
npm run pair -- ABCD-EFGH
```

Obs: servern har bara en "ansluten extension" per konto, så sidan visar då
workern som anslutningen och nollställer tidpunkten för parkopplingen.
Extensionen fortsätter fungera ändå.

## Logga in på CSFloat (en gång)

```powershell
npm run login
```

Ett webbläsarfönster öppnas. Logga in på csfloat.com via Steam, och stäng
fönstret när du ser din avatar. Inloggningen sparas i `worker\.profile\`
(ligger i `.gitignore`, så den hamnar aldrig på GitHub).

## Köra

```powershell
npm run once    # en runda och sedan klart, bra för att testa
npm start       # kör tills du trycker Ctrl+C
```

Exempel på utskrift:

```
15:21:35 snipes: 50 listings, 3 deals, 2/2 lookups
15:21:53 sell prices: pushed 3
```

Om `npm run login` kraschar med `spawn UNKNOWN` blockerar Windows Playwrights
Chromium. Sätt `BROWSER_CHANNEL=msedge` i `.env` så används Edge i stället.

Om CSFloat svarar med en Cloudflare-sida i stället för data: kör
`npm run login` igen, eller sätt `HEADLESS=false` i `.env` (då syns ett fönster,
minimera det). Hjälper inte det, prova `BROWSER_CHANNEL=chrome` för att
använda din installerade Chrome (då kan workern inte se om din vanliga Chrome
är öppen, så den kör alltid).

### Starta automatiskt när du loggar in i Windows (valfritt)

```powershell
$dir = "C:\Users\ludvi\Documents\Programmering\Projekt\skinroi\worker"
$action = New-ScheduledTaskAction -Execute "npm.cmd" -Argument "start" -WorkingDirectory $dir
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName "SkinROI worker" -Action $action -Trigger $trigger
```

Ta bort igen med `Unregister-ScheduledTask -TaskName "SkinROI worker"`.

### Raspberry Pi

Fungerar på 64-bitars Raspberry Pi OS: samma steg (`npm run setup`,
`npm run pair`, `npm run login` med skärm eller VNC, `npm start`). Där finns
ingen koll av om Chrome är öppen, så sätt antingen `RUN_SNIPES=0` när du
använder datorn, eller acceptera att listningar skickas två gånger då.

## Inställningar (`.env`)

| Nyckel | Standard | Vad |
| --- | --- | --- |
| `SKINROI_SECRET` | | Extensionens hemlighet (eller använd `npm run pair`) |
| `SKINROI_URL` | `https://www.skinroi.com` | `http://localhost:3000` mot `vercel dev` |
| `POLL_MINUTES` | `5` | Minuter mellan rundor (minst 5) |
| `HEADLESS` | `true` | `false` = synligt fönster |
| `BROWSER_CHANNEL` | | `msedge` = Microsoft Edge, `chrome` = din installerade Chrome |
| `SKIP_WHEN_CHROME_OPEN` | `1` | Windows: hoppa över rundan när Chrome är öppen |
| `RUN_SNIPES` / `RUN_SELL_PRICES` | `1` | `0` stänger av den delen |

## Tester

```powershell
npm test
```

Testerna körs utan nätverk: kön och pauserna, säljpris-logiken och
Snipes-flödet mot fejkade svar.

## Att tänka på

- Automatiserad hämtning bryter troligen mot CSFloats användarvillkor, precis
  som extensionens hämtning. Risken är densamma: samma IP, samma konto, samma takt.
- Det här är en prototyp och har inte körts mot riktiga csfloat.com än.
