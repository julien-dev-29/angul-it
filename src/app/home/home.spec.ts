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
    vi.spyOn(router, 'navigate').mockReturnValue(Promise.resolve(true));
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
