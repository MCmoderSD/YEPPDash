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

export interface BdsmTraitScore {
  key: BdsmTraitKey;
  label: string;
  score: number;
  percent: number;
  color: string;
}

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

export function traitColor(score: number): string {
  const bounded: number = Math.min(1, Math.max(0, score));
  return `hsl(${Math.round(bounded * 120)} 80% 66%)`;
}

export function traitScores(result: BdsmResult): BdsmTraitScore[] {
  return BDSM_TRAITS.map((trait): BdsmTraitScore => {
    const score: number = result.traits[trait.key];

    return {
      key: trait.key,
      label: trait.label,
      score,
      percent: Math.round(score * 100),
      color: traitColor(score),
    };
  });
}

export function topTraits(result: BdsmResult, count: number): BdsmTraitScore[] {
  return traitScores(result)
    .map((trait, index): [BdsmTraitScore, number] => [trait, index])
    .sort(([left, leftIndex], [right, rightIndex]) => right.score - left.score || leftIndex - rightIndex)
    .slice(0, count)
    .map(([trait]) => trait);
}

export function rankedTraits(result: BdsmResult): BdsmTraitScore[] {
  return topTraits(result, BDSM_TRAITS.length);
}

export function dominantTrait(result: BdsmResult): BdsmTraitScore | null {
  return topTraits(result, 1)[0] ?? null;
}

export function resultTakenAt(result: BdsmResult): Date {
  return new Date(result.timestamp);
}