# stuntdouble report

Generated 2026-09-22T15:14:51.253Z. 111 records, 111 labeled, from 2026-09-22T14:58:15.164Z to 2026-09-22T15:14:43.618Z.

Agreement figures compare each double with the star (**kev-0.8b**, models: kev-latest). They measure whether the double would have produced the same decision, not whether either was right. Accuracy, Brier, ECE and coverage use labels and appear only where labels exist.

## Star: kev-0.8b

| Metric | Value |
| --- | --- |
| Latency p50 / p95 | 1073 ms / 17404 ms |
| Cost per 1,000 decisions | n/a (0 priced) |
| Errors | 4 |
| Accuracy vs label | 35.5% (n=107) |
| Brier | 0.782 |
| ECE | 0.226 |
| Coverage at ≤5% error | 0.0% |

## Double: laya

Models: laya:laya-mlx. Available 100.0% of 111 calls.

| Metric | Value |
| --- | --- |
| Label agreement with star | 41.1% (n=107) |
| Agreement, noul questions | 51.4% (n=37) |
| Agreement, choice questions | 31.3% (n=64) |
| Agreement, score questions | 83.3% (n=6) |
| Score within ±0.5 level | 83.3% (mean abs diff 0.32) |
| Latency p50 / p95 | 342 ms / 3129 ms |
| Cost per 1,000 decisions | n/a |
| Accuracy vs label | 38.3% (n=107) |
| Brier | 0.797 |
| ECE | 0.301 |
| Coverage at ≤5% error | 0.0% |

### Confidence-gated agreement

| Double confidence ≥ | Share of traffic | Agreement with star | n |
| --- | --- | --- | --- |
| 0.5 | 37.4% | 50.0% | 40 |
| 0.6 | 29.9% | 50.0% | 32 |
| 0.7 | 16.8% | 50.0% | 18 |
| 0.8 | 11.2% | 50.0% | 12 |
| 0.85 | 5.6% | 66.7% | 6 |
| 0.9 | 0.0% | n/a | 0 |
| 0.95 | 0.0% | n/a | 0 |

### Swap verdict

No confidence threshold keeps disagreement with kev-0.8b within 5.0% on at least 20 rows. Do not route to **laya** on this traffic without changing the budget or collecting more records.

### Sample disagreements (first 50)

| Record | Question | kev-0.8b | laya | Double conf. | Label |
| --- | --- | --- | --- | --- | --- |
| e889c3bd | answer | deny_vacancy_exclusion | deny_repeated_seepage | 0.14 | pay_subject_to_15000_sublimit |
| 712717b0 | answer | not_covered | full_repair_no_charge | 0.06 | parts_covered_labour_charged |
| b44484da | answer | no_license_required | license_exception_lvs | 0.21 | license_required |
| 631d79db | answer | no | yes | 0.51 | yes |
| 05fccfdb | answer | no | yes | 0.66 | yes |
| 4f965e42 | answer | late | early | 0.03 | on_time |
| 1ffcb778 | answer | reopened | escalated | 0.04 | escalated |
| 05faa705 | answer | no | yes | 0.64 | yes |
| 7e6ae109 | answer | sep_24 | sep_26 | 0.01 | sep_26 |
| 1783cec9 | answer | false_positive | real_incident | 0.11 | real_incident |
| 1cf28c64 | answer | insufficient_information | within_limitation | 0.08 | time_barred |
| b3fc24b1 | answer | grade_correct | grade_should_be_higher | 0.04 | cannot_determine |
| 5b52083a | answer | cannot_determine | split_50_50 | 0.04 | cannot_determine |
| a0ab36be | answer | tier2_department_head | tier3_cfo | 0.00 | tier3_cfo |
| 7ddc1947 | answer | dmitri | no_page_ticket_only | 0.72 | bjorn |
| f319dbb3 | answer | no | yes | 0.55 | yes |
| f290e754 | answer | attended | no_show | 0.19 | attended |
| 1bbe1ab7 | answer | overturned | upheld | 0.11 | upheld |
| eb718f82 | answer | order_c | order_b | 0.11 | order_b |
| 93b90f65 | answer | no | yes | 0.62 | yes |
| be6889b1 | answer | p2_fix_30d | p0_fix_24h | 0.05 | p0_fix_24h |
| 274911d4 | answer | no | yes | 0.63 | yes |
| 70da6a61 | answer | wait_for_inspection | refund_now | 0.07 | refund_now |
| fff9dfbd | answer | restrict_all_pending_legal_hold | erase_all | 0.04 | erase_but_retain_transaction_records |
| 4f76038a | answer | eur_0 | eur_150 | 0.09 | eur_400 |
| a6fee2a4 | answer | ortega_seal_works | halvorsen_polymer | 0.04 | kuznets_technik |
| 3fbab6a4 | answer | eur_617_00 | eur_688_00 | 0.06 | eur_692_00 |
| 9fcc6463 | answer | usd_2222_50 | usd_2303_33 | 0.02 | usd_2335_00 |
| b0d1609e | answer | eur_497_40 | eur_498_81 | 0.03 | eur_498_81 |
| e0684a17 | answer | deny_missing_approval | grant_access | 0.04 | deny_missing_approval |
| 9097dbf0 | answer | no | yes | 0.86 | no |
| 5337fe6c | answer | delete_now | retain_until_2031 | 0.09 | retain_until_2031 |
| 21e598cb | answer | reject_cutoff | accept_s2_dusk | 0.34 | accept_s2_dusk |
| 3fdd8c67 | answer | insufficient_information | heron_q2 | 0.08 | security_primary |
| dd856d48 | answer | reject_category | pay_manager_approved | 0.13 | require_director |
| b76767a9 | answer | insufficient_log | local_maintenance | 0.12 | central_engineering |
| a5ffc3c7 | answer | switch_l4 | confirm_l3 | 0.05 | require_steward |
| 77888044 | answer | deny_sensitive | needs_field_review | 0.06 | approve_45_days |
| 24e4ba48 | answer | wrong_issue_class | covered_recurrence | 0.06 | needs_authentication |
| edf5ccb6 | answer | no | yes | 0.82 | no |
| ee304f4d | answer | no | yes | 0.83 | no |
| f6b940cc | answer | 1 | 2 | 0.04 | 0 |
| a7d6c108 | answer | blocked_second_review | ready_two_reviews | 0.06 | blocked_second_review |
| 37ae5f85 | answer | no | yes | 0.77 | no |
| da341c73 | answer | no | yes | 0.85 | no |
| 1a00e421 | answer | yes | no | 0.62 | yes |
| ac53a5c9 | answer | yes | no | 0.80 | no |
| c02e8414 | answer | yes | no | 0.55 | no |
| 926991c9 | answer | yes | no | 0.57 | yes |
| 216431f7 | answer | deny_current_export | privacy_and_security | 0.04 | deny_current_export |

---
Latency is measured by the proxy from request send to last byte, on this machine, and includes network time for hosted backends. Cost counts only responses whose returned model matches the priced one. Confidence for Noul is max(p, 1−p); for Choice and Score it is the backend's reported confidence, or the top probability when absent.
