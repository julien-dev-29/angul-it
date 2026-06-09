import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Cell } from './cell';

describe('Cell', () => {
  let component: Cell;
  let fixture: ComponentFixture<Cell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Cell],
    }).compileComponents();

    fixture = TestBed.createComponent(Cell);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
