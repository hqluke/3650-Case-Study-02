// Paste into DevTools (or run through chrome-devtools-axi eval) to measure every visible target.
// Returns one row per kind of target: how many, smallest width and height, and the smallest gap to a neighbor.
() => {
  const els = [...document.querySelectorAll('a, button, label.chip, label.check, .field input, summary')]
    .filter(e => e.offsetParent && !e.classList.contains('skip-link') && !e.closest('details:not([open]) > :not(summary)'));
  const boxes = els.map(e => ({ e, r: e.getBoundingClientRect() }));
  const gap = (a, b) => Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom);
  const rows = {};
  for (const { e, r } of boxes) {
    const name = e.matches('label.chip') ? `${e.closest('fieldset').querySelector('legend').textContent} choice`
      : e.matches('label.check') ? 'Course checkbox'
        : e.matches('.tee-card') ? 'Tee time card'
          : e.matches('.field input') ? 'Text field'
            : e.id === 'pay-button' ? 'Pay button'
              : e.textContent.trim().replace(/\s+/g, ' ').slice(0, 32);
    const nearest = Math.min(...boxes.filter(o => o.e !== e && !o.e.contains(e) && !e.contains(o.e)).map(o => gap(r, o.r)));
    const row = rows[name] ??= { name, count: 0, width: Infinity, height: Infinity, gap: Infinity };
    row.count++;
    row.width = Math.min(row.width, Math.round(r.width));
    row.height = Math.min(row.height, Math.round(r.height));
    row.gap = Math.min(row.gap, Math.round(nearest));
  }
  return Object.values(rows);
}
