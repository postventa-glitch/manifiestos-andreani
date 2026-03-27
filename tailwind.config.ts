import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        azul: '#1a2e5a',
        'azul-medio': '#2a4a8a',
        'azul-claro': '#dce8f7',
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
};

export default config;
