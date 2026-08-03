import {
  addEntry,
  cleanLabel,
  entriesFrom,
  entryText,
  flattenEntries,
  hasSeparator,
  removeEntry,
  removeOne,
  shuffleEntries,
  sliceCount,
  slicesFrom,
  sortEntries,
  WHEEL_LABEL_MAX_LENGTH,
  WheelEntry,
  wheelSlices,
} from './wheel-entry';

function entries(...pairs: [string, number][]): WheelEntry[] {
  return pairs.map(([label, count]: [string, number]): WheelEntry => ({ label, count }));
}

describe('cleanLabel', () => {
  it('should trim and collapse whitespace', () => {
    expect(cleanLabel('  Ali   B  ')).toBe('Ali B');
  });

  it('should cut a label that would not fit on a slice', () => {
    expect(cleanLabel('x'.repeat(200))).toHaveLength(WHEEL_LABEL_MAX_LENGTH);
  });
});

describe('addEntry', () => {
  it('should append a name that is not on the wheel yet', () => {
    expect(addEntry([], 'Ali')).toEqual(entries(['Ali', 1]));
  });

  // The whole point of counting instead of appending: the table stays one row per name.
  it('should raise the count instead of adding a second row', () => {
    const added = addEntry(addEntry([], 'Ali'), 'Ali');

    expect(added).toEqual(entries(['Ali', 2]));
  });

  it('should treat a differently cased name as the same entry', () => {
    expect(addEntry(entries(['Ali', 1]), 'ALI')).toEqual(entries(['Ali', 2]));
  });

  it('should keep the spelling that was entered first', () => {
    expect(addEntry(entries(['Ali', 1]), 'ali')[0].label).toBe('Ali');
  });

  it('should ignore a label that is only whitespace', () => {
    expect(addEntry([], '   ')).toEqual([]);
  });
});

describe('entryText', () => {
  it('should prefix the count once a name is on the wheel more than once', () => {
    expect(entryText({ label: 'Ali', count: 2 })).toBe('2x Ali');
  });

  it('should show a single entry as just its name', () => {
    expect(entryText({ label: 'Ali', count: 1 })).toBe('Ali');
  });
});

describe('removeOne', () => {
  it('should take one copy off a counted entry', () => {
    expect(removeOne(entries(['Ali', 3]), 'Ali')).toEqual(entries(['Ali', 2]));
  });

  it('should drop the row when the last copy goes', () => {
    expect(removeOne(entries(['Ali', 1], ['Beatriz', 1]), 'Ali')).toEqual(entries(['Beatriz', 1]));
  });
});

describe('removeEntry', () => {
  it('should drop every copy at once', () => {
    expect(removeEntry(entries(['Ali', 4], ['Beatriz', 1]), 'Ali')).toEqual(entries(['Beatriz', 1]));
  });
});

describe('sliceCount', () => {
  it('should count copies rather than rows', () => {
    expect(sliceCount(entries(['Ali', 2], ['Beatriz', 3]))).toBe(5);
  });
});

describe('sortEntries', () => {
  it('should order by name regardless of case', () => {
    const sorted = sortEntries(entries(['charles', 1], ['Ali', 1], ['beatriz', 1]));

    expect(sorted.map((entry: WheelEntry): string => entry.label)).toEqual(['Ali', 'beatriz', 'charles']);
  });

  it('should leave the counts alone', () => {
    expect(sortEntries(entries(['Beatriz', 2], ['Ali', 3]))).toEqual(entries(['Ali', 3], ['Beatriz', 2]));
  });
});

describe('shuffleEntries', () => {
  it('should keep every entry', () => {
    const shuffled = shuffleEntries(entries(['Ali', 1], ['Beatriz', 2], ['Charles', 1]));

    expect(sortEntries(shuffled)).toEqual(entries(['Ali', 1], ['Beatriz', 2], ['Charles', 1]));
  });

  // Fed a fixed sequence rather than Math.random so the result is something to assert on at all.
  it('should reorder the list', () => {
    const draws = [0, 0];
    let next = 0;

    const shuffled = shuffleEntries(
      entries(['Ali', 1], ['Beatriz', 1], ['Charles', 1]),
      (): number => draws[next++],
    );

    expect(shuffled.map((entry: WheelEntry): string => entry.label)).toEqual(['Beatriz', 'Charles', 'Ali']);
  });
});

describe('wheelSlices', () => {
  it('should give one slice per entry when nothing is doubled', () => {
    expect(wheelSlices(entries(['Ali', 1], ['Beatriz', 1]))).toEqual(['Ali', 'Beatriz']);
  });

  // A doubled entry that kept its copies together would just be one wedge of twice the size, which
  // is not what the list says it is.
  it('should spread the copies of a doubled entry across the wheel', () => {
    expect(wheelSlices(entries(['Ali', 2], ['Beatriz', 1], ['Charles', 1])))
      .toEqual(['Ali', 'Beatriz', 'Charles', 'Ali']);
  });

  it('should never put two copies of the same entry next to each other while others are left', () => {
    const slices = wheelSlices(entries(['Ali', 3], ['Beatriz', 3], ['Charles', 2]));

    expect(slices).toEqual(['Ali', 'Beatriz', 'Charles', 'Ali', 'Beatriz', 'Charles', 'Ali', 'Beatriz']);
  });

  it('should hand out as many slices as there are copies', () => {
    const list = entries(['Ali', 5], ['Beatriz', 2]);

    expect(wheelSlices(list)).toHaveLength(sliceCount(list));
  });

  it('should be empty for an empty wheel', () => {
    expect(wheelSlices([])).toEqual([]);
  });
});

describe('hasSeparator', () => {
  // Entries are stored as one comma-joined column, so a comma inside one would come back as two.
  it('should spot a comma in an entry', () => {
    expect(hasSeparator('Ali, the first')).toBe(true);
    expect(hasSeparator('Ali')).toBe(false);
  });
});

describe('flattenEntries', () => {
  it('should write a doubled entry out twice, in table order', () => {
    expect(flattenEntries(entries(['Ali', 2], ['Beatriz', 1]))).toEqual(['Ali', 'Ali', 'Beatriz']);
  });

  // What is stored and exported has no room for a count, so the table has to survive being written
  // out flat and read back.
  it('should survive a round trip through the flat list', () => {
    const list = entries(['Charles', 1], ['Ali', 3], ['Beatriz', 2]);

    expect(entriesFrom(flattenEntries(list))).toEqual(list);
  });
});

describe('entriesFrom', () => {
  it('should fold repeats into a count', () => {
    expect(entriesFrom(['Ali', 'Beatriz', 'Ali'])).toEqual(entries(['Ali', 2], ['Beatriz', 1]));
  });

  it('should keep the order the names first appear in', () => {
    expect(entriesFrom(['Charles', 'Ali']).map((entry: WheelEntry): string => entry.label))
      .toEqual(['Charles', 'Ali']);
  });
});

describe('slicesFrom', () => {
  // The shortcut both pages take: a stored flat list straight to the slices a wheel is drawn from.
  it('should spread a doubled name across the wheel without the table in between', () => {
    expect(slicesFrom(['Ali', 'Ali', 'Beatriz', 'Charles']))
      .toEqual(wheelSlices(entriesFrom(['Ali', 'Ali', 'Beatriz', 'Charles'])));

    expect(slicesFrom(['Ali', 'Ali', 'Beatriz'])).toEqual(['Ali', 'Beatriz', 'Ali']);
  });

  it('should be empty for an empty list', () => {
    expect(slicesFrom([])).toEqual([]);
  });
});
