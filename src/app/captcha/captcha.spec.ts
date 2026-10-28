import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { Router, provideRouter } from '@angular/router';
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
    vi.spyOn(router, 'navigate').mockReturnValue(Promise.resolve(true));
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
