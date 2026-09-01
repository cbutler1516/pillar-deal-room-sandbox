export type DashboardSummaryCounts = {
  needsAttention: number;
  docsToReview: number;
  ready: number;
};

export function formatDashboardSummary(counts: DashboardSummaryCounts): {
  attention: string;
  review: string;
  ready: string;
} {
  const files = counts.needsAttention;
  const docs = counts.docsToReview;
  return {
    attention:
      files === 1
        ? "1 file needs your attention today"
        : `${files} files need your attention today`,
    review:
      docs === 1
        ? "1 document ready for review"
        : `${docs} documents ready for review`,
    ready:
      counts.ready === 1
        ? "1 ready to submit"
        : `${counts.ready} ready to submit`,
  };
}
