"""Per-call telemetry: how long each model call took and how many tokens it used.

Strategies record one `Stage` per model call into an optional `Trace`. The
evals use it for latency and cost; normal CLI/API calls can ignore it.
"""

import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class Stage:
    name: str
    model: str
    seconds: float = 0.0
    input_tokens: int = 0  # all prompt tokens, audio included
    audio_tokens: int = 0  # the audio share of input_tokens
    output_tokens: int = 0  # response + thinking tokens

    def record_usage(self, usage: Any) -> None:
        """Copy counts from a google-genai `usage_metadata` (any field may be None)."""
        if usage is None:
            return
        self.input_tokens = usage.prompt_token_count or 0
        self.output_tokens = (usage.candidates_token_count or 0) + (usage.thoughts_token_count or 0)
        for detail in usage.prompt_tokens_details or []:
            if str(getattr(detail.modality, "value", detail.modality)).upper() == "AUDIO":
                self.audio_tokens += detail.token_count or 0


@dataclass
class Trace:
    stages: list[Stage] = field(default_factory=list)
    # Called with (stage, "start" | "done") so the API can stream progress.
    on_event: Callable[[Stage, str], None] | None = field(default=None, repr=False, compare=False)

    def emit(self, stage: Stage, status: str) -> None:
        if self.on_event:
            self.on_event(stage, status)

    @contextmanager
    def stage(self, name: str, model: str) -> Iterator[Stage]:
        stage = Stage(name=name, model=model)
        self.emit(stage, "start")
        start = time.perf_counter()
        try:
            yield stage
        finally:
            stage.seconds = time.perf_counter() - start
            self.stages.append(stage)
        self.emit(stage, "done")  # only reached when the call succeeded

    @property
    def seconds(self) -> float:
        return sum(s.seconds for s in self.stages)

    @property
    def input_tokens(self) -> int:
        return sum(s.input_tokens for s in self.stages)

    @property
    def output_tokens(self) -> int:
        return sum(s.output_tokens for s in self.stages)

    def cost_usd(self, pricing: dict[str, dict[str, float]]) -> float | None:
        """Total cost from a {model: {input, audio_input, output}} USD-per-million table.

        None when any stage's model has no price, so a partial number is never shown as a total.
        """
        total = 0.0
        for s in self.stages:
            price = pricing.get(s.model)
            if price is None:
                return None
            text_in = s.input_tokens - s.audio_tokens
            audio_price = price.get("audio_input", price["input"])
            total += (text_in * price["input"] + s.audio_tokens * audio_price + s.output_tokens * price["output"]) / 1e6
        return total

    def to_dict(self) -> dict:
        return {"stages": [asdict(s) for s in self.stages]}

    @classmethod
    def from_dict(cls, data: dict) -> "Trace":
        return cls(stages=[Stage(**s) for s in data.get("stages", [])])
