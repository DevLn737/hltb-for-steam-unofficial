#!/usr/bin/env bash
set -euo pipefail

candidate="${1:?candidate directory is required}"
test -f "$candidate/stable.json"
test -f "$candidate/stable.sig"
test -n "${DATA_REPOSITORY_URL:-}"
test -n "${DATA_REPOSITORY_TOKEN:-}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
authenticated_url="${DATA_REPOSITORY_URL/https:\/\//https:\/\/x-access-token:${DATA_REPOSITORY_TOKEN}@}"

if git ls-remote --exit-code --heads "$authenticated_url" gh-pages >/dev/null 2>&1; then
  git clone --depth 1 --branch gh-pages "$authenticated_url" "$work/repository"
else
  git clone --depth 1 "$authenticated_url" "$work/repository"
  cd "$work/repository"
  git checkout --orphan gh-pages
  git rm -rf --ignore-unmatch .
fi

cd "$work/repository"
version="$(jq -r .snapshotVersion "$candidate/stable.json")"
if test -d "versions/$version"; then
  if ! diff -qr "versions/$version" "$candidate/versions/$version" >/dev/null; then
    echo "Refusing to overwrite immutable snapshot version $version" >&2
    exit 1
  fi
fi
cp -R "$candidate/." "$work/repository/"

# Retain only the three newest immutable versions.
mapfile -t versions < <(find versions -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r)
for version in "${versions[@]:3}"; do rm -rf -- "versions/$version"; done

git add --all
if git diff --cached --quiet; then exit 0; fi
git -c user.name='HLTB snapshot updater' -c user.email='noreply@localhost' commit -m "data: publish $version"
git push origin gh-pages
