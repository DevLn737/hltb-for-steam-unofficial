from __future__ import annotations

from dataclasses import dataclass
import random
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Literal

import httpx

from .model import GameRecord
from .parser import parse_game_page


ResultStatus = Literal["ok", "missing", "forbidden", "rate_limited", "network_error", "parse_error"]


@dataclass(frozen=True, slots=True)
class FetchResult:
    status: ResultStatus
    record: GameRecord | None = None
    status_code: int | None = None
    retry_after: int | None = None
    error: str | None = None


class HltbClient:
    def __init__(self, minimum_delay: float = 0.75, maximum_delay: float = 1.5) -> None:
        if minimum_delay < 0 or maximum_delay < minimum_delay:
            raise ValueError("Request delays must satisfy 0 <= minimum <= maximum")
        self.minimum_delay = minimum_delay
        self.maximum_delay = maximum_delay
        self._client = httpx.Client(
            base_url="https://howlongtobeat.com",
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; HLTB-for-Steam snapshot maintenance; +https://github.com/DevLn737/hltb-for-steam-unofficial)",
                "Accept": "text/html,application/xhtml+xml",
            },
            follow_redirects=True,
            timeout=20,
        )
        self._last_request_at = 0.0

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "HltbClient":
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()

    def fetch(self, game_id: int) -> FetchResult:
        elapsed = time.monotonic() - self._last_request_at
        delay = random.uniform(self.minimum_delay, self.maximum_delay)
        if elapsed < delay:
            time.sleep(delay - elapsed)
        try:
            response = self._client.get(f"/game/{game_id}")
        except httpx.HTTPError as error:
            return FetchResult("network_error", error=str(error))
        finally:
            self._last_request_at = time.monotonic()
        if response.status_code == 404:
            return FetchResult("missing", status_code=404)
        if response.status_code == 403:
            return FetchResult("forbidden", status_code=403)
        if response.status_code == 429:
            retry = response.headers.get("retry-after")
            retry_after = int(retry) if retry and retry.isdigit() else None
            if retry and retry_after is None:
                try:
                    retry_after = max(0, int((parsedate_to_datetime(retry) - datetime.now(timezone.utc)).total_seconds()))
                except (TypeError, ValueError, OverflowError):
                    pass
            return FetchResult("rate_limited", status_code=429, retry_after=retry_after)
        if response.status_code != 200:
            return FetchResult("network_error", status_code=response.status_code, error=f"HTTP {response.status_code}")
        try:
            record = parse_game_page(response.text)
        except ValueError as error:
            return FetchResult("parse_error", status_code=200, error=str(error))
        if record.hltb_id != game_id:
            return FetchResult("parse_error", status_code=200, error=f"Expected ID {game_id}, got {record.hltb_id}")
        return FetchResult("ok", record=record, status_code=200)
