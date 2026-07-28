import { TestBed } from '@angular/core/testing';
import { SidebarService } from './sidebar.service';

describe('SidebarService', () => {
  let service: SidebarService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SidebarService);
  });

  it('should start closed', () => {
    expect(service.opened()).toBe(false);
  });

  it('should flip open and closed on repeated toggles', () => {
    service.toggle();
    expect(service.opened()).toBe(true);

    service.toggle();
    expect(service.opened()).toBe(false);
  });

  it('should force closed regardless of the current state', () => {
    service.toggle();
    service.close();
    expect(service.opened()).toBe(false);

    service.close();
    expect(service.opened()).toBe(false);
  });
});
