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
