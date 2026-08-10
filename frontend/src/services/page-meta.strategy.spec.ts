import { Component } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { provideRouter, Routes, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TestBed } from '@angular/core/testing';
import { PageMetaStrategy } from './page-meta.strategy';

@Component({ selector: 'app-blank', template: '' })
class BlankComponent { }

const FALLBACK = 'The document default, read back out of index.html.';

function description(): string | null {
  return TestBed.inject(Meta).getTag('name="description"')?.content ?? null;
}

// A real <meta> tag rather than a spy: the strategy reads its starting value straight from the
// document at construction time, which is what index.html actually gives it in the app. Left in
// place rather than removed after configure() — the strategy only reads it lazily, on the first
// navigation, so removing it any earlier would mean there is nothing left to read. Cleared in
// afterEach instead: Meta.updateTag() creates its own element when none exists yet, and stray ones
// from an earlier test would otherwise sit ahead of this one in document order and win the lookup.
function seedFallback(): void {
  const meta = document.createElement('meta');
  meta.name = 'description';
  meta.content = FALLBACK;
  document.head.appendChild(meta);
}

afterEach(() => {
  document.head.querySelectorAll('meta[name="description"]').forEach((el) => el.remove());
});

async function configure(routes: Routes): Promise<RouterTestingHarness> {
  seedFallback();

  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      { provide: TitleStrategy, useClass: PageMetaStrategy },
    ],
  });

  return RouterTestingHarness.create();
}

describe('PageMetaStrategy', () => {

  it("should use a route's own description", async () => {
    const harness = await configure([
      { path: 'faq', component: BlankComponent, data: { description: 'What the FAQ is about.' } },
    ]);

    await harness.navigateByUrl('/faq');

    expect(description()).toBe('What the FAQ is about.');
  });

  it("should fall back to index.html's description for a route that names none", async () => {
    const harness = await configure([
      { path: 'dash', component: BlankComponent },
    ]);

    await harness.navigateByUrl('/dash');

    expect(description()).toBe(FALLBACK);
  });

  // route.data can carry anything; only an actual string is a description.
  it('should fall back when a route names something other than a string', async () => {
    const harness = await configure([
      { path: 'odd', component: BlankComponent, data: { description: 42 } },
    ]);

    await harness.navigateByUrl('/odd');

    expect(description()).toBe(FALLBACK);
  });

  it('should read the deepest matched route rather than a parent', async () => {
    const harness = await configure([
      {
        path: 'dash',
        component: BlankComponent,
        data: { description: 'The dashboard shell, never actually shown.' },
        children: [{ path: 'commands', component: BlankComponent, data: { description: 'Custom commands.' } }],
      },
    ]);

    await harness.navigateByUrl('/dash/commands');

    expect(description()).toBe('Custom commands.');
  });

  it('should replace the previous description on a second navigation', async () => {
    const harness = await configure([
      { path: 'faq', component: BlankComponent, data: { description: 'FAQ description.' } },
      { path: 'privacy', component: BlankComponent, data: { description: 'Privacy description.' } },
    ]);

    await harness.navigateByUrl('/faq');
    expect(description()).toBe('FAQ description.');

    await harness.navigateByUrl('/privacy');
    expect(description()).toBe('Privacy description.');
  });

  it('should still set the document title, same as the strategy it replaces', async () => {
    const harness = await configure([
      { path: 'faq', component: BlankComponent, title: 'FAQ', data: { description: 'FAQ description.' } },
    ]);

    await harness.navigateByUrl('/faq');

    expect(document.title).toBe('FAQ');
  });
});
