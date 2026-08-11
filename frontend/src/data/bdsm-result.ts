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
  // Whole percentages, the way BDSMTest.org reports them.
  traits: Record<BdsmTraitKey, number>;
}

export interface BdsmMatchScore {
  userId: string;
  partnerId: string;
  // Whole percent, the way BDSMTest.org reports compatibility.
  score: number;
}

export function traitColor(percent: number): string {
  const bounded: number = Math.min(100, Math.max(0, percent));
  return `hsl(${Math.round(bounded * 1.2)} 80% 66%)`;
}

export function traitScores(result: BdsmResult): BdsmTraitScore[] {
  return BDSM_TRAITS.map((trait): BdsmTraitScore => {
    const percent: number = result.traits[trait.key];

    return {
      key: trait.key,
      label: trait.label,
      percent,
      color: traitColor(percent),
    };
  });
}

export function topTraits(result: BdsmResult, count: number): BdsmTraitScore[] {
  return traitScores(result)
    .map((trait, index): [BdsmTraitScore, number] => [trait, index])
    .sort(([left, leftIndex], [right, rightIndex]) => right.percent - left.percent || leftIndex - rightIndex)
    .slice(0, count)
    .map(([trait]) => trait);
}

export function rankedTraits(result: BdsmResult): BdsmTraitScore[] {
  return topTraits(result, BDSM_TRAITS.length);
}

export function resultTakenAt(result: BdsmResult): Date {
  return new Date(result.timestamp);
}