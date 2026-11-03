/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  // Safelist preserves Tailwind classes that are built dynamically at runtime
  // (e.g. the theme picker swaps accent colours based on a user setting),
  // so JIT can't see them in source and would otherwise purge them.
  safelist: [
    {
      pattern:
        /(bg|text|border|from|via|to|hover:bg|hover:border|focus:border)-(slate|zinc|stone|neutral|red|emerald|blue)-(50|100|200|300|400|500|600|700|800|900|950)/,
    },
    {
      pattern:
        /(bg|border)-(slate|zinc|stone|neutral)-(700|800|900)\/(30|40|50|60|70)/,
    },
    {
      pattern: /text-(slate|zinc|stone)-(300|400)/,
    },
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0a0b0f',
          card: '#111318',
          panel: '#161b26',
          input: '#1a1f2e',
          hover: '#1e2330',
        },
        border: { DEFAULT: '#1e2028', subtle: '#161a22' },
        accent: '#3b82f6',
        profit: '#22c55e',
        loss: '#ef4444',
        warn: '#f59e0b',
      },
      // Strong ease-out for UI feedback; `transition` without a duration
      // class gets 160ms on this curve instead of Tailwind's softer default.
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.23, 1, 0.32, 1)',
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
      },
      transitionDuration: { DEFAULT: '160ms' },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
