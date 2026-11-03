// Booking prototype for Davis County's two public courses. Tee times are generated
// in the browser from a seed, and the "server" is a setTimeout. Nothing leaves the page.

const COURSES = [
  {
    id: 'dp', name: 'Davis Park', town: 'Fruit Heights',
    policy: [
      { hours: 12, outcome: 'Full refund' },
      { hours: 1, outcome: 'No refund, but a rain check for the full amount' },
      { hours: 0, outcome: 'No refund, and a rain check for 50%' },
    ],
  },
  {
    id: 'vv', name: 'Valley View', town: 'Layton',
    policy: [
      { hours: 12, outcome: 'Full refund' },
      { hours: 2, outcome: 'No refund, but a rain check for the full amount' },
      { hours: 0, outcome: 'Nothing back, and the same for a no-show' },
    ],
  },
];
const PRICES = { 9: { green: 18, cart: 10 }, 18: { green: 34, cart: 18 } };
const TIMES_OF_DAY = { any: [0, 24], morning: [0, 11], midday: [11, 14], afternoon: [14, 24] };
const LATENCY = { fast: 50, normal: 800, slow: 3000 };
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- Time ----------
// Every time is a Date whose UTC fields hold Mountain Time wall clock values,
// so the math and formatting don't depend on the visitor's own time zone.

function toWall(instant) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant).map(x => [x.type, x.value]));
  return new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
}

const fmt = (d, opts) => d.toLocaleString('en-US', { timeZone: 'UTC', ...opts });
const fmtTime = d => fmt(d, { hour: 'numeric', minute: '2-digit' });
const fmtDay = d => fmt(d, { weekday: 'short', month: 'short', day: 'numeric' });
const fmtLongDay = d => fmt(d, { weekday: 'long', month: 'long', day: 'numeric' });
const fmtWhen = d => `${fmt(d, { weekday: 'short' })} ${fmtTime(d)}`;
const isoDate = d => d.toISOString().slice(0, 10);
const startOfDay = d => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const addMs = (d, ms) => new Date(d.getTime() + ms);
const money = n => `$${n.toFixed(2)}`;

const params = new URLSearchParams(location.search);
// ?now=2026-11-07T20:55 pins the clock so screenshots and tests are repeatable.
const NOW = /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(params.get('now') ?? '')
  ? new Date(`${params.get('now')}:00Z`)
  : toWall(new Date());
const TODAY = startOfDay(NOW);
const DAYS = Array.from({ length: 7 }, (_, i) => addMs(TODAY, i * DAY));

// NOAA's low accuracy solar equations for Layton, good to about a minute.
function sunset(day) {
  const g = 2 * Math.PI / 365 * ((day - Date.UTC(day.getUTCFullYear(), 0, 1)) / DAY);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const rad = Math.PI / 180, lat = 41.06 * rad, lng = -111.97;
  const ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl)) / rad;
  return toWall(addMs(day, (720 - 4 * (lng - ha) - eqTime) * MIN));
}

// The list ends 100 minutes before sunset so groups finish before dark.
function lastTeeTime(day) {
  const cutoff = addMs(sunset(day), -100 * MIN);
  return addMs(cutoff, -(cutoff.getUTCMinutes() % 10) * MIN);
}

// Days counting today: 18 hole groups get 4, everyone else 3. The next day opens at 9:00 PM.
const windowDays = (holes, players) => (holes === 18 && players > 1 ? 4 : 3);
const opensAt = (day, holes, players) => addMs(day, -windowDays(holes, players) * DAY + 21 * HOUR);
const isOpen = (day, holes, players) => NOW >= opensAt(day, holes, players);
const holesFor = h => (h === 'any' ? [9, 18] : [+h]);
const dayOpen = (day, s) => holesFor(s.holes).some(h => isOpen(day, h, s.players));

// ---------- Fake tee sheet ----------

function seeded(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 2 ** 32;
  };
}

const taken = new Set();

function teeSheet(course, day) {
  const rand = seeded(course.id + isoDate(day));
  const times = [];
  for (let t = addMs(day, 8 * HOUR); t <= lastTeeTime(day); t = addMs(t, 10 * MIN)) {
    for (const start of ['Front #1', 'Back #10']) {
      const roll = rand();
      const spots = roll < 0.4 ? 0 : Math.ceil((roll - 0.4) / 0.15);
      const id = `${course.id}-${t.toISOString()}-${start}`;
      if (spots && !taken.has(id)) times.push({ id, course, start, time: t, spots, holes: start === 'Back #10' ? [9] : [9, 18] });
    }
  }
  return times;
}

function search(s) {
  const [from, to] = TIMES_OF_DAY[s.tod];
  return COURSES.filter(c => s.courses.includes(c.id))
    .flatMap(c => teeSheet(c, s.day))
    .map(t => ({ ...t, holes: t.holes.filter(h => holesFor(s.holes).includes(h) && isOpen(s.day, h, s.players)) }))
    .filter(t => t.holes.length && t.time > NOW && t.spots >= s.players
      && t.time.getUTCHours() >= from && t.time.getUTCHours() < to)
    .sort((a, b) => a.time - b.time || a.course.name.localeCompare(b.course.name));
}

const fakeServer = (fn, ms = LATENCY[controls.latency]) => new Promise(resolve => setTimeout(() => resolve(fn()), ms));

// ---------- State ----------

const controls = { latency: 'normal', outcome: 'ok' };

function readSearchFromUrl() {
  const pick = (key, allowed, fallback) => (allowed.includes(params.get(key)) ? params.get(key) : fallback);
  const s = {
    holes: pick('holes', ['any', '9', '18'], 'any'),
    players: +pick('players', ['1', '2', '3', '4'], '2'),
    tod: pick('tod', Object.keys(TIMES_OF_DAY), 'any'),
    courses: (params.get('courses') ?? 'dp,vv').split(',').filter(id => COURSES.some(c => c.id === id)),
  };
  if (!s.courses.length) s.courses = ['dp', 'vv'];
  const day = DAYS.find(d => isoDate(d) === params.get('date'));
  s.day = day && dayOpen(day, s) ? day : firstBookableDay(s);
  return s;
}

function firstBookableDay(s) {
  return DAYS.find(d => dayOpen(d, s) && (d > TODAY || NOW < lastTeeTime(d))) ?? TODAY;
}

let state = { search: readSearchFromUrl(), selected: null, bookingKey: null, paying: false };

function writeSearchToUrl() {
  const s = state.search;
  const q = new URLSearchParams({ date: isoDate(s.day), holes: s.holes, players: s.players, tod: s.tod, courses: s.courses.join(',') });
  if (params.get('now')) q.set('now', params.get('now'));
  history.replaceState(history.state, '', `?${q}${location.hash}`);
}

const storage = {
  get(key) { try { return JSON.parse(sessionStorage.getItem(key)) ?? {}; } catch { return {}; } },
  set(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } },
};

// ---------- Step 1: search ----------

const searchForm = $('#search-form');

function renderDates() {
  const s = state.search;
  const box = $('#date-options');
  if (!box.children.length) {
    box.innerHTML = DAYS.map(d => `<label class="chip date-chip">
      <input type="radio" name="date" value="${isoDate(d)}">
      <span><b>${isoDate(d) === isoDate(TODAY) ? 'Today' : fmt(d, { weekday: 'short' })}</b> <span class="nowrap">${fmt(d, { month: 'short', day: 'numeric' })}</span><small></small></span>
    </label>`).join('');
  }
  // Update the chips in place. Rebuilding them would throw away keyboard focus mid arrow-key.
  DAYS.forEach((d, i) => {
    const input = box.children[i].querySelector('input');
    const open = dayOpen(d, s);
    const opening = holesFor(s.holes).map(h => opensAt(d, h, s.players)).sort((a, b) => a - b)[0];
    input.disabled = !open;
    input.checked = isoDate(d) === isoDate(s.day);
    box.children[i].querySelector('small').textContent = open ? ''
      : `Opens ${isoDate(opening) === isoDate(TODAY) ? 'tonight' : fmt(opening, { weekday: 'short' })} 9 PM`;
  });
}

function syncSearchForm() {
  const s = state.search;
  for (const box of $$('input[name="courses"]', searchForm)) box.checked = s.courses.includes(box.value);
  for (const name of ['holes', 'players', 'tod']) {
    for (const r of $$(`input[name="${name}"]`, searchForm)) r.checked = r.value === String(s[name]);
  }
  renderDates();
  $('#filters-summary').textContent = [
    s.holes === 'any' ? '9 or 18 holes' : `${s.holes} holes`,
    `${s.players} ${s.players === 1 ? 'player' : 'players'}`,
    s.tod === 'any' ? 'any time' : s.tod,
    s.courses.length === 2 ? 'both courses' : COURSES.find(c => c.id === s.courses[0]).name,
  ].join(', ');
}

searchForm.addEventListener('change', e => {
  const s = state.search;
  const { name, value } = e.target;
  if (name === 'courses') {
    const picked = $$('input[name="courses"]:checked', searchForm).map(b => b.value);
    const error = $('#courses-error');
    for (const box of $$('input[name="courses"]', searchForm)) box.setAttribute('aria-invalid', String(!picked.length));
    if (!picked.length) {
      error.textContent = 'Pick at least one course to see tee times.';
      return;
    }
    error.textContent = '';
    s.courses = picked;
  } else if (name === 'date') {
    s.day = DAYS.find(d => isoDate(d) === value);
  } else {
    s[name] = name === 'players' ? +value : value;
    // A filter can close the picked day (9 holes on day 4), so move to the nearest open one.
    if (!dayOpen(s.day, s)) s.day = firstBookableDay(s);
  }
  syncSearchForm();
  runSearch();
});

$('#filters-toggle').addEventListener('click', e => {
  const btn = e.currentTarget;
  btn.setAttribute('aria-expanded', String(btn.getAttribute('aria-expanded') !== 'true'));
});

let searchId = 0;

async function runSearch() {
  writeSearchToUrl();
  const id = ++searchId;
  const list = $('#results-list');
  list.setAttribute('aria-busy', 'true');
  // Only show the skeleton if the answer takes longer than 100 ms, so fast loads don't flash.
  const skeletonTimer = setTimeout(() => {
    $('#empty-state').hidden = true;
    $('#results-summary').textContent = `Loading tee times for ${fmtLongDay(state.search.day)}...`;
    $('#results-by-course').textContent = '';
    list.innerHTML = '<li class="tee-skeleton" aria-hidden="true"></li>'.repeat(4);
  }, 100);
  const announceTimer = setTimeout(() => { $('#results-status').textContent = 'Loading tee times...'; }, 1000);
  const s = { ...state.search };
  const results = await fakeServer(() => search(s));
  clearTimeout(skeletonTimer);
  clearTimeout(announceTimer);
  if (id !== searchId) return; // a newer search started, so this answer is stale
  list.removeAttribute('aria-busy');
  renderResults(s, results);
}

function renderResults(s, results) {
  const last = lastTeeTime(s.day);
  $('#sunset-note').textContent = `Tee times end at ${fmtTime(last)}, 100 minutes before sunset (${fmtTime(sunset(s.day))}), so every group can finish before dark.`;
  $('#results-list').innerHTML = results.map(teeCard).join('');
  $('#empty-state').hidden = results.length > 0;

  const headline = results.length ? `${results.length} tee ${results.length === 1 ? 'time' : 'times'} on ${fmtLongDay(s.day)}` : '';
  const byCourse = results.length ? COURSES.filter(c => s.courses.includes(c.id)).map(c => {
    const times = results.filter(t => t.course === c);
    return times.length ? `${c.name}: ${times.length}, earliest ${fmtTime(times[0].time)}.` : `${c.name}: none.`;
  }).join(' ') : '';
  $('#results-summary').textContent = headline;
  $('#results-by-course').textContent = byCourse;
  if (!results.length) renderEmpty(s);
  $('#results-status').textContent = results.length ? `${headline}. ${byCourse}` : `No tee times. ${$('#empty-title').textContent}`;
}

function teeCard(t) {
  const holes = t.holes.length === 2 ? '9 or 18 holes' : `${t.holes[0]} holes`;
  const price = PRICES[Math.min(...t.holes)].green;
  return `<li><button type="button" class="tee-card" data-id="${t.id}">
    <span class="tee-time">${fmtTime(t.time)}</span>
    <span class="tee-course">${t.course.name}<span class="visually-hidden">,</span></span>
    <span class="tee-meta"><span>${t.start}<span class="visually-hidden">,</span></span>
      <span class="holes-badge holes-${t.holes.length === 2 ? 'both' : t.holes[0]}">${holes}</span><span class="visually-hidden">,</span>
      <span>${t.spots} of 4 spots open</span></span>
    <span class="tee-price">${t.holes.length === 2 ? 'from ' : ''}${money(price)}<small> per player</small></span>
  </button></li>`;
}

// Say why the list is empty and offer the closest searches that do have times.
function renderEmpty(s) {
  const title = $('#empty-title'), body = $('#empty-body');
  const where = s.courses.length === 2 ? 'either course' : COURSES.find(c => c.id === s.courses[0]).name;
  const anything = search({ ...s, holes: 'any', players: 1, tod: 'any' });

  if (isoDate(s.day) === isoDate(TODAY) && NOW >= lastTeeTime(TODAY)) {
    title.textContent = "Today's tee times are over";
    body.textContent = `The last tee time today was ${fmtTime(lastTeeTime(TODAY))}. The list ends 100 minutes before sunset so every group can finish before dark.`;
  } else if (!anything.length) {
    title.textContent = `${fmtDay(s.day)} is booked up at ${where}`;
    body.textContent = 'Every tee time that day is taken. If someone cancels, it will show up here.';
  } else {
    title.textContent = 'No tee times match those filters';
    body.textContent = `There are ${anything.length} open times at ${where} on ${fmtDay(s.day)}, just not with every filter you picked. These are the ones that do:`;
  }

  const tries = [];
  if (s.tod !== 'any') tries.push([{ tod: 'any' }, 'any time of day']);
  for (let p = s.players - 1; p >= 1; p--) tries.push([{ players: p }, `${p} ${p === 1 ? 'player' : 'players'}`]);
  if (s.holes !== 'any') tries.push([{ holes: 'any' }, '9 or 18 holes']);
  if (s.courses.length < 2) tries.push([{ courses: ['dp', 'vv'] }, 'both courses']);
  // When two filters block at once, no single change helps, so offer loosening both (keeping the group size).
  if (s.tod !== 'any' || s.holes !== 'any') tries.push([{ tod: 'any', holes: 'any' }, 'any time and 9 or 18 holes']);
  const next = DAYS.find(d => d > s.day && dayOpen(d, s));
  if (next) tries.push([{ day: next }, fmtDay(next)]);

  const seen = new Set();
  const actions = tries.map(([change, label]) => ({ change, label, count: search({ ...s, ...change }).length }))
    .filter(a => {
      const key = Object.keys(a.change).join();
      return a.count && !seen.has(key) && seen.add(key);
    })
    .slice(0, 3);
  $('#empty-actions').innerHTML = actions.map((a, i) =>
    `<button type="button" class="btn btn-secondary" data-try="${i}">Show ${a.count} ${a.count === 1 ? 'time' : 'times'} for ${a.label}</button>`).join('');
  $('#empty-actions').onclick = e => {
    const btn = e.target.closest('[data-try]');
    if (!btn) return;
    Object.assign(state.search, actions[+btn.dataset.try].change);
    syncSearchForm();
    runSearch();
  };
}

$('#results-list').addEventListener('click', e => {
  const card = e.target.closest('.tee-card');
  if (!card) return;
  const s = state.search;
  state.selected = search(s).find(t => t.id === card.dataset.id);
  state.bookingKey = crypto.randomUUID();
  renderReview();
  go('review');
});

// ---------- Step 2: review and pay ----------

const bookingForm = $('#booking-form');

function policyRows(course, time) {
  return course.policy.map((tier, i) => {
    const deadline = addMs(time, -tier.hours * HOUR);
    const when = i === 0 ? `Before ${fmtWhen(deadline)} (12+ hours out)`
      : tier.hours ? `${fmtWhen(addMs(time, -course.policy[i - 1].hours * HOUR))} to ${fmtWhen(deadline)}`
        : `After ${fmtWhen(addMs(time, -course.policy[i - 1].hours * HOUR))}`;
    return `<tr><td>${when}</td><td>${tier.outcome}</td></tr>`;
  }).join('');
}

function renderReview() {
  const t = state.selected, s = state.search;
  const other = COURSES.find(c => c !== t.course);

  $('#review-details').innerHTML = `
    <div><dt>Course</dt><dd>${t.course.name}, ${t.course.town}</dd></div>
    <div><dt>Date</dt><dd>${fmtLongDay(t.time)}</dd></div>
    <div><dt>Tee time</dt><dd>${fmtTime(t.time)}, ${t.start}</dd></div>`;

  for (const r of $$('input[name="holes"]', bookingForm)) {
    r.disabled = !t.holes.includes(+r.value);
    r.checked = t.holes.length === 1 ? +r.value === t.holes[0] : s.holes === r.value;
  }
  $('#holes-note').textContent = t.holes.length === 1
    ? `${t.start} times are ${t.holes[0]} holes only.`
    : 'This time can be played as 9 or 18 holes.';

  for (const r of $$('input[name="players"]', bookingForm)) {
    r.disabled = +r.value > t.spots;
    r.checked = +r.value === Math.min(s.players, t.spots);
  }
  $('#players-note').textContent = t.spots < 4 ? `Only ${t.spots} of 4 spots are open at this time.` : 'All 4 spots are open.';

  $('#policy-heading').textContent = `${t.course.name}'s cancellation policy`;
  $('#policy-rows').innerHTML = policyRows(t.course, t.time);
  const toggle = $('#other-policy-toggle');
  toggle.textContent = `Compare with ${other.name}'s policy`;
  toggle.setAttribute('aria-expanded', 'false');
  $('#other-policy').hidden = true;
  $('#other-policy').innerHTML = `<p class="hint">${other.name}'s last tier is different. For this same tee time it would be:</p>
    <table><thead><tr><th scope="col">If you cancel</th><th scope="col">You get</th></tr></thead><tbody>${policyRows(other, t.time)}</tbody></table>`;

  clearErrors();
  $('#pay-alert').hidden = true;
  const booked = storage.get('bookings')[t.id];
  $('#already-booked').hidden = !booked;
  if (booked) $('#already-booked').textContent = `You already booked this tee time. Confirmation ${booked.confirmation}. The Pay button is off so you don't book it twice.`;
  setPaying(false);
  updateTotal();
}

function formValues() {
  const data = new FormData(bookingForm);
  return {
    holes: +data.get('holes') || null,
    players: +data.get('players'),
    cart: data.get('cart'),
    name: data.get('name').trim(),
    email: data.get('email').trim(),
    phone: data.get('phone').trim(),
  };
}

function updateTotal() {
  const v = formValues(), t = state.selected;
  const price = PRICES[v.holes ?? Math.min(...t.holes)];
  const total = v.players * (price.green + (v.cart === 'yes' ? price.cart : 0));
  $('#total').textContent = money(total);
  const booked = storage.get('bookings')[t.id];
  $('#pay-label').textContent = booked ? 'Already booked'
    : taken.has(t.id) ? 'This time is no longer open'
      : `Pay ${money(total)} for ${fmtDay(t.time)} at ${fmtTime(t.time)}`;
  $('#pay-button').disabled = Boolean(booked) || taken.has(t.id);
  return total;
}

bookingForm.addEventListener('change', e => {
  updateTotal();
  // Once a field has shown an error, re-check it as soon as it changes so the message clears.
  if (e.target.getAttribute('aria-invalid') === 'true' || e.target.type === 'radio') validate([e.target.name]);
});
bookingForm.addEventListener('input', e => {
  if (e.target.getAttribute('aria-invalid') === 'true') validate([e.target.name]);
});

const RULES = {
  holes: v => (v.holes ? '' : 'Choose 9 or 18 holes.'),
  cart: v => (v.cart ? '' : 'Pick a cart or walking. The course needs to know before you check in.'),
  name: v => (v.name ? '' : 'Enter the name the tee time is under.'),
  email: v => (!v.email ? 'Enter an email so we can send your confirmation.'
    : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email) ? '' : "That does not look like an email address. Use the format name@example.com."),
  phone: v => (!v.phone || v.phone.replace(/\D/g, '').length === 10 ? '' : 'Enter a 10 digit phone number, or leave it blank.'),
};

function validate(names = Object.keys(RULES)) {
  const v = formValues();
  const errors = [];
  for (const name of names.filter(n => RULES[n])) {
    const message = RULES[name](v);
    $(`#${name}-error`).textContent = message;
    for (const input of $$(`[name="${name}"]`, bookingForm)) input.setAttribute('aria-invalid', String(Boolean(message)));
    if (message) errors.push({ name, message });
  }
  return errors;
}

function clearErrors() {
  for (const p of $$('.field-error', bookingForm)) p.textContent = '';
  for (const input of $$('[aria-invalid]', bookingForm)) input.removeAttribute('aria-invalid');
  $('#error-summary').hidden = true;
}

function showErrorSummary(errors) {
  const box = $('#error-summary');
  $('ul', box).innerHTML = errors.map(e => `<li><a href="#${e.name}" data-field="${e.name}">${e.message}</a></li>`).join('');
  box.hidden = false;
  box.focus();
}

$('#error-summary').addEventListener('click', e => {
  const link = e.target.closest('[data-field]');
  if (!link) return;
  e.preventDefault();
  $(`[name="${link.dataset.field}"]:not(:disabled)`, bookingForm).focus();
});

function setPaying(on) {
  state.paying = on;
  const btn = $('#pay-button');
  btn.classList.toggle('is-loading', on);
  // aria-disabled instead of disabled so focus stays on the button while it works.
  btn.setAttribute('aria-disabled', String(on));
  $('#back-button').disabled = on;
  bookingForm.setAttribute('aria-busy', String(on));
  if (on) $('#pay-label').textContent = 'Processing payment...';
}

bookingForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (state.paying) return; // second click while the first payment is still out
  const t = state.selected;
  const errors = validate();
  if (errors.length) return showErrorSummary(errors);
  $('#error-summary').hidden = true;
  $('#pay-alert').hidden = true;

  const bookings = storage.get('bookings');
  if (bookings[t.id]) return go('done');

  const v = formValues(), total = updateTotal(), key = state.bookingKey;
  setPaying(true);
  $('#pay-status').textContent = 'Processing your payment. This can take a few seconds.';
  const outcome = controls.outcome;
  controls.outcome = 'ok';
  $('input[name="outcome"][value="ok"]').checked = true;

  // A real server would refuse a second payment with the same key. sessionStorage stands in for that here.
  const result = await fakeServer(() => outcome, Math.max(LATENCY[controls.latency] * 2, 300));
  setPaying(false);
  $('#pay-status').textContent = '';

  if (result === 'taken') {
    taken.add(t.id);
    $('#pay-alert').innerHTML = `<p><strong>Someone else booked ${fmtTime(t.time)} at ${t.course.name} while you were on this page.</strong> You weren't charged.</p>
      <button type="button" class="btn btn-secondary" data-action="back">Pick another time</button>`;
    $('#pay-alert').hidden = false;
    updateTotal();
    return;
  }
  if (result === 'network') {
    $('#pay-alert').innerHTML = `<p><strong>We couldn't reach ${t.course.name}'s booking system.</strong> You weren't charged, and everything you entered is still here. Try again in a moment.</p>`;
    $('#pay-alert').hidden = false;
    $('#pay-label').textContent = `Try paying ${money(total)} again`;
    return;
  }

  const confirmation = `${t.course.id.toUpperCase()}-${Math.floor(10000 + Math.random() * 90000)}`;
  bookings[t.id] = { key, confirmation, total, ...v, time: t.time.toISOString(), course: t.course.id, start: t.start };
  storage.set('bookings', bookings);
  renderDone(bookings[t.id]);
  go('done');
});

$('#pay-alert').addEventListener('click', e => {
  if (e.target.closest('[data-action="back"]')) backToSearch();
});
$('#back-button').addEventListener('click', backToSearch);

function backToSearch() {
  go('search');
  runSearch();
}

$('#other-policy-toggle').addEventListener('click', e => {
  const btn = e.currentTarget;
  const open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(open));
  $('#other-policy').hidden = !open;
});

// ---------- Step 3: confirmation ----------

function renderDone(b) {
  const course = COURSES.find(c => c.id === b.course), time = new Date(b.time);
  $('#done-lede').textContent = `Confirmation ${b.confirmation}. We sent the details to ${b.email}.`;
  $('#done-details').innerHTML = `
    <div><dt>Course</dt><dd>${course.name}, ${course.town}</dd></div>
    <div><dt>When</dt><dd>${fmtLongDay(time)} at ${fmtTime(time)}, ${b.start}</dd></div>
    <div><dt>Group</dt><dd>${b.players} ${b.players === 1 ? 'player' : 'players'}, ${b.holes} holes, ${b.cart === 'yes' ? 'with a cart' : 'walking'}</dd></div>
    <div><dt>Paid</dt><dd>${money(b.total)}</dd></div>`;
  $('#done-policy-rows').innerHTML = policyRows(course, time);
}

$('#again-button').addEventListener('click', () => {
  state.selected = null;
  backToSearch();
});

// ---------- Steps and history ----------

const STEP_TITLES = { search: 'Find a Tee Time', review: 'Review and Pay', done: 'Booking Confirmed' };

function go(step, { push = true } = {}) {
  for (const name of Object.keys(STEP_TITLES)) $(`#step-${name}`).hidden = name !== step;
  for (const li of $$('.steps li')) {
    if (li.dataset.step === step) li.setAttribute('aria-current', 'step');
    else li.removeAttribute('aria-current');
  }
  document.title = `${STEP_TITLES[step]} - Davis County Golf (Prototype)`;
  if (push) history.pushState({ step, selected: state.selected?.id }, '', `${location.search}${step === 'search' ? '' : `#${step}`}`);
  $(`#step-${step} h1`).focus();
}

window.addEventListener('popstate', e => {
  let step = e.state?.step ?? 'search';
  if (step !== 'search' && !state.selected) step = 'search';
  if (step === 'review') renderReview();
  if (step === 'done') {
    const b = storage.get('bookings')[state.selected.id];
    if (b) renderDone(b); else step = 'review';
  }
  go(step, { push: false });
  if (step === 'search') runSearch();
});

// ---------- Prototype controls ----------

$('.proto-controls').addEventListener('change', e => { controls[e.target.name] = e.target.value; });

// ---------- Start ----------

history.replaceState({ step: 'search' }, '', location.search);
syncSearchForm();
runSearch();
