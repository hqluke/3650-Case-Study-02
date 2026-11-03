// Checks every text and UI color pair in docs/styles.css against WCAG 2.1 AA.
// Run: node prototype_spec/scripts/contrast.mjs
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../docs/styles.css', import.meta.url), 'utf8');
const token = name => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))[1];

const lum = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [element, foreground, background, needed]. 4.5 for normal text, 3 for large text and UI parts.
// The focus ring sits 2px outside every control, so it's always measured against the page.
const pairs = [
  ['Body text', 'text', 'bg', 4.5],
  ['Hints, prices, labels', 'muted', 'bg', 4.5],
  ['Hints on gray panels', 'muted', 'surface', 4.5],
  ['Links and secondary buttons', 'primary', 'bg', 4.5],
  ['Primary button and selected chip text', '#ffffff', 'primary', 4.5],
  ['Primary button hover', '#ffffff', 'primary-hover', 4.5],
  ['Chip hover text', 'text', 'primary-tint', 4.5],
  ['Pressed chip and card text', 'text', 'pressed', 4.5],
  ['Hole badge, 9 holes', '#ffffff', 'badge-9', 4.5],
  ['Hole badge, 18 holes', '#ffffff', 'badge-18', 4.5],
  ['Hole badge, 9 or 18', '#ffffff', 'badge-both', 4.5],
  ['Error text', 'error', 'bg', 4.5],
  ['Error text on error panel', 'error', 'error-tint', 4.5],
  ['Disabled chip text (exempt, kept readable)', 'disabled-text', 'disabled-bg', 4.5],
  ['Control borders (chips, fields, cards)', 'border', 'bg', 3],
  ['Focus ring', 'focus', 'bg', 3],
];

const hex = v => (v.startsWith('#') ? v : token(v));
console.log('| Element | Foreground | Background | Ratio | Needs | Result |\n| --- | --- | --- | --- | --- | --- |');
for (const [name, fg, bg, need] of pairs) {
  const r = ratio(hex(fg), hex(bg));
  console.log(`| ${name} | \`${hex(fg)}\` | \`${hex(bg)}\` | ${r.toFixed(2)}:1 | ${need}:1 | ${r >= need ? 'Pass' : '**Fail**'} |`);
}
