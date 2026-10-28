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
