export function compatibilityText(report) {
  const lines = [];
  lines.push('UNILINT COMPATIBILITY REPORT');
  lines.push('================================');
  lines.push(`Project: ${report.project.name}`);
  lines.push(`Source Unity: ${report.project.sourceUnity ?? 'unknown'}`);
  lines.push(`Target Unity: ${report.target.unityVersion}`);
  lines.push(`Target: ${report.target.platform}${report.target.backend ? ` / ${report.target.backend}` : ''}`);
  lines.push(`Compatibility: ${report.compatibility.level.code} — ${report.compatibility.level.label}`);
  lines.push(`Prediction: ${report.compatibility.predicted}`);
  lines.push(`Blocking: ${report.compatibility.blocking}`);
  lines.push(`Warnings: ${report.compatibility.warnings}`);
  lines.push(`Unknowns: ${report.compatibility.unknowns}`);
  lines.push(`Runtime verified: NO`);
  if (report.findings.length) {
    lines.push('');
    lines.push('Findings');
    lines.push('--------');
    for (const item of report.findings) lines.push(`[${item.severity.toUpperCase()}] ${item.rule}${item.file ? ` ${item.file}` : ''}: ${item.message}`);
  }
  return lines.join('\n');
}

export function auditText(report) {
  const lines = [`UNILINT AUDIT — ${report.project}`, '==========================='];
  if (!report.findings.length) lines.push('No findings.');
  for (const item of report.findings) lines.push(`[${item.severity.toUpperCase()}] ${item.rule}${item.file ? ` ${item.file}` : ''}: ${item.message}`);
  return lines.join('\n');
}
