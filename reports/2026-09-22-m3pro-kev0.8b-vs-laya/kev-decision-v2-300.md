# stuntdouble report

Generated 2026-09-22T14:57:53.978Z. 300 records, 300 labeled, from 2026-09-22T14:33:44.951Z to 2026-09-22T14:57:43.889Z.

Agreement figures compare each double with the star (**kev-0.8b**, models: kev-latest). They measure whether the double would have produced the same decision, not whether either was right. Accuracy, Brier, ECE and coverage use labels and appear only where labels exist.

## Star: kev-0.8b

| Metric | Value |
| --- | --- |
| Latency p50 / p95 | 220 ms / 1504 ms |
| Cost per 1,000 decisions | n/a (0 priced) |
| Errors | 16 |
| Accuracy vs label | 87.6% (n=348) |
| Brier | 0.200 |
| ECE | 0.059 |
| Coverage at ≤5% error | 65.8% |

## Double: laya

Models: laya:laya-mlx. Available 99.3% of 300 calls.

| Metric | Value |
| --- | --- |
| Label agreement with star | 65.5% (n=348) |
| Agreement, noul questions | 81.7% (n=120) |
| Agreement, choice questions | 60.9% (n=184) |
| Agreement, score questions | 40.9% (n=44) |
| Score within ±0.5 level | 45.5% (mean abs diff 0.91) |
| Latency p50 / p95 | 338 ms / 2637 ms |
| Cost per 1,000 decisions | n/a |
| Accuracy vs label | 65.8% (n=348) |
| Brier | 0.512 |
| ECE | 0.195 |
| Coverage at ≤5% error | 0.0% |

### Confidence-gated agreement

| Double confidence ≥ | Share of traffic | Agreement with star | n |
| --- | --- | --- | --- |
| 0.5 | 74.4% | 69.1% | 259 |
| 0.6 | 67.2% | 71.8% | 234 |
| 0.7 | 61.2% | 72.8% | 213 |
| 0.8 | 50.0% | 77.0% | 174 |
| 0.85 | 42.2% | 76.9% | 147 |
| 0.9 | 34.5% | 75.0% | 120 |
| 0.95 | 29.3% | 71.6% | 102 |

### Swap verdict

No confidence threshold keeps disagreement with kev-0.8b within 5.0% on at least 20 rows. Do not route to **laya** on this traffic without changing the budget or collecting more records.

### Sample disagreements (first 50)

| Record | Question | kev-0.8b | laya | Double conf. | Label |
| --- | --- | --- | --- | --- | --- |
| 6f895d9d | answer | no | yes | 0.83 | no |
| c418843f | decision | director_signoff | auto_approved | 0.21 | director_signoff |
| 2e59edfb | answer_type | human | entity | 0.73 | human |
| 588e3a44 | rating | 3 | 2 | 0.32 | 4 |
| 351567fc | answer_type | number | entity | 0.29 | number |
| b4eacd0f | category | animal | plant | 1.00 | animal |
| bb98c1d3 | decision | yes | no | 0.51 | yes |
| 8d140c6b | stars | 3 | 1 | 0.79 | 1 |
| e9a7635d | stars | 2 | 1 | 0.78 | 2 |
| e96c9154 | category | animal | plant | 0.99 | animal |
| c1e59ccd | intent | card_not_working | declined_transfer | 0.70 | declined_card_payment |
| d0d11b62 | relation | contradiction | neutral | 0.32 | neutral |
| b1e56188 | relation | neutral | entailment | 0.16 | neutral |
| 1f49c3f9 | decision | yes | no | 0.68 | yes |
| 37b9f198 | stars | 2 | 1 | 0.77 | 1 |
| 954c3235 | decision | slightly_over | within_limit | 0.03 | slightly_over |
| 6c360068 | intent | exchange_charge | exchange_rate | 0.99 | exchange_charge |
| 770269d6 | topic | world | business | 0.32 | business |
| 770269d6 | is_business | no | yes | 0.81 | yes |
| c348aee3 | relation | neutral | entailment | 0.24 | entailment |
| f014b480 | sentiment | 3 | 2 | 0.38 | 3 |
| 339b06b5 | decision | director_signoff | auto_approved | 0.22 | director_signoff |
| af3a24c7 | relation | entailment | neutral | 0.17 | entailment |
| ef73f986 | sentiment | 1 | 0 | 0.51 | 1 |
| 514b63ae | intent | none_of_these | top_up_by_cash_or_cheque | 1.00 | none_of_these |
| 0112d731 | intent | card_payment_wrong_exchange_rate | wrong_exchange_rate_for_cash_withdrawal | 1.00 | card_payment_wrong_exchange_rate |
| a7bd33d3 | decision | director_signoff | auto_approved | 0.23 | director_signoff |
| e885308e | positive | yes | no | 1.00 | yes |
| df84417a | topic | scitech | none_of_these | 0.61 | scitech |
| c73ac0f0 | answer_type | human | none_of_these | 0.99 | human |
| f0a1c1e8 | stars | 3 | 1 | 0.54 | 3 |
| f43ad16e | answer_type | human | none_of_these | 1.00 | human |
| cec62b07 | sentiment | 3 | 2 | 0.07 | 3 |
| cee1dfb6 | stars | 1 | 0 | 0.86 | 1 |
| 05a3bbe8 | relation | entailment | neutral | 0.20 | entailment |
| 9dada49f | answer | no | yes | 0.54 | no |
| 6f242498 | relation | neutral | contradiction | 0.34 | neutral |
| 700fcb11 | decision | far_over | within_limit | 0.09 | far_over |
| 230587f7 | decision | director_signoff | auto_approved | 0.20 | director_signoff |
| 99285e8b | positive | yes | no | 1.00 | yes |
| 5eab4c81 | sentiment | 3 | 1 | 0.51 | 3 |
| 69498039 | answer | no | yes | 0.72 | no |
| 9f98ae16 | intent | unable_to_verify_identity | edit_personal_details | 0.98 | unable_to_verify_identity |
| b045befb | is_scitech | no | yes | 0.80 | no |
| 4140d88d | decision | far_over | within_limit | 0.04 | far_over |
| 82c93ff4 | rating | 1 | 2 | 0.54 | 2 |
| c72edbf4 | intent | edit_personal_details | lost_or_stolen_card | 0.91 | edit_personal_details |
| 91beef1c | category | animal | plant | 0.88 | animal |
| 0f0f5b5a | intent | none_of_these | cash_withdrawal_charge | 0.66 | none_of_these |
| 0b3ec964 | sentiment | 1 | 0 | 0.63 | 0 |

---
Latency is measured by the proxy from request send to last byte, on this machine, and includes network time for hosted backends. Cost counts only responses whose returned model matches the priced one. Confidence for Noul is max(p, 1−p); for Choice and Score it is the backend's reported confidence, or the top probability when absent.
