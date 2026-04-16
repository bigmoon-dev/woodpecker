import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../../entities/auth/user.entity';
import { Role } from '../../entities/auth/role.entity';
import { Permission } from '../../entities/auth/permission.entity';
import { AuthService } from '../auth/auth.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  CreateUserDto,
  UpdateUserDto,
} from './admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
    private authService: AuthService,
  ) {}

  async findAllRoles(page = 1, pageSize = 20) {
    const [data, total] = await this.roleRepo.findAndCount({
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total };
  }

  async createRole(dto: CreateRoleDto) {
    const role = this.roleRepo.create(dto);
    return this.roleRepo.save(role);
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    await this.roleRepo.update(id, dto);
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    return role;
  }

  async deleteRole(id: string) {
    await this.roleRepo.delete(id);
  }

  async findAllUsers(page = 1, pageSize = 20) {
    const [data, total] = await this.userRepo.findAndCount({
      relations: ['roles'],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total };
  }

  async createUser(dto: CreateUserDto) {
    const hash = await this.authService.hashPassword(dto.password);
    const user = this.userRepo.create({
      username: dto.username,
      password: hash,
      displayName: dto.displayName,
    });
    if (dto.roleIds && dto.roleIds.length > 0) {
      user.roles = await this.roleRepo.findBy({ id: In(dto.roleIds) });
    }
    return this.userRepo.save(user);
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const updateData: Partial<User> = {};
    if (dto.displayName !== undefined) updateData.displayName = dto.displayName;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.studentRecordId !== undefined)
      updateData.studentId = dto.studentRecordId;
    if (Object.keys(updateData).length > 0) {
      await this.userRepo.update(id, updateData);
    }
    if (dto.roleIds !== undefined) {
      const user = await this.userRepo.findOne({ where: { id } });
      if (!user) throw new NotFoundException(`User ${id} not found`);
      user.roles =
        dto.roleIds.length > 0
          ? await this.roleRepo.findBy({ id: In(dto.roleIds) })
          : [];
      await this.userRepo.save(user);
    }
    const result = await this.userRepo.findOne({ where: { id } });
    if (!result) throw new NotFoundException(`User ${id} not found`);
    return result;
  }

  async deleteUser(id: string) {
    await this.userRepo.delete(id);
  }

  async findAllPermissions(page = 1, pageSize = 20) {
    const [data, total] = await this.permissionRepo.findAndCount({
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total };
  }

  async updateRolePermissions(roleId: string, permissionIds: string[]) {
    const role = await this.roleRepo.findOne({
      where: { id: roleId },
      relations: ['permissions'],
    });
    if (!role) throw new NotFoundException(`Role ${roleId} not found`);
    role.permissions = await this.permissionRepo.findBy({
      id: In(permissionIds),
    });
    return this.roleRepo.save(role);
  }

  async removeRolePermission(roleId: string, permissionId: string) {
    const role = await this.roleRepo.findOne({
      where: { id: roleId },
      relations: ['permissions'],
    });
    if (!role) throw new NotFoundException(`Role ${roleId} not found`);
    role.permissions = role.permissions.filter((p) => p.id !== permissionId);
    return this.roleRepo.save(role);
  }
}
