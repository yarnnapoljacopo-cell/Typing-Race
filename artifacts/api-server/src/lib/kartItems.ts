export type ItemKey =
  | "red_shell" | "green_shell" | "banana" | "star"
  | "blue_shell" | "lightning" | "mushroom" | "mystery_box"
  | "boo" | "golden_pen";

export const ITEM_EMOJIS: Record<ItemKey, string> = {
  red_shell: "🔴", green_shell: "🟢", banana: "🍌", star: "⭐",
  blue_shell: "🔵", lightning: "⚡", mushroom: "🍄", mystery_box: "🎁",
  boo: "👻", golden_pen: "🌟",
};

type ItemWeight = { key: ItemKey; weight: number };

const DROPS_FIRST: ItemWeight[] = [
  { key: "banana", weight: 30 },
  { key: "green_shell", weight: 25 },
  { key: "mushroom", weight: 20 },
  { key: "red_shell", weight: 15 },
  { key: "boo", weight: 10 },
];

const DROPS_MID: ItemWeight[] = [
  { key: "red_shell", weight: 22 },
  { key: "green_shell", weight: 18 },
  { key: "mushroom", weight: 18 },
  { key: "banana", weight: 14 },
  { key: "boo", weight: 12 },
  { key: "mystery_box", weight: 10 },
  { key: "star", weight: 6 },
];

const DROPS_LAST: ItemWeight[] = [
  { key: "blue_shell", weight: 20 },
  { key: "star", weight: 15 },
  { key: "lightning", weight: 15 },
  { key: "mystery_box", weight: 13 },
  { key: "mushroom", weight: 12 },
  { key: "red_shell", weight: 10 },
  { key: "boo", weight: 10 },
  { key: "banana", weight: 5 },
];

const ALL_REGULAR_ITEMS: ItemKey[] = [
  "red_shell", "green_shell", "banana", "star", "blue_shell",
  "lightning", "mushroom", "mystery_box", "boo",
];

function pickFromTable(table: ItemWeight[], goldenPenEligible: boolean): ItemKey {
  const effective = goldenPenEligible
    ? [...table, { key: "golden_pen" as ItemKey, weight: 5 }]
    : table;
  const total = effective.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const entry of effective) {
    r -= entry.weight;
    if (r <= 0) return entry.key;
  }
  return effective[effective.length - 1].key;
}

export function rollItem(
  position: number,
  totalParticipants: number,
  goldenPenAvailable: boolean,
): ItemKey {
  if (totalParticipants <= 1) return pickFromTable(DROPS_MID, false);
  let table: ItemWeight[];
  if (position === 1) table = DROPS_FIRST;
  else if (position === totalParticipants) table = DROPS_LAST;
  else table = DROPS_MID;
  return pickFromTable(table, goldenPenAvailable && position === totalParticipants);
}

export function rollMysteryItems(count: number): ItemKey[] {
  return Array.from({ length: count }, () =>
    ALL_REGULAR_ITEMS[Math.floor(Math.random() * ALL_REGULAR_ITEMS.length)],
  );
}
