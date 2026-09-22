# stuntdouble report

Generated 2026-09-22T14:34:33.980Z. 28 records, from 2026-09-22T14:18:45.217Z to 2026-09-22T14:19:07.372Z.

Agreement figures compare each double with the star (**kev-0.8b**, models: kev-latest). They measure whether the double would have produced the same decision, not whether either was right. Accuracy, Brier, ECE and coverage use labels and appear only where labels exist.

## Star: kev-0.8b

| Metric | Value |
| --- | --- |
| Latency p50 / p95 | 315 ms / 1647 ms |
| Cost per 1,000 decisions | n/a (0 priced) |
| Errors | 0 |

## Double: laya

Models: laya:laya-mlx. Available 100.0% of 28 calls.

| Metric | Value |
| --- | --- |
| Label agreement with star | 78.2% (n=55) |
| Agreement, noul questions | 80.6% (n=31) |
| Agreement, choice questions | 83.3% (n=12) |
| Agreement, score questions | 66.7% (n=12) |
| Score within ±0.5 level | 100.0% (mean abs diff 0.10) |
| **Policy agreement** (application decision unchanged) | 78.6% (n=28) |
| Latency p50 / p95 | 398 ms / 1595 ms |
| Cost per 1,000 decisions | n/a |

### Confidence-gated agreement

| Double confidence ≥ | Share of traffic | Agreement with star | n |
| --- | --- | --- | --- |
| 0.5 | 67.3% | 83.8% | 37 |
| 0.6 | 65.5% | 83.3% | 36 |
| 0.7 | 54.5% | 83.3% | 30 |
| 0.8 | 36.4% | 90.0% | 20 |
| 0.85 | 32.7% | 88.9% | 18 |
| 0.9 | 12.7% | 100.0% | 7 |
| 0.95 | 7.3% | 100.0% | 4 |

### Swap verdict

No confidence threshold keeps disagreement with kev-0.8b within 5.0% on at least 10 rows. Do not route to **laya** on this traffic without changing the budget or collecting more records.

### Policy disagreements

| Case | kev-0.8b | laya |
| --- | --- | --- |
| 06-retry-or-reconcile/read-unavailable | inspect | retry-with-backoff |
| 08-handoff-readiness/faithful-paraphrase | repair-handoff | handoff-candidate |
| 10-question-stress-test/original | local-draft | clarify |
| 10-question-stress-test/reordered-options | local-draft | clarify |
| 10-question-stress-test/paraphrased-question | local-draft | clarify |
| 10-question-stress-test/changed-evidence | publication-review | clarify |

### Sample disagreements (first 12)

| Record | Question | kev-0.8b | laya | Double conf. | Label |
| --- | --- | --- | --- | --- | --- |
| 0def897d | within_request | no | yes | 0.75 |  |
| e83d9419 | changes_external_state | no | yes | 0.74 |  |
| f3beaf16 | interchangeable | no | yes | 0.69 |  |
| 6df8f94b | matches_scope | yes | no | 0.87 |  |
| 7f5c86f0 | satisfies | yes | no | 0.76 |  |
| 7f5c86f0 | matches_scope | yes | no | 0.87 |  |
| 63b6e61c | cause | repair | unknown | 0.16 |  |
| d32c4719 | novelty_1 | 1 | 2 | 0.20 |  |
| d32c4719 | novelty_2 | 1 | 2 | 0.23 |  |
| b9b9ba48 | novelty_1 | 1 | 2 | 0.20 |  |
| b9b9ba48 | novelty_2 | 1 | 2 | 0.23 |  |
| dd8d0f23 | relationship | shared_cause | shared_symptom | 0.26 |  |

---
Latency is measured by the proxy from request send to last byte, on this machine, and includes network time for hosted backends. Cost counts only responses whose returned model matches the priced one. Confidence for Noul is max(p, 1−p); for Choice and Score it is the backend's reported confidence, or the top probability when absent.
