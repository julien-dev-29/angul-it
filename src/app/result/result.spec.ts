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
    vi.spyOn(router, 'navigate').mockReturnValue(Promise.resolve(true));
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
    completeSession();
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button.ghost')!
      .click();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });
});
