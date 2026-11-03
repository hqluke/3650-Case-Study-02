## Interaction Flow

GitHub draws these diagrams from the Mermaid code. The first one is the path through the three steps. The second is every state the Pay button can be in.

### Booking Flow

```mermaid
flowchart TD
    A([Open the page]) --> B[Find a time<br>both courses, first open day]
    B -->|change date, holes, players,<br>time of day, or courses| L{{Loading<br>skeleton after 100 ms}}
    L -->|times found| R[List of tee times<br>count per course, earliest time]
    L -->|nothing matches| E[Empty state<br>says why, offers up to 3 searches that have times]
    E -->|pick a suggestion| L
    R -->|pick a tee time| V[Review and pay]
    V -->|Back to tee times| R
    V -->|Pay with missing or bad fields| X[Error summary gets focus<br>inline error on each field]
    X -->|fix fields, Pay again| P
    V -->|Pay| P{{Processing payment<br>button locked, status announced}}
    P -->|goes through| C[Confirmed<br>confirmation number, cancel deadlines]
    P -->|connection drops| N[Alert: not charged, details kept<br>Try again]
    N -->|Try again, same booking key| P
    P -->|someone else booked it| T[Alert: not charged<br>Pay turned off]
    T -->|Pick another time| R
    C -->|browser Back| D[Review shows Already booked<br>Pay turned off]
    C -->|Book another tee time| B
```

### Pay Button States

```mermaid
stateDiagram-v2
    [*] --> Ready: review opens
    Ready --> Invalid: Pay with errors
    Invalid --> Ready: errors fixed
    Ready --> Processing: Pay with a valid form
    Processing --> Booked: payment goes through
    Processing --> Retry: connection drops
    Retry --> Processing: Try again
    Processing --> Gone: time was taken
    Booked --> AlreadyBooked: browser Back
    Gone --> [*]: Pick another time
    AlreadyBooked --> [*]

    Ready: Ready, label shows the total, day, and time
    Invalid: Invalid, focus moves to the error summary
    Processing: Processing, aria-disabled true, spinner, label says Processing payment
    Retry: Retry, label says Try paying again
    Gone: Gone, disabled, label says This time is no longer open
    Booked: Booked, page moves to Confirmed
    AlreadyBooked: Already booked, disabled
```

Two things don't change the state, so they aren't drawn as arrows. Changing holes, players, or cart while Ready only updates the total in the label. Clicking Pay again while Processing does nothing, because the submit handler returns early while a payment is out.
