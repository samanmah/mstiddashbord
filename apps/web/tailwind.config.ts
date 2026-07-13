import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#17345F',
          800: '#203F70',
          700: '#274A7D',
        },
        brand: {
          orange: '#F57C00',
          green: '#20A55A',
          red: '#E53935',
          yellow: '#FFD400',
          blue: '#2D9CDB',
          purple: '#8E5BD9',
        },
        grayx: {
          header: '#7D8995',
          dot: '#9AA6B2',
        },
        page: '#EDF2F8',
        card: '#FFFFFF',
        borderx: '#D7E0EA',
        ink: '#172B4D',
      },
      fontFamily: {
        sans: ['Vazirmatn', 'Tahoma', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(23, 43, 77, 0.06), 0 1px 2px rgba(23, 43, 77, 0.04)',
        cardhover: '0 4px 12px rgba(23, 43, 77, 0.10)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
