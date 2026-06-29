/**
 * Pilotage design tokens as a Tailwind preset. Colors map to the CSS variables
 * defined in `@pilotage/config/tokens.css`, so:
 *   - light/dark theming works by swapping `[data-theme]` on <html>, and
 *   - white-label works by overriding `--primary*` at runtime (per tenant).
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        fg: {
          DEFAULT: 'var(--fg)',
          muted: 'var(--fg-muted)',
          subtle: 'var(--fg-subtle)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          strong: 'var(--primary-strong)',
          soft: 'var(--primary-soft)',
          fg: 'var(--on-primary)',
        },
        ok: { DEFAULT: 'var(--ok)', soft: 'var(--ok-soft)' },
        info: { DEFAULT: 'var(--info)', soft: 'var(--info-soft)' },
        warn: { DEFAULT: 'var(--warn)', soft: 'var(--warn-soft)' },
        danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)' },
        energy: { DEFAULT: 'var(--energy)', soft: 'var(--energy-soft)' },
        sidebar: {
          bg: 'var(--sidebar-bg)',
          fg: 'var(--sidebar-fg)',
          muted: 'var(--sidebar-muted)',
          'active-bg': 'var(--sidebar-active-bg)',
          border: 'var(--sidebar-border)',
          head: 'var(--sidebar-head)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '14px',
        control: '9px',
        chip: '7px',
      },
      boxShadow: {
        card: 'var(--shadow)',
        lg: 'var(--shadow-lg)',
      },
      maxWidth: {
        content: '1480px',
      },
      keyframes: {
        'pl-spin': { to: { transform: 'rotate(360deg)' } },
        'pl-pulse': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
        'pl-slide': {
          from: { transform: 'translateX(24px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
      },
      animation: {
        'pl-pulse': 'pl-pulse 2.2s ease-in-out infinite',
        'pl-slide': 'pl-slide 0.22s ease',
      },
    },
  },
  plugins: [],
};
