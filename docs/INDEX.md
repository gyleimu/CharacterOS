# CharacterOS Documentation Index

## Active Core Roadmap

| Doc | Description |
|-----|-------------|
| [Core Calibration & Durability Roadmap](core_calibration_durability_roadmap.md) | LLM safety, temporal semantics, model calibration, durable state, and dependency governance |
| [Personality Dynamics Scientific Model](personality_dynamics_scientific_model_design.md) | Research-backed trait-state separation, TESSERA evidence, attractor dynamics, consolidation, and validation plan |
| [Dependency Security Policy](dependency_security_policy.md) | High/critical CI blocking, moderate risk registry, and compatible upgrade policy |

## Temporal Semantics

| Doc | Description |
|-----|-------------|
| [Temporal Semantics Core Report](v14.0_temporal_semantics_report.md) | Event clock, density saturation, elapsed-time recovery, ordering safety, replay audit, and residual calibration risks |
| [Model Calibration Report](v14.1_model_calibration_report.md) | Versioned parameters, Golden Trajectory, properties, metamorphic checks, sensitivity, and repair asymmetry |

## V13 LLM Boundary & Determinism

| Doc | Description |
|-----|-------------|
| [V13.0 LLM Boundary Charter](v13.0_llm_boundary_adapter_design_charter.md) | LLM as replaceable language adapter, never state authority |
| [V13.1 LLM Boundary DTOs](v13.1_llm_boundary_dto_types_report.md) | Safe deterministic boundary contracts |
| [V13.2 Prompt Builder](v13.2_llm_boundary_prompt_builder_report.md) | Grounded prompt construction and redaction |
| [V13.3 Determinism Hardening](v13.3_determinism_boundary_hardening_report.md) | Content-derived IDs and replay audit |
| [V13.4 Metrics Reconciliation](v13.4_release_metrics_reconciliation_report.md) | Release metric consistency |
| [V13.5 AST Scanner](v13.5_ast_determinism_scanner_hardening_report.md) | Context-aware runtime nondeterminism scanner |
| [V13.6 Branch Reconciliation](v13.6_branch_test_coverage_reconciliation_report.md) | LLM and determinism branches integrated into one release line |
| [V13.7 LLM Boundary Integration](v13.7_llm_boundary_integration_qa_report.md) | Agent reply plan to safe offline LLM boundary preview |
| [V13.8 Mock Provider Harness](v13.8_mock_provider_harness_report.md) | Offline provider, validation, grounding, fallback, and static audit artifact |
| [V13.9 LLM Boundary QA / RC](v13.9_llm_boundary_quality_gate_rc_report.md) | 18-case quality gate, adversarial replay, artifact seal, and Mock-only RC |

## V12 Agent SDK (Complete RC)

| Doc | Description |
|-----|-------------|
| [V12.0 Agent SDK Design Charter](v12.0_character_agent_sdk_design_charter.md) | Embeddable SDK architecture, 8 modules, safety model |
| [V12.10 Agent SDK RC](v12.10_agent_sdk_release_candidate_report.md) | Agent SDK release candidate QA |

## V11 Explorer (Complete)

| Doc | Description |
|-----|-------------|
| [V11.0 Explorer Design Charter](v11.0_characteros_explorer_design_charter.md) | 6-module platform architecture, DTO roadmap, prohibitions |
| [V11.1 DTO Types](v11.1_explorer_dto_types_report.md) | 9 core DTOs + 20 supporting types |
| [V11.2 Event Studio Preview](v11.2_event_studio_preview_core_report.md) | Parse/impact/full preview pipeline |
| [V11.3 Event Studio Apply](v11.3_event_studio_apply_boundary_report.md) | Confirmation-gated write boundary |
| [V11.4 Character State Surface](v11.4_character_state_surface_core_report.md) | Human-readable state from raw physics |
| [V11.5 Explainability Timeline](v11.5_explainability_timeline_core_report.md) | Evidence-grounded causal chain |
| [V11.6 Time Machine Snapshot](v11.6_time_machine_snapshot_core_report.md) | Deterministic immutable snapshots |
| [V11.7 Time Machine Restore](v11.7_time_machine_restore_view_core_report.md) | Historical view with safety banners |
| [V11.8 Explorer API Boundary](v11.8_explorer_api_boundary_report.md) | Service layer, 9 methods, structured errors |
| [V11.9 Static Explorer Artifact](v11.9_static_explorer_artifact_report.md) | Offline read-only artifact package |
| [V11.10 Explorer RC](v11.10_explorer_release_candidate_report.md) | QA, RC manifest, release candidate seal |

## V10 RC (Current)

| Doc | Description |
|-----|-------------|
| [v10.78 RC Freeze Audit](v10.78_release_candidate_freeze_audit_report.md) | RC verification: determinism, mutation safety, gates |
| [v10.77 Known Warning Burn-down](v10.77_known_warning_burndown_report.md) | Warning classification, registry, active→0 |
| [v10.76 Quality Trend Baseline](v10.76_quality_trend_baseline_regression_history_report.md) | Regression history tracking |
| [v10.75 Unified Quality Gate](v10.75_benchmark_reality_unified_quality_gate_report.md) | Benchmark + Reality merged |
| [v10.74 Core Reality Regression Gate](v10.74_core_reality_regression_gate_report.md) | Aggregate regression gate |
| [v10.73 Event Type Coverage](v10.73_event_type_coverage_calibration_report.md) | 10 event types × baselines × scenarios |
| [v10.72 Force Saturation + Trust Repair](v10.72_galaxy_force_saturation_trust_repair_report.md) | Diminishing returns, support repair |
| [v10.71 Long-Term Accumulation](v10.71_long_term_accumulation_calibration_report.md) | Personality as slow channel |
| [v10.70 Boundary Repair](v10.70_boundary_positive_support_calibration_repair_report.md) | Support boundary over-response fix |
| [v10.69 Impact Calibration](v10.69_impact_personality_calibration_audit_report.md) | Channel delta expected vs actual |
| [v10.79 RC Seal](v10.79_rc_documentation_seal_report.md) | Documentation sync + RC manifest |
| [v10.80 Post-RC Hardening](v10.80_post_rc_repository_hardening_report.md) | Scripts, .gitignore, CHANGELOG, CONTRIBUTING |

## Architecture & Design

| Doc | Description |
|-----|-------------|
| [Architecture Bible](architecture_bible.md) | System architecture constitution |
| [Core Logic & Personality Drift Audit](core_logic_personality_drift_audit.md) | Core chain validity, fixed drift defects, residual risks, test strategy |
| [Character Physics Upgrade Blueprint](character_physics_upgrade_blueprint.md) | Physics engine design |
| [Core Polish Plan](core_polish_plan.md) | V3.7 polish roadmap |
| [Parameter System](parameter_system.md) | Parameter evolution design |
| [Homeostasis System](homeostasis_system.md) | Homeostasis/adaptation design |
| [Recovery System](recovery_system.md) | Recovery mechanics |

## V10 Design Charters

| Doc | Description |
|-----|-------------|
| [V10 Continuous Life Charter](v10_continuous_life_design_charter.md) | Longitudinal simulation design |
| [V9 Character Editor Charter](v9_character_editor_design_charter.md) | Editor design (pre-V10) |
| [V8 Graph Viewer Charter](v8_graph_viewer_design_charter.md) | Graph viewer design |
| [V7 Graph Data Model Charter](v7_graph_data_model_design_charter.md) | Graph data model |
| [V6 Benchmark Charter](v6_benchmark_design_charter.md) | Benchmark system design |

## V3.x Core Reports (Selected)

| Doc | Description |
|-----|-------------|
| [V3.8 Project Progress](v3.8_project_progress_report.md) | V3.x project summary |
| [V3.7.62 Import Transaction Steps](v3.7.62_import_transaction_steps_report.md) | Import transaction boundary |
| [V3.7.50 Blueprint Foundation](v3.7.50_character_blueprint_foundation_report.md) | Character blueprint system |
| [V3.7.48 Frontend Removal](v3.7.48_frontend_visualization_removal_report.md) | Frontend/dashboard removal |
| [V3.7.4 Core Polish Sweep](v3.7.4_core_polish_sweep_report.md) | Core polish pass |
| [V3.4 Self Check](v3.4_self_check_report.md) | V3.4 integrity check |

## V2.x Galaxy Reports

| Doc | Description |
|-----|-------------|
| [V2 Personality Galaxy](v2_personality_galaxy_report.md) | Galaxy engine introduction |
| [V2.3 Core Convergence](v2.3_core_convergence_report.md) | Core system convergence |
| [V2.21 Continuous Tick](v2.21_continuous_tick_foundation_report.md) | Continuous tick foundation |
| [V2.30 Procedural Reinforcement](v2.30_procedural_reinforcement_loop_report.md) | Procedural memory loop |

## V1.x & V0.x

| Doc | Description |
|-----|-------------|
| [V1.0 Report](v1.0_report.md) | Initial character physics |
| [V0.9 Report](v0.9_report.md) | Pre-physics prototype |
| [TypeScript Core Migration](typescript_core_migration.md) | Python → TypeScript migration |

---

**Current Line:** Temporal Semantics core complete on top of V13.9 Mock-only LLM Boundary RC
**Last Updated:** 2026-07-13
