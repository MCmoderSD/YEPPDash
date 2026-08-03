import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FaqPageComponent } from './faq-page.component';
import { PagesModule } from '../pages.module';
import { FaqEntry } from '../../components/faq-entry-component/faq-entry.component';

describe('FaqPageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PagesModule, RouterModule.forRoot([])],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()],
    }).compileComponents();
  });

  function render(): ComponentFixture<FaqPageComponent> {
    const fixture = TestBed.createComponent(FaqPageComponent);
    fixture.detectChanges();

    return fixture;
  }

  function element(fixture: ComponentFixture<FaqPageComponent>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  // The list is the component's own, so reaching for it is the only way to hold the rendered page
  // against what it was handed.
  function entries(fixture: ComponentFixture<FaqPageComponent>): readonly FaqEntry[] {
    return fixture.componentInstance['entries'];
  }

  it('should list every FAQ entry, in order', () => {
    const fixture = render();

    const questions = [...element(fixture).querySelectorAll('.faq-entry-question')]
      .map((question) => question.textContent!.trim());

    expect(questions).toEqual(entries(fixture).map((entry) => entry.question));
  });

  it('should have entries at all', () => {
    expect(entries(render()).length).toBeGreaterThan(0);
  });

  // A question that appears twice would collapse into one row, since the list tracks by question.
  it('should ask each question once', () => {
    const questions = entries(render()).map((entry) => entry.question);

    expect(new Set(questions).size).toBe(questions.length);
  });

  it('should answer every question it asks', () => {
    for (const entry of entries(render())) {
      expect(entry.answer.length).toBeGreaterThan(0);
    }
  });

  // Absolute rather than routed, so they still resolve once the page is opened from the dashboard
  // host, where none of these paths exist.
  it('should link out with an absolute url wherever an entry carries one', () => {
    for (const entry of entries(render())) {
      if (entry.link) expect(entry.link.url).toMatch(/^https?:\/\//);
    }
  });

  it('should title the page', () => {
    expect(element(render()).querySelector('h1')!.textContent!.trim())
      .toBe('Frequently asked questions');
  });

  it('should start with every entry collapsed', () => {
    const expanded = [...element(render()).querySelectorAll('.mat-expansion-panel-header')]
      .map((header) => header.getAttribute('aria-expanded'));

    expect(expanded.every((state) => state === 'false')).toBe(true);
  });

  // Without an accordion tying them together, opening one entry has to leave the rest alone.
  it('should leave the other entries open when one is opened', () => {
    const fixture = render();
    const headers = () => [...element(fixture).querySelectorAll('.mat-expansion-panel-header')];

    (headers()[0] as HTMLElement).click();
    (headers()[1] as HTMLElement).click();
    fixture.detectChanges();

    expect(headers().slice(0, 2).map((header) => header.getAttribute('aria-expanded')))
      .toEqual(['true', 'true']);
  });
});
