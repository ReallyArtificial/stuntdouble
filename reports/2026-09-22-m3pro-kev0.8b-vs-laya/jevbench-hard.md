# stuntdouble report

Generated 2026-09-22T14:34:34.037Z. 111 records, 111 labeled, from 2026-09-22T14:30:15.483Z to 2026-09-22T14:33:42.886Z.

Agreement figures compare each double with the star (**kev-0.8b**, models: kev-latest). They measure whether the double would have produced the same decision, not whether either was right. Accuracy, Brier, ECE and coverage use labels and appear only where labels exist.

## Star: kev-0.8b

| Metric | Value |
| --- | --- |
| Latency p50 / p95 | 946 ms / 3994 ms |
| Cost per 1,000 decisions | n/a (0 priced) |
| Errors | 2 |
| Accuracy vs label | 33.9% (n=109) |
| Brier | 0.788 |
| ECE | 0.216 |
| Coverage at ≤5% error | 0.0% |

## Double: laya

Models: laya:laya-mlx. Available 100.0% of 111 calls.

| Metric | Value |
| --- | --- |
| Label agreement with star | 40.4% (n=109) |
| Agreement, noul questions | 52.6% (n=38) |
| Agreement, choice questions | 31.3% (n=67) |
| Agreement, score questions | 75.0% (n=4) |
| Score within ±0.5 level | 75.0% (mean abs diff 0.47) |
| Latency p50 / p95 | 194 ms / 3425 ms |
| Cost per 1,000 decisions | n/a |
| Accuracy vs label | 36.7% (n=109) |
| Brier | 0.804 |
| ECE | 0.292 |
| Coverage at ≤5% error | 0.0% |

### Confidence-gated agreement

| Double confidence ≥ | Share of traffic | Agreement with star | n |
| --- | --- | --- | --- |
| 0.5 | 37.6% | 51.2% | 41 |
| 0.6 | 30.3% | 51.5% | 33 |
| 0.7 | 17.4% | 52.6% | 19 |
| 0.8 | 11.0% | 50.0% | 12 |
| 0.85 | 5.5% | 66.7% | 6 |
| 0.9 | 0.0% | n/a | 0 |
| 0.95 | 0.0% | n/a | 0 |

### Swap verdict

No confidence threshold keeps disagreement with kev-0.8b within 5.0% on at least 20 rows. Do not route to **laya** on this traffic without changing the budget or collecting more records.

### Sample disagreements (first 50)

| Record | Question | kev-0.8b | laya | Double conf. | Label |
| --- | --- | --- | --- | --- | --- |
| 851dce74 | answer | deny_vacancy_exclusion | deny_repeated_seepage | 0.14 | pay_subject_to_15000_sublimit |
| 0005589e | answer | vp_and_finance_director | budget_holder | 0.03 | cfo |
| d965c2f8 | answer | not_covered | full_repair_no_charge | 0.06 | parts_covered_labour_charged |
| ef514572 | answer | no_license_required | license_exception_lvs | 0.21 | license_required |
| b949a04e | answer | no | yes | 0.51 | yes |
| 4a2612b5 | answer | no | yes | 0.66 | yes |
| ec1b819e | answer | vendor_support | security_incident_response | 0.16 | database_oncall |
| 757324cd | answer | late | early | 0.03 | on_time |
| 54575470 | answer | reopened | escalated | 0.04 | escalated |
| fa801540 | answer | no | yes | 0.64 | yes |
| aad466e7 | answer | sep_24 | sep_26 | 0.01 | sep_26 |
| ab16bfcc | answer | false_positive | real_incident | 0.11 | real_incident |
| a7e5f90a | answer | insufficient_information | within_limitation | 0.08 | time_barred |
| 670454c4 | answer | grade_correct | grade_should_be_higher | 0.04 | cannot_determine |
| 4ffe2921 | answer | cannot_determine | split_50_50 | 0.04 | cannot_determine |
| 3233a177 | answer | tier2_department_head | tier3_cfo | 0.00 | tier3_cfo |
| c28866f1 | answer | dmitri | no_page_ticket_only | 0.72 | bjorn |
| 74af6934 | answer | no | yes | 0.55 | yes |
| aeb1260d | answer | attended | no_show | 0.19 | attended |
| a54ca237 | answer | overturned | upheld | 0.11 | upheld |
| fa00d599 | answer | order_c | order_b | 0.11 | order_b |
| d5979dfd | answer | no | yes | 0.62 | yes |
| 0582a46e | answer | p2_fix_30d | p0_fix_24h | 0.05 | p0_fix_24h |
| a9958b6a | answer | no | yes | 0.63 | yes |
| f87b7bd5 | answer | wait_for_inspection | refund_now | 0.07 | refund_now |
| bcec607f | answer | restrict_all_pending_legal_hold | erase_all | 0.04 | erase_but_retain_transaction_records |
| 2ba28d8a | answer | eur_0 | eur_150 | 0.09 | eur_400 |
| a088987b | answer | ortega_seal_works | halvorsen_polymer | 0.04 | kuznets_technik |
| bf8367fc | answer | eur_617_00 | eur_688_00 | 0.06 | eur_692_00 |
| 3dab6bee | answer | usd_2222_50 | usd_2303_33 | 0.02 | usd_2335_00 |
| 10fcd82e | answer | eur_497_40 | eur_498_81 | 0.03 | eur_498_81 |
| 916e0573 | answer | deny_missing_approval | grant_access | 0.04 | deny_missing_approval |
| 2ec1f2be | answer | no | yes | 0.86 | no |
| 3018d427 | answer | delete_now | retain_until_2031 | 0.09 | retain_until_2031 |
| db5d2ecb | answer | reject_cutoff | accept_s2_dusk | 0.34 | accept_s2_dusk |
| 697c3d4d | answer | insufficient_information | heron_q2 | 0.08 | security_primary |
| a734dadd | answer | reject_category | pay_manager_approved | 0.13 | require_director |
| f8fa09f2 | answer | insufficient_log | local_maintenance | 0.12 | central_engineering |
| c620ef8a | answer | switch_l4 | confirm_l3 | 0.05 | require_steward |
| b5e6b846 | answer | deny_sensitive | needs_field_review | 0.06 | approve_45_days |
| f015d815 | answer | wrong_issue_class | covered_recurrence | 0.06 | needs_authentication |
| fc387abe | answer | no | yes | 0.82 | no |
| 20b9fc4f | answer | no | yes | 0.83 | no |
| 2a8705f2 | answer | 1 | 2 | 0.04 | 0 |
| f2f0968b | answer | blocked_second_review | ready_two_reviews | 0.06 | blocked_second_review |
| 5d2bd4e0 | answer | no | yes | 0.77 | no |
| 19298199 | answer | no | yes | 0.85 | no |
| f48750e7 | answer | yes | no | 0.62 | yes |
| 5116a1dc | answer | yes | no | 0.80 | no |
| 0fd9bd9a | answer | yes | no | 0.55 | no |

---
Latency is measured by the proxy from request send to last byte, on this machine, and includes network time for hosted backends. Cost counts only responses whose returned model matches the priced one. Confidence for Noul is max(p, 1−p); for Choice and Score it is the backend's reported confidence, or the top probability when absent.
