# Angul-It — Multi-Stage Captcha Application: Design

Date: 2026-10-28
Status: Approved

## Purpose

A multi-stage captcha web application built with Angular 22 (v22.2). A user completes a sequence of captcha challenges; progress persists across page refreshes; results are shown only after full completion.

## Context

The project is an existing Angular 22.2 scaffold (vitest + jsdom for tests). An uncommitted work-in-progress exists (Home/Captcha/Result components, a boilerplate state service, 3 fixed challenges). The user chose to keep and improve it.

## Decisions

1. **Keep and improve** the existing components (`src/app/home`, `src/app/captcha`, `src/app/result`, `src/app/captcha/state.ts`), replacing the mutable state service with a signals-based store.
2. **All 3 bonuses** are in scope: randomized challenge sets, animations, responsiveness.
3. **Advancement rule**: a token challenge is "completed" only when answered correctly. Wrong answers show an inline error, increment `attempts`, and the user stays on that stage until correct. Because of this gate, every recorded challenge ends up marked `passed`.
4. **State management**: signals-based store service (`providedIn: 'root'`) with `effect()` persistence to `localStorage`. No NgRx, no `@angular/animations`.

## Architecture

### Routes and guards

| Path | Component | Guard |
|---|---|---|
| `/` | `Home` | — |
| `/captcha` | `Captcha` | requires an active (non-completed) session, else redirect to `/` |
| `/result` | `Result` | requires a **completed** session, else redirect to `/captcha` |
| `**` | — | redirect to `/` |

Guards are functional guards injected via `provideRouter(routes)` in `app.config.ts`, backed by `CaptchaStateService` (or `inject()` inside guard functions). Guards replace per-component redirects in `ngOnInit`.

### State store — `CaptchaStateService`

```ts
interface Challenge {
  id: number;
  type: 'image' | 'math' | 'text';
  question: string;
  images?: string[];        // emoji tiles (image challenges only)
  category?: string;        // image challenge target category
  answer: string | number | number[]; // correct answer (never rendered)
  userAnswer?: string | number | number[]; // last validated-correct answer
  attempts: number;
  status: 'active' | 'passed';
}

interface CaptchaSession {
  challenges: Challenge[];
  currentIndex: number;
  completed: boolean;
  startedAt: number;        // epoch ms
}
```

- Public API (signals): `session`, `currentChallenge`, `completed`, `progress` (computed).
- Methods: `startNewSession()`, `submitAnswer(correct: boolean, answer)`, `goTo(index)`, `resetState()`, `loadFromStorage()`.
- Persistence: an `effect()` writes JSON to `localStorage` key `angult.session` on every state change; constructor hydrates on service creation. All storage access wrapped in try/catch (private-mode safety).
- `submitAnswer` is called only after correctness is established by the captcha component; it stamps `userAnswer`, `attempts`, `status: 'passed'`, and advances `currentIndex` or sets `completed = true` on the last stage.

### Randomized challenge generation (bonus)

Each `startNewSession()` builds 4 stages, shuffled:
- exactly 1 image challenge drawn from a random category (cats 🐱, dogs 🐶, flowers 🌸, vehicles 🚗, fruits 🍎, musical 🎵),
- 1 math challenge (`+` or `×` operands 1–12; `−` with the larger operand first so results are non-negative),
- 1 text challenge (random word from a pool),
- 1 extra challenge of a randomly chosen type (may duplicate).

Math and text pools ensure single, deterministic correct answers. Image challenges use a fixed 9-tile grid: ≥2 correct tiles + distractor emojis from other categories. Emoji-only tiles: no external assets (jsdom-testable, offline-friendly).

The correct-answer evaluation rules, stated explicitly:
- **image**: sets of selected indices equal (order-insensitive, no missing, no extra).
- **math**: numeric string parses to a Number equal to the answer.
- **text**: trimmed, case-insensitive string equality.

### Components

**Home** (`app-home`) — title, short description, "Start challenge" button → `startNewSession()` + navigate to `/captcha`. If a non-completed session exists on mount, show a "Continue" button as well (idempotent: re-generating is allowed via "Start challenge").

**Captcha** (`app-captcha`)
- Stepper header: `1…4`; a dot shows `passed ✓`, `current`, or `upcoming` (not yet reachable). A revisited passed stage renders as a **locked view-only recap** (question + chosen answers, no inputs) — revisit means review, not re-answer.
- Stage body driven by `currentChallenge`:
  - `image`: 3×3 grid of emoji buttons; per-tile selection state; at-least-one-required validation.
  - `math`: numeric input; `Validators.required + pattern(/^-?\d+$/)`; min/max range message.
  - `text`: text input; `Validators.required`.
- Template per type via `@switch` on `challenge.type`; the reactive form (`FormGroup`/`FormControl`) is rebuilt on every stage change.
- Buttons: **Back** (goTo previous; a previously passed challenge shows its locked recap), **Check / Next**.
- Wrong answer → inline error (shake animation), `attempts++`.
- Correct answer → stage `passed`; auto-advance to next stage (or to `/result` if last — via setting `completed` and navigating).
- View-only locked recap for revisited passed stages (they can't be re-answered — avoids state corruption; revisit = review).

**Result** (`app-result`)
- Guard-protected; reads completed session.
- Per-stage recap list: type icon (grid/math/letters), question, attempts, pass badge. Summary line: "4/4 passed · N attempts · elapsed time".
- Actions: "New challenge" → `startNewSession()` + `/captcha`; "Home" → `/`.

### Animations (bonus — CSS only)

- Stage transition: fade + slide-up keyframes on the stage container, keyed per stage (`@keyframes stageIn`), re-triggered via class re-application on stage change.
- Wrong answer: `@keyframes shake` on the form card + error message appear.
- Image tile selection: scale pulse on selection.
- Stepper dots: color/scale transition.
- No `@angular/animations` package — CSS transitions survive jsdom tests trivially.

### Responsiveness (bonus — CSS only)

- Mobile-first. Challenge card `max-width: 640px`, centered.
- Image grid: 3×3 always, tiles shrink with viewport; `aspect-ratio: 1/1`; touch targets ≥ 44px.
- Stepper wraps; buttons full-width on narrow viewports.
- No media-query-heavy layout beyond simple adjustments (`@media (max-width: 480px)`).

## Error handling

- `localStorage` failures (quota, private mode): swallow and continue in-memory (try/catch at read and write sites).
- Corrupt stored JSON: treat as no session (start over).
- Direct navigation to `/captcha` or `/result` without proper state: guard redirect (per Routes table).
- Empty challenge pools: deterministic defaults.

## Testing (vitest + jsdom, run with `npm test`)

- **state.spec.ts**: challenge generation includes all 3 types (and count = 4), shuffled order across many runs, correct answers consistent with question payload; persistence round-trip through the store (a state change writes to localStorage; `loadFromStorage()` hydrates it back); `resetState()` clears storage; malformed JSON treated as null session.
- **captcha.spec.ts**: image/math/text validation errors prevent advancing; wrong answers produce inline error and do not advance; correct submission advances; "Back" navigates and locked stage is read-only; last correct answer sets `completed` + navigates to `/result`; localStorage involved via the store's `effect()`.
- **home.spec.ts**: "Start challenge" creates a session in the store and navigates.
- **result.spec.ts**: recap renders; "New challenge" resets and navigates.
- **app.spec.ts (guards via `RouterTestingHarness`)**: `/result` unguarded-complete-less → redirect `/captcha`; `/captcha` without session → redirect `/`; `/result` with completed session renders recap.
- Guards themselves get direct unit tests too (`resultGuard` returns redirect).

## Out of scope

- Backend/AJAX captcha verification, accessibility of real image captchas beyond aria-labels.
- `@angular/animations`, NgRx, external HTTP image providers.
