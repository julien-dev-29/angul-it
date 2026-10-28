import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CaptchaStateService } from '../captcha/state';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly state = inject(CaptchaStateService);
  private readonly router = inject(Router);

  readonly hasActiveSession = computed(() => {
    const session = this.state.session();
    return !!session && !session.completed;
  });

  start(): void {
    this.state.startNewSession();
    this.router.navigate(['/captcha']);
  }

  resume(): void {
    this.router.navigate(['/captcha']);
  }
}
