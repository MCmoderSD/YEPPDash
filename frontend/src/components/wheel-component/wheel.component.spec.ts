import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  fitLabel,
  restRotation,
  sliceAtPointer,
  squeezeLabels,
  WheelComponent,
  wheelFontSize,
  wheelSectors,
  WheelSpin,
} from './wheel.component';

// jsdom lays nothing out, so the width of a label is whatever a test says it is.
function measurable(width: number): SVGTextElement {
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  (label as SVGTextElement).getComputedTextLength = (): number => width;

  return label;
}

describe('wheelSectors', () => {
  it('should build one sector per slice', () => {
    expect(wheelSectors(['Ali', 'Beatriz', 'Charles'])).toHaveLength(3);
  });

  it('should share the circle out evenly', () => {
    const angles = wheelSectors(['Ali', 'Beatriz', 'Charles', 'Diya'])
      .map((sector) => sector.angle);

    expect(angles).toEqual([45, 135, 225, 315]);
  });

  // Neighbouring wedges in the same colour read as one wedge, and the last one touches the first.
  it('should never colour two touching slices the same', () => {
    for (let count = 2; count <= 24; count++) {
      const fills = wheelSectors(Array.from({ length: count }, (_value, index) => `${index}`))
        .map((sector) => sector.fill);

      for (let index = 0; index < count; index++) {
        expect(fills[index]).not.toBe(fills[(index + 1) % count]);
      }
    }
  });

  it('should draw a lone entry as the whole disc', () => {
    const [only] = wheelSectors(['Ali']);

    // A wedge is drawn from the centre outwards; a full circle is two arcs and no centre at all.
    expect(only.path.startsWith('M 50 50 L')).toBe(false);
    expect(only.path.split('A')).toHaveLength(3);
  });
});

describe('wheelFontSize', () => {
  it('should shrink as slices are added', () => {
    expect(wheelFontSize(40)).toBeLessThan(wheelFontSize(10));
  });

  it('should stay readable however many entries there are', () => {
    expect(wheelFontSize(500)).toBeGreaterThanOrEqual(1.6);
  });
});

describe('fitLabel', () => {
  it('should leave a short label alone', () => {
    expect(fitLabel('Ali', 6.5)).toEqual({ text: 'Ali', fontSize: 6.5 });
  });

  it('should shrink a long label rather than cut it', () => {
    const fitted = fitLabel('Bartholomew', 6.5);

    expect(fitted.text).toBe('Bartholomew');
    expect(fitted.fontSize).toBeLessThan(6.5);
  });

  it('should cut a label that no longer fits even shrunk', () => {
    const fitted = fitLabel('x'.repeat(60), 6.5);

    expect(fitted.text.length).toBeLessThan(60);
    expect(fitted.text.endsWith('…')).toBe(true);
  });
});

describe('squeezeLabels', () => {
  // The estimate the font size is picked from assumes an average character; a name in wide letters
  // beats it and would otherwise run through the hub and out the far side of the wheel.
  it('should squeeze a label that turns out wider than the room it has', () => {
    const label = measurable(80);

    squeezeLabels([label]);

    expect(label.getAttribute('textLength')).toBe('35');
    expect(label.getAttribute('lengthAdjust')).toBe('spacingAndGlyphs');
  });

  it('should leave a label that fits exactly as it is', () => {
    const label = measurable(20);

    squeezeLabels([label]);

    expect(label.getAttribute('textLength')).toBeNull();
  });

  // The elements are reused as the list changes, so a squeeze left on one would stretch the next
  // name out to fill the same room.
  it('should lift the squeeze once the label fits again', () => {
    const label = measurable(80);
    squeezeLabels([label]);

    label.getComputedTextLength = (): number => 20;
    squeezeLabels([label]);

    expect(label.getAttribute('textLength')).toBeNull();
    expect(label.getAttribute('lengthAdjust')).toBeNull();
  });

  // Nothing measures on the server, and a wheel that threw there would take the page with it.
  it('should do nothing where there is nothing to measure with', () => {
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text') as SVGTextElement;

    expect((): void => squeezeLabels([label])).not.toThrow();
    expect(label.getAttribute('textLength')).toBeNull();
  });
});

describe('sliceAtPointer', () => {
  it('should name the slice the pointer is over', () => {
    // Four slices of 90°, laid out clockwise from the pointer at 3 o'clock.
    expect(sliceAtPointer(0, 4)).toBe(0);
    expect(sliceAtPointer(-100, 4)).toBe(1);
    expect(sliceAtPointer(-190, 4)).toBe(2);
    expect(sliceAtPointer(-280, 4)).toBe(3);
  });

  it('should keep counting through however many turns the wheel has made', () => {
    expect(sliceAtPointer(-100 - 360 * 6, 4)).toBe(1);

    // Turned the other way: +100° puts the slice 260° round the wheel under the pointer.
    expect(sliceAtPointer(100, 4)).toBe(2);
  });

  it('should have nothing to name on an empty wheel', () => {
    expect(sliceAtPointer(0, 0)).toBe(-1);
  });
});

describe('restRotation', () => {
  function underPointer(rotation: number, count: number): number {
    // The pointer sits at 0°, so the slice it covers is the one the wheel turned into that spot.
    const local = (((-rotation % 360) + 360) % 360);

    return Math.floor(local / (360 / count));
  }

  it('should stop with the chosen slice under the pointer', () => {
    const count = 8;

    for (let index = 0; index < count; index++) {
      for (const jitter of [0, 0.25, 0.5, 0.75, 0.999]) {
        expect(underPointer(restRotation(0, index, count, jitter), count)).toBe(index);
      }
    }
  });

  it('should still land right when the wheel is already turned', () => {
    expect(underPointer(restRotation(1234.5, 3, 8, 0.5), 8)).toBe(3);
  });

  it('should always turn forwards by at least a few full turns', () => {
    expect(restRotation(0, 0, 8, 0.5)).toBeGreaterThanOrEqual(360 * 5);
  });

  it('should handle a wheel with a single slice', () => {
    expect(underPointer(restRotation(0, 0, 1, 0.5), 1)).toBe(0);
  });
});

describe('WheelComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [WheelComponent] }).compileComponents();
  });

  function render(slices: string[]): ComponentFixture<WheelComponent> {
    const fixture = TestBed.createComponent(WheelComponent);

    fixture.componentRef.setInput('slices', slices);
    fixture.detectChanges();

    return fixture;
  }

  function disc(fixture: ComponentFixture<WheelComponent>): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector('.wheel-disc') as HTMLElement;
  }

  function stop(fixture: ComponentFixture<WheelComponent>): void {
    disc(fixture).dispatchEvent(new Event('transitionend'));
    fixture.detectChanges();
  }

  it('should draw a wedge per slice', () => {
    const fixture = render(['Ali', 'Beatriz', 'Charles']);

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.wheel-slice')).toHaveLength(3);
  });

  // The same name twice is two slices, and both of them say the name.
  it('should label every copy of a doubled entry', () => {
    const fixture = render(['Ali', 'Beatriz', 'Ali']);

    const labels = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.wheel-label'))
      .map((label) => label.textContent);

    expect(labels).toEqual(['Ali', 'Beatriz', 'Ali']);
  });

  // The label is anchored at its end and reads inwards, so that end has to sit out by the rim. Put
  // it anywhere near the middle and the name runs off towards the far side and under the hub.
  it('should hang every label off the rim rather than the centre', () => {
    const fixture = render(['Ali', 'Beatriz', 'Charles']);

    for (const label of (fixture.nativeElement as HTMLElement).querySelectorAll('.wheel-label')) {
      const end = Number(label.getAttribute('x'));
      const start = end - Number(label.getAttribute('font-size')) * label.textContent!.length * 0.6;

      // Between the edge of the hub and the rim: the wheel is drawn in a 100x100 box centred on 50,
      // and the hub covers the middle 18% of it.
      expect(end).toBeLessThanOrEqual(99);
      expect(start).toBeGreaterThan(59);
    }
  });

  it('should name the entries for a screen reader instead of the shapes', () => {
    const fixture = render(['Ali', 'Beatriz']);
    const face = (fixture.nativeElement as HTMLElement).querySelector('.wheel-face');

    expect(face?.getAttribute('role')).toBe('img');
    expect(face?.getAttribute('aria-label')).toBe('Wheel with 2 slices: Ali, Beatriz');
  });

  it('should announce the winner only once the wheel has stopped', () => {
    const fixture = render(['Ali', 'Beatriz', 'Charles']);
    const spins: WheelSpin[] = [];
    fixture.componentInstance.spun.subscribe((spin: WheelSpin): number => spins.push(spin));

    fixture.componentInstance.spin(1);
    fixture.detectChanges();

    expect(spins).toEqual([]);
    expect(fixture.componentInstance.spinning()).toBe(true);

    stop(fixture);

    expect(spins).toEqual([{ index: 1, label: 'Beatriz' }]);
    expect(fixture.componentInstance.spinning()).toBe(false);
  });

  it('should turn the disc to bring the winner under the pointer', () => {
    const fixture = render(['Ali', 'Beatriz', 'Charles', 'Diya']);

    fixture.componentInstance.spin(2);
    fixture.detectChanges();

    const rotation = Number(/rotate\((-?[\d.]+)deg\)/.exec(disc(fixture).style.transform)?.[1]);
    const local = (((-rotation % 360) + 360) % 360);

    expect(Math.floor(local / 90)).toBe(2);
  });

  // A second click while it is still turning would move the target out from under the winner that
  // was already picked.
  it('should ignore a spin while one is running', () => {
    const fixture = render(['Ali', 'Beatriz']);
    const spins: WheelSpin[] = [];
    fixture.componentInstance.spun.subscribe((spin: WheelSpin): number => spins.push(spin));

    fixture.componentInstance.spin(0);
    fixture.componentInstance.spin(1);
    fixture.detectChanges();
    stop(fixture);

    expect(spins).toEqual([{ index: 0, label: 'Ali' }]);
  });

  // transitionend bubbles: a transition on anything drawn inside the disc must not be taken for the
  // disc coming to a stop.
  it('should ignore a transition that ended somewhere inside the wheel', () => {
    const fixture = render(['Ali', 'Beatriz', 'Charles']);
    const spins: WheelSpin[] = [];
    fixture.componentInstance.spun.subscribe((spin: WheelSpin): number => spins.push(spin));

    fixture.componentInstance.spin(1);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector('.wheel-slice')!
      .dispatchEvent(new Event('transitionend', { bubbles: true }));
    fixture.detectChanges();

    expect(spins).toEqual([]);
    expect(fixture.componentInstance.spinning()).toBe(true);

    stop(fixture);

    expect(spins).toEqual([{ index: 1, label: 'Beatriz' }]);
  });

  it('should not announce anything for a stray transition on a wheel that is standing still', () => {
    const fixture = render(['Ali', 'Beatriz']);
    const spins: WheelSpin[] = [];
    fixture.componentInstance.spun.subscribe((spin: WheelSpin): number => spins.push(spin));

    stop(fixture);

    expect(spins).toEqual([]);
  });

  // Nothing left in the middle to cover the point where the slices meet.
  it('should draw no hub', () => {
    const fixture = render(['Ali', 'Beatriz']);

    expect((fixture.nativeElement as HTMLElement).querySelector('.wheel-hub')).toBeNull();
  });

  describe('pointer', () => {
    function pointerFill(fixture: ComponentFixture<WheelComponent>): string | null {
      return (fixture.nativeElement as HTMLElement)
        .querySelector('.wheel-pointer polygon')!.getAttribute('fill');
    }

    // It says which slice it means, so it has to be that slice's colour rather than a colour of
    // its own sitting on top of the wheel.
    it('should take the colour of the slice under it', () => {
      const fixture = render(['Ali', 'Beatriz', 'Charles', 'Diya']);

      expect(pointerFill(fixture)).toBe(wheelSectors(['Ali', 'Beatriz', 'Charles', 'Diya'])[0].fill);
    });

    it('should follow the wheel round to the slice it stopped on', () => {
      const labels = ['Ali', 'Beatriz', 'Charles', 'Diya'];
      const fixture = render(labels);

      fixture.componentInstance.spin(2);
      fixture.detectChanges();
      stop(fixture);

      expect(pointerFill(fixture)).toBe(wheelSectors(labels)[2].fill);
    });

    it('should have a colour of its own while there is no wheel under it', () => {
      const fixture = render([]);

      expect(pointerFill(fixture)).toBe('#6b6b73');
    });
  });

  describe('clicking', () => {
    function click(fixture: ComponentFixture<WheelComponent>): void {
      (fixture.nativeElement as HTMLElement).click();
      fixture.detectChanges();
    }

    // The overlay is the reason this is off by default: anyone can open it, and a wheel spun from
    // there would disagree with the dashboard that owns it.
    it('should ignore a click unless it was made interactive', () => {
      const fixture = render(['Ali', 'Beatriz']);
      const asked: number[] = [];
      fixture.componentInstance.spinRequested.subscribe((): number => asked.push(1));

      click(fixture);

      expect(asked).toEqual([]);
    });

    // Asked for rather than done: whoever owns the wheel picks the slice, so that the same one can
    // be handed to every wheel following along.
    it('should ask for a spin when it is interactive', () => {
      const fixture = render(['Ali', 'Beatriz']);
      fixture.componentRef.setInput('interactive', true);
      fixture.detectChanges();

      const asked: number[] = [];
      fixture.componentInstance.spinRequested.subscribe((): number => asked.push(1));

      click(fixture);

      expect(asked).toEqual([1]);
      expect(fixture.componentInstance.spinning()).toBe(false);
    });
  });

  it('should do nothing on an empty wheel', () => {
    const fixture = render([]);

    fixture.componentInstance.spin();
    fixture.detectChanges();

    expect(fixture.componentInstance.spinning()).toBe(false);
  });
});
