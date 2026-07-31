/**
 * The traits a BDSM test scores, in the order the backend reports them.
 *
 * The keys match YEPPBot's BDSM table column for column, so they are what a result is keyed by; the
 * labels are only ever shown.
 */
export const BDSM_TRAITS = [
  { key: 'ageplayer', label: 'Ageplayer' },
  { key: 'brat', label: 'Brat' },
  { key: 'bratTamer', label: 'Brat Tamer' },
  { key: 'daddyMommy', label: 'Daddy/Mommy' },
  { key: 'degrader', label: 'Degrader' },
  { key: 'dominant', label: 'Dominant' },
  { key: 'degradee', label: 'Degradee' },
  { key: 'little', label: 'Little' },
  { key: 'masochist', label: 'Masochist' },
  { key: 'masterMistress', label: 'Master/Mistress' },
  { key: 'nonMonogamist', label: 'Non-monogamist' },
  { key: 'owner', label: 'Owner' },
  { key: 'primalHunter', label: 'Primal (Hunter)' },
  { key: 'pet', label: 'Pet' },
  { key: 'primalPrey', label: 'Primal (Prey)' },
  { key: 'rigger', label: 'Rigger' },
  { key: 'ropeBunny', label: 'Rope Bunny' },
  { key: 'sadist', label: 'Sadist' },
  { key: 'slave', label: 'Slave' },
  { key: 'submissive', label: 'Submissive' },
  { key: 'switch', label: 'Switch' },
  { key: 'vanilla', label: 'Vanilla' },
  { key: 'voyeur', label: 'Voyeur' },
  { key: 'exhibitionist', label: 'Exhibitionist' },
  { key: 'experimentalist', label: 'Experimentalist' },
] as const;

export type BdsmTraitKey = typeof BDSM_TRAITS[number]['key'];

/** One trait of one result, ready to show. `score` is the raw 0–1 fraction. */
export interface BdsmTraitScore {
  key: BdsmTraitKey;
  label: string;
  score: number;
  percent: number;
  color: string;
}

/**
 * One completed test.
 *
 * A user can hold several of these — the table is keyed by the test rather than by the user — so
 * `timestamp` and `version` are what tell two apart. Scores are fractions between 0 and 1; the
 * table's raw payload blob is not carried over the wire.
 */
export interface BdsmResult {
  id: string;
  userId: string;
  timestamp: string;
  version: number;
  gender: string;
  ageGroup: string;
  traits: Record<BdsmTraitKey, number>;
}

const LABELS: ReadonlyMap<BdsmTraitKey, string> = new Map(
  BDSM_TRAITS.map((trait) => [trait.key, trait.label]),
);

export function traitLabel(key: BdsmTraitKey): string {
  return LABELS.get(key) ?? key;
}

/**
 * The colour a score is shown in: red at nothing, green at everything.
 *
 * A straight sweep along the hue circle from 0 to 120 degrees. Lightness is held high enough that
 * every hue on that sweep clears WCAG AA against the dashboard's dark surfaces — the darkest of them
 * is the red end, so that is the one worth re-measuring if these numbers are ever touched. The score
 * is never the only thing carrying a value on screen; the percentage sits next to it as text.
 */
export function traitColor(score: number): string {
  // The table's CHECK constraints keep scores inside 0–1, but a hue is silently wrong rather than
  // obviously wrong if one ever escapes: 1.5 would come out blue and read as a perfectly good colour.
  const bounded: number = Math.min(1, Math.max(0, score));

  return `hsl(${Math.round(bounded * 120)} 80% 66%)`;
}

/** A result's scores as a list, in the order {@link BDSM_TRAITS} declares them. */
export function traitScores(result: BdsmResult): BdsmTraitScore[] {
  return BDSM_TRAITS.map((trait): BdsmTraitScore => {
    const score: number = result.traits[trait.key];

    return {
      key: trait.key,
      label: trait.label,
      score,
      // Rounded here rather than at the template, so the number a caller sorts on is the same one it
      // shows — 0.615 and 0.62 must not swap places between the two.
      percent: Math.round(score * 100),
      color: traitColor(score),
    };
  });
}

/**
 * The `count` traits a result scores highest, strongest first.
 *
 * Ties keep the order {@link BDSM_TRAITS} declares, so a result with several traits at the same score
 * lists them the same way every time rather than however the sort happened to land.
 */
export function topTraits(result: BdsmResult, count: number): BdsmTraitScore[] {
  return traitScores(result)
    .map((trait, index): [BdsmTraitScore, number] => [trait, index])
    .sort(([left, leftIndex], [right, rightIndex]) => right.score - left.score || leftIndex - rightIndex)
    .slice(0, count)
    .map(([trait]) => trait);
}

/** Every trait a result scores, strongest first. */
export function rankedTraits(result: BdsmResult): BdsmTraitScore[] {
  return topTraits(result, BDSM_TRAITS.length);
}

/** The single trait a result scores highest, or `null` for a result with no traits at all. */
export function dominantTrait(result: BdsmResult): BdsmTraitScore | null {
  return topTraits(result, 1)[0] ?? null;
}

export function resultTakenAt(result: BdsmResult): Date {
  return new Date(result.timestamp);
}
