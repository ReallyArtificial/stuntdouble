# Project State
Last touched: 2026-09-22

## Now
- v0.1.0 built: proxy, backends, recorder, compare, verdict, report, suites (kev, jevbench, semif, jbe), CLI, Laya sidecar. 30 tests pass.
- Real flow verified: official @typesafe-ai/sdk with baseURL → proxy → Kev-0.8B (star) + Laya (double) → record.
- Launch report runs in progress: jev-by-example (28 cases), Kev decision-v2 test sample (300), JevBench hard (111).

## Next
- Rerun the launch report with Jev as the star once a TYPESAFE_API_KEY exists (config: star.url https://api.typesafe.ai, pricePerMillionInput 0.042).
- Kev-4B as a double needs a machine with more than 18 GB; this Mac swapped to death on it. Kev-0.8B was used instead.
- SemIf sidecar (issue #2), djev/classifier.dev importers, --redact regex.
- npm publish blocked: `npm whoami` returns E401. Log in and run `npm publish`.

## Blockers / Open questions
- No TypeSafe API key on this machine, so the star in the launch report is Kev-0.8B, not Jev.
- Disk was at 100% during the build (HF caches). `uv cache clean` freed 5 GB. Run /cleanup-mac-storage.

## Decisions
- 2026-09-22: Name stuntdouble. State stored verbatim by default, `--no-state` hashes it.
- 2026-09-22: Doubles are called concurrently with the star; the reply never waits for them (test enforces < 300 ms with a 400 ms double).
- 2026-09-22: Contract validation is lenient on usage (optional) so sidecars without tokenizers still count as valid.
