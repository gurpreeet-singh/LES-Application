/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'les-navy': '#1B3A6B',
        'les-blue': '#2E75B6',
        'les-green': '#1E7E34',
        'les-purple': '#7C3AED',
        'les-amber': '#B45309',
        'les-red': '#DC2626',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08)',
        'card-lg': '0 10px 25px rgba(0,0,0,0.08)',
        'nav': '0 1px 3px rgba(0,0,0,0.08)',
        'modal': '0 25px 50px rgba(0,0,0,0.25)',
      },
      keyframes: {
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-down': 'slideDown 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
