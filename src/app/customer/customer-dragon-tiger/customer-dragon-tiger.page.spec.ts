import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomerDragonTigerPage } from './customer-dragon-tiger.page';

describe('CustomerDragonTigerPage', () => {
  let component: CustomerDragonTigerPage;
  let fixture: ComponentFixture<CustomerDragonTigerPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(CustomerDragonTigerPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
