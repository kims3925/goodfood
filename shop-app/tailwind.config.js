/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ABC Market Brand Colors - Coral/Orange Theme
        primary: {
          50: '#fff5f5',
          100: '#ffe0e0',
          200: '#ffbdbd',
          300: '#ff9999',
          400: '#ff7676',
          500: '#FF6B6B', // ABC Market Coral
          600: '#ee5a5a',
          700: '#dc4a4a',
          800: '#c43a3a',
          900: '#a62d2d',
        },
        abc: {
          coral: '#FF6B6B',
          'coral-dark': '#ee5a5a',
          'coral-light': '#ff8585',
          orange: '#FF8C42',
          teal: '#2EC4B6',
        },
        secondary: {
          50: '#e3f2fd',
          100: '#bbdefb',
          200: '#90caf9',
          300: '#64b5f6',
          400: '#42a5f5',
          500: '#2196f3',
          600: '#1e88e5',
          700: '#1976d2',
          800: '#1565c0',
          900: '#0d47a1',
        },
        sale: '#ff424d', // Sale/Discount Red
        point: '#ff8a00', // Point Orange
        gray: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#eeeeee',
          300: '#e0e0e0',
          400: '#bdbdbd',
          500: '#9e9e9e',
          600: '#757575',
          700: '#616161',
          800: '#424242',
          900: '#212121',
        },
      },
      fontFamily: {
        sans: [
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Roboto',
          'Helvetica Neue',
          'Segoe UI',
          'Apple SD Gothic Neo',
          'Noto Sans KR',
          'Malgun Gothic',
          'sans-serif',
        ],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        'card-hover': '0 4px 12px 0 rgba(0, 0, 0, 0.15)',
        'header': '0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      },
      borderRadius: {
        'card': '8px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      maxWidth: {
        'container': '1320px',
      },
    },
  },
  plugins: [],
}
