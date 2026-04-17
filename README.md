# 啄木鸟心理预警辅助系统 (Woodpecker)

面向 K-12 学校场景的心理健康量表在线测评平台，支持 Excel 导入量表、学生在线答题、自动计分与分级预警。

[![CI](https://github.com/bigmoon-dev/woodpecker/actions/workflows/ci.yml/badge.svg)](https://github.com/bigmoon-dev/woodpecker/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-92.83%25-brightgreen)](./src/modules/scoring/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)

> 啄木鸟是"森林医生"，以早发现、早干预为寓意，守护学生心理健康。

[English](./README.en.md) | 中文

---

## 功能概览

- **量表管理** — 创建/编辑心理学量表，支持通过 Excel (.xlsx) 批量导入量表模板
- **自动计分引擎** — 支持求和、加权、维度三种计分策略，反向题自动处理，分数-等级自动匹配
- **分级预警** — 根据测评结果自动触发红/黄预警，支持处理、随访、通知全流程
- **组织架构** — 年级 → 班级 → 学生三级结构，支持批量导入
- **RBAC 权限** — 基于角色的访问控制，管理员可通过 UI 动态配置角色与权限点
- **知情同意** — 学生答题前必须签署知情同意书，符合未成年人保护法要求
- **数据脱敏** — 过期学生数据自动哈希脱敏（可配置保留天数），符合数据安全法
- **审计日志** — 全局操作审计拦截器，记录关键操作轨迹
- **插件系统** — 核心功能不可插拔，扩展功能（Excel 导入、报告导出）通过插件实现
- **单进程部署** — 前端 Vite 构建输出至 `public/`，NestJS 单进程同时服务 API 和静态文件

## 技术栈

| 层 | 技术 |
|---|------|
| 后端框架 | NestJS 11 + TypeScript |
| 数据库 | PostgreSQL (TypeORM) |
| 认证 | Passport-JWT + bcrypt |
| 前端 | React 18 + Ant Design 5 + ProComponents |
| 前端构建 | Vite 6 |
| 代码质量 | ESLint + Prettier + Jest |

## 系统架构

```
┌─────────────────────────────────────────────┐
│                 NestJS Server                │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Auth模块  │ │ Scale模块 │ │  Task模块    │ │
│  │ JWT+RBAC │ │ 量表CRUD  │ │ 答题+计分    │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Alert模块 │ │ Org模块   │ │ Plugin模块   │ │
│  │ 预警流程  │ │ 组织架构  │ │ 插件管理     │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Audit模块 │ │ Consent  │ │ Scoring引擎  │ │
│  │ 审计+脱敏 │ │ 知情同意  │ │ 3种策略      │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
│         │ TypeORM │ @nestjs/serve-static    │
│         ▼        ▼                          │
│    PostgreSQL    public/ (React SPA)        │
└─────────────────────────────────────────────┘
```

## 后端模块说明

| 模块 | 路径 | 职责 |
|------|------|------|
| `auth` | `src/modules/auth/` | JWT 认证、RBAC 权限守卫、数据范围过滤 |
| `scale` | `src/modules/scale/` | 量表 CRUD、Excel 导入解析 |
| `scoring` | `src/modules/scoring/` | 计分引擎（sum/weighted/dimension 策略）、分数区间匹配 |
| `task` | `src/modules/task/` | 测评任务创建、发布、答题提交 |
| `result` | `src/modules/result/` | 测评结果查询、报告导出 |
| `alert` | `src/modules/alert/` | 预警触发、处理、随访 |
| `org` | `src/modules/org/` | 年级/班级/学生组织架构管理 |
| `admin` | `src/modules/admin/` | 角色/权限/用户管理 |
| `consent` | `src/modules/consent/` | 知情同意签署与验证 |
| `audit` | `src/modules/audit/` | 操作审计日志、数据脱敏定时任务 |
| `plugin` | `src/modules/plugin/` | 插件注册/启用/禁用、Hook 总线 |
| `core` | `src/modules/core/` | 加密工具服务 |

## 前端页面

| 角色 | 页面 |
|------|------|
| 登录 | `/login` |
| 学生 | 任务列表、在线答题、我的结果、知情同意 |
| 教师/心理师 | 量表管理、任务管理、班级/年级结果、预警处理 |
| 管理员 | 角色管理、用户管理、插件管理、年级/班级/学生管理 |

## 快速开始

### 前置条件

- Node.js >= 18
- PostgreSQL >= 14
- npm >= 9

### 安装

```bash
# 克隆项目
cd ~/project/psych-scale-server

# 安装后端依赖
npm install

# 安装前端依赖
cd client && npm install && cd ..

# 构建前端（输出到 public/）
cd client && npm run build && cd ..
```

### 配置

创建 `.env` 文件（或设置环境变量）：

```env
# 数据库
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=psych_scale
DB_SYNC=false

# JWT
JWT_SECRET=your-jwt-secret-change-in-production

# 数据脱敏（天）
DATA_RETENTION_DAYS=365
```

### 数据库迁移

```bash
# 首次运行（自动执行迁移）
npm run migration:run
# 或开发环境使用 synchronize
# 设置 DB_SYNC=true
```

### 启动

```bash
# 开发模式（热重载）
npm run start:dev

# 生产模式
npm run build
npm run start:prod
```

服务启动后访问 `http://localhost:3000`。

## API 概览

| 前缀 | 说明 |
|------|------|
| `POST /api/auth/login` | 用户登录 |
| `POST /api/auth/refresh` | 刷新令牌 |
| `GET /api/auth/me` | 当前用户信息 |
| `CRUD /api/scales` | 量表管理 |
| `POST /api/scales/import` | Excel 导入量表 |
| `CRUD /api/tasks` | 测评任务 |
| `POST /api/tasks/:id/answers/submit` | 提交答案 |
| `POST /api/tasks/:id/publish` | 发布任务 |
| `GET /api/results/me` | 我的结果 |
| `GET /api/results` | 按权限范围查询结果 |
| `CRUD /api/alerts` | 预警管理 |
| `CRUD /api/admin/grades` | 年级管理 |
| `CRUD /api/admin/classes` | 班级管理 |
| `CRUD /api/admin/students` | 学生管理 |
| `CRUD /api/admin/roles` | 角色管理 |
| `CRUD /api/admin/users` | 用户管理 |
| `GET/POST /api/admin/plugins` | 插件管理 |

## 测试

```bash
# 运行全部单元测试
npm test

# 带覆盖率报告
npm run test:cov

# 监听模式
npm run test:watch

# E2E 测试
npm run test:e2e
```

计分引擎测试覆盖率 >95%（92 个源文件，20 个测试套件，120 个测试用例）。

## 代码质量

```bash
# TypeScript 类型检查
npx tsc --noEmit

# ESLint 检查
npm run lint

# Prettier 格式化
npm run format
```

## 插件开发

实现 `IPlugin` 接口即可开发新插件：

```typescript
import { IPlugin, PluginRoute } from './modules/plugin/plugin.interface';

export class MyPlugin implements IPlugin {
  name = 'my-plugin';
  version = '1.0.0';
  description = 'My custom plugin';

  getRoutes(): PluginRoute[] {
    return [{ method: 'GET', path: '/api/plugins/my-plugin/hello', handler: 'hello' }];
  }

  getHooks() { return []; }
}
```

在 `PluginManager.onModuleInit()` 中注册插件实例。

## 项目结构

```
psych-scale-server/
├── client/                  # React 前端
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   ├── layouts/         # 布局组件
│   │   ├── router/          # 路由配置
│   │   └── utils/           # 工具函数
│   └── vite.config.ts
├── src/
│   ├── modules/             # 业务模块
│   │   ├── admin/           # 管理后台
│   │   ├── alert/           # 预警
│   │   ├── auth/            # 认证授权
│   │   ├── audit/           # 审计日志
│   │   ├── consent/         # 知情同意
│   │   ├── core/            # 核心工具
│   │   ├── org/             # 组织架构
│   │   ├── plugin/          # 插件系统
│   │   ├── result/          # 测评结果
│   │   ├── scale/           # 量表管理
│   │   ├── scoring/         # 计分引擎
│   │   └── task/            # 测评任务
│   ├── entities/            # TypeORM 实体
│   ├── plugins/             # 插件实现
│   ├── common/              # 公共工具
│   ├── migrations/          # 数据库迁移
│   └── main.ts              # 入口文件
├── public/                  # 前端构建输出
├── test/                    # E2E 测试
└── package.json
```

## 合规说明

- **数据安全法** — 学生个人信息加密存储，超期数据自动哈希脱敏
- **未成年人保护法** — 知情同意机制，学生答题前必须签署同意书
- **审计追溯** — 全局操作审计日志，可追溯关键操作

## 功能路线图

详见 [ROADMAP.md](./docs/ROADMAP.md)，包含已实现功能清单和规划中的功能。

## License

[Apache-2.0](./LICENSE)
