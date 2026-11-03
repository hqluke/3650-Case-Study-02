// Loads axe-core and runs the WCAG 2.0/2.1 A and AA rules plus best practices on the current page.
async () => {
  if (!window.axe) {
    await new Promise(resolve => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
      s.onload = resolve;
      document.head.append(s);
    });
  }
  const result = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] });
  return { passes: result.passes.length, violations: result.violations.map(v => `${v.id}: ${v.nodes.length}`) };
}
