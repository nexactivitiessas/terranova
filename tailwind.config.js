/** Tailwind se compila localmente (gratis) y se incrusta en ui/Estilos.html: sin CDN en producción. */
module.exports = {
  content: ['./apps-script/src/ui/**/*.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: { marca: 'var(--c1)', acento: 'var(--c2)' },
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'], serif: ['Fraunces', 'Georgia', 'serif'] }
    }
  },
  plugins: []
};
