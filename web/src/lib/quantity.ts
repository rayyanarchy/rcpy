import type { Unit } from "./types";

// Turn what a cook types ("1 1/2 tbsp", "15-20 cloves", "to taste") into the
// numeric amount and unit Crouton needs, keeping the text as typed for display.

const UNITS: [RegExp, Unit][] = [
  [/^(tbsp|tbs|tablespoons?|bada chammach)\b/, "TABLESPOON"],
  [/^(tsp|teaspoons?|chota chammach)\b/, "TEASPOON"],
  [/^(cups?|katori)\b/, "CUP"],
  [/^(kg|kgs|kilo|kilos|kilograms?)\b/, "KILOGRAM"],
  [/^(g|gm|gms|grams?)\b/, "GRAM"],
  [/^(ml|milliliters?|millilitres?)\b/, "MILLILITER"],
  [/^(l|liters?|litres?)\b/, "LITER"],
  [/^(oz|ounces?)\b/, "OUNCE"],
  [/^(lb|lbs|pounds?)\b/, "POUND"],
];

const FRACTIONS: Record<string, number> = { "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅛": 0.125 };
const WORDS: Record<string, number> = {
  half: 0.5, adha: 0.5, aadha: 0.5, quarter: 0.25, pav: 0.25,
  one: 1, a: 1, an: 1, ek: 1, two: 2, do: 2, three: 3, teen: 3, four: 4, char: 4, five: 5, paanch: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, dedh: 1.5, dhai: 2.5,
};

// "1 1/2", "1½", "0.5", "3/4", "15-20" (a range: the lower end is the amount), or a number word.
const NUMBER = /^(\d+(?:\.\d+)?)?\s*(?:(\d+)\/(\d+)|([½⅓⅔¼¾⅛]))?(?:\s*(?:-|–|to)\s*\d+(?:\.\d+)?)?/;

export function parseQuantity(text: string): { amount: number | null; unit: Unit } {
  let rest = text.trim().toLowerCase();
  let amount: number | null = null;

  const match = NUMBER.exec(rest);
  if (match && match[0].trim()) {
    const [whole, , num, den, glyph] = match;
    amount = Number(match[1] ?? 0);
    if (num && den && Number(den) !== 0) amount += Number(num) / Number(den);
    if (glyph) amount += FRACTIONS[glyph];
    rest = rest.slice(whole.length).trim();
  } else {
    const word = /^([a-z]+)\b/.exec(rest);
    if (word && word[1] in WORDS) {
      amount = WORDS[word[1]];
      rest = rest.slice(word[0].length).trim().replace(/^(a|an)\s+/, "");
    }
  }
  if (amount === null) return { amount: null, unit: "ITEM" };

  const unit = UNITS.find(([pattern]) => pattern.test(rest))?.[1];
  // "a" or "an" only counts as one when a unit follows: "a teaspoon", not "a little".
  if (!unit && /^(a|an)\b/.test(text.trim().toLowerCase())) return { amount: null, unit: "ITEM" };
  return { amount: Math.round(amount * 1000) / 1000, unit: unit ?? "ITEM" };
}
