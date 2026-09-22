# stuntdouble

## In a Nutshell
**stuntdouble** is a zero-dependency Node proxy that sits between your app and TypeSafe's Jev API: you change one line (baseURL) and your app keeps getting Jev's exact answers, while the proxy quietly sends every request to one or more local decision models (Kev, Laya, anything on the same wire shape), records all the answers, and then produces a report that tells you whether the local model would have made the same decision, at what confidence, how much faster, how much cheaper, and, uniquely, whether your application's own policy code would have acted differently. It ends with a swap verdict, a confidence threshold above which you can safely route traffic to the local model, and a replay mode that reruns recorded traffic against any new checkpoint without paying Jev again. The impact is that the question "can I replace a paid hosted decision model with a free local one" stops being a benchmark argument and becomes a measurement on your own traffic, in an afternoon, with the evidence on disk. It also gives open-model authors a way to prove their models on real workloads, and it has already caught a concrete disagreement: on the jev-by-example cases, two small models diverged on 6 of 28 application decisions, including the retry-or-reconcile case where one model would retry a write that may already have succeeded.

**Find out whether a local decision model can replace Jev on your traffic before you switch.**

stuntdouble is a drop-in proxy for TypeSafe's `/v1/systemone` API. Your app keeps calling the star (Jev). The proxy forwards every request unchanged, returns the star's reply byte-for-byte, and at the same time asks one or more *doubles* (Kev, Laya, or anything else that speaks the same wire shape) the same question. It records all answers. One command then tells you, per question, whether the double would have made the same decision, at what confidence, how much faster, and how much cheaper, and gives a swap verdict: the confidence threshold above which you can route to the double within a disagreement budget you choose.

Zero dependencies. Node 20.17+. MIT. Independent project, not affiliated with TypeSafe AI, Kev, or Laya.

## Two lines to try it

Install and point it at the star and a double:

```sh
npx stuntdouble serve --config stuntdouble.json
```

```json
{
  "star":    { "name": "jev", "url": "https://api.typesafe.ai", "headers": { "authorization": "Bearer ${TYPESAFE_API_KEY}" }, "model": "jev-1.13.0", "pricePerMillionInput": 0.042 },
  "doubles": [ { "name": "kev-4b", "url": "http://127.0.0.1:8009", "model": "kev-latest" } ]
}
```

Then change one line in your app. Both official SDKs accept a base URL:

```ts
const client = new TypeSafeClient({ apiKey, baseURL: "http://127.0.0.1:8010" });   // @typesafe-ai/sdk
```

```py
client = TypeSafeClient(api_key=..., base_url="http://127.0.0.1:8010")             # typesafe_sdk
```

Run your traffic for a while, then:

```sh
npx stuntdouble report records/*.jsonl --out report.md
```

The star still answers every request. The doubles never delay or change the reply; if a double times out or errors, the record says so and the report counts it as unavailable. Your app cannot tell the proxy is there except for two extra response headers (`x-stuntdouble-id`, `x-stuntdouble-doubles`).

## What the report contains

| Section | What it answers |
| --- | --- |
| Label agreement | Did the double select the same answer as the star, per question and per primitive (Noul, Choice, Score)? |
| **Policy agreement** | Did the *application decision* change? Available when the suite carries the policy code, as [jev-by-example](https://github.com/ReallyArtificial/jev-by-example) does. No label-level benchmark can produce this number. |
| Confidence-gated agreement | For each confidence threshold: how much traffic clears it and how often the double agrees with the star there. |
| Swap verdict | The lowest threshold that keeps disagreement within your budget, the share of traffic it covers, and the saving per 1,000 decisions. |
| Accuracy, Brier, ECE, coverage at ≤5% error | Only where labels exist (imported suites or the `x-stuntdouble-label` header). Reported for the star too, so you can see who is actually right. |
| Latency p50 / p95, availability, cost | Measured by the proxy on your machine. Cost counts only responses whose returned model matches the priced one. |

Exact definitions, with the tests that pin them: [docs/metrics.md](docs/metrics.md).

## Replay: record once, compare forever

Recording against a paid star costs money once. After that, run the same requests against any new checkpoint for free:

```sh
npx stuntdouble replay records/2026-09-22.jsonl --double kev-9b=http://127.0.0.1:8012,kev-latest --out records/replay-kev-9b.jsonl
npx stuntdouble report records/replay-kev-9b.jsonl
```

The star's recorded answers are kept and marked as recorded; only the new double is called. Open-model authors can benchmark a new build against yesterday's Jev answers on real traffic without touching the API again.

## Suites: labeled sets and policy sets

Without live traffic, run a labeled suite through the same machinery:

```sh
npx stuntdouble suite import kev      path/to/kev/evals/decision-v2/test.jsonl
npx stuntdouble suite import jevbench path/to/jevbench/datasets/public/hard.jsonl
npx stuntdouble suite import semif    path/to/SemIf/examples/decisions.jsonl
npx stuntdouble suite run suites/kev.jsonl --sample 300 --star jev=https://api.typesafe.ai,jev-1.13.0 --double kev-4b=http://127.0.0.1:8009,kev-latest
npx stuntdouble suite run jbe:../jev-by-example --star ... --double ...    # policy agreement
```

[Kev](https://github.com/jaredpalmer/kev)'s frozen suites are already the wire shape with a label per question. [JevBench](https://github.com/fstandhartinger/jevbench)'s public items carry an expected answer. jev-by-example's examples are imported as code, so the report can run each example's `decide()` with every backend's answers.

## Launch report, 22 September 2026

Run on an M3 Pro with 18 GB, which could not hold Kev-4B (it swapped), so the star here is **Kev-0.8B** served by `kev.serve` in bf16 and the double is **Laya 421M** through the bundled MLX sidecar. There was no TypeSafe key on the machine, so Jev is absent from this run; the config above is all it takes to rerun with Jev as the star. Full reports and raw records are in [reports/](reports/).

**jev-by-example, 28 cases that reach the model, 55 questions.** Policy agreement between Kev-0.8B and Laya was **78.6%**: on 6 of 28 cases the application would have done something different. Label agreement was 78.2%, and it did not rise reliably with Laya's confidence (83.8% at ≥0.5, 90.0% at ≥0.8, 100% only above 0.9 on 7 rows), so the verdict at a 5% budget was **do not route**. The six policy flips were in retry-or-reconcile (Kev inspects, Laya retries), handoff readiness (Kev repairs, Laya ships), and all four question-stress-test variants (Kev drafts locally, Laya asks to clarify).

The other two suites are labeled, so the report also says who was right.

| Suite | Rows | Agreement Laya vs Kev-0.8B | Accuracy Kev-0.8B | Accuracy Laya | Brier Kev / Laya | Coverage at ≤5% error Kev / Laya | p50 Kev / Laya |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Kev `decision-v2` test, 300 rows sampled | 348 questions | 65.5% (Noul 81.7%, Choice 60.9%, Score 40.9%) | 87.6% | 65.8% | 0.200 / 0.512 | 65.8% / 0.0% | 220 ms / 338 ms |
| JevBench public hard, all 111 | 107 questions | 41.1% | 35.5% | 38.3% | 0.782 / 0.797 | 0.0% / 0.0% | 1073 ms / 342 ms |

Kev's own suite is in-distribution for Kev, which explains the gap. On JevBench's hard tier both models sit near chance on 5-way items and neither could automate anything at a 5% error budget; JevBench reports Jev at 74 on its composite score, so the tier is simply beyond 0.4B and 0.8B models. The verdict on every suite was **do not route** at a 5% budget. Sixteen Kev-suite rows and four JevBench rows were excluded as star errors; the report README says which and why.

## Sidecars

Kev, jeff, djev, and TypeSafe itself speak the wire shape and need nothing. Laya is a Python library, so [sidecars/laya.py](sidecars/laya.py) puts it behind `/v1/systemone` in 60 lines of standard library:

```sh
pip install laya-mlx && python sidecars/laya.py --port 8011
```

SemIf ships a batch scorer rather than a server; a sidecar for it is [issue #2](https://github.com/ReallyArtificial/stuntdouble/issues/2).

## Records and privacy

Each request produces one JSON line in `records/<utc-date>.jsonl`: the request (state included), a SHA-256 of it, the optional label, and every backend's status, model, answers, usage, and elapsed milliseconds. Nothing leaves your machine except the calls you configured. Pass `--no-state` to store only the hash. `sampleRate` under 1 fans out only a fraction of traffic; the star is always called.

## Limits, stated plainly

- Agreement is measured against the star, not against truth. A double that agrees with a wrong star is wrong too. Use a labeled suite to see accuracy.
- Every backend receives the identical body, so all see the same option order. Option-order sensitivity is real ([JevBench](https://github.com/fstandhartinger/jevbench) measures it) and not covered here.
- Latency includes network time for hosted backends and is specific to the machine that ran the proxy.
- Backends round probabilities differently; the validator allows drift proportional to the option count, and Score is compared both rounded and within ±0.5 level.
- The launch report used Kev-0.8B, not Kev-4B or Jev. See above.

## Contributing

`node --test` runs in under a second and needs no network. Every metric has a test that fails if the formula is inverted. Open issues marked `good first issue` are small and scoped. Disclose substantial AI assistance in a PR, as this repository does: the initial code and documentation were written with Claude Code, and the launch report was produced by running it.

## Related

[jev-by-example](https://github.com/ReallyArtificial/jev-by-example) (the policy suite), [Kev](https://github.com/jaredpalmer/kev), [laya-mlx](https://github.com/mizorewww/laya-mlx), [SemIf](https://github.com/TheoLeeCJ/SemIf), [JevBench](https://github.com/fstandhartinger/jevbench), [jev-benchmarks](https://github.com/AbdelStark/jev-benchmarks).
