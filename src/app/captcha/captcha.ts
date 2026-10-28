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
    let lastStageKey: string | null = null;
    effect(() => {
      const challenge = this.challenge();
      const key = challenge ? `${challenge.id}:${challenge.status}` : 'empty';
      if (key !== lastStageKey) {
        lastStageKey = key;
        this.errorText.set(null);
      }
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
