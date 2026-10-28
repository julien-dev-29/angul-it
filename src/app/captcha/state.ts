import { Injectable, computed, effect, signal } from '@angular/core';
import { buildSession } from './challenge-generator';
import type { CaptchaSession, Challenge, ChallengeStatus, ChallengeType } from './challenge-generator';

export type { CaptchaSession, Challenge, ChallengeStatus, ChallengeType };

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
        const maxIndex = typeof parsed.maxIndex === 'number' ? parsed.maxIndex : parsed.currentIndex;
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
