import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // مقیاس سرمه‌ای عمیق برای Header و سطوح تیره
        navy: {
          950: '#0B1F3A',
          900: '#112F57',
          800: '#173B6C',
          700: '#1E4E8C',
        },
        // رنگ‌های وضعیت (Status) — هماهنگ با متادیتای Backend، تغییر نکنند
        brand: {
          orange: '#F57C00',
          green: '#20A55A',
          red: '#E53935',
          yellow: '#FFD400',
          blue: '#2D9CDB',
          purple: '#8E5BD9',
        },
        // رنگ‌های Accent مدرن برای هویت بصری داشبورد (تحلیلی/تزئینی)
        accent: {
          blue: '#2563EB',
          sky: '#0EA5E9',
          cyan: '#06B6D4',
          emerald: '#10B981',
          green: '#16A66A',
          amber: '#F59E0B',
          orange: '#F97316',
          red: '#EF4444',
          rose: '#E5484D',
          violet: '#7C5CFC',
          purple: '#8B5CF6',
          indigo: '#4F46E5',
        },
        grayx: {
          header: '#64748B',
          dot: '#94A3B8',
        },
        page: '#F3F6FB',
        surface: '#F8FAFC',
        card: '#FFFFFF',
        borderx: '#DCE4EF',
        ink: '#17233C',
      },
      fontFamily: {
        sans: ['Vazirmatn', 'Tahoma', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '18px',
      },
      boxShadow: {
        card: '0 8px 30px rgba(15, 35, 65, 0.07)',
        cardhover: '0 12px 34px rgba(15, 35, 65, 0.12)',
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
