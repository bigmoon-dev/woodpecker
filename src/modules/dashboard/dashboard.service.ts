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
      'ta.student_id',
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
        LEFT JOIN task_answers ta ON ta.task_id = t.id
        LEFT JOIN task_results tr ON tr.answer_id = ta.id
        LEFT JOIN alert_records ar ON ar.result_id = tr.id
        WHERE t.status = 'published'
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
      'ta.student_id',
    );
    const taskIdx = params.push(taskId || null);
    const taskFilter = taskId ? `AND t.id = $${taskIdx}` : '';

    const sql = `
      SELECT
        g.name as grade_name,
        c.name as class_name,
        COUNT(DISTINCT s.id) as total_students,
        COUNT(DISTINCT ta.student_id) FILTER (WHERE ta.status = 'submitted') as completed
      FROM tasks t
      CROSS JOIN LATERAL jsonb_array_elements_text(t.target_ids) AS target_id
      LEFT JOIN classes c ON (CASE WHEN t.target_type = 'grade' THEN c.grade_id ELSE c.id END) = target_id::uuid
      LEFT JOIN grades g ON g.id = c.grade_id
      LEFT JOIN students s ON s.class_id = c.id
      LEFT JOIN task_answers ta ON ta.task_id = t.id AND ta.student_id = s.id
      WHERE t.status = 'published'
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
      'ar.student_id',
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
      'ta.student_id',
    );
    const dateIdx = params.push(startDate);

    const sql = `
      SELECT
        DATE(tr.created_at) as date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE tr.color = 'green') as green,
        COUNT(*) FILTER (WHERE tr.color = 'yellow') as yellow,
        COUNT(*) FILTER (WHERE tr.color = 'red') as red
      FROM task_results tr
      JOIN task_answers ta ON ta.id = tr.answer_id
      WHERE tr.created_at >= $${dateIdx}
        ${filterSql}
      GROUP BY DATE(tr.created_at)
      ORDER BY date
    `;

    return this.dataSource.query(sql, params);
  }

  async getScaleUsage(dataScope: DataScope): Promise<Record<string, string>[]> {
    const { filterSql, params } = this.buildScopeFilter(
      dataScope,
      'ta.student_id',
    );

    const sql = `
      SELECT
        s.name as scale_name,
        COUNT(DISTINCT t.id) as task_count,
        COUNT(DISTINCT ta.id) FILTER (WHERE ta.status = 'submitted') as answer_count
      FROM scales s
      LEFT JOIN tasks t ON t.scale_id = s.id AND t.status = 'published'
      LEFT JOIN task_answers ta ON ta.task_id = t.id
      WHERE s.is_library = false
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
      'ar.student_id',
    );
    const startIdx = params.push(startDate);

    let endFilter = '';
    let periodExpr: string;
    if (period === 'semester') {
      periodExpr = `CASE 
        WHEN EXTRACT(MONTH FROM ar.created_at) <= 6 
        THEN TO_CHAR(ar.created_at, 'YYYY') || '-S1'
        ELSE TO_CHAR(ar.created_at, 'YYYY') || '-S2'
      END`;
    } else {
      periodExpr = `TO_CHAR(ar.created_at, 'YYYY-MM')`;
    }

    if (endDate) {
      const endIdx = params.push(endDate);
      endFilter = `AND ar.created_at <= $${endIdx}`;
    }

    const sql = `
      SELECT
        ${periodExpr} AS period,
        COUNT(*) FILTER (WHERE ar.level = 'red') AS red_count,
        COUNT(*) FILTER (WHERE ar.level = 'yellow') AS yellow_count,
        COUNT(*) AS total_count
      FROM alert_records ar
      WHERE ar.created_at >= $${startIdx}
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
      'ar.student_id',
    );

    let dateFilter = '';
    if (startDate) {
      const idx = params.push(startDate);
      dateFilter += `AND ar.created_at >= $${idx}`;
    }
    if (endDate) {
      const idx = params.push(endDate);
      dateFilter += `AND ar.created_at <= $${idx}`;
    }

    const sql = `
      SELECT
        g.name AS grade_name,
        c.name AS class_name,
        COUNT(DISTINCT ar.student_id) FILTER (WHERE ar.level = 'red') AS red_students,
        COUNT(DISTINCT ar.student_id) FILTER (WHERE ar.level = 'yellow') AS yellow_students,
        COUNT(DISTINCT ar.student_id) AS total_alert_students
      FROM alert_records ar
      JOIN students s ON s.id = ar.student_id
      JOIN classes c ON c.id = s.class_id
      JOIN grades g ON g.id = c.grade_id
      WHERE 1=1
        ${dateFilter}
        ${filterSql}
      GROUP BY g.name, c.name, g.sort_order, c.sort_order
      ORDER BY g.sort_order, c.sort_order
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
          INNER JOIN users u ON u."studentRecordId" = s.id
          WHERE u.id = $${pIdx}
        )`;
        break;
      }
      case 'class': {
        if (dataScope.classId) {
          const pIdx = params.push(dataScope.classId);
          filterSql = `AND ${studentIdCol} IN (
            SELECT s.id FROM students s WHERE s.class_id = $${pIdx}
          )`;
        }
        break;
      }
      case 'grade': {
        if (dataScope.gradeId) {
          const pIdx = params.push(dataScope.gradeId);
          filterSql = `AND ${studentIdCol} IN (
            SELECT s.id FROM students s
            INNER JOIN classes c ON c.id = s.class_id
            WHERE c.grade_id = $${pIdx}
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
      dateFilter = `AND t.created_at >= $${dateIdx}`;
    }

    const sql = buildSelect(filterSql, dateFilter);
    return { sql, params };
  }
}
