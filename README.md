# ZZZ Pull Planner

A pull planning tool for Zenless Zone Zero. Gambling is solved ✅

The site is available at [zzz.rettend.me](https://zzz.rettend.me/)

## Features

- **Banner Planning**: View current and upcoming banners
- **Target Prioritization**: Select and prioritize Agents and W-Engines you want to pull
- **Mindscape Support**: Supports just pulling for M0 or all the way to M6, and supports both S Ranks and A Ranks
- **Multi-Account Management**: Track resources and pity across multiple accounts
- **Probability-based Calculation**: See your chances of obtaining targets using different safety floors
- **Calculation factors in**:
  - Available pulls and expected income during the banner's duration
  - Current pity for channels
  - Guarantee status (50/50 and 75/25 vs guaranteed)

## Tech Stack

- **Frontend**: SolidJS, SolidStart, UnoCSS
- **Database**: Cloudflare R2 and D1 with Drizzle ORM
- **Worker**: Automatically updates from the Zenless Zone Zero Fandom Wiki

## Credits

Banner data and assets are from the [Zenless Zone Zero Fandom Wiki](https://zenless-zone-zero.fandom.com/).

## License

MIT
