#!/usr/bin/env bash
# Regenerates every screenshot in prototype_spec/ from the running prototype.
# Needs chrome-devtools-axi and the site served locally:
#   python3 -m http.server 8765 --directory docs
set -euo pipefail
cd "$(dirname "$0")/.."
B=http://localhost:8765
U="$B/?now=2026-11-06T09:30" # pinned clock so the tee times are the same every run
FLOW=$PWD/flow STATES=$PWD/component-states
mkdir -p "$FLOW" "$STATES"

shot() { chrome-devtools-axi screenshot "$1" "${@:2}" >/dev/null; }
run() { chrome-devtools-axi eval "() => { $1; return 1 }" >/dev/null; }
fill() { run "const f=document.querySelector('#booking-form'); f.querySelector('[name=holes]:not(:disabled)').click(); f.querySelector('[name=cart][value=$1]').click(); f.name.value='Luke Peterson'; f.email.value='luke@example.com'"; }
open() { chrome-devtools-axi open "$1" >/dev/null; sleep 1.5; }

# Component state matrices
chrome-devtools-axi resize 1100 900 >/dev/null
for id in buttons chips checks fields cards; do
  open "$B/states.html"
  run "const keep=document.getElementById('$id'); document.querySelector('.site-header').style.display='none'; for (const el of document.querySelector('main').children) el.style.display = (el===keep || el===keep.nextElementSibling) ? '' : 'none'"
  shot "$STATES/$id.png" --full-page
done

# Desktop flow
chrome-devtools-axi resize 1280 900 >/dev/null
open "$U"; run "sessionStorage.clear()"; open "$U"
shot "$FLOW/01-search-desktop.png"
run "document.querySelector('[name=latency][value=slow]').click(); document.querySelector('input[name=date][value=\"2026-11-07\"]').click()"
sleep 0.4; shot "$FLOW/02-loading-skeleton.png"; sleep 3

open "$B/?date=2026-11-06&holes=18&players=4&tod=morning&courses=dp&now=2026-11-06T09:30"
shot "$FLOW/03-empty-state.png"

open "$U"
run "document.querySelectorAll('.tee-card')[3].click(); document.querySelector('#pay-button').click()"
shot "$FLOW/04-review-errors.png"
fill yes
run "document.querySelector('#other-policy-toggle').click(); document.querySelector('[name=latency][value=slow]').click(); document.querySelector('#pay-button').click(); document.querySelector('#pay-button').scrollIntoView({block:'end'})"
sleep 0.5; shot "$FLOW/05-paying.png"
sleep 6.5; shot "$FLOW/06-confirmed.png"
run "history.back()"; sleep 0.8; run "scrollTo(0,0)"
shot "$FLOW/07-already-booked.png"

open "$U"
run "document.querySelectorAll('.tee-card')[5].click()"
fill no
run "document.querySelector('[name=latency][value=fast]').click(); document.querySelector('[name=outcome][value=network]').click(); document.querySelector('#pay-button').click()"
sleep 1; run "document.querySelector('#pay-button').scrollIntoView({block:'end'})"
shot "$FLOW/08-network-error.png"
run "document.querySelector('[name=outcome][value=taken]').click(); document.querySelector('#pay-button').click()"
sleep 1; run "document.querySelector('#pay-button').scrollIntoView({block:'end'})"
shot "$FLOW/09-time-taken.png"

# Phone width
chrome-devtools-axi resize 390 844 >/dev/null
open "$U"; shot "$FLOW/10-search-mobile.png"
run "document.querySelector('#filters-toggle').click(); document.querySelector('#filters-toggle').scrollIntoView()"
shot "$FLOW/11-filters-open-mobile.png"
echo "Screenshots written to $FLOW and $STATES"
