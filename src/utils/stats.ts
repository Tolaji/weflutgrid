/**
 * Calculate median of a number array
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Calculate percentile rank (0-1)
 */
export function percentileRank(sortedValues: number[], value: number): number {
  if (sortedValues.length === 0) return 0;
  
  let count = 0;
  for (const v of sortedValues) {
    if (v <= value) count++;
  }
  
  return count / sortedValues.length;
}

/**
 * Compute confidence score based on multiple factors
 */
export function computeConfidence(
  transactionCount: number,
  sourceQuality: number,
  recencyDays: number
): number {
  // Sample size factor (logarithmic scale)
  const sampleFactor = Math.min(1, Math.log10(transactionCount + 1) / 3);
  
  // Recency factor (decay over time)
  const recencyFactor = Math.max(0.1, 1 - (recencyDays / 365));
  
  // Combined confidence score
  return Math.min(1, sourceQuality * sampleFactor * recencyFactor);
}

/**
 * Calculate weighted average
 */
export function weightedAverage(
  values: number[],
  weights: number[]
): number {
  if (values.length !== weights.length || values.length === 0) {
    return 0;
  }
  
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  if (weightSum === 0) return 0;
  
  const weightedSum = values.reduce((sum, val, i) => sum + val * weights[i], 0);
  return weightedSum / weightSum;
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squareDiffs = values.map(val => Math.pow(val - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  
  return Math.sqrt(avgSquareDiff);
}