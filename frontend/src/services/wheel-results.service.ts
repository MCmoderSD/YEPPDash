import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';
import { parseWheelResults, WheelResult } from '../data/wheel-result';

function storageKey(channelId: string): string {
  return `yeppdash.wheel-results.${channelId}`;
}

// Kept in the browser's own storage rather than sent to the server: unlike the wheel itself, which
// has to reach the OBS overlay running elsewhere, a result only has to be read back on the machine
// that recorded it.
@Service()
export class WheelResultsService {

  // Undefined on the server, where prerendering runs this with no window at all, and in a browser
  // that has disabled storage — both are read as an empty history rather than a crash.
  private readonly storage: Storage | undefined = inject(DOCUMENT).defaultView?.localStorage;

  list(channelId: string): WheelResult[] {
    return parseWheelResults(this.storage?.getItem(storageKey(channelId)) ?? null);
  }

  record(channelId: string, label: string): WheelResult[] {
    const results: WheelResult[] = [...this.list(channelId), { label, wonAt: new Date().toISOString() }];

    this.save(channelId, results);
    return results;
  }

  clear(channelId: string): WheelResult[] {
    this.storage?.removeItem(storageKey(channelId));
    return [];
  }

  private save(channelId: string, results: WheelResult[]): void {
    try {
      this.storage?.setItem(storageKey(channelId), JSON.stringify(results));
    } catch {
      // A full quota or storage refused outright by the browser leaves the result on screen for the
      // rest of the session either way, so there is nothing further to do about the write itself.
    }
  }
}
