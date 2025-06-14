import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomerHeaderPage } from './customer-header.page';

describe('CustomerHeaderPage', () => {
  let component: CustomerHeaderPage;
  let fixture: ComponentFixture<CustomerHeaderPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(CustomerHeaderPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
