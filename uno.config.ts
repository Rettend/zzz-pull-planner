import { defineConfig, presetIcons, presetWind4 } from 'unocss'

export default defineConfig({
  rules: [
    ['list-dash', { 'list-style-type': '"-  "' }],
  ],
  presets: [
    presetWind4(),
    presetIcons({
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
  ],
  preflights: [
    {
      getCSS: () => `
        html {
          scrollbar-gutter: stable;
        }
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #18181b;
        }
        ::-webkit-scrollbar-thumb {
          background: #040404;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #52525b;
        }
      `,
    },
  ],
})
