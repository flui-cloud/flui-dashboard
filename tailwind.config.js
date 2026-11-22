const tokens = require('./src/theme/tokens.json');

const flColors = Object.fromEntries(
  Object.keys(tokens.themes.light).map((role) => [role, `var(--fl-${role})`]),
);

const flRadius = Object.fromEntries(
  Object.keys(tokens.radius).map((k) => [`fl-${k}`, `var(--fl-radius-${k})`]),
);

const flText = Object.fromEntries(
  Object.entries(tokens.text).map(([name, t]) => [
    `fl-${name}`,
    [
      t.size,
      {
        lineHeight: t.line,
        fontWeight: String(t.weight),
        ...(t.tracking ? { letterSpacing: t.tracking } : {}),
      },
    ],
  ]),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  presets: [require('@spartan-ng/ui-core/hlm-tailwind-preset')],
  content: ['./src/**/*.{html,ts}', './libs/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: { fl: flColors },
      borderRadius: flRadius,
      fontSize: flText,
      fontFamily: {
        sans: ['var(--fl-font-sans)'],
        mono: ['var(--fl-font-mono)'],
      },
      boxShadow: { 'fl-focus': 'var(--fl-focus-ring)' },
      rotate: {
        270: '270deg',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        indeterminate: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
      },
      animation: {
        indeterminate: 'indeterminate 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.scrollbar-none': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
      });
    },
  ],
};
