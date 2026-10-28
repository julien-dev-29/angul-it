import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CaptchaStateService } from './state';

export const captchaGuard: CanActivateFn = () => {
  const state = inject(CaptchaStateService);
  const router = inject(Router);
  const session = state.session();
  return session && !session.completed ? true : router.createUrlTree(['/']);
};

export const resultGuard: CanActivateFn = () => {
  const state = inject(CaptchaStateService);
  const router = inject(Router);
  return state.completed() ? true : router.createUrlTree(['/captcha']);
};
