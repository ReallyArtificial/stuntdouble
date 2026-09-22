# Metrics

Every number in a stuntdouble report is computed by a pure function in `src/compare.mjs` or `src/verdict.mjs`, and each one has a test in `test/` that fails if the formula is inverted or off by one. This page is the contract.

## Units

A **row** is one (record, question) pair for one double. A record with three questions produces three rows. Agreement is reported per row, so a request with many questions weighs more than a request with one. Rows where the double errored (timeout, non-200, invalid response shape) are excluded from every agreement and calibration figure and counted separately under *availability*.

## Selecting an answer

| Primitive | Selected answer | Confidence |
| --- | --- | --- |
| Noul | `yes` if `noul ≥ 0.5` (override with `--noul-threshold`), else `no` | `max(noul, 1 − noul)` |
| Choice | `choice` | the backend's `confidence`, else the top probability |
| Score | `round(score)` | the backend's `confidence`, else the top level probability |

Score is also compared on the raw value: *within ±0.5 level* and mean absolute difference are reported beside the rounded agreement.

## Agreement with the star

`agreement = rows where doubleSelected == starSelected / valid rows`

This says whether the double would have made the same decision as the star. It is not accuracy. If the star is wrong, a double that agrees is also wrong.

**Confidence-gated agreement.** For each threshold t in {0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95}: agreement restricted to rows where the double's confidence ≥ t, plus the share of valid rows that clear t (coverage). The star's confidence plays no part; the question is whether *the double's own confidence* predicts agreement.

**Policy agreement.** Only for suites that carry application code (`suite run jbe:<path>`). The policy's `decide(state, answers)` runs once with the star's answers and once with each double's, and the two decisions are compared on `action` and every other returned field except `reason`. This is the one number the label-level benchmarks cannot produce: it says whether swapping the model changes what the application does.

## Against labels

These use `label` on a record (from a suite importer or the `x-stuntdouble-label` header) and are reported for the star and each double.

- **Accuracy**: selected answer equals the label.
- **Brier**: mean over rows of Σ (p_k − y_k)² over the answer keys, with y the one-hot label or the gold distribution when the suite supplies one. Perfect one-hot is 0; uniform over four options is 0.75.
- **ECE**: ten equal-width bins on confidence; Σ (n_b / n) · |mean confidence_b − accuracy_b|.
- **Coverage at ≤5% error**: sort rows by confidence descending; accept rows in order; stop before the accepted set's error rate exceeds the budget. Rows with identical confidence are admitted as a whole group or not at all, following AbdelStark/jev-benchmarks v2. Coverage is accepted rows / labeled rows.

## Latency, availability, cost

- **Latency**: p50 and p95 of milliseconds from request send to last byte received, measured by the proxy or the suite runner on the machine it ran on. For hosted backends this includes network time.
- **Availability**: double calls that returned 200 with a valid answer set within the timeout, over all double calls.
- **Cost**: USD per 1,000 decisions. `input_tokens × pricePerMillionInput / 1e6`, averaged over responses whose returned `model` equals the priced model in the config, then ×1000. Doubles cost 0 unless a price is configured for them.

## Swap verdict

Given a maximum disagreement d (default 2%) and a minimum row count (default 20), the verdict is the **lowest** threshold t whose gated agreement is ≥ 1 − d on at least that many rows. The report then states coverage (share of traffic that would go to the double), the observed disagreement at t, the latency comparison, and the saving per 1,000 decisions: `coverage × (star cost − double cost)`.

If no threshold qualifies the report says so. The verdict is always relative to the star; on labeled suites read it beside the accuracy rows.
