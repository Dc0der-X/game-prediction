import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomerRoulettePage } from './customer-roulette.page';

describe('CustomerRoulettePage', () => {
  let component: CustomerRoulettePage;
  let fixture: ComponentFixture<CustomerRoulettePage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(CustomerRoulettePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
