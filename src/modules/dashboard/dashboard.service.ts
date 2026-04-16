import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DataScope } from '../auth/data-scope-filter';

@Injectable()
export class DashboardService {
  constructor(private dataSource: DataSource) {}

  async getOverview(
    dataScope: DataScope,
    startDate?: string,
  ): Promise<Record<string, number>> {
    const { sql, params } = this.buildQuery(
      dataScope,
      startDate,
      'ta."studentId"',
      (scope, date) => `
        SELECT
          COUNT(DISTINCT t.id) as total_tasks,
          COUNT(DISTINCT ta.id) as total_answers,
          COUNT(DISTINCT ta.id) FILTER (WHERE ta.status = 'submitted') as submitted_answers,
          COUNT(DISTINCT ar.id) as total_alerts,
          COUNT(DISTINCT ar.id) FILTER (WHERE ar.level = 'red') as red_alerts,
          COUNT(DISTINCT ar.id) FILTER (WHERE ar.level = 'yellow') as yellow_alerts,
          COUNT(DISTINCT ar.id) FILTER (WHERE ar.status = 'pending') as pending_alerts
        FROM tasks t
        LEFT JOIN task_answers ta ON ta."taskId" = t.id
        LEFT JOIN task_results tr ON tr."answerId" = ta.id
        LEFT JOIN alert_records ar ON ar."resultId" = tr.id
      WHERE t.status IN ('published', 'completed')
          ${scope}
          ${date}
      `,
    );

    const rows: Record<string, number>[] = await this.dataSource.query(
      sql,
      params,
    );
    return rows[0];
  }

  async getCompletion(
    dataScope: DataScope,
    taskId?: string,
  ): Promise<Record<string, string>[]> {
    const { filterSql, params } = this.buildScopeFilter(
      dataScope,
      'ta."studentId"',
    );
    let taskFilter = '';
    if (taskId) {
      const taskIdx = params.push(taskId);
      taskFilter = `AND t.id = $${taskIdx}`;
    }

    const sql = `
      SELECT
        g.name as grade_name,
        c.name as class_name,
        COUNT(DISTINCT s.id) as total_students,
        COUNT(DISTINCT ta."studentId") FILTER (WHERE ta.status = 'submitted') as completed
      FROM tasks t
      LEFT JOIN classes c ON c.id IN (SELECT jsonb_array_elements_text(t."targetIds")::uuid)
      LEFT JOIN grades g ON g.id = c."gradeId"
      LEFT JOIN students s ON s."classId" = c.id
      LEFT JOIN task_answers ta ON ta."taskId" = t.id AND ta."studentId" = s.id
      WHERE t.status IN ('published', 'completed')
        ${taskFilter}
        ${filterSql}
      GROUP BY g.name, c.name
      ORDER BY g.name, c.name
    `;

    return this.dataSource.query(sql, params);
  }

  async getAlertDistribution(
    dataScope: DataScope,
    startDate?: string,
  ): Promise<Record<string, string>[]> {
    const { sql, params } = this.buildQuery(
      dataScope,
      startDate,
      'ar."studentId"',
      (scope, date) => `
        SELECT
          ar.level,
          COUNT(*) as count
        FROM alert_records ar
        WHERE 1=1
          ${scope}
          ${date}
        GROUP BY ar.level
      `,
    );

    return this.dataSource.query(sql, params);
  }

  async getTrend(
    dataScope: DataScope,
    startDate: string,
  ): Promise<Record<string, string>[]> {
    const { filterSql, params } = this.buildScopeFilter(
      dataScope,
      'ta."studentId"',
    );
    const dateIdx = params.push(startDate);

    const sql = `
      SELECT
        DATE(tr."createdAt") as date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE tr.color = 'green') as green,
        COUNT(*) FILTER (WHERE tr.color = 'yellow') as yellow,
        COUNT(*) FILTER (WHERE tr.color = 'red') as red
      FROM task_results tr
      JOIN task_answers ta ON ta.id = tr."answerId"
      WHERE tr."createdAt" >= $${dateIdx}
        ${filterSql}
      GROUP BY DATE(tr."createdAt")
      ORDER BY date
    `;

    return this.dataSource.query(sql, params);
  }

  async getScaleUsage(dataScope: DataScope): Promise<Record<string, string>[]> {
    const { filterSql, params } = this.buildScopeFilter(
      dataScope,
      'ta."studentId"',
    );

    const sql = `
      SELECT
        s.name as scale_name,
        COUNT(DISTINCT t.id) as task_count,
        COUNT(DISTINCT ta.id) FILTER (WHERE ta.status = 'submitted') as answer_count
      FROM scales s
      LEFT JOIN tasks t ON t."scaleId" = s.id AND t.status = 'published'
      LEFT JOIN task_answers ta ON ta."taskId" = t.id
      WHERE s."isLibrary" = false
        ${filterSql}
      GROUP BY s.name
      ORDER BY answer_count DESC
    `;

    return this.dataSource.query(sql, params);
  }

  async getAlertTrendByMonth(
    dataScope: DataScope,
    startDate: string,
    endDate?: string,
    period: 'month' | 'semester' = 'month',
  ): Promise<Record<string, string>[]> {
    const { filterSql, params } = this.buildScopeFilter(
      dataScope,
      'ar."studentId"',
    );
    const startIdx = params.push(startDate);

    let endFilter = '';
    let periodExpr: string;
    if (period === 'semester') {
      periodExpr = `CASE 
        WHEN EXTRACT(MONTH FROM ar."createdAt") <= 6 
        THEN TO_CHAR(ar."createdAt", 'YYYY') || '-S1'
        ELSE TO_CHAR(ar."createdAt", 'YYYY') || '-S2'
      END`;
    } else {
      periodExpr = `TO_CHAR(ar."createdAt", 'YYYY-MM')`;
    }

    if (endDate) {
      const endIdx = params.push(endDate);
      endFilter = `AND ar."createdAt" <= $${endIdx}`;
    }

    const sql = `
      SELECT
        ${periodExpr} AS period,
        COUNT(*) FILTER (WHERE ar.level = 'red') AS red_count,
        COUNT(*) FILTER (WHERE ar.level = 'yellow') AS yellow_count,
        COUNT(*) AS total_count
      FROM alert_records ar
      WHERE ar."createdAt" >= $${startIdx}
        ${endFilter}
        ${filterSql}
      GROUP BY ${periodExpr}
      ORDER BY period
    `;

    return this.dataSource.query(sql, params);
  }

  async getRiskHeatmap(
    dataScope: DataScope,
    startDate?: string,
    endDate?: string,
  ): Promise<Record<string, string>[]> {
    const { filterSql, params } = this.buildScopeFilter(
      dataScope,
      'ar."studentId"',
    );

    let dateFilter = '';
    if (startDate) {
      const idx = params.push(startDate);
      dateFilter += `AND ar."createdAt" >= $${idx}`;
    }
    if (endDate) {
      const idx = params.push(endDate);
      dateFilter += `AND ar."createdAt" <= $${idx}`;
    }

    const sql = `
      SELECT
        g.name AS grade_name,
        c.name AS class_name,
        COUNT(DISTINCT ar."studentId") FILTER (WHERE ar.level = 'red') AS red_students,
        COUNT(DISTINCT ar."studentId") FILTER (WHERE ar.level = 'yellow') AS yellow_students,
        COUNT(DISTINCT ar."studentId") AS total_alert_students
      FROM alert_records ar
      JOIN students s ON s.id = ar."studentId"
      JOIN classes c ON c.id = s."classId"
      JOIN grades g ON g.id = c."gradeId"
      WHERE 1=1
        ${dateFilter}
        ${filterSql}
      GROUP BY g.name, c.name, g."sortOrder", c."sortOrder"
      ORDER BY g."sortOrder", c."sortOrder"
    `;

    return this.dataSource.query(sql, params);
  }

  private buildScopeFilter(
    dataScope: DataScope,
    studentIdCol: string,
  ): { filterSql: string; params: any[] } {
    const params: any[] = [];
    let filterSql = '';

    switch (dataScope.scope) {
      case 'own': {
        const pIdx = params.push(dataScope.userId);
        filterSql = `AND ${studentIdCol} IN (
          SELECT s.id FROM students s
          INNER JOIN users u ON u."studentId" = s.id
          WHERE u.id = $${pIdx}
        )`;
        break;
      }
      case 'class': {
        if (dataScope.classId) {
          const pIdx = params.push(dataScope.classId);
          filterSql = `AND ${studentIdCol} IN (
            SELECT s.id FROM students s WHERE s."classId" = $${pIdx}
          )`;
        }
        break;
      }
      case 'grade': {
        if (dataScope.gradeId) {
          const pIdx = params.push(dataScope.gradeId);
          filterSql = `AND ${studentIdCol} IN (
            SELECT s.id FROM students s
            INNER JOIN classes c ON c.id = s."classId"
            WHERE c."gradeId" = $${pIdx}
          )`;
        }
        break;
      }
      case 'all':
        break;
    }

    return { filterSql, params };
  }

  private buildQuery(
    dataScope: DataScope,
    startDate: string | undefined,
    studentIdCol: string,
    buildSelect: (scopeFilter: string, dateFilter: string) => string,
  ): { sql: string; params: any[] } {
    const { filterSql, params } = this.buildScopeFilter(
      dataScope,
      studentIdCol,
    );

    let dateFilter = '';
    if (startDate) {
      const dateIdx = params.push(startDate);
      dateFilter = `AND t."createdAt" >= $${dateIdx}`;
    }

    const sql = buildSelect(filterSql, dateFilter);
    return { sql, params };
  }
}
