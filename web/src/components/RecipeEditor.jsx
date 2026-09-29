import {
  AlertCircle,
  Clock,
  GripVertical,
  Plus,
  Trash2,
  Users
} from "lucide-react";

const unitOptions = [
  ["ITEM", "item"],
  ["CUP", "cup"],
  ["TABLESPOON", "tablespoon (tbsp)"],
  ["TEASPOON", "teaspoon (tsp)"],
  ["OUNCE", "ounce (oz)"],
  ["POUND", "pound (lb)"],
  ["GRAM", "gram (g)"],
  ["KILOGRAM", "kilogram (kg)"],
  ["MILLILITER", "milliliter (ml)"],
  ["LITER", "liter (l)"]
];

const nullableNumber = (value) =>
  value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;

function Field({ label, children, hint, icon }) {
  return (
    <label className="field">
      <span className="field__label">
        {icon}
        {label}
      </span>
      {children}
      {hint ? <small className="field__hint">{hint}</small> : null}
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

  const clearStepUncertain = (index) => {
    const steps = draft.steps.map((step, stepIndex) =>
      stepIndex === index ? { ...step, uncertain: false } : step
    );
    update("steps", steps);
  };

  return (
    <div className="recipe-editor">
      <div className="recipe-editor__header">
        <h2>Recipe Details</h2>
        <span className="editor-subhead">Editable fields for export</span>
      </div>

      <Field label="Recipe Title">
        <input
          className="recipe-name-input"
          value={draft.name}
          onChange={(event) => update("name", event.target.value)}
          placeholder="e.g. Classic Margherita Pizza"
          required
        />
      </Field>

      <Field label="Description">
        <textarea
          className="description-input"
          value={draft.description}
          onChange={(event) => update("description", event.target.value)}
          placeholder="A short note or serving advice..."
          rows="2"
        />
      </Field>

      <div className="timing-fields">
        <Field label="Servings" icon={<Users size={14} aria-hidden="true" />}>
          <input
            type="number"
            min="1"
            value={draft.servings ?? ""}
            placeholder="e.g. 4"
            onChange={(event) =>
              update("servings", nullableNumber(event.target.value))
            }
          />
        </Field>
        <Field label="Prep Time" icon={<Clock size={14} aria-hidden="true" />}>
          <div className="input-with-suffix">
            <input
              type="number"
              min="0"
              value={draft.prepMinutes ?? ""}
              placeholder="e.g. 15"
              onChange={(event) =>
                update("prepMinutes", nullableNumber(event.target.value))
              }
            />
            <span>min</span>
          </div>
        </Field>
        <Field label="Cook Time" icon={<Clock size={14} aria-hidden="true" />}>
          <div className="input-with-suffix">
            <input
              type="number"
              min="0"
              value={draft.cookMinutes ?? ""}
              placeholder="e.g. 30"
              onChange={(event) =>
                update("cookMinutes", nullableNumber(event.target.value))
              }
            />
            <span>min</span>
          </div>
        </Field>
      </div>

      {/* Ingredients Section */}
      <section className="editor-section">
        <div className="editor-section__header">
          <h3>Ingredients</h3>
          <span className="section-count">{draft.ingredients.length} items</span>
        </div>

        <div className="editable-list">
          {draft.ingredients.map((ingredient, index) => (
            <div className="ingredient-row" key={ingredient.id}>
              <div className="ingredient-row__drag" aria-hidden="true">
                <GripVertical size={16} />
              </div>

              <div className="ingredient-row__fields">
                <input
                  className="ingredient-quantity"
                  aria-label={`Ingredient ${index + 1} phrase (e.g. 2 tablespoons)`}
                  value={ingredient.quantity}
                  placeholder="Quantity (e.g. 2 tbsp)"
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
                  placeholder="Qty"
                  onChange={(event) =>
                    updateIngredient(
                      index,
                      "amount",
                      nullableNumber(event.target.value)
                    )
                  }
                />
                <select
                  className="unit-select"
                  aria-label={`Ingredient ${index + 1} unit`}
                  value={ingredient.unit}
                  onChange={(event) =>
                    updateIngredient(index, "unit", event.target.value)
                  }
                >
                  {unitOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  className="ingredient-name"
                  aria-label={`Ingredient ${index + 1} name`}
                  value={ingredient.name}
                  placeholder="Ingredient name (e.g. olive oil)"
                  onChange={(event) =>
                    updateIngredient(index, "name", event.target.value)
                  }
                />
              </div>

              {ingredient.uncertain && (
                <button
                  type="button"
                  className="uncertain-btn"
                  title="Check against original recording (click when verified)"
                  onClick={() => updateIngredient(index, "uncertain", false)}
                >
                  <AlertCircle size={14} aria-hidden="true" />
                  <span>Verify</span>
                </button>
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
                <Trash2 size={16} aria-hidden="true" />
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
          <Plus size={16} aria-hidden="true" /> Add ingredient
        </button>
      </section>

      {/* Instructions Section */}
      <section className="editor-section">
        <div className="editor-section__header">
          <h3>Method &amp; Steps</h3>
          <span className="section-count">{draft.steps.length} steps</span>
        </div>

        <div className="editable-list">
          {draft.steps.map((step, index) => (
            <div className="instruction-row" key={step.id}>
              <div className="instruction-row__lead">
                <span className="instruction-number">{index + 1}</span>
              </div>
              <textarea
                className="instruction-textarea"
                aria-label={`Instruction step ${index + 1}`}
                value={step.text}
                rows="2"
                placeholder={`Step ${index + 1} description...`}
                onChange={(event) => updateStep(index, event.target.value)}
              />

              {step.uncertain && (
                <button
                  type="button"
                  className="uncertain-btn"
                  title="Check against audio recording (click when verified)"
                  onClick={() => clearStepUncertain(index)}
                >
                  <AlertCircle size={14} aria-hidden="true" />
                  <span>Verify</span>
                </button>
              )}

              <button
                className="delete-button"
                type="button"
                aria-label={`Delete instruction step ${index + 1}`}
                disabled={draft.steps.length === 1}
                onClick={() =>
                  update(
                    "steps",
                    draft.steps.filter((_, stepIndex) => stepIndex !== index)
                  )
                }
              >
                <Trash2 size={16} aria-hidden="true" />
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
          <Plus size={16} aria-hidden="true" /> Add step
        </button>
      </section>
    </div>
  );
}
