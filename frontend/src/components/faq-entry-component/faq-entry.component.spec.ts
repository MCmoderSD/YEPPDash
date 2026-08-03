import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FaqEntry, FaqEntryComponent } from './faq-entry.component';

const ENTRY: FaqEntry = {
  question: 'Does it cost anything?',
  answer: 'No, it is free.',
  details: ['There is no paid tier.', 'There are no ads either.'],
};

describe('FaqEntryComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FaqEntryComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();
  });

  function render(entry: FaqEntry): ComponentFixture<FaqEntryComponent> {
    const fixture = TestBed.createComponent(FaqEntryComponent);
    fixture.componentRef.setInput('entry', entry);
    fixture.detectChanges();

    return fixture;
  }

  function element(fixture: ComponentFixture<FaqEntryComponent>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('should carry the question in the header', () => {
    expect(element(render(ENTRY)).querySelector('.faq-entry-question')!.textContent!.trim())
      .toBe('Does it cost anything?');
  });

  it('should start collapsed', () => {
    expect(element(render(ENTRY)).querySelector('.mat-expansion-panel-header')!
      .getAttribute('aria-expanded')).toBe('false');
  });

  it('should open on a click of its header', () => {
    const fixture = render(ENTRY);

    element(fixture).querySelector<HTMLElement>('.mat-expansion-panel-header')!.click();
    fixture.detectChanges();

    expect(element(fixture).querySelector('.mat-expansion-panel-header')!
      .getAttribute('aria-expanded')).toBe('true');
  });

  it('should lead with the answer and follow it with every detail', () => {
    const fixture = render(ENTRY);

    expect(element(fixture).querySelector('.faq-entry-answer')!.textContent!.trim())
      .toBe('No, it is free.');

    expect([...element(fixture).querySelectorAll('.faq-entry-detail')]
      .map((detail) => detail.textContent!.trim()))
      .toEqual(['There is no paid tier.', 'There are no ads either.']);
  });

  // Prerendering is what makes this page findable at all, and lazy panel content would keep every
  // answer out of the served HTML until a human clicked it.
  it('should render the answer before the panel is ever opened', () => {
    expect(element(render(ENTRY)).querySelector('.faq-entry-answer')).toBeTruthy();
  });

  it('should leave out the link on an entry that has none', () => {
    expect(element(render(ENTRY)).querySelector('.faq-entry-link')).toBeNull();
  });

  it('should open a link it was given in a new tab without handing over the opener', () => {
    const fixture = render({
      ...ENTRY,
      link: { label: 'Open an issue', url: 'https://github.com/MCmoderSD/YEPPDash/issues' },
    });

    const link = element(fixture).querySelector<HTMLAnchorElement>('.faq-entry-link')!;

    expect(link.textContent!.trim()).toContain('Open an issue');
    expect(link.getAttribute('href')).toBe('https://github.com/MCmoderSD/YEPPDash/issues');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener');
  });

  it('should follow an entry it is handed later', () => {
    const fixture = render(ENTRY);

    fixture.componentRef.setInput('entry', { ...ENTRY, question: 'Is it open source?' });
    fixture.detectChanges();

    expect(element(fixture).querySelector('.faq-entry-question')!.textContent!.trim())
      .toBe('Is it open source?');
  });
});
