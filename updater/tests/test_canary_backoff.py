from datetime import datetime, timedelta, timezone

import pytest

from hltb_updater.client import FetchResult
from hltb_updater.database import Database
from hltb_updater.scheduler import CircuitBreakerError, check_canaries


def test_persisted_retry_after_blocks_canaries_before_any_request(tmp_path):
    database = Database(tmp_path / 'state.sqlite')
    database.initialize()
    database.set_metadata('retry_after_until', (datetime.now(timezone.utc) + timedelta(hours=12)).isoformat())

    class Client:
        def fetch(self, _game_id):
            pytest.fail('HLTB must not be contacted during persisted Retry-After')

    with pytest.raises(CircuitBreakerError, match='Retry-After'):
        check_canaries(Client(), [{'hltbGameId': 1}], database=database)


def test_canary_429_saves_retry_after_for_the_next_runner(tmp_path):
    database = Database(tmp_path / 'state.sqlite')
    database.initialize()
    started = datetime.now(timezone.utc)

    class Client:
        def fetch(self, _game_id):
            return FetchResult('rate_limited', status_code=429, retry_after=43200)

    with pytest.raises(CircuitBreakerError):
        check_canaries(Client(), [{'hltbGameId': 1}], database=database)
    assert datetime.fromisoformat(database.get_metadata('retry_after_until')) >= started + timedelta(hours=12)
