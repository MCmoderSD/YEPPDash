import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BadgeComponent } from './badge.component';
import { BadgePreset, BadgeSize } from '../../data/badge';

describe('BadgeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BadgeComponent] }).compileComponents();
  });

  function render(inputs: {
    preset?: BadgePreset;
    size?: BadgeSize;
    icon?: string;
    label?: string;
  }): ComponentFixture<BadgeComponent> {
    const fixture = TestBed.createComponent(BadgeComponent);

    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }

    fixture.detectChanges();
    return fixture;
  }

  function image(fixture: ComponentFixture<BadgeComponent>): HTMLImageElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLImageElement>('.badge-icon');
  }

  function label(fixture: ComponentFixture<BadgeComponent>): string | null {
    return (fixture.nativeElement as HTMLElement)
      .querySelector('.badge-label')?.textContent?.trim() ?? null;
  }

  it('should name the preset it was given', () => {
    expect(label(render({ preset: BadgePreset.Moderator }))).toBe('Moderator');
  });

  it('should show the preset icon at the small size without being asked for one', () => {
    const fixture = render({ preset: BadgePreset.Vip });

    expect(image(fixture)!.getAttribute('src')).toBe('/VIP-18px.png');
    expect(image(fixture)!.width).toBe(18);
    expect(image(fixture)!.height).toBe(18);
  });

  it('should reach for the asset of the size it was given', () => {
    expect(image(render({ preset: BadgePreset.Artist, size: BadgeSize.Medium }))!.getAttribute('src'))
      .toBe('/Artist-36px.png');

    expect(image(render({ preset: BadgePreset.Artist, size: BadgeSize.Large }))!.getAttribute('src'))
      .toBe('/Artist-72px.png');
  });

  // The enum value is the pixel size the assets are named after, so a renumbered member would
  // silently reach for a file that does not exist.
  it('should carry a pixel size on every name', () => {
    expect([BadgeSize.Small, BadgeSize.Medium, BadgeSize.Large]).toEqual([18, 36, 72]);
  });

  // The assets hyphenate a preset whose name is two words.
  it('should find the asset of a two-word preset', () => {
    expect(image(render({ preset: BadgePreset.LeadModerator }))!.getAttribute('src'))
      .toBe('/Lead-Moderator-18px.png');
  });

  it('should offer every preset the dashboard names', () => {
    const named = [
      BadgePreset.Prime,
      BadgePreset.Verified,
      BadgePreset.Artist,
      BadgePreset.Vip,
      BadgePreset.Moderator,
      BadgePreset.LeadModerator,
      BadgePreset.Broadcaster,
    ];

    expect(named.map((preset) => label(render({ preset })))).toEqual([
      'Prime', 'Verified', 'Artist', 'VIP', 'Moderator', 'Lead Moderator', 'Broadcaster',
    ]);
  });

  it('should take a custom icon over the preset one', () => {
    const fixture = render({ preset: BadgePreset.Vip, icon: '/custom.png' });

    expect(image(fixture)!.getAttribute('src')).toBe('/custom.png');
  });

  // Whatever it is drawn at, a custom icon is held to the badge's own size.
  it('should force a custom icon to the size of the badge', () => {
    const fixture = render({ icon: '/custom.png', size: BadgeSize.Large });

    expect(image(fixture)!.width).toBe(72);
    expect(image(fixture)!.height).toBe(72);
  });

  it('should take a custom label over the preset name', () => {
    expect(label(render({ preset: BadgePreset.Moderator, label: 'Editor' }))).toBe('Editor');
  });

  it('should carry a custom label on its own', () => {
    const fixture = render({ label: 'Editor' });

    expect(label(fixture)).toBe('Editor');
    expect(image(fixture)).toBeNull();
  });

  it('should carry an icon with no label at all', () => {
    const fixture = render({ icon: '/custom.png' });

    expect(label(fixture)).toBeNull();
    expect(image(fixture)!.getAttribute('src')).toBe('/custom.png');
    expect((fixture.nativeElement as HTMLElement).classList).toContain('badge-icon-only');
  });

  // Lazy is NgOptimizedImage's default and it is what made the icons pop in a moment after the
  // badge around them was already drawn.
  it('should load the icon eagerly', () => {
    expect(image(render({ preset: BadgePreset.Moderator }))!.getAttribute('loading')).toBe('eager');
  });

  // The label beside it already says what the badge is, so the icon would only repeat it.
  it('should keep the icon out of the accessibility tree', () => {
    expect(image(render({ preset: BadgePreset.Moderator }))!.getAttribute('alt')).toBe('');
  });

  it('should size itself from the size it was given', () => {
    const host = render({ preset: BadgePreset.Vip, size: BadgeSize.Medium }).nativeElement as HTMLElement;

    expect(host.style.getPropertyValue('--badge-size')).toBe('36px');
  });

  it('should follow a preset it is handed later', () => {
    const fixture = render({ preset: BadgePreset.Vip });

    fixture.componentRef.setInput('preset', BadgePreset.Broadcaster);
    fixture.detectChanges();

    expect(label(fixture)).toBe('Broadcaster');
    expect(image(fixture)!.getAttribute('src')).toBe('/Broadcaster-18px.png');
  });
});
