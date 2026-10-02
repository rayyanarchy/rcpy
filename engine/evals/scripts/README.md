# Dictation scripts

36 recipes written to be read aloud, each with its answer key built in. They are the eval set for the thing RCPY actually does: someone talking through a recipe, in English, Hindi or Urdu, mixed however it comes out, with the slips people make when they talk.

The mistakes are on purpose. Across the set there are self-corrections ("ek katori... nahi nahi, dedh katori"), ranges ("aath das kadi patte"), vague amounts ("thoda sa", "to taste"), desi measures (*pav*, *katori*, *chammach*, *chutki*), an ingredient that's only mentioned inside a step, something the speaker forgot and adds at the end, a restart, a tangent, an ingredient that is explicitly left out ("piyaz nahi daalte"), and times or servings that are sometimes said and sometimes not. The `tags` at the top of each file say which.

## Recording

1. Use the phone's voice recorder app. A quiet room is fine, and a real kitchen is better. Hold the phone the way you would on a call.
2. Open the script, read it once in your head, then record. **Say every ingredient, amount and correction as written**; everything else can be in your own words. Pausing, "umm", or going back over a sentence is all fine. That's real dictation.
3. Name the file exactly as in the tables below (the extension can be whatever the app saves: `.m4a`, `.mp3`, `.webm`...). If more than one person reads the same recipe, add `--` and your name: `poha--mom.m4a`.
4. Put all the recordings in one folder and add them in one go, from `engine/`:

   ```bash
   uv run rcpy eval add ~/Downloads/rcpy-recordings/*
   uv run rcpy eval scripts        # which scripts are recorded
   uv run rcpy eval run -s single -n 3
   uv run rcpy eval run -s staged -n 3
   ```

   A recording named after a script takes its answer key from the script, so it's ready to run straight away, with no labelling. If someone changed an amount while reading, edit that case's `data/evals/cases/<id>/gold.json` to match what they actually said.

About a third of the scripts are tagged `holdout`. Don't look at how the model does on those while tuning prompts; they are the honest score.

## Who reads what

### Mom (13 recipes, about 18.5 minutes of talking)

| Save the recording as | Recipe | Length |
| --- | --- | --- |
| `aloo-gosht.m4a` | [Aloo Gosht](aloo-gosht.md) | 2 min |
| `anda-curry.m4a` | [Anda Curry](anda-curry.md) | 1.5 min |
| `bagara-khana.m4a` | [Bagara Khana](bagara-khana.md) | 1.5 min |
| `chicken-65.m4a` | [Chicken 65](chicken-65.md) | 1.5 min |
| `double-ka-meetha.m4a` | [Double ka Meetha](double-ka-meetha.md) | 1.5 min |
| `khatti-dal.m4a` | [Khatti Dal](khatti-dal.md) | 1.5 min |
| `kheer.m4a` | [Chawal ki Kheer](kheer.md) | 1 min |
| `lauki-chana-dal.m4a` | [Lauki Chana Dal](lauki-chana-dal.md) | 1.5 min |
| `matar-pulao.m4a` | [Matar Pulao](matar-pulao.md) | 1 min |
| `methi-aloo.m4a` | [Methi Aloo](methi-aloo.md) | 0.5 min |
| `mirchi-ka-salan.m4a` | [Mirchi ka Salan](mirchi-ka-salan.md) | 3 min |
| `sheer-khurma.m4a` | [Sheer Khurma](sheer-khurma.md) | 1.5 min |
| `tamatar-ki-chutney.m4a` | [Tamatar ki Chutney](tamatar-ki-chutney.md) | 0.5 min |

### Sister (12 recipes, about 14.5 minutes of talking)

| Save the recording as | Recipe | Length |
| --- | --- | --- |
| `aloo-paratha.m4a` | [Aloo Paratha](aloo-paratha.md) | 2.5 min |
| `chole.m4a` | [Pindi Chole](chole.md) | 2 min |
| `cold-coffee.m4a` | [Cold Coffee](cold-coffee.md) | 0.5 min |
| `desi-pasta.m4a` | [Desi Masala Pasta](desi-pasta.md) | 1 min |
| `french-toast.m4a` | [Masala French Toast](french-toast.md) | 0.5 min |
| `maggi-masala.m4a` | [Masala Maggi](maggi-masala.md) | 0.5 min |
| `masala-chai.m4a` | [Masala Chai](masala-chai.md) | 0.5 min |
| `paneer-butter-masala.m4a` | [Paneer Butter Masala](paneer-butter-masala.md) | 2 min |
| `poha.m4a` | [Kanda Poha](poha.md) | 1 min |
| `rajma.m4a` | [Rajma](rajma.md) | 2 min |
| `suji-halwa.m4a` | [Suji ka Halwa](suji-halwa.md) | 1 min |
| `veg-sandwich.m4a` | [Bombay Veg Sandwich](veg-sandwich.md) | 1 min |

### Rayyan (11 recipes, about 10.5 minutes of talking)

| Save the recording as | Recipe | Length |
| --- | --- | --- |
| `banana-bread.m4a` | [Banana Bread](banana-bread.md) | 1.5 min |
| `chicken-tikka.m4a` | [Oven Chicken Tikka](chicken-tikka.md) | 1.5 min |
| `dal-tadka.m4a` | [Dal Tadka](dal-tadka.md) | 1 min |
| `fried-rice.m4a` | [Egg Fried Rice](fried-rice.md) | 1 min |
| `guacamole.m4a` | [Guacamole](guacamole.md) | 0.5 min |
| `hummus.m4a` | [Hummus](hummus.md) | 1 min |
| `masala-omelette.m4a` | [Masala Omelette](masala-omelette.md) | 0.5 min |
| `mug-cake.m4a` | [Chocolate Mug Cake](mug-cake.md) | 0.5 min |
| `pancakes.m4a` | [Fluffy Pancakes](pancakes.md) | 1 min |
| `shikanji.m4a` | [Shikanji](shikanji.md) | 0.5 min |
| `tomato-soup.m4a` | [Roasted Tomato Soup](tomato-soup.md) | 1.5 min |

## Writing more scripts

Copy any file and keep its three parts: the front matter, `## Say this`, and the ```json answer key. The answer key follows the rules in [../README.md](../README.md#writing-goldjson). In short: amounts as spoken after any correction, no unit conversion, ranges as `amount` + `amount_max`, `null` when no number is said, one entry per ingredient, plain water left out. `uv run pytest tests/test_scripts.py` checks that every answer-key ingredient is actually said in the script.
