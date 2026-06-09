import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CaptchaComponent } from './captcha-component';

describe('CaptchaComponent', () => {
  let component: CaptchaComponent;
  let fixture: ComponentFixture<CaptchaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CaptchaComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CaptchaComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
