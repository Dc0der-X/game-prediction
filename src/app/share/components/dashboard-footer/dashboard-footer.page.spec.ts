import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardFooterPage } from './dashboard-footer.page';

describe('DashboardFooterPage', () => {
  let component: DashboardFooterPage;
  let fixture: ComponentFixture<DashboardFooterPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(DashboardFooterPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
