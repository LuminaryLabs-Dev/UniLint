export const Severity = Object.freeze({
  info: 'info',
  warning: 'warning',
  error: 'error',
  critical: 'critical',
});

export const Certainty = Object.freeze({
  inferred: 'inferred',
  medium: 'medium',
  high: 'high',
  certain: 'certain',
});

export function diagnostic({
  rule,
  severity = Severity.warning,
  certainty = Certainty.high,
  category,
  message,
  file = null,
  line = null,
  evidence = [],
  recommendation = null,
  blocking = severity === Severity.error || severity === Severity.critical,
}) {
  return {
    rule,
    severity,
    certainty,
    category,
    message,
    file,
    line,
    evidence,
    recommendation,
    blocking,
  };
}
