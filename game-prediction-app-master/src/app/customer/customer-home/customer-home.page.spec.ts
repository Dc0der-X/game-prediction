import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomerHomePage } from './customer-home.page';

describe('CustomerHomePage', () => {
  let component: CustomerHomePage;
  let fixture: ComponentFixture<CustomerHomePage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(CustomerHomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
