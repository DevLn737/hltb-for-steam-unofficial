#!/usr/bin/env bash
set -euo pipefail

getent hosts server >/dev/null
curl --fail --silent --show-error --max-time 10 http://server:3000/api/healthz >/dev/null
# Reaching this step already proves that the runner created the job through its
# isolated Docker daemon; the job image intentionally does not expose Docker.
test -w /var/lib/hltb-updater

for host in github.com devln737.github.io howlongtobeat.com; do
  getent hosts "$host" >/dev/null
done

echo "Updater runner preflight passed"
