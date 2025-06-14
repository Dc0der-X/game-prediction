import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomerProfilePage } from './customer-profile.page';

describe('CustomerProfilePage', () => {
  let component: CustomerProfilePage;
  let fixture: ComponentFixture<CustomerProfilePage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(CustomerProfilePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
