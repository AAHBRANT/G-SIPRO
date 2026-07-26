DELETE FROM profile_permissions WHERE "permissionId" IN(SELECT id FROM permissions WHERE code LIKE 'analytics.%');
DELETE FROM permissions WHERE code LIKE 'analytics.%';

DROP TRIGGER IF EXISTS trg_opportunity_analysis_decisions_append_only ON opportunity_analysis_decisions;
DROP TRIGGER IF EXISTS trg_analysis_evidences_append_only ON analysis_evidences;
DROP TRIGGER IF EXISTS trg_analysis_dimension_results_append_only ON analysis_dimension_results;
DROP TRIGGER IF EXISTS trg_intelligence_policy_approvals_append_only ON intelligence_policy_approvals;
DROP TRIGGER IF EXISTS trg_intelligence_policies_append_only ON intelligence_policies;
DROP TRIGGER IF EXISTS trg_validate_opportunity_analysis_decision ON opportunity_analysis_decisions;
DROP FUNCTION IF EXISTS gsipro_validate_opportunity_analysis_decision();
DROP TRIGGER IF EXISTS trg_validate_intelligence_policy_approval ON intelligence_policy_approvals;
DROP FUNCTION IF EXISTS gsipro_validate_intelligence_policy_approval();
DROP TRIGGER IF EXISTS trg_validate_intelligence_policy ON intelligence_policies;
DROP FUNCTION IF EXISTS gsipro_validate_intelligence_policy();

DROP TABLE IF EXISTS opportunity_analysis_decisions;
DROP TABLE IF EXISTS critical_impediments;
DROP TABLE IF EXISTS analysis_pending_items;
DROP TABLE IF EXISTS analysis_evidences;
DROP TABLE IF EXISTS analysis_dimension_results;
DROP TABLE IF EXISTS opportunity_analyses;
DROP TABLE IF EXISTS intelligence_policy_approvals;
DROP TABLE IF EXISTS intelligence_policies;

DROP TYPE IF EXISTS "OpportunityDecisionType";
DROP TYPE IF EXISTS "CriticalImpedimentStatus";
DROP TYPE IF EXISTS "CriticalImpedimentType";
DROP TYPE IF EXISTS "AnalysisPendingStatus";
DROP TYPE IF EXISTS "IntelligenceRecommendation";
DROP TYPE IF EXISTS "AnalysisDimensionStatus";
DROP TYPE IF EXISTS "IntelligencePerspective";
DROP TYPE IF EXISTS "OpportunityAnalysisStatus";
DROP TYPE IF EXISTS "OpportunityAnalysisType";
