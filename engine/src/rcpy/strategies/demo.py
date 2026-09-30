"""Canned result so the CLI can be tried without an API key (DEMO_MODE=true)."""

from rcpy.schema import ParseResult

DEMO = ParseResult.model_validate(
    {
        "original_transcript": "सबसे पहले कड़ाही में दो बड़े चम्मच तेल गरम करें। जीरा डालें। फूलगोभी और आलू मसालों के साथ पकाएँ।",
        "recipe": {
            "source_language": "Hindi",
            "english_transcript": "Heat two tablespoons of oil in a pan. Add cumin seeds. Add one chopped onion, one cauliflower in florets and three cubed potatoes. Cook covered for twenty minutes. Salt to taste.",
            "name": "Aloo Gobi",
            "description": "A comforting cauliflower and potato curry with warming spices.",
            "servings": 4,
            "prep_minutes": 15,
            "cook_minutes": 25,
            "ingredients": [
                {
                    "quantity": "2 tablespoons",
                    "amount": 2,
                    "unit": "TABLESPOON",
                    "name": "vegetable oil",
                    "uncertain": False,
                },
                {"quantity": "1 teaspoon", "amount": 1, "unit": "TEASPOON", "name": "cumin seeds", "uncertain": False},
                {"quantity": "1", "amount": 1, "unit": "ITEM", "name": "onion, finely chopped", "uncertain": False},
                {
                    "quantity": "1",
                    "amount": 1,
                    "unit": "ITEM",
                    "name": "cauliflower, cut into florets",
                    "uncertain": False,
                },
                {
                    "quantity": "3",
                    "amount": 3,
                    "unit": "ITEM",
                    "name": "potatoes, peeled and cubed",
                    "uncertain": False,
                },
                {"quantity": "to taste", "amount": None, "unit": "ITEM", "name": "salt", "uncertain": True},
            ],
            "steps": [
                {"text": "Heat the oil in a large pan. Add the cumin seeds and let them sizzle.", "uncertain": False},
                {"text": "Add the onion and fry until golden.", "uncertain": False},
                {
                    "text": "Add the cauliflower and potatoes, cover, and cook for about 20 minutes over medium-low heat.",
                    "uncertain": False,
                },
            ],
            "notes": [],
        },
    }
)
