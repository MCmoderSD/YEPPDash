import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { DashModule } from '../../pages/dash.module';
import { BdsmResultComponent } from './bdsm-result.component';
import { BDSM_TRAITS, BdsmResult, BdsmTraitKey } from '../../data/bdsm-result';

function result(scores: Partial<Record<BdsmTraitKey, number>> = {}): BdsmResult {
  const traits = Object.fromEntries(
    BDSM_TRAITS.map((trait) => [trait.key, scores[trait.key] ?? 0]),
  ) as Record<BdsmTraitKey, number>;

  return {
    id: 'abc123',
    userId: '644984959',
    timestamp: '2026-07-31T12:34:56Z',
    version: 3,
    gender: 'Female',
    ageGroup: '23-25',
    traits,
  };
}

describe('BdsmResultComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashModule, RouterModule.forRoot([])],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()],
    }).compileComponents();
  });

  function render(value: BdsmResult): ComponentFixture<BdsmResultComponent> {
    const fixture = TestBed.createComponent(BdsmResultComponent);
    fixture.componentRef.setInput('result', value);
    fixture.detectChanges();

    return fixture;
  }

  function rows(fixture: ComponentFixture<BdsmResultComponent>): HTMLElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.bdsm-result-row')];
  }

  function texts(fixture: ComponentFixture<BdsmResultComponent>, selector: string): string[] {
    return rows(fixture).map((row) => row.querySelector(selector)!.textContent!.trim());
  }

  it('should show a row for every trait', () => {
    expect(rows(render(result()))).toHaveLength(BDSM_TRAITS.length);
  });

  it('should list the strongest trait first', () => {
    const fixture = render(result({ brat: 0.4, switch: 0.84, vanilla: 0.56 }));

    expect(texts(fixture, '.bdsm-result-label').slice(0, 3)).toEqual(['Switch', 'Vanilla', 'Brat']);
  });

  it('should show each score as a percentage', () => {
    const fixture = render(result({ switch: 0.84, vanilla: 0.56 }));

    expect(texts(fixture, '.bdsm-result-percent').slice(0, 2)).toEqual(['84%', '56%']);
  });

  // The bar is the percentage drawn, so the two must not be able to disagree.
  it('should draw each bar to the width of its own score', () => {
    const fixture = render(result({ switch: 0.84 }));
    const bar = rows(fixture)[0].querySelector<HTMLElement>('.bdsm-result-bar')!;

    expect(bar.style.width).toBe('84%');
  });

  // Compared rather than matched against a literal: engines normalise an hsl() value to their own
  // spelling, so what matters is that the two ends of the scale do not land on the same colour.
  it('should colour a strong trait differently from a weak one', () => {
    const fixture = render(result({ switch: 1, vanilla: 0 }));
    const colorOf = (row: HTMLElement): string =>
      row.querySelector<HTMLElement>('.bdsm-result-bar')!.style.backgroundColor;

    const drawn = rows(fixture).map(colorOf);

    expect(drawn[0]).not.toBe(drawn.at(-1));
    expect(drawn.every((color) => color.length > 0)).toBe(true);
  });

  // Colour must not be the only thing carrying a score, or the chart is unreadable to anyone who
  // cannot separate the hues — the percentage sits beside every bar as text.
  it('should state every score in text as well as in colour', () => {
    const fixture = render(result({ switch: 0.84 }));

    expect(texts(fixture, '.bdsm-result-percent')).toHaveLength(BDSM_TRAITS.length);
    expect(texts(fixture, '.bdsm-result-label')).toHaveLength(BDSM_TRAITS.length);
  });

  // It redraws the same number the text either side of it already gives.
  it('should hide the bar from assistive technology', () => {
    const fixture = render(result());

    expect(rows(fixture)[0].querySelector('.bdsm-result-track')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('should redraw when it is handed a different result', () => {
    const fixture = render(result({ switch: 0.84 }));
    expect(texts(fixture, '.bdsm-result-label')[0]).toBe('Switch');

    fixture.componentRef.setInput('result', result({ vanilla: 0.9 }));
    fixture.detectChanges();

    expect(texts(fixture, '.bdsm-result-label')[0]).toBe('Vanilla');
  });
});
