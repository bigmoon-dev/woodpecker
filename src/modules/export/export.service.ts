import { Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as path from 'path';
import { ResultWithContext } from '../result/result.service';
import { AlertRecord } from '../../entities/audit/alert-record.entity';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { Grade } from '../../entities/org/grade.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EncryptionService } from '../core/encryption.service';

const FONT_PATH = path.resolve(
  __dirname,
  '../../assets/fonts/NotoSansSC-Regular.ttf',
);

interface PDFDoc {
  registerFont(name: string, path: string): PDFDoc;
  font(name: string, size?: number): PDFDoc;
  fontSize(size: number): PDFDoc;
  fillColor(color: string): PDFDoc;
  text(text: string, options?: Record<string, unknown>): PDFDoc;
  moveDown(lines?: number): PDFDoc;
  on(event: string, handler: (chunk: Buffer) => void): PDFDoc;
  end(): void;
}

interface PdfReportData {
  result: TaskResult;
  studentName: string;
  studentNumber: string;
  gradeName: string;
  className: string;
  scaleName: string;
  taskTitle: string;
}

@Injectable()
export class ExportService {
  constructor(
    @InjectRepository(AlertRecord)
    private alertRepo: Repository<AlertRecord>,
    @InjectRepository(TaskResult)
    private resultRepo: Repository<TaskResult>,
    @InjectRepository(TaskAnswer)
    private answerRepo: Repository<TaskAnswer>,
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    @InjectRepository(Class)
    private classRepo: Repository<Class>,
    @InjectRepository(Grade)
    private gradeRepo: Repository<Grade>,
    private encryptionService: EncryptionService,
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

  async generatePdf(resultId: string): Promise<Buffer> {
    const result = await this.resultRepo.findOne({ where: { id: resultId } });
    if (!result) throw new NotFoundException(`Result ${resultId} not found`);

    const answer = await this.answerRepo.findOne({
      where: { id: result.answerId },
      relations: ['task', 'task.scale'],
    });

    const studentId = answer?.studentId ?? '';
    const pii = studentId
      ? await this.encryptionService.batchDecrypt([studentId])
      : new Map<string, { name: string; studentNumber: string }>();
    const studentInfo = pii.get(studentId);
    const taskEntity: {
      title?: string;
      scale?: { name?: string };
    } = (answer?.task ?? {}) as {
      title?: string;
      scale?: { name?: string };
    };

    const data: PdfReportData = {
      result,
      studentName: studentInfo?.name ?? '',
      studentNumber: studentInfo?.studentNumber ?? '',
      gradeName: '',
      className: '',
      scaleName: taskEntity?.scale?.name ?? '',
      taskTitle: taskEntity?.title ?? '',
    };

    if (studentId) {
      const student = await this.studentRepo.findOne({
        where: { id: studentId },
        relations: ['class', 'class.grade'],
      });
      if (student?.class) {
        data.className = student.class.name;
        data.gradeName = student.class.grade?.name ?? '';
      }
    }

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const PDFDocumentCtor = PDFDocument as unknown as new (
        opts: Record<string, unknown>,
      ) => PDFDoc;
      const doc = new PDFDocumentCtor({
        size: 'A4',
        margin: 50,
      }) as unknown as PDFDoc;

      doc.registerFont('NotoSansSC', FONT_PATH);
      doc.font('NotoSansSC');

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('心理测评报告', { align: 'center' });
      doc.moveDown(0.5);
      doc
        .fontSize(10)
        .fillColor('#999')
        .text('Psychological Assessment Report', { align: 'center' });
      doc.fillColor('#000');
      doc.moveDown(1.5);

      doc.fontSize(12).text(`量表名称：${data.scaleName}`);
      doc.text(`任务名称：${data.taskTitle}`);
      doc.text(`学生姓名：${data.studentName}`);
      doc.text(`学号：${data.studentNumber}`);
      if (data.gradeName) doc.text(`年级：${data.gradeName}`);
      if (data.className) doc.text(`班级：${data.className}`);
      doc.text(
        `测评时间：${data.result.createdAt?.toISOString().slice(0, 19).replace('T', ' ') ?? ''}`,
      );
      doc.moveDown(1);

      doc.fontSize(14).text('测评结果', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);

      const colorLabel =
        data.result.color === 'red'
          ? '红色（需重点关注）'
          : data.result.color === 'yellow'
            ? '黄色（需关注）'
            : '绿色（正常）';
      doc.text(`总分：${data.result.totalScore}`);
      doc.text(`等级：${data.result.level}`);
      doc.text(`预警等级：${colorLabel}`);
      doc.moveDown(0.5);

      if (data.result.dimensionScores) {
        doc.fontSize(14).text('维度得分', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11);

        const dimensions = Object.entries(data.result.dimensionScores);
        for (const [dim, score] of dimensions) {
          doc.text(`${dim}：${score}`);
        }
        doc.moveDown(0.5);
      }

      if (data.result.suggestion) {
        doc.fontSize(14).text('评估建议', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11).text(data.result.suggestion, { width: 450 });
        doc.moveDown(0.5);
      }

      doc.moveDown(2);
      doc
        .fontSize(8)
        .fillColor('#999')
        .text(
          `报告生成时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
        )
        .text('本报告仅供参考，不作为临床诊断依据。', { align: 'center' });

      doc.end();
    });
  }
}
