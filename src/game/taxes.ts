// The keep's tax rate, Stronghold-style: the player sets how hard the peasants are taxed. Every peasant
// pays the keep's level in gold a minute at the average rate; harder rates bring in more and cost
// happiness, no taxes at all cheers the hold up (happiness.ts). Import-free data.

export const TAX_RATES = ['none', 'low', 'average', 'high', 'cruel'] as const;
export type TaxRate = (typeof TAX_RATES)[number];
export const isTaxRate = (value: unknown): value is TaxRate => (TAX_RATES as readonly unknown[]).includes(value);

/** Each rate: its name, what it brings in (× the average), and what it does to happiness (points a minute). */
export const TAX_INFO: Record<TaxRate, { name: string; gold: number; mood: number; note: string }> = {
  none: { name: 'No taxes', gold: 0, mood: 3, note: 'The hold lives on bounties and barges; the peasants love it.' },
  low: { name: 'Low', gold: 0.5, mood: 1, note: 'Half the usual gold, and the peasants are pleased.' },
  average: { name: 'Average', gold: 1, mood: 0, note: 'A fair tithe: every peasant pays the keep’s level a minute.' },
  high: { name: 'High', gold: 1.5, mood: -3, note: 'Half as much again, grudgingly paid.' },
  cruel: { name: 'Cruel', gold: 2, mood: -6, note: 'Double the gold, and the peasants mutter about leaving.' },
};

export const DEFAULT_TAX_RATE: TaxRate = 'average';
