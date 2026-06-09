import { Routes } from '@angular/router';
import { HomeComponent } from './home-component/home-component';
import { CaptchaComponent } from './captcha-component/captcha-component';
import { ResultComponent } from './result-component/result-component';

export const routes: Routes = [
    {
        path: '',
        component: HomeComponent,
        title: 'Home Page',
    },
    {
        path: 'captcha',
        component: CaptchaComponent,
        title: 'Resolve the cpatcha!',
    },
    {
        path: 'result',
        component: ResultComponent,
        title: "Resultat",
    }
];
