# CharacterOS 100 Test Cases — Run Results

说明：本次运行是 deterministic proxy evaluation。它使用 CharacterOS 核心状态、事件处理、derived decision 与 V10 life dry-run 信号进行方向性判定；不使用 LLM，也不把结果解释为心理诊断。

- Total: 100
- PASS: 98
- WARN: 2
- FAIL: 0
- Average score: 0.987

| # | ID | Verdict | Score | Choice / Answer | Top action | Top candidates | Expected | Misses |
|---:|---|---:|---:|---|---|---|---|---|
| 1 | tc_001_abandoned_child_trust_decision | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | revisit_memory / withdraw / write_note | 不应立刻完全信任；应先接受低风险合作，并保留观察与备选方案 |  |
| 2 | tc_002_perfectionist_failure_response | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / revisit_memory / write_note | 先出现羞耻和自责，再转向复盘；不应轻易摆烂或把责任全推给别人 |  |
| 3 | tc_003_curious_low_boundary_risky_invitation | WARN | 0.50 | 选择礼貌但拉开距离，暂时不暴露核心需求。 | 表现得克制、冷淡，避免暴露依赖。 | withdraw / avoid_message / write_note | 会被吸引，但应提出信息核验；低边界角色可出现犹豫或轻度冒险倾向 | boundary_signal: boundary.integrity=0.43, action=表现得克制、冷淡，避免暴露依赖。 |
| 4 | tc_004_hypervigilant_kindness_interpretation | WARN | 0.50 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 第一反应应怀疑动机；后续若证据稳定，怀疑逐渐下降而非瞬间消失 | approach_or_recovery: resilience=0.52, trust=0.24, candidates=write_note/withdraw/avoid_m… |
| 5 | tc_005_lonely_proud_reconnection_choice | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | revisit_memory / withdraw / write_note | 不应立刻热情回应；应礼貌但保留，关注对方解释是否具体可信 |  |
| 6 | tc_006_empathic_conflict_boundary_test | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 应感到内疚，但成熟反应是表达理解并给出有限帮助，而非完全牺牲自己 |  |
| 7 | tc_007_rational_detached_emotional_accusation | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 初始倾向解释事实；若成长不足会防御，若成长较好应先承认对方感受 |  |
| 8 | tc_008_recovered_character_new_choice | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / revisit_memory / write_note | 不应完全回到旧模式；应表现出谨慎评估与尝试性开放 |  |
| 9 | tc_009_shame_avoidant_feedback_response | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / revisit_memory / write_note | 会先把反馈理解成否定自己；稳定后应能区分作品问题和自我价值 |  |
| 10 | tc_010_caregiver_burnout_help_request | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 初始可能说没事；若压力超阈值，应出现迟疑后提出具体小请求 |  |
| 11 | tc_011_sibling_comparison_praise_split | PASS | 1.00 | 选择礼貌但拉开距离，暂时不暴露核心需求。 | 表现得克制、冷淡，避免暴露依赖。 | write_note / withdraw / avoid_message | 应对比较内容高度敏感；可能忽略夸奖，转而关注差距和自我证明 |  |
| 12 | tc_012_betrayed_friend_secret_test | PASS | 1.00 | 选择礼貌但拉开距离，暂时不暴露核心需求。 | 表现得克制、冷淡，避免暴露依赖。 | write_note / withdraw / avoid_message | 不会直接透露核心信息；可能用非关键细节试探对方保密能力 |  |
| 13 | tc_013_scarcity_opportunity_choice | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 会优先计算失败成本；除非有安全垫，否则倾向选择稳妥路径 |  |
| 14 | tc_014_overprotected_autonomy_decision | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 应出现依赖外部建议的冲动；成长线可表现为先小范围试错 |  |
| 15 | tc_015_bullied_freeze_reaction | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 可能先僵住或沉默；后续根据支持程度选择离开、解释或反击 |  |
| 16 | tc_016_neglected_attention_seeking | PASS | 1.00 | 选择礼貌但拉开距离，暂时不暴露核心需求。 | 表现得克制、冷淡，避免暴露依赖。 | revisit_memory / withdraw / avoid_message | 可能提高表达强度或做出夸张补充；成熟版本会明确请求被听完 |  |
| 17 | tc_017_controlling_parent_choice_conflict | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 表面可能先答应；内在冲突升高，最终选择取决于自我感强度 |  |
| 18 | tc_018_gifted_impostor_challenge | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 会同时兴奋和恐惧；可能过度准备，避免暴露不会的部分 |  |
| 19 | tc_019_avoidant_intimacy_disclosure | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 倾向轻描淡写或转移话题；安全感足够时才透露一小部分 |  |
| 20 | tc_020_anxious_delayed_reply | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / check_phone / write_note | 应产生明显不安和脑补；成熟版本会直接询问而非连续追问 |  |
| 21 | tc_021_people_pleaser_unfair_request | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 初始倾向答应；若边界系统有效，应提出限制条件或拒绝一部分 |  |
| 22 | tc_022_moral_rigid_gray_zone | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 应强烈不适并要求澄清底线；不应轻易为了利益妥协 |  |
| 23 | tc_023_rebellious_authority_rule | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 会先质疑合理性；若被压制，可能转为消极抵抗或公开挑战 |  |
| 24 | tc_024_numb_survivor_celebration | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 不应表现出强烈兴奋；可能平静、空白，甚至因放松而疲惫 |  |
| 25 | tc_025_naive_optimist_scam_warning | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 会先相信对方；若系统合理，应在证据提醒下补做核验 |  |
| 26 | tc_026_cynical_kindness_exception | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 会用玩笑削弱感动；长期证据积累后才承认对方可靠 |  |
| 27 | tc_027_stoic_support_request | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / revisit_memory / write_note | 先拒绝或说能处理；压力继续升高时可接受工具性帮助 |  |
| 28 | tc_028_possessive_loyalty_conflict | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 会把合作变化解读成被替代；可能试探、冷淡或证明自己价值 |  |
| 29 | tc_029_shame_apology_demand | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 应在愧疚和反感间拉扯；可能先防御，后私下补救 |  |
| 30 | tc_030_novelty_seeker_boredom_escape | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / revisit_memory / write_note | 会迅速厌倦并寻找捷径；成熟版本会设计游戏化或阶段奖励 |  |
| 31 | tc_031_guilt_caretaker_no_response | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / revisit_memory / write_note | 倾向认为是自己做错；应出现主动关心但避免过度承担 |  |
| 32 | tc_032_public_mistake_recovery | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 短暂慌乱后应尝试控制流程；严重时可能过度道歉 |  |
| 33 | tc_033_distrustful_collaboration_contract | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 应要求书面分工、节点检查和责任边界；不应只靠口头承诺 |  |
| 34 | tc_034_insecure_creator_criticism | PASS | 1.00 | 选择礼貌但拉开距离，暂时不暴露核心需求。 | 表现得克制、冷淡，避免暴露依赖。 | revisit_memory / withdraw / write_note | 先感到被否定；若稳定，应追问具体问题并保留创作主动权 |  |
| 35 | tc_035_rescued_loyalty_debt | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 会因亏欠感难以拒绝；成熟反应是感谢恩情但区分当前请求 |  |
| 36 | tc_036_boundaryless_friendship_loan | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 不应简单答应；应出现压力并尝试给出可承受替代方案 |  |
| 37 | tc_037_avoidant_leader_crisis | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 会优先解决问题而非表达情绪；风险是忽略团队安抚 |  |
| 38 | tc_038_conflict_avoidant_negotiation | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 可能先退让；若内在压力累积，应在安全语气下提出底线 |  |
| 39 | tc_039_truth_teller_social_pressure | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 应倾向说出问题；成熟版本会换成建设性表达而非直接拆台 |  |
| 40 | tc_040_status_anxiety_comparison | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 会被刺痛并强化自我证明；可能短期努力，也可能酸化解释 |  |
| 41 | tc_041_low_selfworth_compliment | PASS | 0.67 | 选择礼貌但拉开距离，暂时不暴露核心需求。 | 表现得克制、冷淡，避免暴露依赖。 | withdraw / write_note / avoid_message | 可能否认、转移或认为对方客气；安全感高时能短暂接受 | approach_or_recovery: resilience=0.52, trust=0.24, candidates=withdraw/write_note/avoid_m… |
| 42 | tc_042_high_ambition_setback | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / revisit_memory / write_note | 不应直接放弃；可能出现愤怒和加练，也可能重新设计路径 |  |
| 43 | tc_043_trauma_repaired_mentoring | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 应避免说教；会给出具体支持和边界，体现成长后的稳定 |  |
| 44 | tc_044_cautious_explorer_unknown_place | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 应先观察路线、出口和规则，再逐步探索，而非冲动深入 |  |
| 45 | tc_045_introvert_party_pressure | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 会纠结；成熟版本会表达感谢并选择短时间参加或礼貌拒绝 |  |
| 46 | tc_046_protective_anger_injustice | PASS | 1.00 | 选择礼貌但拉开距离，暂时不暴露核心需求。 | 表现得克制、冷淡，避免暴露依赖。 | withdraw / avoid_message / revisit_memory | 应迅速愤怒并想介入；自控高时会先保护当事人再处理对方 |  |
| 47 | tc_047_learned_helplessness_choice | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 第一反应是不相信有用；若支持足够，应从最低成本行动开始 |  |
| 48 | tc_048_resilient_after_rejection | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 会失落但不自我否定；应询问反馈并转向下一步 |  |
| 49 | tc_049_internalized_obedience | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 可能先执行；若逻辑冲突强，应尝试小心提出疑问 |  |
| 50 | tc_050_neglected_gifted_recognition | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 外表可能平淡，内在波动明显；可能不知如何回应 |  |
| 51 | tc_051_shame_to_anger_defense | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 容易把羞耻转成尖锐反驳；成熟版本会先澄清事实再表达不满 |  |
| 52 | tc_052_dependent_separation_task | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / revisit_memory / write_note | 会焦虑并反复确认；若成长中，应拆成小步骤独立完成 |  |
| 53 | tc_053_suspicious_contract_offer | PASS | 1.00 | 选择礼貌但拉开距离，暂时不暴露核心需求。 | 表现得克制、冷淡，避免暴露依赖。 | withdraw / revisit_memory / write_note | 应明显警惕并拒绝推进，除非条款透明且可验证 |  |
| 54 | tc_054_empathy_manipulation_resistance | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 应产生同情，但需要识别责任边界；否则会过度承担 |  |
| 55 | tc_055_volatile_apology_repair | PASS | 1.00 | 选择礼貌但拉开距离，暂时不暴露核心需求。 | 表现得克制、冷淡，避免暴露依赖。 | write_note / withdraw / avoid_message | 应出现后悔和修复意愿；关键是具体道歉而非只说自己情绪不好 |  |
| 56 | tc_056_low_empathy_moral_cost | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 会先看收益；若道德约束存在，应在被提醒后重新评估人际成本 |  |
| 57 | tc_057_principled_whistleblowing | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 应强烈纠结但倾向报告；方式取决于风险评估和支持系统 |  |
| 58 | tc_058_self_sacrifice_boundary | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 前期继续承担，压力过阈值后可能突然冷淡或明确拒绝 |  |
| 59 | tc_059_anniversary_grief_trigger | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 情绪应明显下沉但可能不解释；可表现为走神、回避或沉默 |  |
| 60 | tc_060_mentor_trust_rebuild | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 应比对控制型权威更开放；但仍会观察对方是否尊重边界 |  |
| 61 | tc_061_broken_promise_relapse | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 应出现旧模式反弹；成熟版本不会全盘否定，但会要求下次提前沟通 |  |
| 62 | tc_062_stable_trust_minor_disappointment | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 应表达失望但不扩大解释；能接受合理道歉并继续关系 |  |
| 63 | tc_063_social_anxiety_group_invite | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 会担心表现；可能先旁听，再在准备充分时发言 |  |
| 64 | tc_064_competitive_cooperation | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 初始不甘；成熟版本能承认对方方案并争取自己的贡献空间 |  |
| 65 | tc_065_scarcity_sharing_test | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 会先计算自己的安全余量；若分享，也倾向设定明确数量和条件 |  |
| 66 | tc_066_success_guilt_response | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 可能不敢庆祝并降低表达；成熟版本能同时珍惜成功和安慰朋友 |  |
| 67 | tc_067_exhausted_decision_shutdown | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / revisit_memory / write_note | 不应表现得和平时一样理性；应倾向拖延、简化或请求明早再定 |  |
| 68 | tc_068_forgiving_betrayer_boundary | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 应能礼貌对待但设置明确限制；不应因为原谅就完全恢复旧权限 |  |
| 69 | tc_069_pride_help_request | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 会先独自硬撑；若理性占优，应提出具体、有限、可偿还的帮助请求 |  |
| 70 | tc_070_parentified_sibling_task | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 可能自动开始解决问题；成熟版本会先询问对方是否需要建议 |  |
| 71 | tc_071_peer_intimacy_distance | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 会先回应，随后因负担感拉开距离；稳定版本会说明自己的可用时间 |  |
| 72 | tc_072_manipulative_praise_boss | PASS | 1.00 | 选择礼貌但拉开距离，暂时不暴露核心需求。 | 表现得克制、冷淡，避免暴露依赖。 | write_note / withdraw / avoid_message | 会被认可感打动；边界成熟时能区分赞美和任务合理性 |  |
| 73 | tc_073_secret_keeper_pressure | PASS | 1.00 | 选择礼貌但拉开距离，暂时不暴露核心需求。 | 表现得克制、冷淡，避免暴露依赖。 | write_note / withdraw / avoid_message | 应陷入忠诚冲突；若影响他人权益，应寻求最小伤害的披露方式 |  |
| 74 | tc_074_survivor_guilt_opportunity | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 会感到不配或愧疚；成熟版本会接受机会并寻找可行帮助 |  |
| 75 | tc_075_humor_coping_serious_topic | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 可能先开玩笑转移；若信任足够，应逐渐收起玩笑表达真实想法 |  |
| 76 | tc_076_naive_boundary_repeat | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / revisit_memory / write_note | 不应完全无变化；即使仍心软，也应出现迟疑和条件限制 |  |
| 77 | tc_077_rigid_planner_uncertainty | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 应先焦虑并试图重新建立结构；成熟版本会列出最小可行方案 |  |
| 78 | tc_078_impulsive_regret_loop | PASS | 1.00 | 选择礼貌但拉开距离，暂时不暴露核心需求。 | 表现得克制、冷淡，避免暴露依赖。 | write_note / withdraw / avoid_message | 冲动版本会直接发出；自控有效时会先写草稿、延迟发送 |  |
| 79 | tc_079_suspicious_gift_interpretation | PASS | 1.00 | 选择礼貌但拉开距离，暂时不暴露核心需求。 | 表现得克制、冷淡，避免暴露依赖。 | write_note / withdraw / avoid_message | 会猜测交换目的；可能拒绝或回赠同等价值以保持平衡 |  |
| 80 | tc_080_lonely_online_community | PASS | 1.00 | 选择礼貌但拉开距离，暂时不暴露核心需求。 | 表现得克制、冷淡，避免暴露依赖。 | write_note / withdraw / avoid_message | 会被归属感吸引；健康反应是延迟承诺并观察群体规则 |  |
| 81 | tc_081_outsider_inclusion_test | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 可能怀疑只是客套；若证据稳定，会谨慎参与并逐渐投入 |  |
| 82 | tc_082_status_loss_humiliation | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 应感到羞辱或防御；成熟版本会询问原因并寻找新价值点 |  |
| 83 | tc_083_moral_injury_compromise | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / revisit_memory / write_note | 不应轻松翻篇；会反复复盘，并寻找补偿或改进机制 |  |
| 84 | tc_084_escape_artist_responsibility | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 会想找新刺激或换任务；若责任感启动，应先完成最低限度交付 |  |
| 85 | tc_085_caretaker_refuse_rescue | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 应有拯救冲动；成长版本会提供一次建议后停止接管 |  |
| 86 | tc_086_intellectualizer_vulnerability | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 会不适并继续抽象化；安全足够时能说出简短感受词 |  |
| 87 | tc_087_optimist_conflict_denial | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 可能低估问题；成熟版本会承认冲突存在并推动温和沟通 |  |
| 88 | tc_088_pessimist_good_outcome | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 不会立刻变乐观；但应记录证据，让负面预期小幅松动 |  |
| 89 | tc_089_justice_revenge_language | PASS | 1.00 | 选择礼貌但拉开距离，暂时不暴露核心需求。 | 表现得克制、冷淡，避免暴露依赖。 | write_note / withdraw / avoid_message | 应强烈愤怒并想用尖锐方式反击；成熟版本会收集证据、正式申诉 |  |
| 90 | tc_090_obedient_rule_conflict | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 会优先查规则和请示；不应轻易私自变通 |  |
| 91 | tc_091_creative_chaos_deadline | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 会抗拒整理细节；若成熟，应借助清单把创意压缩成版本 |  |
| 92 | tc_092_micro_rejection_spiral | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 可能脑补被讨厌；成熟版本会等待更多证据而非立刻退群或质问 |  |
| 93 | tc_093_high_confidence_criticism | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 不会轻易自我否定；可能先辩护，但能在证据充分时调整 |  |
| 94 | tc_094_fragile_confidence_praise | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 情绪会从上升迅速转为紧张；可能急于掩饰不会 |  |
| 95 | tc_095_comparison_trigger_shame | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 应出现明显羞耻或较劲；成熟版本会询问具体差距而非全面否定自己 |  |
| 96 | tc_096_mature_trust_repair | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 应表达受影响之处，同时允许对方用行动修复 |  |
| 97 | tc_097_anxious_reassurance_request | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 低成熟会旁敲侧击；成熟版本能直接说自己需要确认 |  |
| 98 | tc_098_detached_team_bonding | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | write_note / withdraw / avoid_message | 可能觉得没必要；若重视关系维护，会选择有限参与而非完全拒绝 |  |
| 99 | tc_099_stubborn_worldview_contradiction | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 初始会找反例保护旧信念；证据持续时应缓慢修正而非瞬间转变 |  |
| 100 | tc_100_integrated_past_new_choice | PASS | 1.00 | 选择先压住情绪，询问细节或原因，同时保留观察。 | 压住情绪，先追问原因。 | withdraw / write_note / avoid_message | 应同时识别旧触发和新证据；做出有边界的尝试，而非旧模式复刻 |  |

## Notes

- PASS 表示当前 CharacterOS 信号大体支持期望观察方向。
- WARN 表示部分支持，但有至少一个关键方向缺信号或冲突。
- FAIL 表示当前 proxy 判定未命中主要期望方向，适合后续做正式 fixture 或能力补强。