import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => vi.useRealTimers());

  function messages(): string[] {
    return service.notifications().map((entry) => entry.message);
  }

  // The whole point of replacing MatSnackBar: it dismissed the previous message on every new one,
  // so a burst of clicks silently ate its own feedback.
  it('should keep every message instead of replacing the previous one', () => {
    service.success('first');
    service.success('second');
    service.failure('third');

    expect(messages()).toEqual(['first', 'second', 'third']);
  });

  // Newest last, because the stack is anchored at its bottom edge — so the new one lands at the
  // bottom and pushes the older ones up rather than covering them.
  it('should append the newest message last so the stack grows upwards', () => {
    service.success('older');
    service.success('newer');

    expect(messages().at(-1)).toBe('newer');
  });

  it('should drop the oldest once the cap is reached rather than filling the page', () => {
    for (let i = 1; i <= 7; i++) service.success(`message ${i}`);

    expect(messages()).toEqual(['message 3', 'message 4', 'message 5', 'message 6', 'message 7']);
  });

  it('should retire a confirmation after its lifetime', () => {
    service.success('done');
    expect(messages()).toEqual(['done']);

    vi.advanceTimersByTime(4000);
    expect(messages()).toEqual([]);
  });

  // Failures stay up longer, so a confirmation raised at the same moment must not take them with it.
  it('should keep a failure up after a confirmation has already gone', () => {
    service.failure('broke');
    service.success('fine');

    vi.advanceTimersByTime(4000);
    expect(messages()).toEqual(['broke']);

    vi.advanceTimersByTime(4000);
    expect(messages()).toEqual([]);
  });

  it('should remove only the dismissed message', () => {
    service.success('keep me');
    service.success('drop me');

    const target = service.notifications().find((entry) => entry.message === 'drop me')!;
    service.dismiss(target.id);

    expect(messages()).toEqual(['keep me']);
  });

  it('should not resurrect or error on a message dismissed twice', () => {
    service.success('once');
    const [only] = service.notifications();

    service.dismiss(only.id);
    service.dismiss(only.id);
    vi.advanceTimersByTime(10000);

    expect(messages()).toEqual([]);
  });
});
