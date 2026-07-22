# Reviewer build instructions

This file is intended for Mozilla Add-ons reviewers and anyone reproducing the packaged extension from source.

## Environment

- Ubuntu, macOS, or Windows
- Node.js 22 or newer
- npm (the version bundled with Node.js is sufficient)

No private packages, credentials, environment variables, or external build services are required. The committed local snapshot is build input; the build does not scrape or contact HowLongToBeat.

## Reproduce the Firefox build

From the source archive root:

```sh
npm ci
npm run build:firefox
npm run verify:firefox
```

The unpacked extension is produced at `.output/firefox-mv3/`.

To produce the submission ZIP and source ZIP:

```sh
npm run xpi:firefox:unsigned
```

The command creates:

- `.output/hltb-for-steam-unofficial-2.1.0-firefox.zip` — extension archive to submit to AMO;
- `.output/hltb-for-steam-unofficial-2.1.0-sources.zip` — matching reviewer sources;
- `.output/hltb-for-steam-unofficial-2.1.0-firefox-unsigned.xpi` — an explicitly unsigned development copy for temporary installation only.

Generated JavaScript is bundled by WXT. No minifier obfuscation, remote executable code, post-download code generation, or native binaries are used.
