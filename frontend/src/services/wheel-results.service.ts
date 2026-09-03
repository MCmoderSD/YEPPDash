import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';
import { parseWheelResults, WheelResult } from '../data/wheel-result';

function storageKey(wheelId: string): string {
  return `yeppdash.wheel-results.${wheelId}`;
}

@Service()
export class WheelResultsService {

  private readonly storage: Storage | undefined = inject(DOCUMENT).defaultView?.localStorage;

  list(wheelId: string): WheelResult[] {
    return parseWheelResults(this.storage?.getItem(storageKey(wheelId)) ?? null);
  }

  record(wheelId: string, label: string): WheelResult[] {
    const results: WheelResult[] = [...this.list(wheelId), { label, wonAt: new Date().toISOString() }];

    this.save(wheelId, results);
    return results;
  }

  clear(wheelId: string): WheelResult[] {
    this.storage?.removeItem(storageKey(wheelId));
    return [];
  }

  private save(wheelId: string, results: WheelResult[]): void {
    try {
      this.storage?.setItem(storageKey(wheelId), JSON.stringify(results));
    } catch {
      // A full quota or storage refused outright by the browser leaves the result on screen for the
      // rest of the session either way, so there is nothing further to do about to write itself.
    }
  }
}