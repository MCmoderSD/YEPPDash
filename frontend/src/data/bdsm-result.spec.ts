import {
  BDSM_TRAITS,
  BdsmResult,
  BdsmTraitKey,
  dominantTrait,
  rankedTraits,
  resultTakenAt,
  topTraits,
  traitColor,
  traitLabel,
  traitScores,
} from './bdsm-result';

function hueOf(color: string): number {
  return Number(/^hsl\((\d+)/.exec(color)![1]);
}

function result(scores: Partial<Record<BdsmTraitKey, number>> = {}): BdsmResult {
  const traits = Object.fromEntries(
    BDSM_TRAITS.map((trait) => [trait.key, scores[trait.key] ?? 0]),
  ) as Record<BdsmTraitKey, number>;

  return {
    id: 'abc123',
    userId: '644984959',
    timestamp: '2026-07-31T12:34:56Z',
    version: 3,
    gender: 'Female',
    ageGroup: '23-25',
    traits,
  };
}

describe('BDSM_TRAITS', () => {
  // The keys are the table's column names, so a typo here silently reads undefined off every result.
  it('should declare the twenty-five traits the table stores', () => {
    expect(BDSM_TRAITS.map((trait) => trait.key)).toEqual([
      'ageplayer', 'brat', 'bratTamer', 'daddyMommy', 'degrader', 'dominant', 'degradee', 'little',
      'masochist', 'masterMistress', 'nonMonogamist', 'owner', 'primalHunter', 'pet', 'primalPrey',
      'rigger', 'ropeBunny', 'sadist', 'slave', 'submissive', 'switch', 'vanilla', 'voyeur',
      'exhibitionist', 'experimentalist',
    ]);
  });

  it('should label every trait it declares', () => {
    expect(BDSM_TRAITS.every((trait) => trait.label.length > 0)).toBe(true);
  });
});

describe('traitLabel', () => {
  it('should name a trait the way it is shown', () => {
    expect(traitLabel('masterMistress')).toBe('Master/Mistress');
  });
});

describe('traitScores', () => {
  it('should list every trait in the declared order', () => {
    expect(traitScores(result()).map((trait) => trait.key))
      .toEqual(BDSM_TRAITS.map((trait) => trait.key));
  });

  it('should carry the raw fraction alongside the percentage', () => {
    const scores = traitScores(result({ brat: 0.42 }));
    const brat = scores.find((trait) => trait.key === 'brat');

    expect([brat?.score, brat?.percent]).toEqual([0.42, 42]);
  });

  it('should colour each trait by its own score', () => {
    const scores = traitScores(result({ brat: 1, vanilla: 0 }));

    expect(scores.find((trait) => trait.key === 'brat')?.color).toBe(traitColor(1));
    expect(scores.find((trait) => trait.key === 'vanilla')?.color).toBe(traitColor(0));
  });

  it('should keep the bounds the table enforces', () => {
    const scores = traitScores(result({ switch: 1, vanilla: 0 }));

    expect(scores.find((trait) => trait.key === 'switch')?.percent).toBe(100);
    expect(scores.find((trait) => trait.key === 'vanilla')?.percent).toBe(0);
  });

  // Rounded once, so a caller that sorts on `percent` cannot disagree with what the template shows.
  it('should round the percentage rather than truncate it', () => {
    const scores = traitScores(result({ brat: 0.615, sadist: 0.614 }));

    expect(scores.find((trait) => trait.key === 'brat')?.percent).toBe(62);
    expect(scores.find((trait) => trait.key === 'sadist')?.percent).toBe(61);
  });
});

describe('topTraits', () => {
  it('should list the strongest traits first', () => {
    const strongest = topTraits(result({ brat: 0.9, sadist: 0.7, vanilla: 0.8 }), 3);

    expect(strongest.map((trait) => trait.key)).toEqual(['brat', 'vanilla', 'sadist']);
  });

  it('should take no more than it is asked for', () => {
    expect(topTraits(result({ brat: 0.9, sadist: 0.8 }), 2)).toHaveLength(2);
  });

  it('should cope with being asked for more traits than exist', () => {
    expect(topTraits(result(), 99)).toHaveLength(BDSM_TRAITS.length);
  });

  // Two traits at the same score must not swap places between two renders of the same result.
  it('should break ties by the declared order', () => {
    const tied = topTraits(result({ dominant: 0.5, brat: 0.5, sadist: 0.5 }), 3);

    expect(tied.map((trait) => trait.key)).toEqual(['brat', 'dominant', 'sadist']);
  });
});

describe('traitColor', () => {
  it('should run red at nothing and green at everything', () => {
    expect(hueOf(traitColor(0))).toBe(0);
    expect(hueOf(traitColor(1))).toBe(120);
  });

  it('should sweep the hue in step with the score', () => {
    expect(hueOf(traitColor(0.5))).toBe(60);
    expect(hueOf(traitColor(0.25))).toBeLessThan(hueOf(traitColor(0.75)));
  });

  // A hue past green wraps into blue and would read as a perfectly ordinary colour rather than as
  // the bad data it came from.
  it('should not wrap past either end of the sweep', () => {
    expect(hueOf(traitColor(1.5))).toBe(120);
    expect(hueOf(traitColor(-1))).toBe(0);
  });
});

describe('rankedTraits', () => {
  it('should list every trait, strongest first', () => {
    const ranked = rankedTraits(result({ vanilla: 0.9, brat: 0.1 }));

    expect(ranked).toHaveLength(BDSM_TRAITS.length);
    expect(ranked[0].key).toBe('vanilla');
    expect(ranked.at(-1)?.key).not.toBe('vanilla');
  });
});

describe('dominantTrait', () => {
  it('should name the single strongest trait', () => {
    expect(dominantTrait(result({ brat: 0.4, ropeBunny: 0.95 }))?.key).toBe('ropeBunny');
  });

  // Everything at zero is a real result, not an absent one, so it still has a strongest trait.
  it('should still answer for a result scored zero throughout', () => {
    expect(dominantTrait(result())?.key).toBe('ageplayer');
  });
});

describe('resultTakenAt', () => {
  // The backend stamps the timestamp UTC, so reading it back must not drift by the viewer's offset.
  it('should read the timestamp as the instant the backend sent', () => {
    expect(resultTakenAt(result()).toISOString()).toBe('2026-07-31T12:34:56.000Z');
  });
});
