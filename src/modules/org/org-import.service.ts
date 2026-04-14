import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';
import * as crypto from 'crypto';
import { Student } from '../../entities/org/student.entity';
import { Grade } from '../../entities/org/grade.entity';
import { Class } from '../../entities/org/class.entity';
import { EncryptionService } from '../core/encryption.service';

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ParsedRow {
  gradeName: string;
  className: string;
  name: string;
  studentNumber: string;
  contact: string;
  gender: string;
}

export interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  errors: ImportError[];
}

const MAX_ROWS = 2000;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const XLSX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

function cellStr(val: ExcelJS.CellValue | undefined): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object' && 'result' in (val as object)) {
    return String((val as { result: unknown }).result);
  }
  return JSON.stringify(val);
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

@Injectable()
export class OrgImportService {
  constructor(
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    @InjectRepository(Grade)
    private gradeRepo: Repository<Grade>,
    @InjectRepository(Class)
    private classRepo: Repository<Class>,
    private encryptionService: EncryptionService,
    private dataSource: DataSource,
  ) {}

  validateFile(buffer: Buffer): void {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException('文件大小超过 5MB 限制');
    }
    if (
      buffer.length < 4 ||
      buffer[0] !== XLSX_MAGIC[0] ||
      buffer[1] !== XLSX_MAGIC[1] ||
      buffer[2] !== XLSX_MAGIC[2] ||
      buffer[3] !== XLSX_MAGIC[3]
    ) {
      throw new BadRequestException('仅支持 .xlsx 文件格式');
    }
  }

  async parseExcel(buffer: Buffer): Promise<{
    validRows: ParsedRow[];
    errors: ImportError[];
  }> {
    this.validateFile(buffer);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('Excel 文件不包含工作表');
    }

    const rawRows: ParsedRow[] = [];
    const errors: ImportError[] = [];
    let dataRowIdx = 0;

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (dataRowIdx >= MAX_ROWS) return;
      dataRowIdx++;

      const gradeName = cellStr(row.getCell(1).value).trim();
      const className = cellStr(row.getCell(2).value).trim();
      const name = cellStr(row.getCell(3).value).trim();
      const studentNumber = cellStr(row.getCell(4).value).trim();
      const contact = cellStr(row.getCell(5).value).trim();
      const gender = cellStr(row.getCell(6).value).trim();

      if (!gradeName) {
        errors.push({
          row: rowNumber,
          field: 'gradeName',
          message: '年级不能为空',
        });
        return;
      }
      if (!className) {
        errors.push({
          row: rowNumber,
          field: 'className',
          message: '班级不能为空',
        });
        return;
      }
      if (!name) {
        errors.push({ row: rowNumber, field: 'name', message: '姓名不能为空' });
        return;
      }

      rawRows.push({
        gradeName,
        className,
        name,
        studentNumber,
        contact,
        gender,
      });
    });

    if (rawRows.length === 0 && errors.length === 0) {
      throw new BadRequestException('Excel 文件没有数据行');
    }

    const numberSet = new Set<string>();
    const validRows: ParsedRow[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (row.studentNumber && numberSet.has(row.studentNumber)) {
        errors.push({
          row: i + 2,
          field: 'studentNumber',
          message: `学号 ${row.studentNumber} 在文件内重复`,
        });
        continue;
      }
      if (row.studentNumber) {
        numberSet.add(row.studentNumber);
      }
      validRows.push(row);
    }

    const studentNumbers = validRows
      .map((r) => r.studentNumber)
      .filter((n) => n);

    if (studentNumbers.length > 0) {
      const hashes = studentNumbers.map(sha256Hex);
      const existing = await this.studentRepo.find({
        where: hashes.map((h) => ({ studentNumberHash: h })),
        select: ['studentNumberHash'],
      });
      const existingHashes = new Set(existing.map((e) => e.studentNumberHash));

      const filtered: ParsedRow[] = [];
      for (const row of validRows) {
        if (
          row.studentNumber &&
          existingHashes.has(sha256Hex(row.studentNumber))
        ) {
          // skip existing
        } else {
          filtered.push(row);
        }
      }

      return { validRows: filtered, errors };
    }

    return { validRows, errors };
  }

  async importStudents(validRows: ParsedRow[]): Promise<ImportResult> {
    if (validRows.length === 0) {
      return { total: 0, created: 0, skipped: 0, errors: [] };
    }

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const gradeMap = new Map<string, Grade>();
      const classMap = new Map<string, Class>();
      let createdCount = 0;
      const errors: ImportError[] = [];

      for (const row of validRows) {
        try {
          const gradeKey = row.gradeName;
          let grade = gradeMap.get(gradeKey);
          if (!grade) {
            const found = await manager.findOne(Grade, {
              where: { name: row.gradeName },
            });
            if (found) {
              grade = found;
            } else {
              const gradeEntity = manager.create(Grade, {
                name: row.gradeName,
                sortOrder: gradeMap.size,
              });
              grade = await manager.save(Grade, gradeEntity);
            }
            gradeMap.set(gradeKey, grade);
          }

          const classKey = `${grade.id}:${row.className}`;
          let cls = classMap.get(classKey);
          if (!cls) {
            const found = await manager.findOne(Class, {
              where: { gradeId: grade.id, name: row.className },
            });
            if (found) {
              cls = found;
            } else {
              const classEntity = manager.create(Class, {
                gradeId: grade.id,
                name: row.className,
                sortOrder: classMap.size,
              });
              cls = await manager.save(Class, classEntity);
            }
            classMap.set(classKey, cls);
          }

          const encryptedName = row.name
            ? await this.encryptionService.encrypt(row.name)
            : null;
          const encryptedStudentNumber = row.studentNumber
            ? await this.encryptionService.encrypt(row.studentNumber)
            : null;
          const encryptedContact = row.contact
            ? await this.encryptionService.encrypt(row.contact)
            : null;

          const student = new Student();
          student.classId = cls.id;
          student.encryptedName = encryptedName;
          student.encryptedStudentNumber = encryptedStudentNumber;
          student.encryptedContact = encryptedContact;
          student.studentNumberHash = row.studentNumber
            ? sha256Hex(row.studentNumber)
            : null;
          student.gender = row.gender || null;

          await manager.save(Student, student);
          createdCount++;
        } catch (err) {
          errors.push({
            row: validRows.indexOf(row) + 2,
            field: '_',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return {
        total: validRows.length,
        created: createdCount,
        skipped: validRows.length - createdCount - errors.length,
        errors,
      };
    });
  }

  async generateTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('学生导入模板');

    sheet.columns = [
      { header: '年级', key: 'gradeName', width: 15 },
      { header: '班级', key: 'className', width: 15 },
      { header: '姓名', key: 'name', width: 15 },
      { header: '学号', key: 'studentNumber', width: 20 },
      { header: '联系方式', key: 'contact', width: 20 },
      { header: '性别', key: 'gender', width: 10 },
    ];

    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
