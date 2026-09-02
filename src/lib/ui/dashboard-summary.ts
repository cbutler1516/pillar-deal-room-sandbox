export type DashboardSummaryCounts = {
  needsAttention: number;
  docsToReview: number;
  ready: number;
};

export function formatDashboardSummary(counts: DashboardSummaryCounts): {
  attention: string;
  review: string;
  ready: string;
  line: string;
} {
  const files = counts.needsAttention;
  const docs = counts.docsToReview;
  const attention =
    files === 1
      ? "1 file needs your attention today"
      : `${files} files need your attention today`;
  const review =
    docs === 1
      ? "1 document ready for review"
      : `${docs} documents ready for review`;
  const ready =
    counts.ready === 1
      ? "1 ready to send"
      : `${counts.ready} ready to send`;
  return {
    attention,
    review,
    ready,
    line: formatDashboardSummaryLine(counts),
  };
}

export function formatDashboardSummaryLine(counts: DashboardSummaryCounts): string {
  const files =
    counts.needsAttention === 1
      ? "1 file needs attention"
      : `${counts.needsAttention} files need attention`;
  const docs =
    counts.docsToReview === 1
      ? "1 document to review"
      : `${counts.docsToReview} documents to review`;
  const ready =
    counts.ready === 1 ? "1 ready to send" : `${counts.ready} ready to send`;
  return `${files} · ${docs} · ${ready}`;
}
