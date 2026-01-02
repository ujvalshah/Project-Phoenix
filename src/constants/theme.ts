export interface AccentTheme {
  bg: string;
  text: string;
  light: string;
}

const COLLECTION_COLORS: AccentTheme[] = [
  { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50' },
  { bg: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-50' },
  { bg: 'bg-indigo-500', text: 'text-indigo-600', light: 'bg-indigo-50' },
  { bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50' },
  { bg: 'bg-teal-500', text: 'text-teal-600', light: 'bg-teal-50' },
  { bg: 'bg-cyan-500', text: 'text-cyan-600', light: 'bg-cyan-50' },
  { bg: 'bg-slate-500', text: 'text-slate-600', light: 'bg-slate-50' },
];

/**
 * Deterministically gets a color theme based on a string ID.
 */
export const getCollectionTheme = (id: string): AccentTheme => {
  const sum = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COLLECTION_COLORS[sum % COLLECTION_COLORS.length];
};
