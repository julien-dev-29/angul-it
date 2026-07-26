# Angul-It Captcha Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 3-stage captcha web app with emoji grid, math, and text input challenges, localStorage persistence, and a protected results page.

**Architecture:** Single CaptchaComponent handles all 3 stages via a signal-based CaptchaService. Routes: `/` (Home), `/captcha` (Challenges), `/results` (Protected). Each session gets one of each challenge type in random order.

**Tech Stack:** Angular 21, signals, reactive forms, `@angular/animations`, Vitest

## Global Constraints

- Angular 21 — standalone components only, no `standalone: true` (default in v20+)
- Use signals for state, `computed()` for derived state, `update()`/`set()` (no `mutate`)
- Use `input()` and `output()` functions, not decorators
- `changeDetection: ChangeDetectionStrategy.OnPush` on all components
- No `ngClass`/`ngStyle` — use `class`/`style` bindings
- Use native control flow (`@if`, `@for`, `@switch`)
- Use `inject()` function, not constructor injection
- Reactive forms only
- WCAG AA compliance, AXE checks pass
- `NgOptimizedImage` for static images (not needed here — using emoji text)
- Vitest for testing (already configured via `@angular/build:unit-test`)

---

## File Structure

```
src/app/
  models/
    captcha.models.ts          # Challenge, StageResult, ChallengeType types
  services/
    captcha.service.ts          # Signal-based state + localStorage
    captcha.service.spec.ts     # Service tests
  guards/
    results.guard.ts            # Route guard for /results
  components/
    home/
      home.ts                   # HomeComponent
      home.html
      home.css
      home.spec.ts
    captcha/
      captcha.ts                # CaptchaComponent
      captcha.html
      captcha.css
      captcha.spec.ts
    result/
      result.ts                 # ResultComponent
      result.html
      result.css
      result.spec.ts
  animations.ts                 # Shared animation definitions
  app.ts                        # Root component (update)
  app.html                      # Root template (update)
  app.routes.ts                 # Routes (update)
  app.config.ts                 # Add animations provider
```

---

### Task 1: Create Models and Types

**Files:**
- Create: `src/app/models/captcha.models.ts`

**Interfaces:**
- Produces: `ChallengeType`, `Challenge`, `StageResult`, `CaptchaState`

- [ ] **Step 1: Create the models file**

```typescript
export type ChallengeType = 'emoji' | 'math' | 'text';

export interface EmojiGridChallenge {
  type: 'emoji';
  prompt: string;
  grid: string[][];
  correctAnswers: number[];
}

export interface MathChallenge {
  type: 'math';
  prompt: string;
  answer: number;
  options: number[];
}

export interface TextChallenge {
  type: 'text';
  prompt: string;
  displayWord: string;
}

export type Challenge = EmojiGridChallenge | MathChallenge | TextChallenge;

export interface StageResult {
  stage: number;
  type: ChallengeType;
  passed: boolean;
  userAnswer: unknown;
}

export interface CaptchaState {
  currentStage: number;
  challenges: Challenge[];
  results: StageResult[];
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx ng build --configuration development`
Expected: BUILD SUCCESSFUL (no errors in models file)

- [ ] **Step 3: Commit**

```bash
git add src/app/models/captcha.models.ts
git commit -m "feat: add captcha models and types"
```

---

### Task 2: Create CaptchaService

**Files:**
- Create: `src/app/services/captcha.service.ts`
- Create: `src/app/services/captcha.service.spec.ts`

**Interfaces:**
- Consumes: `Challenge`, `StageResult`, `CaptchaState`, `ChallengeType`, `EmojiGridChallenge`, `MathChallenge`, `TextChallenge` from Task 1
- Produces: `CaptchaService` with `currentStage()`, `challenges()`, `results()`, `isComplete()`, `currentChallenge()`, `submitStage()`, `goToPreviousStage()`, `reset()`, `hasPersistedState()`

- [ ] **Step 1: Write failing tests for CaptchaService**

```typescript
import { TestBed } from '@angular/core/testing';
import { CaptchaService } from './captcha.service';

describe('CaptchaService', () => {
  let service: CaptchaService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(CaptchaService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with 3 challenges', () => {
    expect(service.challenges().length).toBe(3);
  });

  it('should initialize at stage 1', () => {
    expect(service.currentStage()).toBe(1);
  });

  it('should have empty results initially', () => {
    expect(service.results().length).toBe(0);
  });

  it('should not be complete initially', () => {
    expect(service.isComplete()).toBeFalse();
  });

  it('should have one of each challenge type', () => {
    const types = service.challenges().map(c => c.type);
    expect(types).toContain('emoji');
    expect(types).toContain('math');
    expect(types).toContain('text');
  });

  it('should return current challenge for current stage', () => {
    const challenge = service.currentChallenge();
    expect(challenge).toBeTruthy();
    expect(challenge!.type).toBeDefined();
  });

  it('should submit a stage and advance', () => {
    const challenge = service.currentChallenge()!;
    let userAnswer: unknown;

    if (challenge.type === 'emoji') {
      userAnswer = challenge.correctAnswers;
    } else if (challenge.type === 'math') {
      userAnswer = challenge.answer;
    } else {
      userAnswer = challenge.displayWord;
    }

    service.submitStage(userAnswer);
    expect(service.results().length).toBe(1);
    expect(service.results()[0].passed).toBeTrue();
    expect(service.currentStage()).toBe(2);
  });

  it('should persist to localStorage after submit', () => {
    const challenge = service.currentChallenge()!;
    let userAnswer: unknown;

    if (challenge.type === 'emoji') {
      userAnswer = challenge.correctAnswers;
    } else if (challenge.type === 'math') {
      userAnswer = challenge.answer;
    } else {
      userAnswer = challenge.displayWord;
    }

    service.submitStage(userAnswer);
    const stored = localStorage.getItem('captchaState');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.results.length).toBe(1);
  });

  it('should restore from localStorage on init', () => {
    const challenge = service.currentChallenge()!;
    let userAnswer: unknown;

    if (challenge.type === 'emoji') {
      userAnswer = challenge.correctAnswers;
    } else if (challenge.type === 'math') {
      userAnswer = challenge.answer;
    } else {
      userAnswer = challenge.displayWord;
    }

    service.submitStage(userAnswer);

    // Create new service instance
    const newService = TestBed.inject(CaptchaService);
    expect(newService.results().length).toBe(1);
    expect(newService.currentStage()).toBe(2);
  });

  it('should go to previous stage', () => {
    const challenge = service.currentChallenge()!;
    let userAnswer: unknown;

    if (challenge.type === 'emoji') {
      userAnswer = challenge.correctAnswers;
    } else if (challenge.type === 'math') {
      userAnswer = challenge.answer;
    } else {
      userAnswer = challenge.displayWord;
    }

    service.submitStage(userAnswer);
    expect(service.currentStage()).toBe(2);

    service.goToPreviousStage();
    expect(service.currentStage()).toBe(1);
  });

  it('should not go below stage 1', () => {
    service.goToPreviousStage();
    expect(service.currentStage()).toBe(1);
  });

  it('should mark as complete after 3 submissions', () => {
    for (let i = 0; i < 3; i++) {
      const challenge = service.currentChallenge()!;
      let userAnswer: unknown;

      if (challenge.type === 'emoji') {
        userAnswer = challenge.correctAnswers;
      } else if (challenge.type === 'math') {
        userAnswer = challenge.answer;
      } else {
        userAnswer = challenge.displayWord;
      }

      service.submitStage(userAnswer);
    }

    expect(service.isComplete()).toBeTrue();
    expect(service.results().length).toBe(3);
  });

  it('should reset all state', () => {
    const challenge = service.currentChallenge()!;
    let userAnswer: unknown;

    if (challenge.type === 'emoji') {
      userAnswer = challenge.correctAnswers;
    } else if (challenge.type === 'math') {
      userAnswer = challenge.answer;
    } else {
      userAnswer = challenge.displayWord;
    }

    service.submitStage(userAnswer);
    service.reset();

    expect(service.currentStage()).toBe(1);
    expect(service.results().length).toBe(0);
    expect(localStorage.getItem('captchaState')).toBeNull();
  });

  it('should record wrong answers as failed', () => {
    const challenge = service.currentChallenge()!;
    let wrongAnswer: unknown;

    if (challenge.type === 'emoji') {
      wrongAnswer = [-1];
    } else if (challenge.type === 'math') {
      wrongAnswer = -999;
    } else {
      wrongAnswer = 'definitely_wrong_answer_xyz';
    }

    service.submitStage(wrongAnswer);
    expect(service.results()[0].passed).toBeFalse();
  });

  it('should report hasPersistedState correctly', () => {
    expect(service.hasPersistedState()).toBeFalse();

    const challenge = service.currentChallenge()!;
    let userAnswer: unknown;

    if (challenge.type === 'emoji') {
      userAnswer = challenge.correctAnswers;
    } else if (challenge.type === 'math') {
      userAnswer = challenge.answer;
    } else {
      userAnswer = challenge.displayWord;
    }

    service.submitStage(userAnswer);
    expect(service.hasPersistedState()).toBeTrue();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include='**/captcha.service.spec.ts' --run`
Expected: FAIL — `CaptchaService` does not exist

- [ ] **Step 3: Implement CaptchaService**

```typescript
import { Injectable, signal, computed, effect } from '@angular/core';
import {
  Challenge,
  ChallengeType,
  EmojiGridChallenge,
  MathChallenge,
  TextChallenge,
  StageResult,
  CaptchaState,
} from '../models/captcha.models';

const STORAGE_KEY = 'captchaState';

const EMOJI_POOLS: { category: string; emojis: string[][] }[] = [
  {
    category: 'animals',
    emojis: [
      ['🐶', '🐱', '🐭', '🐹'],
      ['🐰', '🦊', '🐻', '🐼'],
      ['🐨', '🐯', '🦁', '🐮'],
      ['🐷', '🐸', '🐵', '🐔'],
    ],
  },
  {
    category: 'food',
    emojis: [
      ['🍎', '🍐', '🍊', '🍋'],
      ['🍌', '🍉', '🍇', '🍓'],
      ['🫐', '🍈', '🍒', '🍑'],
      ['🥭', '🍍', '🥝', '🍅'],
    ],
  },
  {
    category: 'objects',
    emojis: [
      ['⚽', '🏀', '🏈', '⚾'],
      ['🎾', '🏐', '🏉', '🎱'],
      ['🏓', '🏸', '🥊', '🎯'],
      ['⛳', '🏹', '🎣', '🛶'],
    ],
  },
];

const MATH_PROBLEMS: Omit<MathChallenge, 'options'>[] = [
  { type: 'math', prompt: '7 + 5 = ?', answer: 12 },
  { type: 'math', prompt: '15 - 8 = ?', answer: 7 },
  { type: 'math', prompt: '6 × 4 = ?', answer: 24 },
  { type: 'math', prompt: '20 - 9 = ?', answer: 11 },
  { type: 'math', prompt: '3 + 9 = ?', answer: 12 },
  { type: 'math', prompt: '5 × 3 = ?', answer: 15 },
  { type: 'math', prompt: '18 - 7 = ?', answer: 11 },
  { type: 'math', prompt: '4 × 6 = ?', answer: 24 },
];

const TEXT_WORDS = [
  'captcha', 'angular', 'bridge', 'guitar', 'planet',
  'forest', 'rocket', 'puzzle', 'breeze', 'marble',
  'crystal', 'shadow', 'velvet', 'thunder', 'lantern',
];

@Injectable({ providedIn: 'root' })
export class CaptchaService {
  readonly currentStage = signal(1);
  readonly challenges = signal<Challenge[]>([]);
  readonly results = signal<StageResult[]>([]);

  readonly isComplete = computed(() => this.results().length === 3);

  readonly currentChallenge = computed<Challenge | null>(() => {
    const stage = this.currentStage();
    const all = this.challenges();
    if (stage < 1 || stage > all.length) return null;
    return all[stage - 1];
  });

  constructor() {
    this.restore();
    if (this.challenges().length === 0) {
      this.generateChallenges();
      this.persist();
    }

    effect(() => {
      this.currentStage();
      this.results();
      this.persist();
    });
  }

  submitStage(userAnswer: unknown): void {
    const challenge = this.currentChallenge();
    if (!challenge) return;

    const passed = this.validateAnswer(challenge, userAnswer);
    const result: StageResult = {
      stage: this.currentStage(),
      type: challenge.type,
      passed,
      userAnswer,
    };

    this.results.update(r => [...r, result]);

    if (this.currentStage() < 3) {
      this.currentStage.update(s => s + 1);
    }
  }

  goToPreviousStage(): void {
    if (this.currentStage() > 1) {
      this.currentStage.update(s => s - 1);
    }
  }

  reset(): void {
    this.currentStage.set(1);
    this.challenges.set([]);
    this.results.set([]);
    localStorage.removeItem(STORAGE_KEY);
    this.generateChallenges();
  }

  hasPersistedState(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  private validateAnswer(challenge: Challenge, userAnswer: unknown): boolean {
    switch (challenge.type) {
      case 'emoji': {
        const correct = new Set(challenge.correctAnswers);
        const user = userAnswer as number[];
        if (!Array.isArray(user) || user.length !== correct.size) return false;
        return user.every(i => correct.has(i));
      }
      case 'math':
        return userAnswer === challenge.answer;
      case 'text':
        return (
          typeof userAnswer === 'string' &&
          userAnswer.toLowerCase() === challenge.displayWord.toLowerCase()
        );
    }
  }

  private generateChallenges(): void {
    const shuffledTypes: ChallengeType[] = ['emoji', 'math', 'text'].sort(
      () => Math.random() - 0.5,
    );

    const challenges: Challenge[] = shuffledTypes.map(type => {
      switch (type) {
        case 'emoji':
          return this.generateEmojiChallenge();
        case 'math':
          return this.generateMathChallenge();
        case 'text':
          return this.generateTextChallenge();
      }
    });

    this.challenges.set(challenges);
  }

  private generateEmojiChallenge(): EmojiGridChallenge {
    const pool = EMOJI_POOLS[Math.floor(Math.random() * EMOJI_POOLS.length)];
    const correctIndices: number[] = [];
    const usedRows = new Set<number>();

    // Pick 2-3 random rows as correct answers
    const numRows = 2 + Math.floor(Math.random() * 2);
    while (correctIndices.length < numRows) {
      const row = Math.floor(Math.random() * 4);
      if (!usedRows.has(row)) {
        usedRows.add(row);
        for (let col = 0; col < 4; col++) {
          correctIndices.push(row * 4 + col);
        }
      }
    }

    return {
      type: 'emoji',
      prompt: `Select all ${pool.category}`,
      grid: pool.emojis,
      correctAnswers: correctIndices.sort((a, b) => a - b),
    };
  }

  private generateMathChallenge(): MathChallenge {
    const base = MATH_PROBLEMS[Math.floor(Math.random() * MATH_PROBLEMS.length)];
    const options = new Set<number>([base.answer]);

    while (options.size < 4) {
      const offset = Math.floor(Math.random() * 10) - 5;
      const wrong = base.answer + offset;
      if (wrong !== base.answer && wrong > 0) {
        options.add(wrong);
      }
    }

    return {
      ...base,
      options: Array.from(options).sort(() => Math.random() - 0.5),
    };
  }

  private generateTextChallenge(): TextChallenge {
    const word = TEXT_WORDS[Math.floor(Math.random() * TEXT_WORDS.length)];
    return {
      type: 'text',
      prompt: 'Type the word shown below',
      displayWord: word,
    };
  }

  private persist(): void {
    const state: CaptchaState = {
      currentStage: this.currentStage(),
      challenges: this.challenges(),
      results: this.results(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  private restore(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const state: CaptchaState = JSON.parse(raw);
      if (state.challenges?.length === 3) {
        this.challenges.set(state.challenges);
        this.results.set(state.results || []);
        this.currentStage.set(state.currentStage || 1);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --include='**/captcha.service.spec.ts' --run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/services/captcha.service.ts src/app/services/captcha.service.spec.ts
git commit -m "feat: add CaptchaService with signal-based state and localStorage persistence"
```

---

### Task 3: Set Up Routing and Guard

**Files:**
- Create: `src/app/guards/results.guard.ts`
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/app.config.ts`

**Interfaces:**
- Consumes: `CaptchaService.isComplete` from Task 2

- [ ] **Step 1: Create the results guard**

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CaptchaService } from '../services/captcha.service';

export const resultsGuard: CanActivateFn = () => {
  const captchaService = inject(CaptchaService);
  const router = inject(Router);

  if (captchaService.isComplete()) {
    return true;
  }

  return router.createUrlTree(['/captcha']);
};
```

- [ ] **Step 2: Update routes**

```typescript
import { Routes } from '@angular/router';
import { resultsGuard } from './guards/results.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/home/home').then(m => m.HomeComponent),
  },
  {
    path: 'captcha',
    loadComponent: () =>
      import('./components/captcha/captcha').then(m => m.CaptchaComponent),
  },
  {
    path: 'results',
    canActivate: [resultsGuard],
    loadComponent: () =>
      import('./components/result/result').then(m => m.ResultComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
```

- [ ] **Step 3: Update app.config.ts to add animations provider**

```typescript
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimationsAsync(),
  ],
};
```

- [ ] **Step 4: Verify build succeeds**

Run: `npx ng build --configuration development`
Expected: BUILD SUCCESSFUL (components don't exist yet, but lazy loading means no error)

- [ ] **Step 5: Commit**

```bash
git add src/app/guards/results.guard.ts src/app/app.routes.ts src/app/app.config.ts
git commit -m "feat: set up routing with lazy-loaded components and results guard"
```

---

### Task 4: Create HomeComponent

**Files:**
- Create: `src/app/components/home/home.ts`
- Create: `src/app/components/home/home.html`
- Create: `src/app/components/home/home.css`
- Create: `src/app/components/home/home.spec.ts`

**Interfaces:**
- Consumes: `CaptchaService.hasPersistedState()`, `CaptchaService.isComplete()` from Task 2
- Produces: `HomeComponent` — navigates to `/captcha` or `/results`

- [ ] **Step 1: Write failing tests**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home';
import { CaptchaService } from '../../services/captcha.service';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let captchaService: CaptchaService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    captchaService = TestBed.inject(CaptchaService);
    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Angul-It');
  });

  it('should render a Start Captcha button', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('button');
    expect(button?.textContent?.toLowerCase()).toContain('start');
  });

  it('should not show View Results when no persisted state', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const links = compiled.querySelectorAll('a');
    const resultsLink = Array.from(links).find(a =>
      a.textContent?.toLowerCase().includes('result'),
    );
    expect(resultsLink).toBeFalsy();
  });

  it('should show View Results when state is complete', () => {
    // Complete the captcha first
    for (let i = 0; i < 3; i++) {
      const challenge = captchaService.currentChallenge()!;
      let answer: unknown;
      if (challenge.type === 'emoji') answer = challenge.correctAnswers;
      else if (challenge.type === 'math') answer = challenge.answer;
      else answer = challenge.displayWord;
      captchaService.submitStage(answer);
    }

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const links = compiled.querySelectorAll('a');
    const resultsLink = Array.from(links).find(a =>
      a.textContent?.toLowerCase().includes('result'),
    );
    expect(resultsLink).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include='**/home.spec.ts' --run`
Expected: FAIL — `HomeComponent` does not exist

- [ ] **Step 3: Create HomeComponent TypeScript**

```typescript
import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CaptchaService } from '../../services/captcha.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  private readonly captchaService = inject(CaptchaService);

  protected readonly showResults = computed(() => this.captchaService.isComplete());
}
```

- [ ] **Step 4: Create HomeComponent template**

```html
<main class="home-container">
  <h1>Angul-It</h1>
  <p class="subtitle">Prove you're human with our multi-stage captcha challenge.</p>

  <div class="actions">
    <a routerLink="/captcha" class="btn btn-primary">Start Captcha</a>

    @if (showResults()) {
      <a routerLink="/results" class="btn btn-secondary">View Results</a>
    }
  </div>
</main>
```

- [ ] **Step 5: Create HomeComponent styles**

```css
:host {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.home-container {
  text-align: center;
  padding: 2rem;
  max-width: 480px;
}

h1 {
  font-size: 3rem;
  margin-bottom: 0.5rem;
  color: #1a1a2e;
}

.subtitle {
  font-size: 1.125rem;
  color: #555;
  margin-bottom: 2rem;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.btn {
  display: inline-block;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 1rem;
  transition: background-color 0.2s, transform 0.1s;
  cursor: pointer;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn-primary {
  background-color: #3f51b5;
  color: white;
}

.btn-primary:hover {
  background-color: #303f9f;
}

.btn-secondary {
  background-color: #e8eaf6;
  color: #3f51b5;
}

.btn-secondary:hover {
  background-color: #c5cae9;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx ng test --include='**/home.spec.ts' --run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/components/home/
git commit -m "feat: add HomeComponent with start button and conditional results link"
```

---

### Task 5: Create CaptchaComponent — Emoji Grid Challenge

**Files:**
- Create: `src/app/components/captcha/captcha.ts`
- Create: `src/app/components/captcha/captcha.html`
- Create: `src/app/components/captcha/captcha.css`
- Create: `src/app/components/captcha/captcha.spec.ts`

**Interfaces:**
- Consumes: `CaptchaService` (all methods) from Task 2, `EmojiGridChallenge` from Task 1
- Produces: `CaptchaComponent` with emoji grid rendering, form validation, stage navigation

- [ ] **Step 1: Write failing tests**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CaptchaComponent } from './captcha';
import { CaptchaService } from '../../services/captcha.service';

describe('CaptchaComponent', () => {
  let component: CaptchaComponent;
  let fixture: ComponentFixture<CaptchaComponent>;
  let captchaService: CaptchaService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [CaptchaComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    captchaService = TestBed.inject(CaptchaService);
    fixture = TestBed.createComponent(CaptchaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display stage indicator', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('1');
    expect(compiled.textContent).toContain('3');
  });

  it('should render emoji grid when challenge type is emoji', () => {
    // Force emoji challenge
    captchaService.reset();
    const challenges = captchaService.challenges();
    const emojiIndex = challenges.findIndex(c => c.type === 'emoji');

    // Navigate to emoji challenge
    for (let i = 0; i < emojiIndex; i++) {
      const ch = captchaService.currentChallenge()!;
      let answer: unknown;
      if (ch.type === 'emoji') answer = ch.correctAnswers;
      else if (ch.type === 'math') answer = ch.answer;
      else answer = ch.displayWord;
      captchaService.submitStage(answer);
    }

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll('.emoji-btn');
    expect(buttons.length).toBe(16);
  });

  it('should have a Previous button', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const prevBtn = Array.from(compiled.querySelectorAll('button')).find(b =>
      b.textContent?.toLowerCase().includes('previous'),
    );
    expect(prevBtn).toBeTruthy();
  });

  it('should disable Previous on first stage', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const prevBtn = Array.from(compiled.querySelectorAll('button')).find(b =>
      b.textContent?.toLowerCase().includes('previous'),
    ) as HTMLButtonElement | undefined;
    expect(prevBtn?.disabled).toBeTrue();
  });

  it('should render math challenge with options', () => {
    captchaService.reset();
    const challenges = captchaService.challenges();
    const mathIndex = challenges.findIndex(c => c.type === 'math');

    for (let i = 0; i < mathIndex; i++) {
      const ch = captchaService.currentChallenge()!;
      let answer: unknown;
      if (ch.type === 'emoji') answer = ch.correctAnswers;
      else if (ch.type === 'math') answer = ch.answer;
      else answer = ch.displayWord;
      captchaService.submitStage(answer);
    }

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const options = compiled.querySelectorAll('.math-option');
    expect(options.length).toBe(4);
  });

  it('should render text challenge with input', () => {
    captchaService.reset();
    const challenges = captchaService.challenges();
    const textIndex = challenges.findIndex(c => c.type === 'text');

    for (let i = 0; i < textIndex; i++) {
      const ch = captchaService.currentChallenge()!;
      let answer: unknown;
      if (ch.type === 'emoji') answer = ch.correctAnswers;
      else if (ch.type === 'math') answer = ch.answer;
      else answer = ch.displayWord;
      captchaService.submitStage(answer);
    }

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include='**/captcha.spec.ts' --run`
Expected: FAIL — `CaptchaComponent` does not exist

- [ ] **Step 3: Implement CaptchaComponent**

```typescript
import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
  OnInit,
} from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { CaptchaService } from '../../services/captcha.service';
import {
  Challenge,
  EmojiGridChallenge,
  MathChallenge,
  TextChallenge,
} from '../../models/captcha.models';

@Component({
  selector: 'app-captcha',
  imports: [ReactiveFormsModule],
  templateUrl: './captcha.html',
  styleUrl: './captcha.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaptchaComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly captchaService = inject(CaptchaService);
  private readonly router = inject(Router);

  protected readonly challenge = this.captchaService.currentChallenge;
  protected readonly stage = this.captchaService.currentStage;
  protected readonly isComplete = this.captchaService.isComplete;
  protected readonly selectedEmojis = signal<Set<number>>(new Set());
  protected readonly form = signal<FormGroup | null>(null);
  protected readonly direction = signal<'forward' | 'backward'>('forward');

  private readonly stageEffect = effect(() => {
    const challenge = this.challenge();
    if (challenge) {
      this.buildForm(challenge);
      this.selectedEmojis.set(new Set());
    }
  });

  ngOnInit(): void {
    if (!this.captchaService.currentChallenge()) {
      this.captchaService.reset();
    }
  }

  protected toggleEmoji(index: number): void {
    this.selectedEmojis.update(current => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  protected selectMathOption(value: number): void {
    this.form()?.get('mathAnswer')?.setValue(value);
  }

  protected submit(): void {
    const challenge = this.challenge();
    if (!challenge || this.form()?.invalid) return;

    let answer: unknown;

    switch (challenge.type) {
      case 'emoji':
        answer = Array.from(this.selectedEmojis()).sort((a, b) => a - b);
        break;
      case 'math':
        answer = this.form()?.get('mathAnswer')?.value;
        break;
      case 'text':
        answer = this.form()?.get('textAnswer')?.value;
        break;
    }

    this.captchaService.submitStage(answer);

    if (this.captchaService.isComplete()) {
      this.router.navigate(['/results']);
    }
  }

  protected goBack(): void {
    this.direction.set('backward');
    this.captchaService.goToPreviousStage();
  }

  private buildForm(challenge: Challenge): void {
    switch (challenge.type) {
      case 'emoji':
        this.form.set(this.fb.group({}));
        break;
      case 'math':
        this.form.set(
          this.fb.group({
            mathAnswer: [null, Validators.required],
          }),
        );
        break;
      case 'text':
        this.form.set(
          this.fb.group({
            textAnswer: ['', Validators.required],
          }),
        );
        break;
    }
  }
}
```

- [ ] **Step 4: Create CaptchaComponent template**

```html
<div class="captcha-container">
  <div class="stage-indicator">
    <span>Stage {{ stage() }} / 3</span>
    <div class="progress-bar">
      <div
        class="progress-fill"
        [style.width]="(stage() / 3 * 100) + '%'"
      ></div>
    </div>
  </div>

  @if (challenge(); as ch) {
    <div class="challenge-card" [class.slide-left]="direction() === 'backward'">
      <h2>{{ ch.prompt }}</h2>

      @switch (ch.type) {
        @case ('emoji') {
          <div class="emoji-grid" role="group" aria-label="Emoji selection grid">
            @for (row of ch.grid; track $index) {
              @for (emoji of row; track $index) {
                @let flatIndex = $parent.index * 4 + $index;
                <button
                  type="button"
                  class="emoji-btn"
                  [class.selected]="selectedEmojis().has(flatIndex)"
                  (click)="toggleEmoji(flatIndex)"
                  [attr.aria-label]="'Emoji ' + (flatIndex + 1) + ': ' + emoji"
                  [attr.aria-pressed]="selectedEmojis().has(flatIndex)"
                >
                  {{ emoji }}
                </button>
              }
            }
          </div>
        }
        @case ('math') {
          <div class="math-challenge">
            <p class="equation">{{ ch.prompt }}</p>
            @if (form(); as f) {
              <div class="math-options">
                @for (option of ch.options; track option) {
                  <button
                    type="button"
                    class="math-option"
                    [class.selected]="f.get('mathAnswer')?.value === option"
                    (click)="selectMathOption(option)"
                    [attr.aria-pressed]="f.get('mathAnswer')?.value === option"
                  >
                    {{ option }}
                  </button>
                }
              </div>
            }
          </div>
        }
        @case ('text') {
          <div class="text-challenge">
            <p class="display-word">{{ ch.displayWord }}</p>
            @if (form(); as f) {
              <input
                type="text"
                formControlName="textAnswer"
                placeholder="Type the word above"
                autocomplete="off"
                aria-label="Type the word shown"
              />
            }
          </div>
        }
      }

      <div class="challenge-actions">
        <button
          type="button"
          class="btn btn-secondary"
          (click)="goBack()"
          [disabled]="stage() === 1"
          aria-label="Go to previous stage"
        >
          Previous
        </button>

        @if (stage() < 3) {
          <button
            type="button"
            class="btn btn-primary"
            (click)="submit()"
            [disabled]="form()?.invalid"
            aria-label="Submit answer and go to next stage"
          >
            Next
          </button>
        } @else {
          <button
            type="button"
            class="btn btn-primary"
            (click)="submit()"
            [disabled]="form()?.invalid"
            aria-label="Submit final answer"
          >
            Finish
          </button>
        }
      </div>
    </div>
  }
</div>
```

- [ ] **Step 5: Create CaptchaComponent styles**

```css
.captcha-container {
  max-width: 520px;
  margin: 2rem auto;
  padding: 1rem;
}

.stage-indicator {
  text-align: center;
  margin-bottom: 1.5rem;
}

.stage-indicator span {
  font-weight: 600;
  color: #333;
}

.progress-bar {
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  margin-top: 0.5rem;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #3f51b5;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.challenge-card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.challenge-card h2 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #1a1a2e;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.emoji-btn {
  font-size: 2rem;
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.1s, background-color 0.2s;
}

.emoji-btn:hover {
  border-color: #3f51b5;
  transform: scale(1.05);
}

.emoji-btn.selected {
  border-color: #3f51b5;
  background: #e8eaf6;
}

.math-challenge {
  text-align: center;
  margin-bottom: 1.5rem;
}

.equation {
  font-size: 2rem;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 1rem;
}

.math-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.math-option {
  font-size: 1.25rem;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
}

.math-option:hover {
  border-color: #3f51b5;
}

.math-option.selected {
  border-color: #3f51b5;
  background: #e8eaf6;
}

.text-challenge {
  text-align: center;
  margin-bottom: 1.5rem;
}

.display-word {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #1a1a2e;
  margin-bottom: 1rem;
  font-family: monospace;
}

.text-challenge input {
  font-size: 1.125rem;
  padding: 0.75rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  width: 100%;
  max-width: 300px;
  text-align: center;
  transition: border-color 0.2s;
}

.text-challenge input:focus {
  outline: none;
  border-color: #3f51b5;
}

.challenge-actions {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  border: none;
  transition: background-color 0.2s, opacity 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #3f51b5;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #303f9f;
}

.btn-secondary {
  background-color: #e0e0e0;
  color: #333;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #bdbdbd;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx ng test --include='**/captcha.spec.ts' --run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/components/captcha/
git commit -m "feat: add CaptchaComponent with emoji grid, math, and text challenges"
```

---

### Task 6: Create ResultComponent

**Files:**
- Create: `src/app/components/result/result.ts`
- Create: `src/app/components/result/result.html`
- Create: `src/app/components/result/result.css`
- Create: `src/app/components/result/result.spec.ts`

**Interfaces:**
- Consumes: `CaptchaService` (results, isComplete, reset) from Task 2
- Produces: `ResultComponent` — displays results, allows retry

- [ ] **Step 1: Write failing tests**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ResultComponent } from './result';
import { CaptchaService } from '../../services/captcha.service';

describe('ResultComponent', () => {
  let component: ResultComponent;
  let fixture: ComponentFixture<ResultComponent>;
  let captchaService: CaptchaService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ResultComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    captchaService = TestBed.inject(CaptchaService);

    // Complete all 3 stages
    for (let i = 0; i < 3; i++) {
      const challenge = captchaService.currentChallenge()!;
      let answer: unknown;
      if (challenge.type === 'emoji') answer = challenge.correctAnswers;
      else if (challenge.type === 'math') answer = challenge.answer;
      else answer = challenge.displayWord;
      captchaService.submitStage(answer);
    }

    fixture = TestBed.createComponent(ResultComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display results heading', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Results');
  });

  it('should show 3 stage results', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const items = compiled.querySelectorAll('.result-item');
    expect(items.length).toBe(3);
  });

  it('should show overall pass status when all passed', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Passed');
  });

  it('should show a Try Again button', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const btn = Array.from(compiled.querySelectorAll('button')).find(b =>
      b.textContent?.toLowerCase().includes('try again'),
    );
    expect(btn).toBeTruthy();
  });

  it('should have a link back to home', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector('a[href="/"]');
    expect(link).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include='**/result.spec.ts' --run`
Expected: FAIL — `ResultComponent` does not exist

- [ ] **Step 3: Implement ResultComponent**

```typescript
import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CaptchaService } from '../../services/captcha.service';

@Component({
  selector: 'app-result',
  imports: [RouterLink],
  templateUrl: './result.html',
  styleUrl: './result.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultComponent {
  private readonly captchaService = inject(CaptchaService);
  private readonly router = inject(Router);

  protected readonly results = this.captchaService.results;
  protected readonly allPassed = computed(() =>
    this.results().every(r => r.passed),
  );
  protected readonly passedCount = computed(() =>
    this.results().filter(r => r.passed).length,
  );

  protected retry(): void {
    this.captchaService.reset();
    this.router.navigate(['/captcha']);
  }

  protected typeLabel(type: string): string {
    switch (type) {
      case 'emoji':
        return 'Emoji Grid';
      case 'math':
        return 'Math Problem';
      case 'text':
        return 'Text Input';
      default:
        return type;
    }
  }
}
```

- [ ] **Step 4: Create ResultComponent template**

```html
<div class="result-container">
  <h1>Results</h1>

  <div class="result-summary" [class.pass]="allPassed()" [class.fail]="!allPassed()">
    <p class="status">
      @if (allPassed()) {
        Passed
      } @else {
        Failed
      }
    </p>
    <p class="score">{{ passedCount() }} / 3 correct</p>
  </div>

  <div class="results-list">
    @for (result of results(); track result.stage) {
      <div class="result-item" [class.pass]="result.passed" [class.fail]="!result.passed">
        <span class="stage-label">Stage {{ result.stage }}</span>
        <span class="type-label">{{ typeLabel(result.type) }}</span>
        <span class="result-badge">
          @if (result.passed) {
            Pass
          } @else {
            Fail
          }
        </span>
      </div>
    }
  </div>

  <div class="actions">
    <button type="button" class="btn btn-primary" (click)="retry()">
      Try Again
    </button>
    <a routerLink="/" class="btn btn-secondary">Back to Home</a>
  </div>
</div>
```

- [ ] **Step 5: Create ResultComponent styles**

```css
.result-container {
  max-width: 480px;
  margin: 2rem auto;
  padding: 1rem;
  text-align: center;
}

h1 {
  font-size: 2rem;
  color: #1a1a2e;
  margin-bottom: 1.5rem;
}

.result-summary {
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
}

.result-summary.pass {
  background: #e8f5e9;
  color: #2e7d32;
}

.result-summary.fail {
  background: #ffebee;
  color: #c62828;
}

.status {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.score {
  font-size: 1rem;
  margin: 0.5rem 0 0;
  opacity: 0.8;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-radius: 8px;
  background: #f5f5f5;
}

.result-item.pass {
  border-left: 4px solid #4caf50;
}

.result-item.fail {
  border-left: 4px solid #f44336;
}

.stage-label {
  font-weight: 600;
  color: #333;
}

.type-label {
  color: #666;
}

.result-badge {
  font-weight: 600;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
}

.result-item.pass .result-badge {
  background: #c8e6c9;
  color: #2e7d32;
}

.result-item.fail .result-badge {
  background: #ffcdd2;
  color: #c62828;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.btn {
  display: inline-block;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  border: none;
  transition: background-color 0.2s, transform 0.1s;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn-primary {
  background-color: #3f51b5;
  color: white;
}

.btn-primary:hover {
  background-color: #303f9f;
}

.btn-secondary {
  background-color: #e8eaf6;
  color: #3f51b5;
}

.btn-secondary:hover {
  background-color: #c5cae9;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx ng test --include='**/result.spec.ts' --run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/components/result/
git commit -m "feat: add ResultComponent with results display and retry"
```

---

### Task 7: Update Root App Component

**Files:**
- Modify: `src/app/app.ts`
- Modify: `src/app/app.html`
- Modify: `src/app/app.css`

**Interfaces:**
- Consumes: Routes from Task 3

- [ ] **Step 1: Update root component**

```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
```

- [ ] **Step 2: Update root template**

```html
<router-outlet />
```

- [ ] **Step 3: Update root styles**

```css
:host {
  display: block;
  min-height: 100vh;
  background: #f0f2f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    Oxygen, Ubuntu, Cantarell, sans-serif;
}
```

- [ ] **Step 4: Update global styles**

Read `src/styles.css` and replace contents:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #f0f2f5;
  color: #333;
  line-height: 1.5;
}
```

- [ ] **Step 5: Verify full build**

Run: `npx ng build --configuration development`
Expected: BUILD SUCCESSFUL

- [ ] **Step 6: Commit**

```bash
git add src/app/app.ts src/app/app.html src/app/app.css src/styles.css
git commit -m "feat: update root component with router outlet and global styles"
```

---

### Task 8: Add Animations

**Files:**
- Create: `src/app/animations.ts`

**Interfaces:**
- Consumes: None
- Produces: Reusable animation triggers

- [ ] **Step 1: Create animations file**

```typescript
import {
  trigger,
  transition,
  style,
  animate,
  query,
  group,
} from '@angular/animations';

export const slideInAnimation = trigger('routeAnimation', [
  transition('* <=> *', [
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(20px)' }),
    ], { optional: true }),
    group([
      query(':leave', [
        animate('200ms ease-out', style({ opacity: 0, transform: 'translateY(-20px)' })),
      ], { optional: true }),
      query(':enter', [
        animate('300ms 100ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ], { optional: true }),
    ]),
  ]),
]);

export const fadeInAnimation = trigger('fadeIn', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate('300ms ease-in', style({ opacity: 1 })),
  ]),
]);

export const staggerAnimation = trigger('stagger', [
  transition('* => *', [
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(10px)' }),
      stagger('100ms', [
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ], { optional: true }),
  ]),
]);
```

- [ ] **Step 2: Apply route animation to root template**

Update `src/app/app.html`:

```html
<div [@routeAnimation]="getRouteAnimationData()">
  <router-outlet />
</div>
```

Update `src/app/app.ts`:

```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { slideInAnimation } from './animations';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [slideInAnimation],
})
export class App {
  getRouteAnimationData(): string {
    return '';
  }
}
```

- [ ] **Step 3: Apply fadeIn to ResultComponent**

Update `src/app/components/result/result.html` to add `@fadeIn` to the container:

```html
<div class="result-container" @fadeIn>
  <h1>Results</h1>

  <div class="result-summary" [class.pass]="allPassed()" [class.fail]="!allPassed()">
    <p class="status">
      @if (allPassed()) {
        Passed
      } @else {
        Failed
      }
    </p>
    <p class="score">{{ passedCount() }} / 3 correct</p>
  </div>

  <div class="results-list" @stagger>
    @for (result of results(); track result.stage) {
      <div class="result-item" [class.pass]="result.passed" [class.fail]="!result.passed">
        <span class="stage-label">Stage {{ result.stage }}</span>
        <span class="type-label">{{ typeLabel(result.type) }}</span>
        <span class="result-badge">
          @if (result.passed) {
            Pass
          } @else {
            Fail
          }
        </span>
      </div>
    }
  </div>

  <div class="actions">
    <button type="button" class="btn btn-primary" (click)="retry()">
      Try Again
    </button>
    <a routerLink="/" class="btn btn-secondary">Back to Home</a>
  </div>
</div>
```

Update `src/app/components/result/result.ts` to import animations:

```typescript
import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CaptchaService } from '../../services/captcha.service';
import { fadeInAnimation, staggerAnimation } from '../../animations';

@Component({
  selector: 'app-result',
  imports: [RouterLink],
  templateUrl: './result.html',
  styleUrl: './result.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeInAnimation, staggerAnimation],
})
export class ResultComponent {
  private readonly captchaService = inject(CaptchaService);
  private readonly router = inject(Router);

  protected readonly results = this.captchaService.results;
  protected readonly allPassed = computed(() =>
    this.results().every(r => r.passed),
  );
  protected readonly passedCount = computed(() =>
    this.results().filter(r => r.passed).length,
  );

  protected retry(): void {
    this.captchaService.reset();
    this.router.navigate(['/captcha']);
  }

  protected typeLabel(type: string): string {
    switch (type) {
      case 'emoji':
        return 'Emoji Grid';
      case 'math':
        return 'Math Problem';
      case 'text':
        return 'Text Input';
      default:
        return type;
    }
  }
}
```

- [ ] **Step 4: Verify build**

Run: `npx ng build --configuration development`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add src/app/animations.ts src/app/app.ts src/app/app.html src/app/components/result/result.ts src/app/components/result/result.html
git commit -m "feat: add animations for route transitions, fade-in, and stagger"
```

---

### Task 9: Run All Tests and Verify

**Files:** None (verification only)

- [ ] **Step 1: Run all unit tests**

Run: `npx ng test --run`
Expected: All tests PASS

- [ ] **Step 2: Run build**

Run: `npx ng build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: resolve test and build issues"
```

(Only if fixes were needed)
