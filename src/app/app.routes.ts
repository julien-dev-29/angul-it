import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Captcha } from './captcha/captcha';
import { Result } from './result/result';
import { captchaGuard, resultGuard } from './captcha/guards';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'captcha', component: Captcha, canActivate: [captchaGuard] },
  { path: 'result', component: Result, canActivate: [resultGuard] },
  { path: '**', redirectTo: '' },
];
