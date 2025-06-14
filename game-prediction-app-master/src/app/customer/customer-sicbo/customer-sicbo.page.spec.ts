import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomerSicboPage } from './customer-sicbo.page';

describe('CustomerSicboPage', () => {
  let component: CustomerSicboPage;
  let fixture: ComponentFixture<CustomerSicboPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(CustomerSicboPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
