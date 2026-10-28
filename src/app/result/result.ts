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
