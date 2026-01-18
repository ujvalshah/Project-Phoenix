# Frontend UI Theme Details - Project Nuggets

This document contains all the UI/UX theme details from Project Nuggets that can be used to replicate the design system in another application.

---

## 🎨 Color Palette

### Primary Color (Yellow/Gold Theme)
The app uses a yellow/gold primary color scheme:

```javascript
primary: {
  50: '#fffbea',   // Lightest
  100: '#fff5c8',
  200: '#ffea96',
  300: '#fde047',
  400: '#facc15',
  500: '#eab308',  // Main primary (used for scrollbars, accents)
  600: '#ca8a04',
  700: '#a16207',
  800: '#854d0e',
  900: '#713f12',  // Darkest
}
```

**Usage:**
- Primary accent: `#eab308` (primary-500)
- Hover states: `#ca8a04` (primary-600)
- Focus rings: `ring-yellow-400` or `ring-primary-500`
- Logo background: `bg-yellow-400`

### Collection Colors (Accent Themes)
Used for collection badges and accents:

```javascript
[
  { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50' },
  { bg: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-50' },
  { bg: 'bg-indigo-500', text: 'text-indigo-600', light: 'bg-indigo-50' },
  { bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50' },
  { bg: 'bg-teal-500', text: 'text-teal-600', light: 'bg-teal-50' },
  { bg: 'bg-cyan-500', text: 'text-cyan-600', light: 'bg-cyan-50' },
  { bg: 'bg-slate-500', text: 'text-slate-600', light: 'bg-slate-50' },
]
```

### Neutral Colors (Slate/Gray Scale)
- **Light Mode:**
  - Background: `bg-white`
  - Subtle background: `bg-slate-50`, `bg-gray-50`
  - Borders: `border-slate-200`, `border-gray-100`, `border-gray-200`
  - Text primary: `text-slate-900`, `text-gray-900`
  - Text secondary: `text-slate-600`, `text-gray-500`, `text-gray-600`
  - Text muted: `text-slate-400`, `text-gray-400`
  - Hover backgrounds: `bg-gray-100`, `bg-slate-100`

- **Dark Mode:**
  - Background: `bg-slate-900`, `dark:bg-slate-900`
  - Subtle background: `bg-slate-800`, `dark:bg-slate-800`
  - Borders: `border-slate-700`, `border-slate-800`
  - Text primary: `text-white`, `dark:text-white`
  - Text secondary: `text-slate-300`, `dark:text-slate-300`
  - Text muted: `text-slate-400`, `dark:text-slate-400`

---

## 📐 Spacing & Layout

### Border Radius
- Small: `rounded-md` (6px)
- Medium: `rounded-lg` (8px)
- Large: `rounded-xl` (12px)
- Extra Large: `rounded-2xl` (16px)
- Full: `rounded-full` (9999px)

### Padding
- Compact: `p-1`, `p-2` (4px, 8px)
- Standard: `p-3`, `p-4` (12px, 16px)
- Large: `p-5` (20px)
- Card padding: `p-4` to `p-5` (16px-20px)

### Gaps
- Small: `gap-1`, `gap-2` (4px, 8px)
- Medium: `gap-3`, `gap-4` (12px, 16px)
- Large: `gap-6` (24px)

### Header Heights
- Desktop: `h-16` (64px)
- Mobile: `h-14` (56px)
- Scroll padding: `scroll-padding-top: 64px` (desktop), `56px` (mobile)

---

## 🔤 Typography

### Font Sizes
- Extra Small: `text-[10px]` - Labels, badges, metadata
- Small: `text-xs` (12px) - Secondary text, descriptions
- Base: `text-sm` (14px) - Body text, navigation labels
- Medium: `text-base` (16px) - Titles, headings
- Large: `text-lg` (18px) - Large headings

### Font Weights
- Normal: `font-normal`
- Medium: `font-medium` - Navigation, labels
- Bold: `font-bold` - Titles, important text
- Extra Bold: `font-extrabold` - Brand name, emphasis

### Text Colors
- **Light Mode:**
  - Primary: `text-slate-900`, `text-gray-900`
  - Secondary: `text-slate-600`, `text-gray-600`
  - Muted: `text-slate-500`, `text-gray-500`
  - Disabled: `text-slate-400`, `text-gray-400`

- **Dark Mode:**
  - Primary: `text-white`, `dark:text-white`
  - Secondary: `text-slate-300`, `dark:text-slate-300`
  - Muted: `text-slate-400`, `dark:text-slate-400`

---

## 🎭 Component Styles

### Buttons

**Primary Button:**
```css
bg-yellow-400 text-gray-900 font-bold rounded-xl
hover:scale-[1.02] transition-transform
shadow-lg shadow-yellow-400/20
```

**Secondary Button:**
```css
bg-gray-100 text-gray-700 font-medium rounded-lg
hover:bg-gray-200 transition-colors
```

**Icon Button:**
```css
min-h-[44px] min-w-[44px] flex items-center justify-center
p-2 text-gray-500 hover:text-gray-700 transition-colors
```

**Danger Button:**
```css
text-red-600 hover:bg-red-50 transition-colors
font-medium
```

### Input Fields

```css
block w-full py-2.5 pl-4 pr-4
bg-slate-50 dark:bg-slate-800
border rounded-xl
text-slate-900 dark:text-white
placeholder-slate-400
focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
transition-all
border-slate-200 dark:border-slate-700
```

**With Icons:**
- Left icon: `pl-10`
- Right icon: `pr-10`
- Icon color: `text-slate-400 group-focus-within:text-primary-500`

### Cards

**Card Container:**
```css
bg-white dark:bg-slate-900
rounded-2xl
shadow-sm hover:shadow-md
border border-slate-200 dark:border-slate-800
p-4 or p-5
transition-all
```

**Card Hover (Masonry Tiles):**
```css
transform: translateY(-2px) scale(1.015)
box-shadow: 0 10px 18px rgba(0, 0, 0, 0.08)
transition: transform 0.16s ease-out, box-shadow 0.16s ease-out
```

### Badges

```css
inline-flex items-center px-1.5 py-0.5
text-[10px] font-medium
bg-slate-200 dark:bg-slate-700
text-slate-600 dark:text-slate-400
rounded
```

### Navigation

**Active Nav Item:**
```css
bg-white text-gray-900
px-3 py-1 text-sm font-medium rounded-md
```

**Inactive Nav Item:**
```css
text-gray-500 hover:text-gray-700
px-3 py-1 text-sm font-medium rounded-md
```

**Nav Container:**
```css
bg-gray-100 rounded-lg p-1
```

### Dropdowns/Modals

**Dropdown Menu:**
```css
bg-white rounded-lg shadow-lg
border border-gray-200
overflow-hidden
```

**Modal Overlay:**
```css
fixed inset-0 bg-slate-900/60 backdrop-blur-sm
animate-in fade-in
```

**Modal Container:**
```css
bg-white dark:bg-slate-900
rounded-2xl shadow-2xl
border border-slate-200 dark:border-slate-800
max-w-4xl
```

---

## 🎬 Animations

### Keyframes

```javascript
shimmer: {
  '0%': { backgroundPosition: '-200% 0' },
  '100%': { backgroundPosition: '200% 0' },
}

'fade-in-up': {
  '0%': { opacity: '0', transform: 'translateY(10px)' },
  '100%': { opacity: '1', transform: 'translateY(0)' },
}

'fade-in': {
  '0%': { opacity: '0' },
  '100%': { opacity: '1' },
}
```

### Animation Classes

```css
animation: shimmer 2s infinite linear
animation: fade-in-up 0.4s ease-out forwards
animation: fade-in 0.3s ease-out forwards
```

### Transition Delays
Available delays: `75ms`, `100ms`, `150ms`, `200ms`, `250ms`, `300ms`, `400ms`, `500ms`, `600ms`, `700ms`, `800ms`, `900ms`, `1000ms`

### Common Transitions
- Colors: `transition-colors`
- All: `transition-all`
- Transform: `transition-transform`
- Opacity: `transition-opacity`
- Duration: Typically `0.16s` to `0.3s` with `ease-out` easing

---

## 📜 Scrollbar Styling

### Custom Scrollbar (Primary Theme)
```css
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #eab308 transparent;
}

.custom-scrollbar::-webkit-scrollbar {
  height: 4px;
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #eab308;
  border-radius: 9999px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #ca8a04;
  cursor: pointer;
}
```

### Hidden Scrollbar (Mobile)
```css
.hide-scrollbar-mobile::-webkit-scrollbar {
  display: none;
}

.hide-scrollbar-mobile {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

### Tag Scroll Container
```css
.tag-scroll-container {
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.5) transparent;
}

.tag-scroll-container::-webkit-scrollbar {
  height: 6px;
}

.tag-scroll-container::-webkit-scrollbar-thumb {
  background-color: rgba(148, 163, 184, 0.5);
  border-radius: 8px;
}
```

---

## 🌓 Dark Mode

### Implementation
- Uses `class` strategy: `darkMode: 'class'`
- Toggle between light and dark themes
- All components support dark mode variants

### Dark Mode Color Mappings
- `bg-white` → `dark:bg-slate-900`
- `bg-gray-50` → `dark:bg-slate-800`
- `text-gray-900` → `dark:text-white`
- `text-gray-600` → `dark:text-slate-300`
- `border-gray-200` → `dark:border-slate-700`

---

## ♿ Accessibility

### Focus States
```css
focus-visible:outline-2px solid rgb(59, 130, 246) /* blue-500 */
focus-visible:outline-offset-2px
```

### Screen Reader Only
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Touch Targets
- Minimum size: `min-h-[44px] min-w-[44px]` (WCAG AA compliant)

---

## 🎯 Z-Index Layers

```javascript
Z_INDEX = {
  HEADER: 1000,
  HEADER_OVERLAY: 1001,
  // Add other z-index values as needed
}
```

---

## 📱 Responsive Breakpoints

Uses Tailwind's default breakpoints:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px (main breakpoint for desktop/mobile split)
- `xl`: 1280px
- `2xl`: 1536px

### Common Patterns
- Desktop: `hidden lg:flex`
- Mobile: `flex lg:hidden`
- Tablet detection: `window.innerWidth >= 768 && window.innerWidth < 1024`

---

## 🎨 Icon System

- **Library:** Lucide React (`lucide-react`)
- **Common Sizes:** `16px`, `18px`, `20px`, `24px`
- **Styling:** Inherit text color, use `strokeWidth={2}` or `strokeWidth={2.5}` for emphasis

---

## 📋 Tailwind Configuration

```javascript
// tailwind.config.js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          // ... primary color scale as shown above
        }
      },
      keyframes: {
        // ... keyframes as shown above
      },
      animation: {
        // ... animations as shown above
      },
      transitionDelay: {
        // ... delays as shown above
      },
    }
  },
  plugins: [],
}
```

---

## 🎯 Design Principles

1. **Minimal & Clean:** White backgrounds, subtle borders, plenty of whitespace
2. **Consistent Spacing:** Uses Tailwind's spacing scale consistently
3. **Subtle Interactions:** Hover effects are gentle (scale 1.01-1.015, soft shadows)
4. **Accessibility First:** WCAG AA compliant, proper focus states, reduced motion support
5. **Dark Mode Native:** All components designed with dark mode in mind
6. **Mobile First:** Responsive design with mobile-optimized interactions
7. **Performance:** Uses transform/opacity for animations, lazy loading for images

---

## 📦 Key Dependencies

```json
{
  "tailwindcss": "^3.4.17",
  "lucide-react": "^0.556.0",
  "tailwind-merge": "^3.4.0"
}
```

---

## 💡 Usage Examples

### Button
```tsx
<button className="min-h-[44px] px-4 py-2 bg-yellow-400 text-gray-900 font-bold rounded-xl hover:scale-[1.02] transition-transform shadow-lg shadow-yellow-400/20">
  Click Me
</button>
```

### Input
```tsx
<input
  className="w-full py-2.5 pl-4 bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 border-slate-200 dark:border-slate-700 transition-all"
  placeholder="Enter text..."
/>
```

### Card
```tsx
<div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm hover:shadow-md border border-slate-200 dark:border-slate-800 p-5 transition-all">
  {/* Card content */}
</div>
```

---

This theme creates a modern, clean, and accessible design system with a distinctive yellow/gold accent color that works beautifully in both light and dark modes.
