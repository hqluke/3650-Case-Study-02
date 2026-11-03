## Annotated Code Snippets

These come straight from the prototype in `docs/`, trimmed to the lines that matter. Each one is the code behind a state or accessibility hook in the spec.

### 1. Page Landmarks

From `docs/index.html`, trimmed. Every screen sits inside one `<main>`, and each step is a `<section>` named by its `<h1>`. A screen reader user can jump between the banner, the step list, the main content, and the footer.

```html
<a class="skip-link" href="#main">Skip to main content</a>
<header class="site-header">...</header>

<nav class="steps" aria-label="Booking steps">
  <ol>
    <li data-step="search" aria-current="step">...Find a time</li>
    <li data-step="review">...Review and pay</li>
    <li data-step="done">...Confirmed</li>
  </ol>
</nav>

<main id="main">
  <section id="step-search" aria-labelledby="search-heading">
    <h1 id="search-heading" tabindex="-1">Find a tee time</h1>
    <form id="search-form" novalidate>
      <fieldset aria-describedby="window-note"><legend>Date</legend>...</fieldset>
      <fieldset><legend>Holes</legend>...</fieldset>
    </form>
    <section class="results" aria-labelledby="results-heading">...</section>
  </section>
  <section id="step-review" aria-labelledby="review-heading" hidden>...</section>
  <section id="step-done" aria-labelledby="done-heading" hidden>...</section>
</main>

<footer class="site-footer">...</footer>
```

- `tabindex="-1"` on each `<h1>` lets the script move focus there when the step changes, without adding it to the Tab order.
- `aria-current="step"` is what tells a screen reader which step you're on. The green circle is only for sighted users.

### 2. A Disabled Choice That Explains Itself

From `renderDates()` in `docs/app.js`. A day that isn't open yet is a real `disabled` radio button, so it can't be picked, and the chip says when it opens. The whole `<fieldset>` also points at the booking window rule with `aria-describedby`.

```js
input.disabled = !open;
input.checked = isoDate(d) === isoDate(s.day);
box.children[i].querySelector('small').textContent = open ? ''
  : `Opens ${isoDate(opening) === isoDate(TODAY) ? 'tonight' : fmt(opening, { weekday: 'short' })} 9 PM`;
```

ForeUp shows days you can't book in a slightly lighter gray (`#6f777e` instead of `#333333`) with no reason. Here the reason is on the chip. The chips are updated in place instead of rebuilt, because rebuilding them deleted the focused radio button while someone was arrowing through the dates.

### 3. Loading Feedback After 100 ms, and Ignoring Stale Answers

From `runSearch()` in `docs/app.js`.

```js
const id = ++searchId;
list.setAttribute('aria-busy', 'true');
// Only show the skeleton if the answer takes longer than 100 ms, so fast loads don't flash.
const skeletonTimer = setTimeout(() => {
  $('#results-summary').textContent = `Loading tee times for ${fmtLongDay(state.search.day)}...`;
  list.innerHTML = '<li class="tee-skeleton" aria-hidden="true"></li>'.repeat(4);
}, 100);
const announceTimer = setTimeout(() => { $('#results-status').textContent = 'Loading tee times...'; }, 1000);
const results = await fakeServer(() => search(s));
clearTimeout(skeletonTimer);
clearTimeout(announceTimer);
if (id !== searchId) return; // a newer search started, so this answer is stale
```

- Under 100 ms nothing changes on screen, since a flash of gray boxes looks worse than a short wait.
- Over 100 ms the skeleton shows where the list will be. Over 1 second a screen reader hears "Loading tee times...". The skeleton is `aria-hidden` so it isn't read as four empty items.
- If someone clicks Saturday and then Sunday quickly, Saturday's answer can come back second. The `searchId` check throws it away so the list never shows the wrong day.

When the results come in, the polite live region gets the count:

```html
<p id="results-status" class="visually-hidden" aria-live="polite"></p>
```

```js
$('#results-status').textContent = results.length ? `${headline}. ${byCourse}` : `No tee times. ${$('#empty-title').textContent}`;
// "53 tee times on Friday, November 6. Davis Park: 28, earliest 9:50 AM. Valley View: 25, earliest 10:00 AM."
```

### 4. An Empty List That Says Why

From `renderEmpty()` in `docs/app.js`. ForeUp shows one message for sold out, not open yet, and wrong booking class. This checks which one it is.

```js
if (isoDate(s.day) === isoDate(TODAY) && NOW >= lastTeeTime(TODAY)) {
  title.textContent = "Today's tee times are over";
} else if (!anything.length) {
  title.textContent = `${fmtDay(s.day)} is booked up at ${where}`;
} else {
  title.textContent = 'No tee times match all of your filters';
}
```

Then it tries loosening one filter at a time (any time of day, fewer players, 9 or 18 holes, both courses, the next open day), keeps the ones that would show times, and offers up to three as buttons with the count on them ("Show 4 times for any time of day").

### 5. Validation: Error Summary, Inline Errors, `aria-invalid`

From `docs/index.html` and `validate()` in `docs/app.js`. Each field has an error paragraph tied to it with `aria-describedby`. The paragraph is a polite live region, so when an error clears or changes while you type, it's announced without moving focus.

```html
<input id="email" name="email" type="email" autocomplete="email" required aria-describedby="email-error">
<p id="email-error" class="field-error" aria-live="polite"></p>
```

```js
const message = RULES[name](v);
$(`#${name}-error`).textContent = message;
for (const input of $$(`[name="${name}"]`, bookingForm)) input.setAttribute('aria-invalid', String(Boolean(message)));
```

On submit, every problem goes into a summary at the top, and focus moves there so it's read right away. Each line links to its field.

```js
const errors = validate();
if (errors.length) return showErrorSummary(errors); // fills the list, unhides it, box.focus()
```

The messages say how to fix the problem, not just that there is one: "That email is missing something. It should look like name@example.com." Errors also start with an icon and get a thicker red border, so they aren't shown by color alone.

### 6. One Payment, No Matter How Many Clicks

From the submit handler in `docs/app.js`. This covers three ways to pay twice: double clicking, clicking again because nothing seemed to happen, and going Back after paying.

```js
if (state.paying) return; // second click while the first payment is still out
...
const bookings = storage.get('bookings');
if (bookings[t.id]) return go('done');

const v = formValues(), total = updateTotal(), key = state.bookingKey;
setPaying(true);
$('#pay-status').textContent = 'Processing your payment. This can take a few seconds.';
```

```js
function setPaying(on) {
  state.paying = on;
  btn.classList.toggle('is-loading', on);
  // aria-disabled instead of disabled so focus stays on the button while it works.
  btn.setAttribute('aria-disabled', String(on));
  $('#back-button').disabled = on;
  bookingForm.setAttribute('aria-busy', String(on));
  if (on) $('#pay-label').textContent = 'Processing payment...';
}
```

- A real `disabled` would throw keyboard focus back to the top of the page, which is the exact bug I found on ForeUp (A-05). `aria-disabled` keeps focus on the button and tells a screen reader it's unavailable.
- `state.bookingKey` is made with `crypto.randomUUID()` when you pick a time. A real server would refuse a second payment with the same key. In the prototype, `sessionStorage` stands in for that.
- Failures use `role="alert"` so they're read right away, and both say "You weren't charged."

### 7. Disclosure With `aria-expanded`

From `docs/app.js`. Used for "Compare with Valley View's policy" and the Filters panel on phones.

```html
<button type="button" id="other-policy-toggle" class="disclosure" aria-expanded="false" aria-controls="other-policy">
  Compare with Valley View's policy
</button>
<div id="other-policy" hidden>...</div>
```

```js
const open = btn.getAttribute('aria-expanded') !== 'true';
btn.setAttribute('aria-expanded', String(open));
$('#other-policy').hidden = !open;
```

The arrow icon is drawn by CSS from the same attribute (`.disclosure[aria-expanded="true"]::before`), so the picture and what a screen reader hears can't disagree.

### 8. Moving Focus Between Steps

From `go()` in `docs/app.js`. Each step change updates the title, the current step, and the browser history, then moves focus to the new `<h1>` so keyboard and screen reader users start at the top of the new step.

```js
for (const name of Object.keys(STEP_TITLES)) $(`#step-${name}`).hidden = name !== step;
document.title = `${STEP_TITLES[step]} - Davis County Golf (Prototype)`;
if (push) history.pushState({ step, selected: state.selected?.id }, '', `${location.search}${step === 'search' ? '' : `#${step}`}`);
$(`#step-${step} h1`).focus();
```

The search is also saved in the address (`?date=2026-11-07&holes=18&players=2&tod=any&courses=dp,vv`), so a search can be bookmarked or texted to the group, which ForeUp can't do (H-10).

### 9. One CSS Rule Per State

From `docs/styles.css`. Each live state shares its rule with an `.is-*` class, so the [component states page](../docs/states.html) shows exactly what the real controls do.

```css
.btn-primary:hover, .btn-primary.is-hover { background: var(--primary-hover); }
.btn-primary:active, .btn-primary.is-active { background: var(--primary-active); translate: 0 1px; }
:focus-visible, .btn.is-focus, .tee-card.is-focus { outline: 3px solid var(--focus); outline-offset: 2px; }
.btn:disabled, .btn.is-disabled { background: var(--disabled-bg); border-style: dashed; cursor: not-allowed; }
.btn.is-loading .spinner { display: inline-block; }
```

Disabled controls get a dashed border as well as the gray, so "off" doesn't depend on seeing the color difference.
