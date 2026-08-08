import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentsModule } from '../components.module';
import { PageScrollBarComponent } from './page-scroll-bar.component';

// jsdom has no layout and no matchMedia, so both are defined by hand. Whether a browser agrees
// about the geometry is a question for the browser; what is checked here is the decision the
// component makes from the numbers it is given.
function layout(metrics: { scrollHeight?: number; clientHeight?: number; scrollTop?: number }): void {
  for (const [name, value] of Object.entries(metrics)) {
    Object.defineProperty(document.documentElement, name, {
      value, configurable: true, writable: true,
    });
  }
}

function media(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: () => ({
      matches,
      addEventListener: (): void => undefined,
      removeEventListener: (): void => undefined,
    }),
  });
}

describe('PageScrollBarComponent', () => {

  beforeEach(async () => {
    media(false);
    layout({ scrollHeight: 3000, clientHeight: 1000, scrollTop: 0 });

    await TestBed.configureTestingModule({
      imports: [ComponentsModule],
    }).compileComponents();
  });

  function render(): ComponentFixture<PageScrollBarComponent> {
    const fixture = TestBed.createComponent(PageScrollBarComponent);
    TestBed.tick();

    return fixture;
  }

  function host(fixture: ComponentFixture<PageScrollBarComponent>): HTMLElement {
    return fixture.nativeElement;
  }

  function thumb(fixture: ComponentFixture<PageScrollBarComponent>): HTMLElement | null {
    return fixture.nativeElement.querySelector('.page-scroll-bar-thumb');
  }

  function pointerAt(fixture: ComponentFixture<PageScrollBarComponent>, x: number): void {
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: 100 }));
    TestBed.tick();
    fixture.detectChanges();
  }

  it('should size the thumb by how much of the page is on screen', () => {
    const fixture = render();

    // A third of the page is visible, so the thumb covers a third of the track.
    expect(thumb(fixture)?.style.height).toBe('333px');
  });

  it('should draw no bar for a page that fits', () => {
    layout({ scrollHeight: 1000, clientHeight: 1000 });

    expect(thumb(render())).toBeNull();
  });

  it('should draw no bar where there is no pointer to reveal it with', () => {
    // A touch screen scrolls the content directly and has nothing that could reach the edge, so the
    // bar would be dead weight floating over the page.
    media(true);

    expect(thumb(render())).toBeNull();
  });

  it('should stay out of sight until the pointer comes to the edge', () => {
    const fixture = render();

    pointerAt(fixture, 300);
    expect(host(fixture).classList.contains('page-scroll-bar-revealed')).toBe(false);

    // window.innerWidth is 1024 in jsdom, so this is 4px from the right edge.
    pointerAt(fixture, 1020);
    expect(host(fixture).classList.contains('page-scroll-bar-revealed')).toBe(true);
  });

  it('should put the bar away once the pointer leaves the window', () => {
    const fixture = render();

    pointerAt(fixture, 1020);
    expect(host(fixture).classList.contains('page-scroll-bar-revealed')).toBe(true);

    // Otherwise the last position — inside the reveal zone — would linger forever, since no
    // further move fires to correct it.
    document.dispatchEvent(new MouseEvent('pointerleave'));
    TestBed.tick();
    fixture.detectChanges();

    expect(host(fixture).classList.contains('page-scroll-bar-revealed')).toBe(false);
  });

  it('should stay out of the accessibility tree', () => {
    // It only restates scrolling the page already offers natively.
    expect(host(render()).getAttribute('aria-hidden')).toBe('true');
  });
});