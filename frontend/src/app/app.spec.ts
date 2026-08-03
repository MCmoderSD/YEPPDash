import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { App } from './app';
import { AppModule } from './app-module';

describe('App', () => {
  beforeEach(async () => {
    // App is AOT-compiled with its directive scope bound to AppModule, so the real module has to
    // come along — re-declaring App in a bare testing module leaves <app-navbar> unresolved.
    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [provideHttpClientTesting(), provideNoopAnimations()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render a router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('should render the navbar and footer around the outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-navbar')).toBeTruthy();
    expect(compiled.querySelector('app-footer')).toBeTruthy();
  });

  // The overlay is loaded by a browser source in OBS, so everything the dashboard puts around a
  // page would be captured into the stream along with the wheel.
  it('should drop the navbar, footer and notifications on the OBS overlay', async () => {
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(await router.navigateByUrl('/wheel/overlay?entries=Ali')).toBe(true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-wheel-overlay-page')).toBeTruthy();
    expect(compiled.querySelector('app-navbar')).toBeNull();
    expect(compiled.querySelector('app-footer')).toBeNull();
    expect(compiled.querySelector('app-notifications')).toBeNull();
  });

  it('should offer a login link while signed out', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-user-menu')).toBeNull();
    expect(compiled.querySelector('a[href*="/auth/login"]')).toBeTruthy();
  });
});