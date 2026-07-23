import {
  AlertCircle,
  GripVertical,
  Plus,
  Trash2
} from "lucide-react";

const unitOptions = [
  ["ITEM", "item"],
  ["CUP", "cup"],
  ["TABLESPOON", "tablespoon"],
  ["TEASPOON", "teaspoon"],
  ["OUNCE", "ounce"],
  ["POUND", "pound"],
  ["GRAM", "gram"],
  ["KILOGRAM", "kilogram"],
  ["MILLILITER", "milliliter"],
  ["LITER", "liter"]
];

const nullableNumber = (value) =>
  value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;

function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function RecipeEditor({ draft, onChange }) {
  const update = (field, value) => onChange({ ...draft, [field]: value });
  const updateIngredient = (index, field, value) => {
    const ingredients = draft.ingredients.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item
    );
    update("ingredients", ingredients);
  };
  const updateStep = (index, text) => {
    const steps = draft.steps.map((step, stepIndex) =>
      stepIndex === index ? { ...step, text } : step
    );
    update("steps", steps);
  };

  return (
    <div className="recipe-editor">
      <h2>English recipe</h2>
      <Field label="Recipe name">
        <input
          value={draft.name}
          onChange={(event) => update("name", event.target.value)}
          required
        />
      </Field>

      <Field label="Description">
        <textarea
          className="description-input"
          value={draft.description}
          onChange={(event) => update("description", event.target.value)}
          rows="2"
        />
      </Field>

      <div className="timing-fields">
        <Field label="Serves">
          <input
            type="number"
            min="1"
            value={draft.servings ?? ""}
            placeholder="Unknown"
            onChange={(event) =>
              update("servings", nullableNumber(event.target.value))
            }
          />
        </Field>
        <Field label="Prep">
          <div className="input-with-suffix">
            <input
              type="number"
              min="0"
              value={draft.prepMinutes ?? ""}
              placeholder="—"
              onChange={(event) =>
                update("prepMinutes", nullableNumber(event.target.value))
              }
            />
            <span>min</span>
          </div>
        </Field>
        <Field label="Cook">
          <div className="input-with-suffix">
            <input
              type="number"
              min="0"
              value={draft.cookMinutes ?? ""}
              placeholder="—"
              onChange={(event) =>
                update("cookMinutes", nullableNumber(event.target.value))
              }
            />
            <span>min</span>
          </div>
        </Field>
      </div>

      <section className="editor-section">
        <h3>Ingredients</h3>
        <div className="editable-list">
          {draft.ingredients.map((ingredient, index) => (
            <div className="ingredient-row" key={ingredient.id}>
              <GripVertical className="drag-handle" aria-hidden="true" />
              <input
                aria-label={`Ingredient ${index + 1} quantity`}
                value={ingredient.quantity}
                placeholder="Quantity"
                onChange={(event) =>
                  updateIngredient(index, "quantity", event.target.value)
                }
              />
              <input
                className="amount-input"
                aria-label={`Ingredient ${index + 1} numeric amount`}
                type="number"
                min="0"
                step="any"
                value={ingredient.amount ?? ""}
                placeholder="No."
                onChange={(event) =>
                  updateIngredient(
                    index,
                    "amount",
                    nullableNumber(event.target.value)
                  )
                }
              />
              <select
                aria-label={`Ingredient ${index + 1} unit`}
                value={ingredient.unit}
                onChange={(event) =>
                  updateIngredient(index, "unit", event.target.value)
                }
              >
                {unitOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input
                className="ingredient-name"
                aria-label={`Ingredient ${index + 1} name`}
                value={ingredient.name}
                placeholder="Ingredient"
                onChange={(event) =>
                  updateIngredient(index, "name", event.target.value)
                }
              />
              {ingredient.uncertain && (
                <span
                  className="uncertain"
                  title="Check this amount against the transcript"
                >
                  <AlertCircle aria-hidden="true" />
                  <span>Check</span>
                </span>
              )}
              <button
                className="delete-button"
                type="button"
                aria-label={`Delete ingredient ${index + 1}`}
                disabled={draft.ingredients.length === 1}
                onClick={() =>
                  update(
                    "ingredients",
                    draft.ingredients.filter((_, itemIndex) => itemIndex !== index)
                  )
                }
              >
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
        <button
          className="add-action"
          type="button"
          onClick={() =>
            update("ingredients", [
              ...draft.ingredients,
              {
                id: crypto.randomUUID(),
                quantity: "",
                amount: null,
                unit: "ITEM",
                name: "",
                uncertain: false
              }
            ])
          }
        >
          <Plus aria-hidden="true" /> Add ingredient
        </button>
      </section>

      <section className="editor-section">
        <h3>Instructions</h3>
        <div className="editable-list">
          {draft.steps.map((step, index) => (
            <div className="instruction-row" key={step.id}>
              <GripVertical className="drag-handle" aria-hidden="true" />
              <span className="instruction-number">{index + 1}</span>
              <textarea
                aria-label={`Instruction ${index + 1}`}
                value={step.text}
                rows="2"
                onChange={(event) => updateStep(index, event.target.value)}
              />
              {step.uncertain && (
                <span className="uncertain" title="Check this step">
                  <AlertCircle aria-hidden="true" />
                  <span>Check</span>
                </span>
              )}
              <button
                className="delete-button"
                type="button"
                aria-label={`Delete instruction ${index + 1}`}
                disabled={draft.steps.length === 1}
                onClick={() =>
                  update(
                    "steps",
                    draft.steps.filter((_, stepIndex) => stepIndex !== index)
                  )
                }
              >
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
        <button
          className="add-action"
          type="button"
          onClick={() =>
            update("steps", [
              ...draft.steps,
              {
                id: crypto.randomUUID(),
                text: "",
                uncertain: false
              }
            ])
          }
        >
          <Plus aria-hidden="true" /> Add step
        </button>
      </section>
    </div>
  );
}
