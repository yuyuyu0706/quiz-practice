import { buildConfidenceHistorySummary } from './confidence-history-summary.js';
import { buildConfidenceHistoryTrend } from './confidence-history-trend.js';

export function buildConfidenceHistoryAnalysis(history, query) {
  const summaryResult = buildConfidenceHistorySummary(history, query);
  const trendResult = buildConfidenceHistoryTrend(history, {
    period: summaryResult.query.period,
    sectionId: summaryResult.query.sectionId,
    asOf: summaryResult.query.asOf,
  });

  return {
    query: summaryResult.query,
    coverage: summaryResult.coverage,
    quality: summaryResult.quality,
    retention: summaryResult.retention,
    summary: summaryResult.summary,
    confidenceLevels: summaryResult.confidenceLevels,
    outcomes: summaryResult.outcomes,
    guidance: summaryResult.guidance,
    sections: summaryResult.sections,
    attempts: summaryResult.attempts,
    trends: trendResult.trends,
    questionTrends: trendResult.questionTrends,
    changeEvents: trendResult.changeEvents,
  };
}
