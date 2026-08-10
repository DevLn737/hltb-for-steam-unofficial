from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import json
from typing import Any


def positive_int(value: Any) -> int | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def seconds_to_minutes(value: Any) -> int | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return max(1, round(parsed / 60)) if parsed > 0 else None


@dataclass(frozen=True, slots=True)
class GameRecord:
    hltb_id: int
    title: str
    main_minutes: int | None
    extra_minutes: int | None
    completion_minutes: int | None
    steam_app_id: int | None
    steam_alt_app_id: int | None

    @property
    def has_times(self) -> bool:
        return any(value is not None for value in (
            self.main_minutes, self.extra_minutes, self.completion_minutes
        ))

    @property
    def has_steam(self) -> bool:
        return self.steam_app_id is not None or self.steam_alt_app_id is not None

    @property
    def content_hash(self) -> str:
        payload = json.dumps([
            self.title, self.main_minutes, self.extra_minutes, self.completion_minutes,
            self.steam_app_id, self.steam_alt_app_id,
        ], ensure_ascii=False, separators=(",", ":"))
        return sha256(payload.encode("utf-8")).hexdigest()


def extract_record(source: Any) -> GameRecord | None:
    game_list = source.get("game") if isinstance(source, dict) else None
    game = game_list[0] if isinstance(game_list, list) and game_list else None
    if not isinstance(game, dict):
        return None
    hltb_id = positive_int(game.get("game_id"))
    title = str(game.get("game_name") or "").strip()
    if hltb_id is None or not title:
        return None
    return GameRecord(
        hltb_id=hltb_id,
        title=title,
        main_minutes=seconds_to_minutes(game.get("comp_main")),
        extra_minutes=seconds_to_minutes(game.get("comp_plus")),
        completion_minutes=seconds_to_minutes(game.get("comp_100")),
        steam_app_id=positive_int(game.get("profile_steam")),
        steam_alt_app_id=positive_int(game.get("profile_steam_alt")),
    )

