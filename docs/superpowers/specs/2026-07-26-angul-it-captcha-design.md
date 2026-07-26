# Angul-It Captcha Application — Design Spec

## Overview

A multi-stage captcha web application built with Angular 21. Users complete 3 randomly assigned captcha challenges (emoji grid, math, text input) before accessing a results page. State persists across page refresh via localStorage.

## Architecture

### Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `HomeComponent` | Landing page with "Start Captcha" button |
| `/captcha` | `CaptchaComponent` | Multi-stage captcha challenges |
| `/results` | `ResultComponent` | Final score and retry option |

### Approach: Single Component + Service

One `CaptchaComponent` handles all 3 stages internally via a signal-based `CaptchaService`. This keeps routing minimal (`/`, `/captcha`, `/results`) and uses a service for state management aligned with Angular's signal patterns.

## Components

### HomeComponent
- Landing page with project title and "Start Captcha" button
- Button navigates to `/captcha`
- If user already has completed state in localStorage, show "View Results" option

### CaptchaComponent
- Displays current challenge based on `CaptchaService.currentStage()`
- Stage indicator showing progress (1/3, 2/3, 3/3)
- "Previous" button to revisit earlier stages (answers preserved in service)
- "Next"/"Submit" button enabled only after correct answer (form validation)
- Three challenge renderers:
  - **Emoji Grid**: 4x4 grid of emoji buttons, prompt asks "click all [category]" (e.g., animals, food). Selected emojis have visual highlight. Validation checks if selection matches expected answer set.
  - **Math**: Displays equation, multiple choice or text input for answer. Validation checks numeric equality.
  - **Text**: Displays a word/phrase, text input field. Validation checks exact string match (case-insensitive).

### ResultComponent
- Shows per-stage results (passed/failed with challenge type label)
- Overall pass/fail status
- "Try Again" button resets service and navigates to `/captcha`
- Protected by `resultsGuard` — direct URL access redirects to `/captcha` if incomplete

## Services

### CaptchaService (Signal-based)

```
State:
  currentStage: signal<number>(1)
  challenges: signal<Challenge[]>([])    // 3 randomly selected challenges
  results: signal<StageResult[]>([])     // per-stage pass/fail + user answers
  isComplete: computed(() => results().length === 3)

On init:
  - restore() from localStorage if data exists
  - If no data, generate 3 random challenges and persist

On stage submit:
  - Validate answer against challenge
  - Push result to results[]
  - If currentStage < 3, increment currentStage
  - persist() to localStorage

On "Previous":
  - Decrement currentStage (minimum 1)

On reset:
  - Clear all signals, clear localStorage
  - Generate new challenges
```

### Challenge Types

Three challenge types, randomly allocated per session:

1. **Emoji Grid** — 4x4 grid of emojis. Prompt asks to select all matching a category (animals, food, objects, etc.). User clicks matching emojis, then submits.
2. **Math Problem** — Simple arithmetic (addition, subtraction, multiplication). Multiple choice answers.
3. **Text Input** — Show a word/phrase, user types it back (case-insensitive).

Each session gets 3 challenges, randomly selected from the pool of types (each type appears exactly once per session — one emoji grid, one math, one text input, in random order).

## Route Guards

### resultsGuard
- Checks `CaptchaService.isComplete`
- If complete: allows navigation to `/results`
- If incomplete: redirects to `/captcha`

## localStorage Persistence

### Schema

```json
{
  "captchaState": {
    "currentStage": 2,
    "challenges": [...],
    "results": [
      { "stage": 1, "type": "emoji", "passed": true, "userAnswer": [...] },
      { "stage": 2, "type": "math", "passed": null }
    ]
  }
}
```

### Behavior
- Auto-persist on every state change via Angular `effect()`
- Restore on service initialization
- Clear on reset

## Form Validation

Each challenge type uses Reactive Forms:

- **Emoji Grid**: `FormArray` of boolean selections, at least one selected
- **Math**: `FormControl` with `Validators.required` and custom validator for correct answer
- **Text**: `FormControl` with `Validators.required` and custom validator for match
- Submit button disabled until form is valid

## Animations

Using `@angular/animations`:

- Page transitions: `routeAnimation` trigger on router outlet
- Challenge card: slide-in from right when advancing, slide-in from left when going back
- Stage indicator: smooth progress bar transition
- Emoji grid: subtle scale animation on selection
- Results page: fade-in with staggered result items

## Accessibility

- All interactive elements keyboard-accessible
- ARIA labels on emoji grid cells
- Focus management when switching stages
- Color contrast meets WCAG AA
- Screen reader announcements for stage transitions
- Form error messages linked to inputs via `aria-describedby`

## Testing Strategy

Unit tests with Vitest:

- **CaptchaService**: challenge generation, validation, localStorage persistence, reset
- **HomeComponent**: renders title, navigates to captcha
- **CaptchaComponent**: renders correct challenge type, form validation, submit behavior, stage navigation
- **ResultComponent**: displays results, redirects if incomplete, reset functionality
- **resultsGuard**: allows/blocks access based on completion state

## File Structure

```
src/
  app/
    components/
      home/
        home.ts
        home.html
        home.css
        home.spec.ts
      captcha/
        captcha.ts
        captcha.html
        captcha.css
        captcha.spec.ts
      result/
        result.ts
        result.html
        result.css
        result.spec.ts
    services/
      captcha.service.ts
      captcha.service.spec.ts
    guards/
      results.guard.ts
    models/
      captcha.models.ts
    app.ts
    app.html
    app.css
    app.routes.ts
    app.config.ts
```
