"""Cheap retryable schedule gate; skipped checks never reset collection age."""
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import re
import subprocess


def backlog_pending(progress: dict | None, checkpoint: str) -> bool:
    if progress is None:
        return False
    if progress.get('schema') != 1:
        raise ValueError('Unsupported progress schema')
    if progress.get('checkpoint') != checkpoint:
        return False
    count = progress.get('dueCount')
    if not isinstance(count, int) or isinstance(count, bool) or count < 0:
        raise ValueError('Invalid pending-record count')
    return count > 0


def collection_due(last_started: str | None, now: datetime, force: bool = False, backlog: bool = False) -> bool:
    if force or last_started is None:
        return True
    started = datetime.fromisoformat(last_started.replace('Z', '+00:00'))
    if started.tzinfo is None or started > now:
        raise ValueError('Invalid last collection timestamp')
    return backlog or now - started >= timedelta(hours=6)


def main() -> None:
    force = os.environ.get('FORCE_COLLECTION') == 'true'
    last_started = None
    backlog = False
    if not force:
        repository = os.environ['GITHUB_REPOSITORY']
        release = subprocess.run(['gh', 'api', f'repos/{repository}/releases/tags/updater-state'],
                                 capture_output=True, text=True)
        if release.returncode and '(HTTP 404)' not in release.stderr:
            raise RuntimeError(release.stderr)
        if not release.returncode:
            assets = [asset for asset in json.loads(release.stdout)['assets']
                      if re.fullmatch(r'state-\d+-\d+\.sqlite\.gz', asset['name'])]
            if not assets:
                raise ValueError('Existing state release has no checkpoint; refusing to reset schedule')
            latest = max(assets, key=lambda asset: (asset['created_at'], asset['id']))
            progress_path = Path('updater/progress.json')
            progress = json.loads(progress_path.read_text(encoding='utf-8')) if progress_path.exists() else None
            backlog = backlog_pending(progress, latest['name'])
            _, run_id, suffix = latest['name'].split('-')
            attempt = suffix.removesuffix('.sqlite.gz')
            run = json.loads(subprocess.check_output(
                ['gh', 'api', f'repos/{repository}/actions/runs/{run_id}/attempts/{attempt}'], text=True))
            last_started = run['run_started_at']
            if not last_started:
                raise ValueError('Checkpoint run has no start timestamp')
    due = collection_due(last_started, datetime.now(timezone.utc), force, backlog)
    message = f'Collect: {due}; forced: {force}; published backlog: {backlog}; last actual collection start: {last_started}'
    print(message)
    if output := os.environ.get('GITHUB_OUTPUT'):
        with Path(output).open('a', encoding='utf-8') as stream:
            stream.write(f'collect={str(due).lower()}\n')
    if summary := os.environ.get('GITHUB_STEP_SUMMARY'):
        with Path(summary).open('a', encoding='utf-8') as stream:
            stream.write(f'### Collection schedule check\n\n{message}\n')


if __name__ == '__main__':
    main()
