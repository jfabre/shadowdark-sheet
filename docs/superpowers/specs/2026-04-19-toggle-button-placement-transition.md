# Toggle Button Placement & Transition — Design Spec

Date: 2026-04-19

## Overview

Two changes to the existing party-view toggle:

1. **Move the pill** from above the portrait row into the bottom-right corner of the portrait frame itself (semi-transparent overlay).
2. **Add a horizontal slide transition** between the char-pane and party-pane.
3. **Rework the party icon** from the cluttered 3-figure SVG to a clean two-figure side-by-side icon.

## 1. Button Placement

### Current
`#view-toggle` is a block-level div placed before `.portrait-info-row`, centring the pill above the whole row.

### New
The pill moves **inside `.portrait-frame`**, absolutely positioned at `bottom: 6px; right: 6px`. It overlays the portrait image.

**Styling:**
- `position: absolute; bottom: 6px; right: 6px; z-index: 10`
- Background: `rgba(0, 0, 0, 0.55)` — semi-transparent dark frosted look
- Border: `1px solid rgba(255,255,255,0.12)`
- Border-radius: `20px`
- Padding: `3px 4px`, gap `2px`
- Pointer-events on pill buttons work normally; the portrait click target must not fire when the pill is clicked

**Portrait frame note:** `.portrait-frame` already has `position: relative` and `overflow: hidden`. The pill sits inside the frame, clipped by the rounded border. The active button gets `background: var(--accent)` at reduced opacity; inactive gets transparent.

**Pill only renders when JS sets `toggle.style.display = ''`** (unchanged JS logic).

## 2. Party Icon

### Current
Three overlapping figures — cluttered at 14px.

### New
Two clean side-by-side silhouettes, equal size, no overlap:

```svg
<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
  <circle cx="4.5" cy="3.5" r="1.9"/>
  <path d="M0.5 13 C0.5 10 2 8.5 4.5 8.5 C7 8.5 8.5 10 8.5 13Z"/>
  <circle cx="9.5" cy="3.5" r="1.9"/>
  <path d="M5.5 13 C5.5 10 7 8.5 9.5 8.5 C12 8.5 13.5 10 13.5 13Z"/>
</svg>
```

## 3. Horizontal Slide Transition

### Mechanism
`#char-pane` and `#party-pane` are siblings inside `.portrait-info-col`. Both are always in the DOM; visibility is controlled by CSS classes rather than `display:none` flips.

**CSS approach (Chromium 111 compatible — no View Transitions API):**

```css
.portrait-info-col {
  position: relative;
  overflow: hidden;     /* clips sliding panes */
}

#char-pane,
#party-pane {
  width: 100%;
  transition: transform 0.25s ease, opacity 0.25s ease;
}

/* Default: char visible, party off to the right */
#char-pane  { transform: translateX(0);     opacity: 1; }
#party-pane { transform: translateX(100%);  opacity: 0; pointer-events: none; }

/* Active party view */
.party-active #char-pane  { transform: translateX(-100%); opacity: 0; pointer-events: none; }
.party-active #party-pane { transform: translateX(0);      opacity: 1; pointer-events: none; }
/* party-pane gets pointer-events restored when active: */
.party-active #party-pane { pointer-events: auto; }
```

A `.party-active` class is toggled on `.portrait-info-col` (or a wrapper) instead of JS directly setting `display:none`. This lets CSS transitions fire.

**JS change:** Replace `display` assignments with class toggle:
```js
function show(view) {
  var col = document.querySelector('.portrait-info-col');
  col.classList.toggle('party-active', view === 'party');
  btnChar.classList.toggle('active',  view !== 'party');
  btnParty.classList.toggle('active', view === 'party');
}
```

`renderPartyPanel` empty-party reset also removes `.party-active` from `.portrait-info-col`.

## Constraints

- Chromium 111: no optional chaining, nullish coalescing, structuredClone, ES modules. Use `var`.
- `.portrait-frame` has `overflow: hidden` — pill is clipped by frame border-radius, which is the desired look.
- `pointer-events` on hidden panes must be `none` to prevent invisible inputs receiving focus/clicks.
- `#party-pane` display is no longer set by JS (CSS handles visibility); JS only sets `toggle.style.display` for the pill show/hide.

## Files Changed

- `index.html`: move `#view-toggle` div inside `.portrait-frame`; update party icon SVG
- `style.css`: reposition pill CSS; add slide transition rules; update `.portrait-info-col`
- `script.js`: replace `display` assignments with `.party-active` class toggle on `.portrait-info-col`
- `tests/party-panel.spec.js`: update selectors/assertions for new transition mechanism

## Out of Scope

- Transition duration/easing customisation (0.25s ease is fixed)
- Any change to HP dots, party card layout, or PartySync API
