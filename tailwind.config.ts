import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        azul: { DEFAULT: '#1a2e5a', medio: '#2a4a8a', claro: '#dce8f7' },
        acento: '#0057d9',
        verde: '#0f9d58',
        rojo: '#d93025',
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'monospace'],
        sans: ['IBM Plex Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
