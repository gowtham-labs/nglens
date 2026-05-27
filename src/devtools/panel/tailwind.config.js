/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/devtools/panel/**/*.{html,ts}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        critical: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6',
        success: '#22C55E',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      backgroundColor: {
        'devtools-primary': '#111827',
        'devtools-secondary': '#1F2937',
      },
      borderColor: {
        'devtools': '#374151',
      },
    },
  },
  plugins: [],
};
