/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { DataScopeFilter } from './data-scope-filter';

describe('DataScopeFilter', () => {
  let filter: DataScopeFilter;
  let studentRepo: any;
  let classRepo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataScopeFilter,
        {
          provide: getRepositoryToken(Student),
          useValue: { find: jest.fn(), createQueryBuilder: jest.fn() },
        },
        { provide: getRepositoryToken(Class), useValue: { find: jest.fn() } },
      ],
    }).compile();

    filter = module.get<DataScopeFilter>(DataScopeFilter);
    studentRepo = module.get(getRepositoryToken(Student));
    classRepo = module.get(getRepositoryToken(Class));
  });

  describe('getStudentIds', () => {
    it('should return student IDs for class scope', async () => {
      studentRepo.find.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
      const ids = await filter.getStudentIds({
        scope: 'class',
        userId: 'u1',
        classId: 'c1',
      });
      expect(ids).toEqual(['s1', 's2']);
    });

    it('should return empty for class scope without classId', async () => {
      const ids = await filter.getStudentIds({
        scope: 'class',
        userId: 'u1',
      });
      expect(ids).toEqual([]);
    });

    it('should return student IDs for grade scope', async () => {
      classRepo.find.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
      studentRepo.find.mockResolvedValue([
        { id: 's1' },
        { id: 's2' },
        { id: 's3' },
      ]);
      const ids = await filter.getStudentIds({
        scope: 'grade',
        userId: 'u1',
        gradeId: 'g1',
      });
      expect(ids).toEqual(['s1', 's2', 's3']);
    });

    it('should return empty for grade scope without gradeId', async () => {
      const ids = await filter.getStudentIds({
        scope: 'grade',
        userId: 'u1',
      });
      expect(ids).toEqual([]);
    });

    it('should return empty array for all scope (no filter)', async () => {
      const ids = await filter.getStudentIds({
        scope: 'all',
        userId: 'u1',
      });
      expect(ids).toEqual([]);
    });

    it('should return empty for own scope when no student found', async () => {
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      studentRepo.createQueryBuilder.mockReturnValue(qb);
      const ids = await filter.getStudentIds({
        scope: 'own',
        userId: 'u1',
      });
      expect(ids).toEqual([]);
    });
  });
});
