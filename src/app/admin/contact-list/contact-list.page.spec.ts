import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactListPage } from './contact-list.page';

describe('ContactListPage', () => {
  let component: ContactListPage;
  let fixture: ComponentFixture<ContactListPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(ContactListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
