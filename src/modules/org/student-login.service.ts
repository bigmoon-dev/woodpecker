import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/auth/user.entity';
import { Role } from '../../entities/auth/role.entity';
import { Student } from '../../entities/org/student.entity';
import { HookBus } from '../plugin/hook-bus';
import { AuthService } from '../auth/auth.service';

const DEFAULT_STUDENT_PASSWORD = 'Test1234';

@Injectable()
export class StudentLoginService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    private hookBus: HookBus,
    private authService: AuthService,
  ) {}

  onModuleInit() {
    this.hookBus.register([
      {
        event: 'on:student.imported',
        priority: 10,
        handler: async (payload: { studentId: string; classId?: string }) => {
          await this.createLoginForStudent(payload.studentId);
        },
      },
    ]);
  }

  async createLoginForStudent(studentId: string): Promise<void> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId },
    });
    if (!student) return;

    const existing = await this.userRepo.findOne({
      where: { studentId: student.id },
    });
    if (existing) return;

    const shortId = student.id.slice(0, 8);
    const username = `stu_${shortId}`;
    const displayName = `学生_${shortId.slice(0, 6)}`;

    const usernameExists = await this.userRepo.findOne({
      where: { username },
    });
    if (usernameExists) return;

    const studentRole = await this.roleRepo
      .createQueryBuilder('role')
      .where('role.name IN (:...names)', { names: ['student', '学生'] })
      .getOne();

    const hash = await this.authService.hashPassword(DEFAULT_STUDENT_PASSWORD);
    const user = this.userRepo.create({
      username,
      password: hash,
      displayName,
      status: 'active',
      studentId: student.id,
      roles: studentRole ? [studentRole] : [],
    });

    await this.userRepo.save(user);
  }
}
