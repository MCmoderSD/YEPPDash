export interface BdsmTrait {
  kink: string;
  name: string;
  percent: number;
}

export interface BdsmTraitScore extends BdsmTrait {
  color: string;
}

export interface BdsmResult {
  id: string;
  userId: string;
  timestamp: string;
  version: number;
  gender: string;
  ageGroup: string;
  language: string;
  traits: BdsmTrait[];
}

export interface BdsmMatchScore {
  userId: string;
  partnerId: string;
  score: number;
}

export function traitColor(percent: number): string {
  const bounded: number = Math.min(100, Math.max(0, percent));
  return `hsl(${Math.round(bounded * 1.2)} 80% 66%)`;
}

export function rankedTraits(result: BdsmResult): BdsmTraitScore[] {
  return result.traits
    .map((trait: BdsmTrait, index: number): [BdsmTraitScore, number] => [{ ...trait, color: traitColor(trait.percent) }, index])
    .sort(([left, leftIndex], [right, rightIndex]) => right.percent - left.percent || leftIndex - rightIndex)
    .map(([trait]) => trait);
}

export function resultTakenAt(result: BdsmResult): Date {
  return new Date(result.timestamp);
}