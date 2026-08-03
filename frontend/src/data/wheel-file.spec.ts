import { parseWheelFile, WHEEL_MAX_SLICES, wheelFileContent } from './wheel-entry';

describe('wheelFileContent', () => {
  it('should write one entry per line', () => {
    expect(wheelFileContent(['Ali', 'Beatriz'])).toBe('Ali\nBeatriz');
  });

  it('should be empty for an empty wheel', () => {
    expect(wheelFileContent([])).toBe('');
  });
});

describe('parseWheelFile', () => {
  it('should read one entry per line', () => {
    expect(parseWheelFile('Ali\nBeatriz\nCharles').entries).toEqual(['Ali', 'Beatriz', 'Charles']);
  });

  // A file written on Windows — which is where OBS mostly runs — ends its lines with both.
  it('should read a file with Windows line endings', () => {
    expect(parseWheelFile('Ali\r\nBeatriz\r\n').entries).toEqual(['Ali', 'Beatriz']);
  });

  it('should ignore blank lines and surrounding space', () => {
    expect(parseWheelFile('  Ali  \n\n\n Beatriz\n').entries).toEqual(['Ali', 'Beatriz']);
  });

  it('should keep a repeated name as two entries', () => {
    expect(parseWheelFile('Ali\nBeatriz\nAli').entries).toEqual(['Ali', 'Beatriz', 'Ali']);
  });

  // Dropped rather than split, so an imported name is never silently turned into two.
  it('should refuse a line containing a comma and say which it was', () => {
    const parsed = parseWheelFile('Ali\nBeatriz, the second\nCharles');

    expect(parsed.entries).toEqual(['Ali', 'Charles']);
    expect(parsed.rejected).toEqual(['Beatriz, the second']);
  });

  it('should stop at the number of slices a wheel can hold', () => {
    const many = Array.from({ length: WHEEL_MAX_SLICES + 20 }, (_value, index) => `Entry ${index}`);
    const parsed = parseWheelFile(many.join('\n'));

    expect(parsed.entries).toHaveLength(WHEEL_MAX_SLICES);
    expect(parsed.rejected).toHaveLength(20);
  });

  it('should survive a round trip through the file format', () => {
    const entries = ['Ali', 'Ali', 'Beatriz'];

    expect(parseWheelFile(wheelFileContent(entries)).entries).toEqual(entries);
  });

  it('should find nothing in an empty file', () => {
    expect(parseWheelFile('').entries).toEqual([]);
  });
});