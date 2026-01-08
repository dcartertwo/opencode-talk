/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // macOS-inspired colors
        'glass': 'rgba(255, 255, 255, 0.72)',
        'glass-dark': 'rgba(30, 30, 30, 0.85)',
        'accent': '#007AFF',
        'accent-hover': '#0056CC',
        'danger': '#FF3B30',
        'success': '#34C759',
        'warning': '#FF9500',
      },
      backdropBlur: {
        'glass': '20px',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-gentle': 'bounce 1s ease-in-out infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
