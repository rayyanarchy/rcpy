"""Evaluation harness: score parse strategies against hand-checked recipes.

Layout (all under <DATA_DIR>/evals, git-ignored because the audio is private):

    cases/<case_id>/audio.<ext>   the recording
    cases/<case_id>/gold.json     the correct recipe (a `GoldCase`)
    runs/<run_id>/<case_id>.<n>.json   cached predictions + traces

Summaries are written to evals/results/<run_id>.json in the repo, so the
numbers can be committed and shown on the web app without the audio.
"""
