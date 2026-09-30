import { describe, expect, it } from "vitest";
import { parseQuantity } from "./quantity";

describe("parseQuantity", () => {
  it.each([
    ["2 tbsp", 2, "TABLESPOON"],
    ["1 1/2 cups", 1.5, "CUP"],
    ["1½ tsp", 1.5, "TEASPOON"],
    ["0.5 kg", 0.5, "KILOGRAM"],
    ["500 g", 500, "GRAM"],
    ["15-20 cloves", 15, "ITEM"],
    ["15–20", 15, "ITEM"],
    ["3 to 4 potatoes", 3, "ITEM"],
    ["half a kilo", 0.5, "KILOGRAM"],
    ["adha kilo", 0.5, "KILOGRAM"],
    ["one teaspoon", 1, "TEASPOON"],
    ["2 katori", 2, "CUP"],
    ["250 ml", 250, "MILLILITER"],
    ["1 l", 1, "LITER"],
    ["a teaspoon", 1, "TEASPOON"],
  ])("%s", (text, amount, unit) => {
    expect(parseQuantity(text)).toEqual({ amount, unit });
  });

  it.each(["to taste", "a little", "some", "", "as needed"])("%s has no amount", (text) => {
    expect(parseQuantity(text)).toEqual({ amount: null, unit: "ITEM" });
  });

  it("does not read a gram unit into words that start with g", () => {
    expect(parseQuantity("2 garlic cloves")).toEqual({ amount: 2, unit: "ITEM" });
  });
});
