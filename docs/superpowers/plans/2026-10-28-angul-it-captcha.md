# Angul-It Captcha Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and polish a multi-stage captcha app (4 randomized stages, localStorage-persisted progress, guarded routes, animated/responsive UI) on the existing Angular 22 scaffold and its uncommitted WIP.

**Architecture:** A signals-based `CaptchaStateService` store with `effect()` persistence is the single source of truth; pure challenge generation/evaluation lives in `challenge-generator.ts`; functional guards route-protect `/captcha` and `/result`; `Captcha` renders the active stage with reactive forms and correctness-gated advancement. Spec: `docs/superpowers/specs/2026-10-28-angul-it-captcha-design.md`.

**Tech Stack:** Angular 22.2 (zoneless), Reactive Forms, signals, vitest + jsdom (via `@angular/build:unit-test`), plain CSS (no `@angular/animations`, no NgRx, no new npm deps).

## Global Constraints

- Angular v22.2, **zoneless**: in tests use `await fixture.whenStable()` (project convention) instead of forcing `await fixture.autoDetectChanges()`.
- **No new npm dependencies.** Reactive Forms come from `@angular/forms` (already installed).
- localStorage key: `angul-it-captcha`.
- Image challenges are emoji-only tiles (no external assets).
- Component naming per existing app: `Home`, `Captcha`, `Result`, store `CaptchaStateService` (class `State` is renamed). Selectors stay `app-home`, `app-captcha`, `app-result`.
- Tests use vitest globals (`describe`/`it`/`expect` are global — current spec files don't import them; match that).
- Component style budget is 4kB: put layout/theme/animation CSS in `src/styles.css`; component `.css` files stay minimal.
- **No code comments** anywhere in src files (project convention).
- Baseline before Task 1: run `npm test`. Expected current state: `home.spec`, `result.spec`, `captcha.spec`, `state.spec` pass; `app.spec` "should render title" **fails** (app.html was emptied). Everything else in the repo is uncommitted WIP; leave working-tree contents in place and let tasks overwrite files.
- Test runner note: `npm test` maps to `ng test`. If it enters interactive watch mode, cancel (Ctrl+C) and rerun once with `npm test -- --watch=false`.

---

### Task 1: Challenge generator and evaluator (`challenge-generator.ts`)

**Files:**
- Create: `src/app/captcha/challenge-generator.ts`
- Create: `src/app/captcha/challenge-generator.spec.ts`
- Modify (later, in Task 2): `src/app/captcha/state.ts` consumes this

**Interfaces:**
- Consumes: nothing (pure module).
- Produces (used by Tasks 2, 5, 6):
  - `type ChallengeType = 'image' | 'math' | 'text'`
  - `type ChallengeStatus = 'active' | 'passed'`
  - `interface Challenge { id: number; type: ChallengeType; question: string; images?: string[]; category?: string; answer: string | number | number[]; userAnswer?: string | number | number[]; attempts: number; status: ChallengeStatus }`
  - `interface CaptchaSession { challenges: Challenge[]; currentIndex: number; maxIndex: number; completed: boolean; startedAt: number }`
  - `interface ImageCategory { category: string; label: string; correct: string[]; distractors: string[] }`
  - `IMAGE_CATEGORIES: ImageCategory[]` (5 entries)
  - `WORD_POOL: string[]`
  - `shuffle<T>(items: readonly T[]): T[]` (returns new array)
  - `pick<T>(items: readonly T[]): T`
  - `buildImageChallenge(id: number): Challenge`
  - `buildMathChallenge(id: number): Challenge`
  - `buildTextChallenge(id: number): Challenge`
  - `buildSession(startedAt: number): CaptchaSession`
  - `isCorrect(challenge: Challenge, input: unknown): boolean`
  - `describeUserAnswer(challenge: Challenge): string`
  - `typeLabel(type: 'image' | 'math' | 'text'): string`
- Note: this file **defines and exports** the `ChallengeType`, `ChallengeStatus`, `Challenge`, and `CaptchaSession` types consumed by every later task; `state.ts` imports and re-exports them in Task 2. Do **not** modify `state.ts` in Task 1.

- [ ] **Step 1: Write the failing test file**

Create `src/app/captcha/challenge-generator.spec.ts`:

```ts
import {
  IMAGE_CATEGORIES,
  WORD_POOL,
  buildImageChallenge,
  buildMathChallenge,
  buildSession,
  buildTextChallenge,
  describeUserAnswer,
  isCorrect,
  shuffle,
} from './challenge-generator';

function questionToMathAnswer(question: string): number {
  const m = question.match(/What is (\d+) ([+\-−×]) (\d+)\?$/);
  if (!m) throw new Error('bad math question: ' + question);
  const a = Number(m[1]);
  const b = Number(m[3]);
  const op = m[2];
  return op === '+' ? a + b : op === '−' ? a - b : a * b;
}

describe('challenge-generator', () => {
  describe('buildSession', () => {
    it('creates 4 challenges with all 3 types present', () => {
      for (let i = 0; i < 20; i++) {
        const session = buildSession(1000 + i);
        expect(session.challenges.length).toBe(4);
        const types = new Set(session.challenges.map((c) => c.type));
        expect(types.has('image')).toBe(true);
        expect(types.has('math')).toBe(true);
        expect(types.has('text')).toBe(true);
        expect(session.currentIndex).toBe(0);
        expect(session.maxIndex).toBe(0);
        expect(session.completed).toBe(false);
        expect(session.startedAt).toBe(1000 + i);
        const ids = session.challenges.map((c) => c.id);
        expect(new Set(ids).size).toBe(4);
        expect(Math.min(...ids)).toBe(0);
      }
    });

    it('shuffles stage order across sessions', () => {
      const signatures = new Set<string>();
      for (let i = 0; i < 30; i++) {
        signatures.add(buildSession(i).challenges.map((c) => c.type).join(','));
      }
      expect(signatures.size).toBeGreaterThan(1);
    });

    it('builds consistent image challenges', () => {
      for (let i = 0; i < 30; i++) {
        const c = buildImageChallenge(0);
        expect(c.images?.length).toBe(9);
        expect(IMAGE_CATEGORIES.some((cat) => cat.category === c.category)).toBe(true);
        const answer = c.answer as number[];
        expect(answer.length).toBeGreaterThanOrEqual(2);
        expect(answer.length).toBeLessThanOrEqual(4);
        answer.forEach((idx) => expect(idx).toBeGreaterThanOrEqual(0));
        answer.forEach((idx) => expect(idx).toBeLessThan(9));
        expect(new Set(answer).size).toBe(answer.length);
      }
    });

    it('builds self-consistent math challenges', () => {
      let sawSubtraction = false;
      for (let i = 0; i < 60; i++) {
        const c = buildMathChallenge(0);
        const expected = questionToMathAnswer(c.question);
        expect(c.answer).toBe(expected);
        if (c.question.includes('−')) {
          sawSubtraction = true;
          expect(c.answer as number).toBeGreaterThanOrEqual(0);
        }
      }
      expect(sawSubtraction).toBe(true);
    });

    it('builds text challenges from the word pool', () => {
      for (let i = 0; i < 20; i++) {
        const c = buildTextChallenge(0);
        expect(WORD_POOL).toContain(c.answer);
        expect(c.question).toContain(`"${c.answer as string}"`);
      }
    });
  });

  describe('shuffle', () => {
    it('returns a new array with the same elements', () => {
      const input = [1, 2, 3, 4, 5, 6];
      const output = shuffle(input);
      expect(output).not.toBe(input);
      expect([...output].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });

  describe('isCorrect', () => {
    it('image: exact set match, order-insensitive', () => {
      const challenge = { type: 'image', answer: [0, 3] } as never;
      expect(isCorrect(challenge, [0, 3])).toBe(true);
      expect(isCorrect(challenge, [3, 0])).toBe(true);
      expect(isCorrect(challenge, [0])).toBe(false);
      expect(isCorrect(challenge, [0, 1, 3])).toBe(false);
      expect(isCorrect(challenge, [])).toBe(false);
    });

    it('math: numeric string or number', () => {
      const challenge = { type: 'math', answer: 15 } as never;
      expect(isCorrect(challenge, 15)).toBe(true);
      expect(isCorrect(challenge, '15')).toBe(true);
      expect(isCorrect(challenge, ' 15 ')).toBe(true);
      expect(isCorrect(challenge, '15 ')).toBe(true);
      expect(isCorrect(challenge, '16')).toBe(false);
      expect(isCorrect(challenge, 'abc')).toBe(false);
      expect(isCorrect(challenge, '')).toBe(false);
    });

    it('text: trimmed, case-insensitive', () => {
      const challenge = { type: 'text', answer: 'angular' } as never;
      expect(isCorrect(challenge, 'angular')).toBe(true);
      expect(isCorrect(challenge, '  Angular ')).toBe(true);
      expect(isCorrect(challenge, 'other')).toBe(false);
      expect(isCorrect(challenge, '')).toBe(false);
    });
  });

  describe('describeUserAnswer', () => {
    it('joins selected image tiles as emoji', () => {
      const challenge = { type: 'image', images: ['🐱', '🐶', '🐱'], answer: [0, 2], userAnswer: [2, 0] } as never;
      expect(describeUserAnswer(challenge)).toBe('🐱 🐱');
    });

    it('returns primitives as-is for math and text', () => {
      expect(describeUserAnswer({ type: 'math', answer: 5, userAnswer: 5 } as never)).toBe('5');
      expect(describeUserAnswer({ type: 'text', answer: 'x', userAnswer: 'X' } as never)).toBe('X');
      expect(describeUserAnswer({ type: 'text', answer: 'x' } as never)).toBe('—');
    });
  });
});
```

- [ ] **Step 2: Run the suite to verify the new tests fail**

Run: `npm test -- --watch=false`
Expected: FAIL — challenge-generator tests error with "Cannot find module './challenge-generator'"; pre-existing files behave as baseline.

- [ ] **Step 3: Create `src/app/captcha/challenge-generator.ts`**

```ts
export type ChallengeType = 'image' | 'math' | 'text';
export type ChallengeStatus = 'active' | 'passed';

export interface Challenge {
  id: number;
  type: ChallengeType;
  question: string;
  images?: string[];
  category?: string;
  answer: string | number | number[];
  userAnswer?: string | number | number[];
  attempts: number;
  status: ChallengeStatus;
}

export interface CaptchaSession {
  challenges: Challenge[];
  currentIndex: number;
  maxIndex: number;
  completed: boolean;
  startedAt: number;
}

export interface ImageCategory {
  category: string;
  label: string;
  correct: string[];
  distractors: string[];
}

export const IMAGE_CATEGORIES: ImageCategory[] = [
  { category: 'cats', label: 'a cat', correct: ['🐱', '🐈', '😺', '😻'], distractors: ['🐶', '🦊', '🐺', '🐵'] },
  { category: 'flowers', label: 'a flower', correct: ['🌸', '🌺', '🌻', '🌷'], distractors: ['🍀', '🌿', '🌵', '🍁'] },
  { category: 'vehicles', label: 'a car or bus', correct: ['🚗', '🚙', '🚌', '🏎️'], distractors: ['🚲', '🚤', '✈️', '🚂'] },
  { category: 'fruits', label: 'a fruit', correct: ['🍎', '🍌', '🍇', '🍓'], distractors: ['🥕', '🌽', '🍆', '🍄'] },
  { category: 'music', label: 'a musical note', correct: ['🎵', '🎶', '🎸', '🎹'], distractors: ['🥁', '🎺', '🎧', '🎤'] },
];

export const WORD_POOL: string[] = ['angular', 'captcha', 'harbor', 'quartz', 'purple', 'drift'];

const rand = (n: number): number => Math.floor(Math.random() * n);

export function pick<T>(items: readonly T[]): T {
  return items[rand(items.length)];
}

export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildImageChallenge(id: number): Challenge {
  const category = pick(IMAGE_CATEGORIES);
  const correctCount = 2 + rand(3);
  const correctTiles = shuffle(category.correct).slice(0, correctCount);
  const tiles = [...correctTiles];
  const distractors = shuffle(category.distractors);
  while (tiles.length < 9) {
    tiles.push(distractors[tiles.length % distractors.length]);
  }
  const images = shuffle(tiles);
  const answer: number[] = [];
  images.forEach((tile, index) => {
    if (correctTiles.includes(tile)) answer.push(index);
  });
  return {
    id,
    type: 'image',
    question: `Select every tile showing ${category.label}.`,
    category: category.category,
    images,
    answer,
    attempts: 0,
    status: 'active',
  };
}

export function buildMathChallenge(id: number): Challenge {
  const op = pick(['+', '−', '×'] as const);
  let a = 1 + rand(12);
  let b = 1 + rand(12);
  if (op === '−' && b > a) {
    [a, b] = [b, a];
  }
  const answer = op === '+' ? a + b : op === '−' ? a - b : a * b;
  return {
    id,
    type: 'math',
    question: `What is ${a} ${op} ${b}?`,
    answer,
    attempts: 0,
    status: 'active',
  };
}

export function buildTextChallenge(id: number): Challenge {
  const word = pick(WORD_POOL);
  return {
    id,
    type: 'text',
    question: `Type the word "${word}".`,
    answer: word,
    attempts: 0,
    status: 'active',
  };
}

export function buildSession(startedAt: number): CaptchaSession {
  const one = [buildImageChallenge(0), buildMathChallenge(1), buildTextChallenge(2)];
  const extra = pick([buildImageChallenge, buildMathChallenge, buildTextChallenge])(3);
  return {
    challenges: shuffle([...one, extra]),
    currentIndex: 0,
    maxIndex: 0,
    completed: false,
    startedAt,
  };
}

export function isCorrect(challenge: Challenge, input: unknown): boolean {
  if (challenge.type === 'image') {
    if (!Array.isArray(input) || !Array.isArray(challenge.answer)) return false;
    const left = [...(input as number[])].sort((a, b) => a - b);
    const right = (challenge.answer as number[]).slice().sort((a, b) => a - b);
    return left.length === right.length && left.every((v, i) => v === right[i]);
  }
  if (challenge.type === 'math') {
    const raw = String(input ?? '').trim();
    if (raw === '') return false;
    const n = Number(raw);
    return Number.isFinite(n) && n === challenge.answer;
  }
  return String(input ?? '').trim().toLowerCase() === String(challenge.answer).toLowerCase();
}

export function describeUserAnswer(challenge: Challenge): string {
  if (challenge.type === 'image') {
    const picked = Array.isArray(challenge.userAnswer) ? challenge.userAnswer : [];
    return picked.map((i) => challenge.images?.[i] ?? '').join(' ').trim();
  }
  return challenge.userAnswer === undefined || challenge.userAnswer === null
    ? '—'
    : String(challenge.userAnswer);
}

export function typeLabel(type: ChallengeType): string {
  switch (type) {
    case 'image':
      return 'Image grid';
    case 'math':
      return 'Math';
    case 'text':
      return 'Text';
  }
}
```

- [ ] **Step 4: Run the suite to verify it passes**

Run: `npm test -- --watch=false`
Expected: PASS for challenge-generator.spec.ts; rest as baseline.

- [ ] **Step 5: Commit**

```bash
git add src/app/captcha/challenge-generator.ts src/app/captcha/challenge-generator.spec.ts
git commit -m "feat(captcha): randomized challenge generation and evaluation"
```

---

### Task 2: Signals store with localStorage persistence (`state.ts`)

**Files:**
- Modify (full rewrite): `src/app/captcha/state.ts`
- Modify (full rewrite): `src/app/captcha/state.spec.ts`

**Interfaces:**
- Consumes: `buildSession`, `isCorrect` not used here (correctness decided by component) — only `buildSession` from Task 1.
- Produces (used by Tasks 3–6):
  - Re-exports the `ChallengeType`/`ChallengeStatus`/`Challenge`/`CaptchaSession` types (defined in Task 1's `challenge-generator.ts`).
  - `class CaptchaStateService` with:
    - signals: `session: Signal<CaptchaSession | null>`, `currentChallenge: Signal<Challenge | null>`, `completed: Signal<boolean>`
    - `startNewSession(): CaptchaSession`
    - `submitAnswer(challengeId: number, correct: boolean, userAnswer?: string | number | number[]): void` — wrong: `attempts++` only; correct: stamps `userAnswer` + `status: 'passed'`, then advances `currentIndex`/`maxIndex`, or sets `completed` on last stage
    - `goTo(index: number): void` — only `0 ≤ index ≤ maxIndex`, no-op otherwise
    - `resetState(): void`
    - `loadFromStorage(): void`
  - Storage key constant inside file: `angul-it-captcha`. Effect writes JSON on every signal change; `loadFromStorage()` hydrates in constructor; malformed/corrupt data → no session.

- [ ] **Step 1: Rewrite `src/app/captcha/state.spec.ts`** (test-first)

```ts
import { TestBed } from '@angular/core/testing';
import { CaptchaStateService, CaptchaSession, STORAGE_KEY } from './state';

function seedCompletedSession(service: CaptchaStateService): CaptchaSession {
  const session = service.startNewSession();
  for (const challenge of session.challenges) {
    service.submitAnswer(challenge.id, true, challenge.answer);
  }
  return service.session() as CaptchaSession;
}

describe('CaptchaStateService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('starts with no session', () => {
    const service = TestBed.inject(CaptchaStateService);
    expect(service.session()).toBeNull();
    expect(service.completed()).toBe(false);
    expect(service.currentChallenge()).toBeNull();
  });

  it('startNewSession creates a 4-challenge session', () => {
    const service = TestBed.inject(CaptchaStateService);
    const session = service.startNewSession();
    expect(session.challenges.length).toBe(4);
    expect(service.session()).toEqual(session);
    expect(service.currentChallenge()?.id).toBe(session.challenges[0].id);
  });

  it('persisted across service instances (hydration)', async () => {
    let service = TestBed.inject(CaptchaStateService);
    const original = service.startNewSession();
    const first = original.challenges[0];
    service.submitAnswer(first.id, true, first.answer);
    const afterFirst = service.session();
    await new Promise((resolve) => setTimeout(resolve, 0));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(CaptchaStateService);
    expect(service.session()).toEqual(afterFirst);
    expect(service.session()?.currentIndex).toBe(afterFirst?.currentIndex);
    expect(service.session()?.maxIndex).toBe(1);
  });

  it('submitAnswer with wrong answer only bumps attempts', () => {
    const service = TestBed.inject(CaptchaStateService);
    const session = service.startNewSession();
    const target = session.challenges[0];
    service.submitAnswer(target.id, false);
    expect(service.session()?.challenges[0].attempts).toBe(1);
    expect(service.session()?.challenges[0].status).toBe('active');
    expect(service.session()?.currentIndex).toBe(0);
  });

  it('submitAnswer with correct answer passes stage and advances', () => {
    const service = TestBed.inject(CaptchaStateService);
    const session = service.startNewSession();
    const target = session.challenges[0];
    service.submitAnswer(target.id, true, target.answer);
    expect(service.session()?.challenges[0]).toMatchObject({
      status: 'passed',
      userAnswer: target.answer,
      attempts: 1,
    });
    expect(service.session()?.currentIndex).toBe(1);
    expect(service.session()?.maxIndex).toBe(1);
    expect(service.completed()).toBe(false);
  });

  it('completes the session after the final stage', () => {
    const service = TestBed.inject(CaptchaStateService);
    const session = seedCompletedSession(service);
    expect(session.completed).toBe(true);
    expect(service.completed()).toBe(true);
    expect(service.session()?.challenges.every((c) => c.status === 'passed')).toBe(true);
    expect(service.session()?.currentIndex).toBe(3);
  });

  it('submitAnswer ignores unknown or already-passed ids', () => {
    const service = TestBed.inject(CaptchaStateService);
    const session = service.startNewSession();
    service.submitAnswer(999, true, 'x');
    expect(service.session()?.challenges[0].attempts).toBe(0);
    service.submitAnswer(session.challenges[0].id, true, session.challenges[0].answer);
    service.submitAnswer(session.challenges[0].id, true, session.challenges[0].answer);
    expect(service.session()?.challenges[0].attempts).toBe(1);
    expect(service.session()?.currentIndex).toBe(1);
  });

  describe('goTo', () => {
    let service: CaptchaStateService;

    beforeEach(() => {
      service = TestBed.inject(CaptchaStateService);
      service.startNewSession();
    });

    it('rejects jumps beyond maxIndex and negative indexes', () => {
      const before = service.session();
      service.goTo(2);
      service.goTo(-1);
      service.goTo(9);
      expect(service.session()).toEqual(before);
    });

    it('allows revisiting a passed stage', () => {
      const first = service.session()?.challenges[0];
      service.submitAnswer(first!.id, true, first!.answer);
      service.goTo(0);
      expect(service.session()?.currentIndex).toBe(0);
      expect(service.currentChallenge()?.status).toBe('passed');
    });
  });

  it('resetState clears signals and storage', () => {
    const service = TestBed.inject(CaptchaStateService);
    service.startNewSession();
    service.resetState();
    expect(service.session()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('ignores corrupt storage payload', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json{');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const service = TestBed.inject(CaptchaStateService);
    expect(service.session()).toBeNull();
  });

  it('ignores storage payload with invalid shape', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ challenges: [], currentIndex: 0, completed: false }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const service = TestBed.inject(CaptchaStateService);
    expect(service.session()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the suite to verify the new tests fail**

Run: `npm test -- --watch=false`
Expected: FAIL — `STORAGE_KEY` and `CaptchaStateService` don't exist yet; state.spec compile errors.

- [ ] **Step 3: Rewrite `src/app/captcha/state.ts`**

```ts
import { Injectable, computed, effect, signal } from '@angular/core';
import { buildSession } from './challenge-generator';
import type { CaptchaSession, Challenge, ChallengeType } from './challenge-generator';

export type { CaptchaSession, Challenge, ChallengeType, ChallengeStatus };

export const STORAGE_KEY = 'angul-it-captcha';

@Injectable({
  providedIn: 'root',
})
export class CaptchaStateService {
  private readonly _session = signal<CaptchaSession | null>(null);

  readonly session = this._session.asReadonly();
  readonly currentChallenge = computed<Challenge | null>(() => {
    const session = this._session();
    if (!session) return null;
    return session.challenges[session.currentIndex] ?? null;
  });
  readonly completed = computed(() => this._session()?.completed ?? false);

  constructor() {
    this.loadFromStorage();
    effect(() => {
      const session = this._session();
      try {
        if (session) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        return;
      }
    });
  }

  startNewSession(): CaptchaSession {
    const session = buildSession(Date.now());
    this._session.set(session);
    return session;
  }

  submitAnswer(challengeId: number, correct: boolean, userAnswer?: string | number | number[]): void {
    const session = this._session();
    if (!session) return;
    const target = session.challenges.find((c) => c.id === challengeId);
    if (!target || target.status === 'passed') return;
    const challenges = session.challenges.map((c) =>
      c === target
        ? {
            ...c,
            userAnswer: correct ? userAnswer : c.userAnswer,
            attempts: c.attempts + 1,
            status: correct ? ('passed' as const) : ('active' as const),
          }
        : c,
    );
    const advance = correct && session.currentIndex >= session.challenges.length - 1;
    this._session.set({
      ...session,
      challenges,
      completed: advance || session.completed,
      maxIndex: advance
        ? Math.max(session.maxIndex, session.currentIndex)
        : correct
          ? Math.max(session.maxIndex, session.currentIndex + 1)
          : session.maxIndex,
      currentIndex: correct ? (advance ? session.currentIndex : session.currentIndex + 1) : session.currentIndex,
    });
  }

  goTo(index: number): void {
    const session = this._session();
    if (!session) return;
    if (index < 0 || index >= session.challenges.length || index === session.currentIndex) return;
    if (index > session.maxIndex) return;
    this._session.set({ ...session, currentIndex: index });
  }

  resetState(): void {
    this._session.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      return;
    }
  }

  loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<CaptchaSession> | null;
      if (
        parsed &&
        Array.isArray(parsed.challenges) &&
        parsed.challenges.length > 0 &&
        typeof parsed.currentIndex === 'number' &&
        parsed.currentIndex >= 0 &&
        parsed.currentIndex < parsed.challenges.length &&
        typeof parsed.completed === 'boolean' &&
        typeof parsed.startedAt === 'number'
      ) {
        const maxIndex =
          typeof parsed.maxIndex === 'number' ? parsed.maxIndex : parsed.currentIndex;
        this._session.set({
          challenges: parsed.challenges,
          currentIndex: parsed.currentIndex,
          maxIndex: Math.min(Math.max(maxIndex, 0), parsed.challenges.length - 1),
          completed: parsed.completed,
          startedAt: parsed.startedAt,
        });
      }
    } catch {
      return;
    }
  }
}
```

- [ ] **Step 4: Run the suite to verify it passes**

Run: `npm test -- --watch=false`
Expected: PASS for state.spec.ts and challenge-generator.spec.ts; rest as baseline (app.spec may still fail — fixed in Task 3).

- [ ] **Step 5: Commit**

```bash
git add src/app/captcha/state.ts src/app/captcha/state.spec.ts
git commit -m "feat(captcha): signals store with localStorage persistence"
```

---

### Task 3: Route guards, routes wiring, app shell

**Files:**
- Create: `src/app/captcha/guards.ts`
- Create: `src/app/captcha/guards.spec.ts`
- Modify (full rewrite): `src/app/app.routes.ts`
- Modify (full rewrite): `src/app/app.html`
- Modify (full rewrite): `src/app/app.spec.ts`

**Interfaces:**
- Consumes: `CaptchaStateService.session`, `CaptchaStateService.completed` signals (Task 2).
- Produces: `captchaGuard: CanActivateFn` (requires a **non-completed** session, else `UrlTree` to `/`), `resultGuard: CanActivateFn` (session must be completed, else `UrlTree` to `/captcha`). Routes wired to those guards; `app.html` hosts `<router-outlet />`.

- [ ] **Step 1: Write the failing guard tests (`src/app/captcha/guards.spec.ts`)**

```ts
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { CaptchaStateService } from './state';
import { captchaGuard, resultGuard } from './guards';

function runGuard(guard: typeof captchaGuard | typeof resultGuard): true | UrlTree {
  return TestBed.runInInjectionContext(() => guard({} as never, {} as never)) as true | UrlTree;
}

describe('route guards', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('captchaGuard redirects to / when no session', () => {
    const router = TestBed.inject(Router);
    const result = runGuard(captchaGuard);
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe(router.parseUrl('/').toString());
  });

  it('captchaGuard allows when a session exists', () => {
    TestBed.inject(CaptchaStateService).startNewSession();
    expect(runGuard(captchaGuard)).toBe(true);
  });

  it('captchaGuard redirects completed sessions to /', () => {
    const service = TestBed.inject(CaptchaStateService);
    const session = service.startNewSession();
    for (const challenge of session.challenges) {
      service.submitAnswer(challenge.id, true, challenge.answer);
    }
    expect(runGuard(captchaGuard)).toBeInstanceOf(UrlTree);
  });

  it('resultGuard redirects to /captcha when session incomplete', () => {
    TestBed.inject(CaptchaStateService).startNewSession();
    const result = runGuard(resultGuard);
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/captcha');
  });

  it('resultGuard allows completed sessions', () => {
    const service = TestBed.inject(CaptchaStateService);
    const session = service.startNewSession();
    for (const challenge of session.challenges) {
      service.submitAnswer(challenge.id, true, challenge.answer);
    }
    expect(runGuard(resultGuard)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --watch=false`
Expected: FAIL — `./guards` not found.

- [ ] **Step 3: Create `src/app/captcha/guards.ts`**

```ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CaptchaStateService } from './state';

export const captchaGuard: CanActivateFn = () => {
  const state = inject(CaptchaStateService);
  const router = inject(Router);
  const session = state.session();
  return session && !session.completed ? true : router.createUrlTree(['/']);
};

export const resultGuard: CanActivateFn = () => {
  const state = inject(CaptchaStateService);
  const router = inject(Router);
  return state.completed() ? true : router.createUrlTree(['/captcha']);
};
```

- [ ] **Step 4: Rewrite `src/app/app.routes.ts`**

```ts
import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Captcha } from './captcha/captcha';
import { Result } from './result/result';
import { captchaGuard, resultGuard } from './captcha/guards';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'captcha', component: Captcha, canActivate: [captchaGuard] },
  { path: 'result', component: Result, canActivate: [resultGuard] },
  { path: '**', redirectTo: '' },
];
```

- [ ] **Step 5: Rewrite `src/app/app.html`**

```html
<router-outlet />
```

- [ ] **Step 6: Rewrite `src/app/app.spec.ts`**

```ts
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { CaptchaStateService } from './captcha/state';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('redirects /result to /captcha for a non-completed session', async () => {
    const router = TestBed.inject(Router);
    TestBed.inject(CaptchaStateService).startNewSession();
    await router.navigateByUrl('/result');
    expect(router.url).toBe('/captcha');
  });

  it('redirects /result to /captcha when storage is empty', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/result');
    expect(router.url).toBe('/captcha');
  });

  it('renders /result for a completed session', async () => {
    const service = TestBed.inject(CaptchaStateService);
    const session = service.startNewSession();
    for (const challenge of session.challenges) {
      service.submitAnswer(challenge.id, true, challenge.answer);
    }
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/result');
    expect(router.url).toBe('/result');
  });

  it('redirects /captcha to / when storage is empty', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/captcha');
    expect(router.url).toBe('/');
  });

  it('redirects /captcha to / when the session is completed', async () => {
    const service = TestBed.inject(CaptchaStateService);
    const session = service.startNewSession();
    for (const challenge of session.challenges) {
      service.submitAnswer(challenge.id, true, challenge.answer);
    }
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/captcha');
    expect(router.url).toBe('/');
  });
});
```

- [ ] **Step 7: Run to verify passes**

Run: `npm test -- --watch=false`
Expected: PASS everywhere (guard tests, app navigation tests, state, generator). NOTE: `app.spec` navigations to `/result` render `Result` whose WIP `ngOnInit` may also fire — it will *also* try to navigate; harmless. If `Result`'s old `ngOnInit` navigation causes flake, this is resolved in Task 6 rewrite — do not block.

- [ ] **Step 8: Commit**

```bash
git add src/app/captcha/guards.ts src/app/captcha/guards.spec.ts src/app/app.routes.ts src/app/app.html src/app/app.spec.ts
git commit -m "feat(app): route guards protect /captcha and /result"
```

---

### Task 4: Home component (start + resume)

**Files:**
- Modify (full rewrite): `src/app/home/home.ts`
- Modify (full rewrite): `src/app/home/home.html`
- Modify (full rewrite): `src/app/home/home.spec.ts`
- Modify: `src/app/home/home.css` (may become empty — global styles own layout)

**Interfaces:**
- Consumes: `CaptchaStateService.session`, `startNewSession()` (Task 2); `Router`.
- Produces: `Home` with `hasActiveSession: Signal<boolean>`, `start(): void`, `resume(): void`. `start()` regenerates a session and navigates to `/captcha`; `resume()` navigates only.

- [ ] **Step 1: Rewrite `src/app/home/home.spec.ts`**

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Home } from './home';
import { CaptchaStateService } from '../captcha/state';

describe('Home', () => {
  let fixture: ComponentFixture<Home>;
  let service: CaptchaStateService;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Home);
    service = TestBed.inject(CaptchaStateService);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
  });

  it('renders heading and start button without a session', async () => {
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Angul-It');
    expect(el.textContent).toContain('Start Challenge');
    expect(el.textContent).not.toContain('Continue');
  });

  it('shows Continue when an active session exists', async () => {
    service.startNewSession();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Continue');
  });

  it('start() creates a session and navigates to /captcha', async () => {
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button.start-btn')!
      .click();
    expect(service.session()).not.toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/captcha']);
  });

  it('resume() navigates without regenerating', async () => {
    service.startNewSession();
    await fixture.whenStable();
    const before = service.session();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button.resume-btn')!
      .click();
    expect(service.session()).toBe(before);
    expect(router.navigate).toHaveBeenCalledWith(['/captcha']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --watch=false`
Expected: FAIL — no `.start-btn`/`.resume-btn`, no Continue rendering.

- [ ] **Step 3: Rewrite `src/app/home/home.ts`**

```ts
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CaptchaStateService } from '../captcha/state';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly state = inject(CaptchaStateService);
  private readonly router = inject(Router);

  readonly hasActiveSession = computed(() => {
    const session = this.state.session();
    return !!session && !session.completed;
  });

  start(): void {
    this.state.startNewSession();
    this.router.navigate(['/captcha']);
  }

  resume(): void {
    this.router.navigate(['/captcha']);
  }
}
```

- [ ] **Step 4: Rewrite `src/app/home/home.html`**

```html
<main class="home card">
  <h1>Angul-It Captcha</h1>
  <p class="lede">Prove you are human: complete every stage of the challenge.</p>
  <div class="actions">
    <button type="button" class="primary start-btn" (click)="start()">Start Challenge</button>
    @if (hasActiveSession()) {
      <button type="button" class="ghost resume-btn" (click)="resume()">Continue</button>
    }
  </div>
</main>
```

- [ ] **Step 5: Make `src/app/home/home.css` empty**

Replace content with nothing (global stylesheet covers `.card`, `.actions`, buttons).

- [ ] **Step 6: Run to verify passes**

Run: `npm test -- --watch=false`
Expected: PASS for home.spec.ts.

- [ ] **Step 7: Commit**

```bash
git add src/app/home/home.ts src/app/home/home.html src/app/home/home.css src/app/home/home.spec.ts
git commit -m "feat(home): start button creates session, Continue resumes"
```

---

### Task 5: Captcha component (reactive forms, correctness gate, review mode)

**Files:**
- Modify (full rewrite): `src/app/captcha/captcha.ts`
- Modify (full rewrite): `src/app/captcha/captcha.html`
- Modify: `src/app/captcha/captcha.css` (make it empty; global stylesheet covers layout)
- Modify (full rewrite): `src/app/captcha/captcha.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`isCorrect`, `describeUserAnswer`, `typeLabel`), Task 2 (`CaptchaStateService` signals + `submitAnswer`, `goTo`), `NonNullableFormBuilder`, `Validators.pattern`.
- Produces: `Captcha` component with public members used in tests: signals `session`, `challenge`, `errorText`; `form(): FormGroup`; `tileControl(i: number): FormControl<boolean>`; methods `toggleTile(i)`, `submit()`, `goBack()`, `continueForward()`, `canGoBack()`, `canContinue()`, `stageKey()`, `selectedTiles(c)`.

Behavior contract (what the tests pin down):
- On submit with invalid form → inline error text, **no attempts change, no advance**.
- On submit with wrong answer → `attempts+1`, inline error, stage stays; the stage section is re-created (key includes attempts) so the shake animation replays; typed input resets.
- On submit with correct answer → stage `passed`, service advances; on the final stage `completed` becomes true and the component navigates to `/result`.
- `Back` navigates to the previous index; a revisited `passed` stage renders a locked review (answers shown, no inputs, `Continue` button enabled while `currentIndex < challenges.length - 1`).
- Stage stepper dots: `current` / `passed` / `upcoming` (index > `maxIndex`).

- [ ] **Step 1: Rewrite `src/app/captcha/captcha.spec.ts`**

Stage order is random per session, so every test seeds a deterministic session into storage and re-hydrates the service.

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, Router, provideRouter } from '@angular/router';
import { Captcha } from './captcha';
import { CaptchaSession, CaptchaStateService, Challenge, STORAGE_KEY } from './state';
import {
  buildImageChallenge,
  buildMathChallenge,
  buildTextChallenge,
} from './challenge-generator';

type StageType = 'image' | 'math' | 'text';

const builders = {
  image: buildImageChallenge,
  math: buildMathChallenge,
  text: buildTextChallenge,
};

function seedSession(types: StageType[]): void {
  const challenges = types.map((type, id) => builders[type](id));
  const payload: CaptchaSession = {
    challenges,
    currentIndex: 0,
    maxIndex: 0,
    completed: false,
    startedAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

describe('Captcha', () => {
  let fixture: ComponentFixture<Captcha>;
  let component: Captcha;
  let service: CaptchaStateService;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Captcha],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Captcha);
    component = fixture.componentInstance;
    service = TestBed.inject(CaptchaStateService);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    seedSession(['image', 'math', 'text', 'text']);
    service.loadFromStorage();
    await fixture.whenStable();
  });

  function current(): Challenge {
    const challenge = component.challenge();
    if (!challenge) throw new Error('no challenge');
    return challenge;
  }

  function fillCorrect(): void {
    const challenge = current();
    if (challenge.type === 'image') {
      for (const index of challenge.answer as number[]) {
        component.tileControl(index).setValue(true);
      }
    } else {
      (component.form().get('answer') as FormControl).setValue(String(challenge.answer));
    }
  }

  function clickCheck(): void {
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.actions button.primary')!
      .click();
  }

  function reseed(types: StageType[]): void {
    seedSession(types);
    service.loadFromStorage();
  }

  it('renders stepper, stage heading and question', async () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.step').length).toBe(4);
    expect(el.querySelector('h2')?.textContent).toContain('Stage 1 of 4');
    expect(el.querySelector('.question')?.textContent).toContain(current().question);
  });

  it('renders an image grid of 9 tiles for image challenges', async () => {
    expect(current().type).toBe('image');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.image-option').length).toBe(9);
  });

  it('toggles tile selection on click', async () => {
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.image-option')!.click();
    await fixture.whenStable();
    expect(el.querySelector('.image-option.selected')).not.toBeNull();
  });

  it('blocks advancement when image form is empty', async () => {
    const before = service.session();
    clickCheck();
    await fixture.whenStable();
    expect(component.errorText()).not.toBeNull();
    expect(service.session()).toEqual(before);
  });

  it('counts an attempt and stays on wrong math answers', async () => {
    reseed(['math', 'text', 'image', 'text']);
    await fixture.whenStable();
    const challenge = current();
    component.form().get('answer')!.setValue('999999');
    clickCheck();
    await fixture.whenStable();
    expect(component.errorText()).toContain('Incorrect');
    const saved = service.session()!.challenges.find((c) => c.id === challenge.id)!;
    expect(saved.attempts).toBe(1);
    expect(saved.status).toBe('active');
    expect(service.session()!.currentIndex).toBe(0);
  });

  it('rejects invalid math input without counting an attempt', async () => {
    reseed(['math', 'text', 'image', 'text']);
    await fixture.whenStable();
    const challenge = current();
    component.form().get('answer')!.setValue('abc');
    clickCheck();
    await fixture.whenStable();
    const saved = service.session()!.challenges.find((c) => c.id === challenge.id)!;
    expect(saved.attempts).toBe(0);
    expect(service.session()!.currentIndex).toBe(0);
  });

  it('counts an attempt on wrong text answers', async () => {
    reseed(['text', 'image', 'math', 'text']);
    await fixture.whenStable();
    const challenge = current();
    component.form().get('answer')!.setValue('wrongword');
    clickCheck();
    await fixture.whenStable();
    expect(component.errorText()).toContain('Incorrect');
    const saved = service.session()!.challenges.find((c) => c.id === challenge.id)!;
    expect(saved.attempts).toBe(1);
    expect(service.session()!.currentIndex).toBe(0);
  });

  it('advances on correct answer', async () => {
    fillCorrect();
    clickCheck();
    await fixture.whenStable();
    expect(service.session()!.currentIndex).toBe(1);
    expect(service.session()!.challenges[0].status).toBe('passed');
    expect(component.errorText()).toBeNull();
  });

  it('advances through every stage and finishes on the last', async () => {
    for (let i = 0; i < 4; i++) {
      expect(service.completed()).toBe(false);
      fillCorrect();
      clickCheck();
      await fixture.whenStable();
    }
    expect(service.completed()).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(['/result']);
  });

  it('Back shows locked review of a passed stage, Continue returns', async () => {
    fillCorrect();
    clickCheck();
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.actions button.ghost')!
      .click();
    await fixture.whenStable();
    expect(service.session()!.currentIndex).toBe(0);
    expect(component.challenge()!.status).toBe('passed');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('form')).toBeNull();
    expect(el.textContent).toContain('Passed');
    clickCheck();
    await fixture.whenStable();
    expect(service.session()!.currentIndex).toBe(0);
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.actions button.primary')!
      .click();
    await fixture.whenStable();
    expect(service.session()!.currentIndex).toBe(1);
  });

  it('marks current, passed and upcoming stepper states', async () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.step.current').length).toBe(1);
    expect(el.querySelectorAll('.step.upcoming').length).toBe(3);
    fillCorrect();
    clickCheck();
    await fixture.whenStable();
    expect(el.querySelectorAll('.step.passed').length).toBe(1);
    expect(el.querySelectorAll('.step.upcoming').length).toBe(2);
  });

  it('rebuilds the FormGroup per stage type', async () => {
    expect(current().type).toBe('image');
    const tiles = Object.keys(component.form().controls);
    expect(tiles.length).toBe(9);
    expect(tiles.every((key) => key.startsWith('tile'))).toBe(true);
    fillCorrect();
    clickCheck();
    await fixture.whenStable();
    expect(current().type).toBe('math');
    expect(component.form().get('answer')).toBeInstanceOf(FormControl);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --watch=false`
Expected: FAIL — old Captcha has no stepper/tiles/errorText etc.

- [ ] **Step 3: Rewrite `src/app/captcha/captcha.ts`**

```ts
import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { CaptchaStateService, Challenge } from './state';
import { describeUserAnswer, isCorrect, typeLabel } from './challenge-generator';

function atLeastOneSelected(control: AbstractControl): ValidationErrors | null {
  const values = Object.values(control.value as Record<string, boolean>);
  return values.some(Boolean) ? null : { noneSelected: true };
}

@Component({
  selector: 'app-captcha',
  imports: [ReactiveFormsModule],
  templateUrl: './captcha.html',
  styleUrl: './captcha.css',
})
export class Captcha {
  private readonly state = inject(CaptchaStateService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly session = this.state.session;
  readonly challenge = this.state.currentChallenge;
  readonly errorText = signal<string | null>(null);

  readonly form = computed<FormGroup>(() => {
    const challenge = this.challenge();
    if (!challenge) return this.fb.group({});
    if (challenge.type === 'image') {
      const tiles: Record<string, FormControl<boolean>> = {};
      (challenge.images ?? []).forEach((_, index) => {
        tiles['tile' + index] = this.fb.control(false);
      });
      return this.fb.group(tiles, { validators: atLeastOneSelected });
    }
    if (challenge.type === 'math') {
      return this.fb.group({
        answer: ['', [Validators.required, Validators.pattern(/^-?\d+$/)]],
      });
    }
    return this.fb.group({ answer: ['', [Validators.required]] });
  });

  constructor() {
    effect(() => {
      this.challenge();
      this.errorText.set(null);
    });
  }

  stageKey(): string {
    const challenge = this.challenge();
    return challenge ? `${challenge.id}:${challenge.status}:${challenge.attempts}` : 'empty';
  }

  tileControl(index: number): FormControl<boolean> {
    return this.form().get('tile' + index) as FormControl<boolean>;
  }

  toggleTile(index: number): void {
    const control = this.tileControl(index);
    control.setValue(!control.value);
  }

  selectedTiles(challenge: Challenge): number[] {
    return Array.isArray(challenge.userAnswer) ? challenge.userAnswer : [];
  }

  typeOf(challenge: Challenge): string {
    return typeLabel(challenge.type);
  }

  answerOf(challenge: Challenge): string {
    return describeUserAnswer(challenge);
  }

  canGoBack(): boolean {
    const session = this.session();
    return !!session && session.currentIndex > 0;
  }

  goBack(): void {
    const session = this.session();
    if (!session || session.currentIndex === 0) return;
    this.state.goTo(session.currentIndex - 1);
  }

  canContinue(): boolean {
    const session = this.session();
    return !!session && session.currentIndex < session.challenges.length - 1;
  }

  continueForward(): void {
    const session = this.session();
    if (!session) return;
    this.state.goTo(session.currentIndex + 1);
  }

  submit(): void {
    const challenge = this.challenge();
    if (!challenge || challenge.status === 'passed') return;
    const form = this.form();
    if (form.invalid) {
      form.markAllAsTouched();
      let message =
        challenge.type === 'image' ? 'Select at least one tile.' : 'Please provide an answer.';
      if (challenge.type === 'math' && form.hasError('pattern')) {
        message = 'Numbers only, please.';
      }
      this.errorText.set(message);
      return;
    }
    const value = form.value as Record<string, string | boolean>;
    const input: string | number | number[] =
      challenge.type === 'image'
        ? (challenge.images ?? []).flatMap((_, index) => (value['tile' + index] ? [index] : []))
        : challenge.type === 'math'
          ? Number(String(value['answer']).trim())
          : String(value['answer']);
    if (!isCorrect(challenge, input)) {
      this.state.submitAnswer(challenge.id, false);
      this.errorText.set('Incorrect answer — try again.');
      return;
    }
    this.state.submitAnswer(challenge.id, true, input);
    if (this.state.completed()) {
      this.router.navigate(['/result']);
    }
  }
}
```

- [ ] **Step 4: Rewrite `src/app/captcha/captcha.html`**

```html
<main class="captcha">
  @if (session(); as s) {
    <nav class="stepper" aria-label="Challenge progress">
      @for (c of s.challenges; track c.id) {
        <span
          class="step"
          [class.current]="$index === s.currentIndex"
          [class.passed]="c.status === 'passed'"
          [class.upcoming]="$index > s.maxIndex"
          >{{ $index + 1 }}</span
        >
      }
    </nav>
    @for (c of [challenge()]; track stageKey()) {
      @if (c; as cc) {
        <section class="stage card">
          <header class="stage-head">
            <h2>Stage {{ s.currentIndex + 1 }} of {{ s.challenges.length }}</h2>
            <span class="type-badge">{{ typeOf(cc) }}</span>
          </header>
          <p class="question">{{ cc.question }}</p>
          @if (cc.attempts > 0) {
            <p class="stage-attempts">Attempts: {{ cc.attempts }}</p>
          }
          @if (cc.status === 'passed') {
            <div class="review">
              <p class="review-badge">Passed ✓</p>
              @if (cc.type === 'image') {
                <div class="images">
                  @for (img of cc.images; track $index) {
                    <div
                      class="image-option reviewed"
                      [class.selected]="selectedTiles(cc).includes($index)"
                      >{{ img }}</div
                    >
                  }
                </div>
              } @else {
                <p class="review-answer">{{ answerOf(cc) }}</p>
              }
            </div>
            <div class="actions">
              <button type="button" class="ghost" (click)="goBack()" [disabled]="!canGoBack()">
                Back
              </button>
              <button
                type="button"
                class="primary"
                (click)="continueForward()"
                [disabled]="!canContinue()"
              >
                Continue
              </button>
            </div>
          } @else {
            <form [formGroup]="form()" novalidate>
              @switch (cc.type) {
                @case ('image') {
                  <div class="images" role="group" aria-label="Image grid">
                    @for (img of cc.images; track $index) {
                      <button
                        type="button"
                        class="image-option"
                        [class.selected]="tileControl($index).value"
                        (click)="toggleTile($index)"
                      >
                        {{ img }}
                      </button>
                    }
                  </div>
                }
                @case ('math') {
                  <div class="input-row">
                    <input
                      formControlName="answer"
                      type="text"
                      inputmode="numeric"
                      placeholder="Your answer"
                      aria-label="Numeric answer"
                    />
                  </div>
                }
                @case ('text') {
                  <div class="input-row">
                    <input
                      formControlName="answer"
                      type="text"
                      autocomplete="off"
                      placeholder="Type the word"
                      aria-label="Text answer"
                    />
                  </div>
                }
              }
            </form>
            @if (errorText(); as err) {
              <p class="error" role="alert">{{ err }}</p>
            }
            <div class="actions">
              <button type="button" class="ghost" (click)="goBack()" [disabled]="!canGoBack()">
                Back
              </button>
              <button type="button" class="primary" (click)="submit()">Check</button>
            </div>
          }
        </section>
      }
    }
  }
</main>
```

Note: the `@for` singleton keyed by `stageKey()` re-creates the stage card whenever id/status/attempts change — that is what replays the entrance/shake animations.

- [ ] **Step 5: Make `src/app/captcha/captcha.css` empty**

- [ ] **Step 6: Run to verify passes**

Run: `npm test -- --watch=false`
Expected: PASS captcha.spec.ts (all 10) plus everything prior.

- [ ] **Step 7: Commit**

```bash
git add src/app/captcha/captcha.ts src/app/captcha/captcha.html src/app/captcha/captcha.css src/app/captcha/captcha.spec.ts
git commit -m "feat(captcha): reactive forms, correctness gate, review mode"
```

---

### Task 6: Result component

**Files:**
- Modify (full rewrite): `src/app/result/result.ts`
- Modify (full rewrite): `src/app/result/result.html`
- Modify: `src/app/result/result.css` (make empty)
- Modify (full rewrite): `src/app/result/result.spec.ts`

**Interfaces:**
- Consumes: `CaptchaStateService` (Task 2), `typeLabel`/`describeUserAnswer` (Task 1), `Router`.
- Produces: `Result` with signals `session`, `passedCount`, `totalAttempts`, `elapsedSeconds`; methods `newChallenge(): void`, `goHome(): void`.

- [ ] **Step 1: Rewrite `src/app/result/result.spec.ts`**

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Result } from './result';
import { CaptchaStateService } from '../captcha/state';

describe('Result', () => {
  let fixture: ComponentFixture<Result>;
  let component: Result;
  let service: CaptchaStateService;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Result],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Result);
    component = fixture.componentInstance;
    service = TestBed.inject(CaptchaStateService);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
  });

  function completeSession(): void {
    const session = service.startNewSession();
    for (const challenge of session.challenges) {
      service.submitAnswer(challenge.id, true, challenge.answer);
    }
  }

  it('renders recap with summary line', async () => {
    completeSession();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('4/4 passed');
    expect(el.textContent).toContain('4 attempts');
    expect(el.querySelectorAll('.result-item').length).toBe(4);
  });

  it('lists type badges, questions and answers per stage', async () => {
    completeSession();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const session = service.session()!;
    for (const challenge of session.challenges) {
      expect(el.textContent).toContain(challenge.question);
    }
    expect(el.textContent).toContain('Passed ✓');
  });

  it('newChallenge() replaces the session and navigates', async () => {
    completeSession();
    await fixture.whenStable();
    const before = service.session();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button.primary')!
      .click();
    expect(service.session()).not.toBe(before);
    expect(service.completed()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/captcha']);
  });

  it('goHome() navigates to /', async () => {
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button.ghost')!
      .click();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --watch=false`
Expected: FAIL — old Result has different markup/logic.

- [ ] **Step 3: Rewrite `src/app/result/result.ts`**

```ts
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CaptchaStateService, Challenge } from '../captcha/state';
import { describeUserAnswer, typeLabel } from '../captcha/challenge-generator';

@Component({
  selector: 'app-result',
  imports: [],
  templateUrl: './result.html',
  styleUrl: './result.css',
})
export class Result {
  private readonly state = inject(CaptchaStateService);
  private readonly router = inject(Router);

  readonly session = this.state.session;
  readonly passedCount = computed(
    () => this.session()?.challenges.filter((c) => c.status === 'passed').length ?? 0,
  );
  readonly totalAttempts = computed(
    () => this.session()?.challenges.reduce((sum, c) => sum + c.attempts, 0) ?? 0,
  );
  readonly elapsedSeconds = computed(() => {
    const session = this.session();
    return session ? Math.max(0, Math.round((Date.now() - session.startedAt) / 1000)) : 0;
  });

  typeOf(type: 'image' | 'math' | 'text'): string {
    return typeLabel(type);
  }

  answerOf(challenge: Challenge): string {
    return describeUserAnswer(challenge);
  }

  newChallenge(): void {
    this.state.startNewSession();
    this.router.navigate(['/captcha']);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
```

- [ ] **Step 4: Rewrite `src/app/result/result.html`**

```html
<main class="result card">
  @if (session(); as s) {
    <h1>Challenge complete</h1>
    <p class="summary">
      {{ passedCount() }}/{{ s.challenges.length }} passed · {{ totalAttempts() }} attempts ·
      {{ elapsedSeconds() }}s
    </p>
    <ul class="results-list">
      @for (c of s.challenges; track c.id) {
        <li class="result-item card-flat">
          <header class="result-head">
            <span class="type-badge">{{ typeOf(c.type) }}</span>
            <span class="review-badge">Passed ✓</span>
          </header>
          <p class="question">{{ c.question }}</p>
          <p class="answer">Your answer: {{ answerOf(c) }}</p>
          <p class="stage-attempts">Attempts: {{ c.attempts }}</p>
        </li>
      }
    </ul>
    <div class="actions">
      <button type="button" class="ghost" (click)="goHome()">Home</button>
      <button type="button" class="primary" (click)="newChallenge()">New Challenge</button>
    </div>
  }
</main>
```

- [ ] **Step 5: Empty `src/app/result/result.css`**

- [ ] **Step 6: Run to verify passes**

Run: `npm test -- --watch=false`
Expected: PASS result.spec.ts (4 tests) + full suite green.

- [ ] **Step 7: Commit**

```bash
git add src/app/result/result.ts src/app/result/result.html src/app/result/result.css src/app/result/result.spec.ts
git commit -m "feat(result): recap page with attempts summary and new challenge"
```

---

### Task 7: Theme, animations, responsiveness (CSS) + final verification

**Files:**
- Modify (full rewrite): `src/styles.css`
- Modify: `src/app/app.css` — replace with empty content

**Interfaces:**
- Consumes: class names emitted by Tasks 4–6 templates (`.card`, `.card-flat`, `.home`, `.captcha`, `.result`, `.stepper`, `.step.(current|passed|upcoming)`, `.stage`, `.stage-head`, `.type-badge`, `.question`, `.stage-attempts`, `.review`, `.review-badge`, `.review-answer`, `.images`, `.image-option.(selected|reviewed)`, `.input-row`, `.error`, `.actions`, `.results-list`, `.result-item`, `.result-head`, `.answer`, `.summary`, `.primary`, `.ghost`, `.start-btn`, `.resume-btn`, `.lede`).
- Produces: finished look. Keep `@media (max-width: 480px)` adjustments; animations via keyframes (entrance `.stage`, shake `.error`, pulse-on-select transition), all CSS-only.

- [ ] **Step 1: Rewrite `src/styles.css`**

```css
:root {
  --bg: #0f1420;
  --card: #ffffff;
  --ink: #1c2333;
  --muted: #667085;
  --line: #e2e8f0;
  --primary: #4f6ef7;
  --primary-dark: #3b55d9;
  --danger: #c0392b;
  --ok: #1e9e5a;
  --radius: 14px;
  --shadow: 0 10px 30px rgb(15 20 32 / 0.12);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100dvh;
  background:
    radial-gradient(900px 500px at 15% -10%, #2a3655 0%, transparent 60%),
    radial-gradient(800px 500px at 90% 110%, #33406a 0%, transparent 55%),
    var(--bg);
  color: var(--ink);
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
}

.card {
  background: var(--card);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 24px;
  max-width: 640px;
  margin: 32px auto;
}

.card-flat {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px 16px;
}

.home,
.result {
  text-align: center;
}

.lede {
  color: var(--muted);
  margin: 8px 0 20px;
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 18px;
}

button.primary,
button.ghost {
  min-height: 44px;
  min-width: 96px;
  padding: 10px 18px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}

button.primary {
  border: none;
  background: var(--primary);
  color: #fff;
  box-shadow: 0 6px 16px rgb(79 110 247 / 0.35);
}

button.primary:hover {
  background: var(--primary-dark);
  transform: translateY(-1px);
}

button.ghost {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
}

button.ghost:hover {
  background: #f4f6fb;
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.stepper {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin: 24px auto 8px;
}

.step {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 2px solid var(--line);
  background: #fff;
  color: var(--muted);
  font-weight: 700;
  font-size: 14px;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.step.current {
  border-color: var(--primary);
  color: var(--primary);
  transform: scale(1.1);
}

.step.passed {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

.stage-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.type-badge {
  background: #eef2ff;
  color: var(--primary-dark);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 600;
}

.question {
  font-size: 18px;
  margin: 14px 0 4px;
  word-break: break-word;
}

.stage-attempts {
  color: var(--muted);
  font-size: 13px;
  margin: 0;
}

.images {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin: 18px 0 6px;
}

.image-option {
  aspect-ratio: 1 / 1;
  min-width: 44px;
  font-size: clamp(26px, 7vw, 42px);
  display: grid;
  place-items: center;
  background: #f8fafc;
  border: 2px solid var(--line);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}

.image-option:hover {
  border-color: #b7c3f5;
}

.image-option.selected {
  border-color: var(--primary);
  background: #eef2ff;
  transform: scale(0.96);
}

.image-option.reviewed {
  cursor: default;
}

.input-row input {
  width: 100%;
  min-height: 48px;
  padding: 12px 14px;
  font-size: 18px;
  border: 2px solid var(--line);
  border-radius: 10px;
  margin-top: 6px;
}

.input-row input:focus {
  outline: none;
  border-color: var(--primary);
}

.error {
  color: var(--danger);
  font-weight: 600;
  margin: 12px 0 0;
  animation: shake 0.4s;
}

.review {
  margin-top: 10px;
}

.review-badge {
  color: var(--ok);
  font-weight: 700;
  margin: 4px 0;
}

.review-answer {
  font-size: 20px;
  margin: 8px 0;
}

.summary {
  color: var(--muted);
  margin: 6px 0 18px;
}

.results-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
  text-align: left;
}

.result-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.answer {
  color: var(--muted);
  margin: 6px 0;
}

.stage {
  margin-top: 16px;
  animation: stageIn 0.35s ease both;
}

@keyframes stageIn {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes shake {
  10%,
  90% {
    transform: translateX(-2px);
  }
  20%,
  80% {
    transform: translateX(4px);
  }
  30%,
  50%,
  70% {
    transform: translateX(-6px);
  }
  40%,
  60% {
    transform: translateX(6px);
  }
}

@media (max-width: 480px) {
  .card {
    margin: 16px 12px;
    padding: 18px;
  }

  .images {
    gap: 8px;
  }

  .actions button {
    width: 100%;
  }
}
```

- [ ] **Step 2: Empty `src/app/app.css`**

- [ ] **Step 3: Run the full test suite**

Run: `npm test -- --watch=false`
Expected: all spec files PASS (state, generator, guards, app, home, captcha, result).

- [ ] **Step 4: Build for production**

Run: `npm run build`
Expected: BUILD SUCCESS with no budget errors (component styles are ≤ 1kB each).

- [ ] **Step 5: Manual smoke (optional but recommended)**

Run: `npm start`
Expected in browser at http://localhost:4200: Home → Start → 4 randomized stages (image 3×3 grid / math / text), wrong answer shakes + attempt count, correct advances; refresh mid-challenge keeps position; `/result` after finish; typing `/result` early redirects back to `/captcha`. Resize viewport ≤ 480px to confirm mobile layout.

- [ ] **Step 6: Commit**

```bash
git add src/styles.css src/app/app.css
git commit -m "style: theme, animations, responsive layout"
```
