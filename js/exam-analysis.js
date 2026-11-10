export function summarizeExam(scores, fullScore) {
  const sorted = scores.map(Number).filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) return null;

  const count = sorted.length;
  const middle = Math.floor(count / 2);
  const average = sorted.reduce((total, score) => total + score, 0) / count;
  const median = count % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const passing = sorted.filter(score => score >= fullScore * 0.6).length;
  const bands = [0, 0, 0, 0, 0];
  sorted.forEach(score => {
    const percent = score / fullScore;
    bands[percent < 0.6 ? 0 : percent < 0.7 ? 1 : percent < 0.8 ? 2 : percent < 0.9 ? 3 : 4]++;
  });

  return {
    count,
    average: Math.round(average * 100) / 100,
    median: Math.round(median * 100) / 100,
    highest: sorted[count - 1],
    lowest: sorted[0],
    passing,
    passingRate: Math.round(passing / count * 10000) / 100,
    bands
  };
}
