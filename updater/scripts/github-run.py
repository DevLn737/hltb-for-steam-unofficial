"""Collect one bounded chunk, persist progress, and build the next signed channel."""
from dataclasses import asdict
from datetime import datetime, timezone
import base64
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

from hltb_updater.checkpoint import read_checkpoint, write_checkpoint
from hltb_updater.client import HltbClient
from hltb_updater.database import Database, utc_now
from hltb_updater.restore import restore_snapshot
from hltb_updater.scheduler import check_canaries, check_publication_readiness, run_update_cycle
from hltb_updater.snapshot import build_snapshot, verify_candidate
from hltb_updater.progress import snapshot_progress


repository = os.environ['GITHUB_REPOSITORY']
channel = Path('docs/data/v2')
previous = channel if (channel / 'stable.json').exists() else Path('docs/data')
public_key = Path('updater/config/snapshot-public-key.json')
previous_key = public_key if previous == channel else Path('updater/config/legacy-snapshot-public-key.json')
database = Database('updater/.tmp/state.sqlite')
release = subprocess.run(['gh', 'api', f'repos/{repository}/releases/tags/updater-state'], capture_output=True, text=True)
if release.returncode and '(HTTP 404)' not in release.stderr:
    raise RuntimeError(release.stderr)
assets = json.loads(release.stdout)['assets'] if release.returncode == 0 else []
checkpoints = [asset for asset in assets if re.fullmatch(r'state-\d+-\d+\.sqlite\.gz', asset['name'])]
if release.returncode == 0 and not checkpoints:
    raise RuntimeError('Existing updater-state release has no valid checkpoint; refusing to reset state')

with tempfile.TemporaryDirectory() as temporary:
    work = Path(temporary)
    if checkpoints:
        latest = max(checkpoints, key=lambda asset: asset['created_at'])
        subprocess.run(['gh', 'release', 'download', 'updater-state', '-R', repository,
                        '--pattern', latest['name'], '--dir', str(work)], check=True)
        read_checkpoint(work / latest['name'], database.path)
        database.initialize()
    else:
        database.initialize()
        print(f'Recovered {restore_snapshot(database, previous, previous_key)} distributed records', flush=True)

    try:
        canaries = json.loads(Path('updater/config/canaries.json').read_text())['games']
        with HltbClient() as client:
            records = check_canaries(client, canaries, database=database)
            for record in records:
                database.upsert(record, utc_now())
            mode, cutoff, stats = run_update_cycle(
                database, client,
                max_tail=int(os.environ.get('MAX_TAIL', '100')),
                max_refresh=min(5000, max(0, int(os.environ.get('MAX_REFRESH', '5000')))),
                catch_up_limit=5000,
                max_seconds=min(5400, max(1, int(os.environ.get('MAX_SECONDS', '5400')))),
            )
        print(json.dumps({'mode': mode, 'cutoff': str(cutoff), **asdict(stats)}), flush=True)
    finally:
        # Save even after rate limits/parser failures; publish only after success.
        filename = f"state-{os.environ['GITHUB_RUN_ID']}-{os.environ['GITHUB_RUN_ATTEMPT']}.sqlite.gz"
        checkpoint = work / filename
        write_checkpoint(database.path, checkpoint)
        if release.returncode:
            subprocess.run(['gh', 'release', 'create', 'updater-state', '-R', repository,
                            '--target', 'main', '--prerelease', '--title', 'Updater working state',
                            '--notes', 'Resumable SQLite state. Contains game data and collection status; no keys or raw pages.',
                            str(checkpoint)], check=True)
        else:
            subprocess.run(['gh', 'release', 'upload', 'updater-state', '-R', repository, str(checkpoint), '--clobber'], check=True)
            for asset in checkpoints:
                if asset['name'] != filename:
                    subprocess.run(['gh', 'release', 'delete-asset', 'updater-state', asset['name'],
                                    '-R', repository, '--yes'], check=True)

    check_publication_readiness(database)
    verify_candidate(previous, previous_key)
    pointer = json.loads((previous / 'stable.json').read_bytes())
    signing_key = work / 'signing-key.pem'
    signing_key.write_bytes(base64.b64decode(os.environ['SNAPSHOT_SIGNING_KEY']))
    signing_key.chmod(0o600)
    suffix = int(os.environ['GITHUB_RUN_NUMBER']) * 100 + int(os.environ['GITHUB_RUN_ATTEMPT'])
    version = datetime.now(timezone.utc).strftime('%Y.%m.%d.') + str(suffix)
    build_snapshot(database, channel, version, signing_key, 'updater/config/overrides.json',
                   previous / pointer['manifestPath'])
    manifest = verify_candidate(channel, public_key)
    progress = snapshot_progress(database, filename, utc_now())
    Path('updater/progress.json').write_text(json.dumps(progress, indent=2) + '\n', encoding='utf-8')
    if output := os.environ.get('GITHUB_OUTPUT'):
        with Path(output).open('a', encoding='utf-8') as stream:
            stream.write(f"remaining={progress['dueCount']}\n")
    for obsolete in sorted((channel / 'versions').iterdir(), key=lambda path: tuple(map(int, path.name.split('.'))), reverse=True)[3:]:
        assert obsolete.resolve().parent == (channel / 'versions').resolve()
        shutil.rmtree(obsolete)
    print(json.dumps({'publishedCandidate': version, 'sourceUpdatedAt': manifest['sourceUpdatedAt'],
                      'entries': manifest['entryCount']}), flush=True)
