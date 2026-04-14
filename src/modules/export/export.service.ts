import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ResultWithContext } from '../result/result.service';
import { AlertRecord } from '../../entities/audit/alert-record.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class ExportService {
  constructor(
    @InjectRepository(AlertRecord)
    private alertRepo: Repository<AlertRecord>,
  ) {}

  async generateExcel(results: ResultWithContext[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('测评结果');

    sheet.columns = [
      { header: '序号', key: 'index', width: 6 },
      { header: '年级', key: 'gradeName', width: 12 },
      { header: '班级', key: 'className', width: 12 },
      { header: '姓名', key: 'studentName', width: 10 },
      { header: '学号', key: 'studentNumber', width: 14 },
      { header: '量表名称', key: 'scaleName', width: 20 },
      { header: '任务名称', key: 'taskTitle', width: 20 },
      { header: '总分', key: 'totalScore', width: 8 },
      { header: '等级', key: 'level', width: 10 },
      { header: '预警颜色', key: 'color', width: 10 },
      { header: '维度得分', key: 'dimensionScores', width: 30 },
      { header: '测评时间', key: 'createdAt', width: 18 },
      { header: '建议', key: 'suggestion', width: 30 },
    ];

    results.forEach((r, i) => {
      sheet.addRow({
        index: i + 1,
        gradeName: r.gradeName,
        className: r.className,
        studentName: r.studentName,
        studentNumber: r.studentNumber,
        scaleName: r.scaleName,
        taskTitle: r.taskTitle,
        totalScore: r.result.totalScore,
        level: r.result.level,
        color: r.result.color,
        dimensionScores: r.result.dimensionScores
          ? Object.entries(r.result.dimensionScores)
              .map(([k, v]) => `${k}: ${v}`)
              .join('; ')
          : '',
        createdAt: r.result.createdAt?.toISOString().slice(0, 19) ?? '',
        suggestion: r.result.suggestion ?? '',
      });
    });

    const resultIds = results.map((r) => r.result.id);
    if (resultIds.length > 0) {
      const alerts = await this.alertRepo.find({
        where: resultIds.map((id) => ({ resultId: id })),
      });

      if (alerts.length > 0) {
        const alertSheet = workbook.addWorksheet('预警明细');
        alertSheet.columns = [
          { header: '序号', key: 'index', width: 6 },
          { header: '姓名', key: 'studentName', width: 10 },
          { header: '学号', key: 'studentNumber', width: 14 },
          { header: '预警等级', key: 'level', width: 10 },
          { header: '处理状态', key: 'status', width: 10 },
          { header: '处理人', key: 'handledBy', width: 12 },
          { header: '处理时间', key: 'handledAt', width: 18 },
          { header: '处理备注', key: 'handleNote', width: 30 },
        ];

        const resultMap = new Map(results.map((r) => [r.result.id, r]));

        alerts.forEach((a, i) => {
          const ctx = resultMap.get(a.resultId);
          alertSheet.addRow({
            index: i + 1,
            studentName: ctx?.studentName ?? '',
            studentNumber: ctx?.studentNumber ?? '',
            level: a.level,
            status: a.status,
            handledBy: a.handledById ?? '',
            handledAt: a.handledAt?.toISOString().slice(0, 19) ?? '',
            handleNote: a.handleNote ?? '',
          });
        });
      }
    }

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
