import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        orange: {
          400: '#fb923c',
          500: '#f97316',
        },
      },
    },
  },
  plugins: [],
};

export default config;
