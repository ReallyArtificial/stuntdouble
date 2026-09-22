# Project State
Last touched: 2026-09-22

## Now
- v0.1.0 live at https://github.com/ReallyArtificial/stuntdouble, CI green on Node 20/22, 33 tests.
- Launch report committed under `reports/2026-09-22-m3pro-kev0.8b-vs-laya/` (Kev-0.8B star, Laya double, no Jev). Numbers in README.
- Outreach open: Kev PR #36, laya-mlx PR #9, SemIf PR #30, JevBench issue #32, 8 awesome-jev directory issues, jev-by-example issue #8 comment.

## Next
- `npm publish` (blocked: `npm whoami` E401; log in first). The README already says `npx stuntdouble`.
- Post Show HN and the X thread from `../stuntdouble-launch-posts.md`.
- Rerun the launch report with Jev as the star once a TYPESAFE_API_KEY exists (issue #1); under $2.
- Watch the three upstream PRs and the logicrw auto-ingest of issue #70; answer maintainer questions.
- v0.2: SemIf sidecar (#2), --redact (#3), hosted backends doc (#4), CSV rows (#5), Windows CI (#6).

## Blockers / Open questions
- No TypeSafe key on this machine; Jev never ran through the proxy.
- Kev-4B does not fit on the 18 GB M3 Pro beside a desktop session (swap thrash). Kev-0.8B works.
- Machine memory and disk were near full during the build; the final Kev rerun was stopped at 290/300, so the committed Kev-suite report has 16 excluded star rows (documented in the report README).

## Decisions
- 2026-09-22: Name stuntdouble; state verbatim by default with `--no-state`; doubles run concurrently with the star and never delay the reply.
- 2026-09-22: Validator tolerances scale with option/level count because Kev rounds probabilities to two decimals.
- 2026-09-22: Launch report published with two local models rather than waiting for a Jev key; README leads with that caveat.
