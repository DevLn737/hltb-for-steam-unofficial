from __future__ import annotations

from html.parser import HTMLParser
import json
from typing import Any

from .model import GameRecord, extract_record


class NextDataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.capture = False
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        self.capture = tag == "script" and (
            attributes.get("id") == "__NEXT_DATA__" or attributes.get("type") == "application/json"
        )

    def handle_endtag(self, tag: str) -> None:
        if tag == "script":
            self.capture = False

    def handle_data(self, data: str) -> None:
        if self.capture and data.lstrip().startswith('{"props"'):
            self.parts.append(data)


def parse_game_page(html: str) -> GameRecord:
    parser = NextDataParser()
    parser.feed(html)
    candidates = parser.parts
    if not candidates:
        start = html.find('{"props"')
        end = html.rfind("</script>")
        if start >= 0 and end > start:
            candidates = [html[start:end]]
    for candidate in candidates:
        try:
            payload: Any = json.loads(candidate)
            source = payload["props"]["pageProps"]["game"]["data"]
            record = extract_record(source)
            if record is not None:
                return record
        except (KeyError, TypeError, json.JSONDecodeError):
            continue
    raise ValueError("HLTB page did not contain a valid game payload")

