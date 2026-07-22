# Firefox AMO preparation

The repository can build a Firefox extension and a clean matching source archive. The local `.xpi` is **unsigned**; only Mozilla can produce the permanently installable signed XPI.

## Current baseline

- Manifest V3 Firefox build.
- Stable Gecko ID: `hltb-for-steam-unofficial@devln737.github.io`.
- Minimum Firefox version declared in the manifest.
- `websiteContent` data-transmission declaration.
- Privacy policy describing the title sent to HowLongToBeat.
- Reproducible reviewer instructions in [SOURCE_BUILD.md](../SOURCE_BUILD.md).
- WXT source ZIP excludes local diagnostics, raw scrape data, credentials, and generated packages.

## Artifact meanings

- `*-firefox.zip`: unsigned extension archive to upload to AMO.
- `*-sources.zip`: matching source archive for Mozilla review.
- `*-firefox-unsigned.xpi`: development convenience copy for temporary loading; it is not Mozilla-signed.

## Before AMO submission

- [ ] Create or verify the Mozilla/AMO developer account and accept the current agreements.
- [ ] Run AMO validation against the final Firefox ZIP and resolve errors/warnings.
- [ ] Test the exact build on current Firefox Release and the oldest declared compatible version; add ESR coverage if ESR support is claimed.
- [ ] Confirm the declared minimum Firefox version is intentional rather than Nightly-only convenience.
- [ ] Complete a legal/redistribution review for the packaged HLTB-derived snapshot.
- [ ] Add final icon/listing artwork and screenshots.
- [ ] Supply name, summary, description, categories, support URL/email, MIT license, privacy-policy URL, and reviewer notes.
- [ ] Upload both `*-firefox.zip` and the matching `*-sources.zip` for a listed AMO release, or choose unlisted signing for self-distribution.
- [ ] Download Mozilla's signed XPI and verify a permanent clean-profile installation.

Mozilla signs both listed and self-distributed extensions. A GitHub release or renamed ZIP cannot replace that signature. See Mozilla's [signing and distribution overview](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/), [submission guide](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/), and [source-code requirements](https://extensionworkshop.com/documentation/publish/source-code-submission/).
