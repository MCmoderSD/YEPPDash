import { Component, signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScrollBarComponent, scrollBarAxis, scrollForThumbOffset } from './scroll-bar.component';

@Component({
  imports: [ScrollBarComponent],
  template: `
    <div class="frame">
      <div #target class="target"></div>
      @if (show()) {
        <app-scroll-bar [target]="target"/>
      }
    </div>
  `,
})
class HostComponent {
  readonly show: WritableSignal<boolean> = signal(true);
}

type Metrics = Partial<Record<
  'clientWidth' | 'clientHeight' | 'scrollWidth' | 'scrollHeight' | 'scrollLeft' | 'scrollTop'
  | 'offsetWidth' | 'offsetHeight' | 'clientTop' | 'clientLeft',
  number
>>;

// jsdom has no layout, so every size an element reports there is zero. Defining them by hand is
// what makes the geometry testable at all; whether a browser agrees is a question for the browser.
function layout(element: HTMLElement, metrics: Metrics): void {
  for (const [name, value] of Object.entries(metrics)) {
    Object.defineProperty(element, name, { value, configurable: true, writable: true });
  }
}

describe('scrollBarAxis', () => {

  it('should show no bar when the content fits', () => {
    expect(scrollBarAxis(300, 300, 300, 0).visible).toBe(false);
  });

  it('should treat a single pixel of overflow as nothing to scroll', () => {
    // What sub-pixel layout and page zoom produce on their own, not a scrollable element.
    expect(scrollBarAxis(300, 300, 301, 0).visible).toBe(false);
  });

  it('should show no bar when there is no track to draw one on', () => {
    expect(scrollBarAxis(0, 300, 900, 0).visible).toBe(false);
  });

  it('should size the thumb by how much of the content is visible', () => {
    // A third of the content is on screen, so the thumb covers a third of the track.
    expect(scrollBarAxis(300, 300, 900, 0)).toEqual({
      visible: true,
      trackSize: 300,
      thumbSize: 100,
      thumbOffset: 0,
    });
  });

  it('should keep the thumb grabbable however long the content is', () => {
    // In proportion this thumb would be a third of a pixel tall.
    expect(scrollBarAxis(300, 10, 10000, 0).thumbSize).toBe(24);
  });

  it('should never let the thumb outgrow its track', () => {
    // A track shorter than the minimum thumb wins, otherwise the thumb hangs out of its own bar.
    const axis = scrollBarAxis(12, 100, 1000, 0);

    expect(axis.thumbSize).toBe(12);
    expect(axis.thumbOffset).toBe(0);
  });

  it('should move the thumb with the scroll offset', () => {
    // Half scrolled, so the thumb sits halfway along the room it has: (300 - 100) / 2.
    expect(scrollBarAxis(300, 300, 900, 300).thumbOffset).toBe(100);
  });

  it('should park the thumb at the end once the content is scrolled to the bottom', () => {
    expect(scrollBarAxis(300, 300, 900, 600).thumbOffset).toBe(200);
  });

  it('should clamp a scroll offset that reaches past the content', () => {
    // Overscroll — rubber banding, a trackpad pushed past the end — reports more than exists.
    expect(scrollBarAxis(300, 300, 900, 900).thumbOffset).toBe(200);
    expect(scrollBarAxis(300, 300, 900, -50).thumbOffset).toBe(0);
  });
});

describe('scrollForThumbOffset', () => {
  const axis = { visible: true, trackSize: 300, thumbSize: 100, thumbOffset: 0 };

  it('should map the middle of the track to the middle of the content', () => {
    expect(scrollForThumbOffset(100, axis, 300, 900)).toBe(300);
  });

  it('should undo the geometry it is the inverse of', () => {
    const measured = scrollBarAxis(300, 300, 900, 420);

    expect(Math.round(scrollForThumbOffset(measured.thumbOffset, measured, 300, 900))).toBe(420);
  });

  it('should clamp an offset past either end of the track', () => {
    expect(scrollForThumbOffset(-80, axis, 300, 900)).toBe(0);
    expect(scrollForThumbOffset(4000, axis, 300, 900)).toBe(600);
  });

  it('should stay put when the thumb fills the whole track', () => {
    expect(scrollForThumbOffset(50, { ...axis, thumbSize: 300 }, 300, 900)).toBe(0);
  });
});

describe('ScrollBarComponent', () => {

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  });

  function target(fixture: ComponentFixture<HostComponent>): HTMLElement {
    return fixture.nativeElement.querySelector('.target');
  }

  function track(
    fixture: ComponentFixture<HostComponent>, axis: 'vertical' | 'horizontal',
  ): HTMLElement {
    return fixture.nativeElement.querySelector(`.scroll-bar-track-${axis}`);
  }

  function thumb(
    fixture: ComponentFixture<HostComponent>, axis: 'vertical' | 'horizontal',
  ): HTMLElement {
    return track(fixture, axis).querySelector('.scroll-bar-thumb')!;
  }

  function shown(fixture: ComponentFixture<HostComponent>, axis: 'vertical' | 'horizontal'): boolean {
    return track(fixture, axis).classList.contains('scroll-bar-shown');
  }

  function scrollTo(fixture: ComponentFixture<HostComponent>, metrics: Metrics): void {
    layout(target(fixture), metrics);
    target(fixture).dispatchEvent(new Event('scroll'));
    TestBed.tick();
  }

  // The bars only get their thickness from CSS, which jsdom does not apply, so it is handed to them
  // after they exist and the element is then measured again the way a scroll would.
  function render(metrics: Metrics = {}): ComponentFixture<HostComponent> {
    const fixture = TestBed.createComponent(HostComponent);
    TestBed.tick();

    layout(track(fixture, 'vertical'), { offsetWidth: 10 });
    layout(track(fixture, 'horizontal'), { offsetHeight: 10 });
    scrollTo(fixture, metrics);

    return fixture;
  }

  it('should hide the platform bar on the element it is pointed at', () => {
    const fixture = render();

    expect(target(fixture).classList.contains('app-native-scrollbar-hidden')).toBe(true);
  });

  it('should give the platform bar back when it goes away', () => {
    const fixture = render();
    const element = target(fixture);

    fixture.componentInstance.show.set(false);
    TestBed.tick();

    // Otherwise an element that outlives its bar is left with no scroll bar at all.
    expect(element.classList.contains('app-native-scrollbar-hidden')).toBe(false);
  });

  it('should stay out of the accessibility tree', () => {
    const fixture = render();

    // It only restates scrolling that the element underneath already offers natively.
    expect(fixture.nativeElement.querySelector('app-scroll-bar').getAttribute('aria-hidden'))
      .toBe('true');
  });

  it('should show no bar for an element that does not overflow', () => {
    const fixture = render({ clientWidth: 400, clientHeight: 300, scrollWidth: 400, scrollHeight: 300 });

    expect(shown(fixture, 'vertical')).toBe(false);
    expect(shown(fixture, 'horizontal')).toBe(false);
  });

  it('should show a vertical bar sized to the content', () => {
    const fixture = render({ clientWidth: 400, clientHeight: 300, scrollWidth: 400, scrollHeight: 900 });

    expect(shown(fixture, 'vertical')).toBe(true);
    expect(track(fixture, 'vertical').style.height).toBe('300px');
    expect(thumb(fixture, 'vertical').style.height).toBe('100px');
    expect(thumb(fixture, 'vertical').style.top).toBe('0px');

    // Nothing overflows sideways, so the second bar stays out of it.
    expect(shown(fixture, 'horizontal')).toBe(false);
  });

  it('should follow the element as it scrolls', () => {
    const fixture = render({ clientWidth: 400, clientHeight: 300, scrollWidth: 400, scrollHeight: 900 });

    scrollTo(fixture, { scrollTop: 600 });

    expect(thumb(fixture, 'vertical').style.top).toBe('200px');
  });

  it("should keep the two bars out of each other's corner", () => {
    const fixture = render({ clientWidth: 400, clientHeight: 300, scrollWidth: 800, scrollHeight: 900 });

    // Each track gives up the bar's thickness to the other, so the two never cross in the corner.
    expect(track(fixture, 'vertical').style.height).toBe('290px');
    expect(track(fixture, 'horizontal').style.width).toBe('390px');

    expect(thumb(fixture, 'vertical').style.height).toBe('97px');
    expect(thumb(fixture, 'horizontal').style.width).toBe('195px');
  });

  it('should redraw when the content grows without anything changing size', () => {
    const fixture = render({ clientWidth: 400, clientHeight: 300, scrollWidth: 400, scrollHeight: 300 });

    expect(shown(fixture, 'vertical')).toBe(false);

    // What typing into a textarea does: its own content gets taller, no element resizes.
    layout(target(fixture), { scrollHeight: 900 });
    target(fixture).dispatchEvent(new Event('input'));
    TestBed.tick();

    expect(shown(fixture, 'vertical')).toBe(true);
  });

  it("should lay the bars over the element's padding box, not its border", () => {
    const fixture = render({ clientWidth: 400, clientHeight: 300, clientTop: 2, clientLeft: 3 });

    target(fixture).getBoundingClientRect = () => ({ top: 40, left: 60 }) as DOMRect;
    target(fixture).dispatchEvent(new Event('scroll'));
    TestBed.tick();

    // Where a native bar sits too. Measuring from the border box instead would draw the bar on top
    // of the element's own outline.
    const style = fixture.nativeElement.querySelector('app-scroll-bar').style;
    expect([style.top, style.left]).toEqual(['42px', '63px']);
    expect([style.width, style.height]).toEqual(['400px', '300px']);
  });

  it('should draw its bar the moment it appears, without waiting for an event', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.show.set(false);
    TestBed.tick();

    layout(target(fixture), { clientWidth: 400, clientHeight: 300, scrollWidth: 400, scrollHeight: 900 });

    fixture.componentInstance.show.set(true);
    TestBed.tick();

    // Nothing scrolled and nothing resized — the element was already overflowing when the bar
    // arrived, which is the ordinary case for a table that is rendered full.
    expect(shown(fixture, 'vertical')).toBe(true);
    expect(thumb(fixture, 'vertical').style.height).toBe('100px');
  });
});
