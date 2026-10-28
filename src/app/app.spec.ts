import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { CaptchaStateService } from './captcha/state';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
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

  it('redirects /result back to / when storage is empty', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/result');
    expect(router.url).toBe('/');
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
