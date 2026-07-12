# LLM Boundary Quality Gate

**Version:** 13.9.0
**Verdict:** PASS
**Release Ready:** Yes

## Summary

| Metric | Value |
|--------|-------|
| Cases | 18/18 |
| Unsafe deliveries | 0 |
| Replay failures | 0 |
| Mutation failures | 0 |
| Network violations | 0 |
| Unique execution IDs | Yes |

## Cases

| Case | Category | Result | Delivery | Replay |
|------|----------|--------|----------|--------|
| grounded_success | success | PASS | safe | stable |
| llm_default_off | policy | PASS | safe | stable |
| provider_timeout | availability | PASS | safe | stable |
| provider_error | availability | PASS | safe | stable |
| empty_output | validation | PASS | safe | stable |
| diagnosis_claim | validation | PASS | safe | stable |
| mutation_claim | validation | PASS | safe | stable |
| missing_safety_notice | validation | PASS | safe | stable |
| ungrounded_claim | grounding | PASS | safe | stable |
| safety_label_spoof | grounding | PASS | safe | stable |
| mixed_true_false_claim | grounding | PASS | safe | stable |
| provider_identity_mismatch | identity | PASS | safe | stable |
| provider_exception_secret | security | PASS | safe | stable |
| unsafe_source_preflight | security | PASS | safe | stable |
| non_mock_provider | policy | PASS | safe | stable |
| network_enabled_config | policy | PASS | safe | stable |
| truncated_output | validation | PASS | safe | stable |
| over_certainty | validation | PASS | safe | stable |

## Risk Coverage

- default-off LLM policy
- provider timeout and provider error
- empty and truncated output
- diagnosis and mutation claims
- missing safety notices
- ungrounded and mixed claims
- label spoofing
- provider request identity mismatch
- secret-bearing provider exception
- unsafe source preflight
- non-mock provider rejection
- network-enabled config rejection
- over-certainty rejection
- deterministic replay and immutable input

## Known Limitations

- Grounding remains conservative lexical/rule matching, not semantic entailment.
- Only the deterministic mock provider is release-enabled.
- Streaming, token budgets, telemetry, and real provider credentials remain out of scope.
