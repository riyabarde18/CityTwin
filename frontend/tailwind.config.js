/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          500: '#0284c7',
          600: '#0265d6',
          700: '#034aa6',
          900: '#0f172a'
        },
        // CityTwin urban-planning palette: deep navy for structure/headers,
        // Tailwind's built-in `sky` scale for the light-blue accent.
        navy: {
          50: '#f0f5fc',
          100: '#dae6f7',
          200: '#b3cced',
          300: '#82abdd',
          400: '#4d7dc2',
          500: '#2f5da3',
          600: '#224785',
          700: '#1c3968',
          800: '#152a4d',
          850: '#101f3a',
          900: '#0b1730',
          950: '#060e1e'
        },
        urban: {
          water: '#0284c7',        // standing_water
          footpath: '#f59e0b',     // footpath_obstruction
          pedestrian: '#ef4444',   // pedestrian_on_road
          traffic: '#8b5cf6',      // traffic_slowdown
          surface: '#ec4899',      // damaged_surface
          garbage: '#64748b',      // garbage
          crossing: '#10b981',     // unsafe_crossing
          barrier: '#d97706'       // accessibility_barrier
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      }
    },
  },
  plugins: [],
}
