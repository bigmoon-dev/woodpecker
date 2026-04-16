import * as fs from 'fs';
import * as path from 'path';

interface JourneyResult {
  name: string;
  steps: { label: string; status: string; duration: number }[];
  passed: boolean;
}

interface ReportData {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  journeys: JourneyResult[];
  cleanupStatus: 'CLEAN' | 'DIRTY' | 'UNKNOWN';
  scaleCountBefore: number;
  scaleCountAfter: number;
}

export class ReportGenerator {
  private journeys: JourneyResult[] = [];
  private startTime = Date.now();
  private scaleCountBefore = 0;
  private scaleCountAfter = 0;

  setScaleCountBefore(count: number) {
    this.scaleCountBefore = count;
  }

  setScaleCountAfter(count: number) {
    this.scaleCountAfter = count;
  }

  addJourney(result: JourneyResult) {
    this.journeys.push(result);
  }

  generate(): string {
    const duration = Date.now() - this.startTime;
    const passed = this.journeys.filter((j) => j.passed).length;
    const failed = this.journeys.filter((j) => !j.passed).length;
    const cleanupStatus =
      this.scaleCountBefore === this.scaleCountAfter ? 'CLEAN' : 'DIRTY';

    const data: ReportData = {
      total: this.journeys.length,
      passed,
      failed,
      skipped: 0,
      duration,
      journeys: this.journeys,
      cleanupStatus,
      scaleCountBefore: this.scaleCountBefore,
      scaleCountAfter: this.scaleCountAfter,
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportDir = path.resolve(__dirname, '../e2e-reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const lines: string[] = [
      `# E2E Test Report`,
      ``,
      `**Timestamp**: ${new Date().toISOString()}`,
      `**Database**: psych_scale_e2e_test (isolated)`,
      ``,
      `## Summary`,
      ``,
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Total  | ${data.total} |`,
      `| Passed | ${data.passed} |`,
      `| Failed | ${data.failed} |`,
      `| Duration | ${(data.duration / 1000).toFixed(1)}s |`,
      ``,
      `## Journey Coverage Matrix`,
      ``,
      `| Journey | Steps | Status | Duration |`,
      `|---------|-------|--------|----------|`,
    ];

    for (const j of data.journeys) {
      const status = j.passed ? 'PASS' : 'FAIL';
      const stepCount = j.steps.length;
      const dur = j.steps.reduce((s, st) => s + st.duration, 0);
      lines.push(`| ${j.name} | ${stepCount} | ${status} | ${dur}ms |`);
    }

    lines.push('');
    lines.push('## Data Cleanup Verification');
    lines.push('');
    lines.push(
      `| Metric | Value |`,
    );
    lines.push(
      `|--------|-------|`,
    );
    lines.push(
      `| Scale count before | ${data.scaleCountBefore} |`,
    );
    lines.push(
      `| Scale count after | ${data.scaleCountAfter} |`,
    );
    lines.push(`| Status | **${data.cleanupStatus}** |`);
    lines.push('');

    if (data.cleanupStatus === 'DIRTY') {
      lines.push(
        '> **WARNING**: Test data was not fully cleaned up. Scale count differs.',
      );
      lines.push('');
    }

    const failedJourneys = data.journeys.filter((j) => !j.passed);
    if (failedJourneys.length > 0) {
      lines.push('## Failed Journeys');
      lines.push('');
      for (const j of failedJourneys) {
        lines.push(`### ${j.name}`);
        for (const step of j.steps) {
          if (step.status !== 'PASS') {
            lines.push(`- **${step.label}**: ${step.status}`);
          }
        }
        lines.push('');
      }
    }

    const reportPath = path.join(reportDir, `e2e-report-${timestamp}.md`);
    fs.writeFileSync(reportPath, lines.join('\n'));
    console.log(`[E2E Report] Generated: ${reportPath}`);

    return reportPath;
  }
}
