import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomerLuckySevenPage } from './customer-lucky-seven.page';

describe('CustomerLuckySevenPage', () => {
  let component: CustomerLuckySevenPage;
  let fixture: ComponentFixture<CustomerLuckySevenPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(CustomerLuckySevenPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
