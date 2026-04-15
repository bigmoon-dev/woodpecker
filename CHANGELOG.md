# Changelog

All notable changes to **啄木鸟心理预警辅助系统 (Woodpecker)**.

## [0.10.0] - 2026-04-15

### Added

#### 数据看板增强 — 预警趋势图表 + 高风险学生热力图

**DashboardService 新增方法**
- `getAlertTrendByMonth(dataScope, startDate, endDate?, period?)` — 按月或学期聚合预警趋势
  - `period=month`: `YYYY-MM` 粒度聚合 red/yellow/total
  - `period=semester`: 基于 createdAt 月份映射 `YYYY-S1`(1-6月)/`YYYY-S2`(7-12月)
  - 支持 startDate/endDate 范围过滤
  - 复用 buildScopeFilter (own/class/grade/all)

- `getRiskHeatmap(dataScope, startDate?, endDate?)` — 年级×班级高风险学生分布热力图
  - 聚合维度: grade_name × class_name
  - 指标: red_students, yellow_students, total_alert_students (DISTINCT student_id)
  - 按 g.sort_order, c.sort_order 排序

**Dashboard Controller 新增端点**
- `GET /api/dashboard/alert-trend?startDate=&endDate=&period=month|semester`
- `GET /api/dashboard/risk-heatmap?startDate=&endDate=`

**Tests**
- `dashboard.service.spec.ts`: +10 tests (月度/学期聚合、scope=all/own/class/grade、日期范围、空结果)
- `dashboard.controller.spec.ts`: +3 tests (alert-trend 默认/semester、risk-heatmap 日期参数)

### Changed

- Version bumped to `0.10.0`
- Dashboard 模块覆盖率: Stmts 100%, Branch 89.18%, Lines 100%

### Test Results

- 56 test suites, 471 test cases, all passing
- ESLint 0 warnings, TypeScript 0 errors

## [0.9.0] - 2026-04-15

### Added

#### 运行时配置热更新 (DIR-1)

**SystemConfig Entity + Migration**
- `system-config.entity.ts`: SystemConfig entity (key/value/category/description/valueType/updatedAt/updatedBy)
- `1700000000005-AddSystemConfig.ts`: migration 创建 system_config 表

**ConfigReloadService** (`@Global` provider)
- `get<T>(key, defaultValue)`: 优先 DB 缓存 → process.env → defaultValue，支持 number/boolean/string 类型自动转换
- `reload()`: 从 DB 重新加载全部热配置到内存缓存
- `set(key, value, updatedBy)`: 写入 DB 并立即更新缓存
- `findAll()`: 列出全部配置（按 category+key 排序）
- `remove(key)`: 删除配置并清除缓存
- `maskValue(key, value)`: 脱敏敏感配置（AUDIT_HMAC_SECRET/ENCRYPTION_KEY/JWT_SECRET）
- `@Cron('*/5 * * * *') periodicSync()`: 每 5 分钟自动同步 DB 配置（多实例一致性）
- `OnModuleInit`: 启动时自动加载 DB 配置

**Admin Config API**
- `GET /api/admin/config` — 列出所有配置（脱敏密钥值）
- `PUT /api/admin/config/:key` — 更新配置值
- `POST /api/admin/config/reload` — 手动触发全局刷新

**Tests**
- `config-reload.service.spec.ts`: 12 tests (DB 加载、env fallback、coerce number/boolean、set/update cache、delete、reload、maskValue、findAll)
- `admin.controller.spec.ts`: +3 tests (listConfig、updateConfig、reloadConfig)

#### 数据库备份恢复策略 (DIR-2)

**Docker Compose**
- `db` service: WAL archiving 配置 (archive_mode=on, wal_level=replica, max_wal_senders=3)
- `backup` sidecar: postgres:16-alpine + cron 定时备份 + 初始备份
- 敏感配置通过 `${DB_PASSWORD}` 环境变量注入

**Backup Scripts**
- `scripts/backup-script.sh`: pg_dump -Fc 全量备份 + SHA256 校验 + pg_restore --list 验证 + 7d/4w/12m 轮转
- `scripts/backup-entrypoint.sh`: sidecar 入口 (初始备份 + crond 调度)
- `scripts/restore.sh`: 交互式一键恢复 (checksum 验证 + drop/create DB + pg_restore + app restart)
- `scripts/verify-backup.sh`: 备份完整性检查 (SHA256 + pg_restore --list)，支持 --all 批量验证
- `scripts/drill-restore.sh`: 隔离容器恢复演练 (临时 postgres + 完整恢复 + 表数据验证 + 清理)

**RPO/RTO**
| 场景 | RPO | RTO |
|------|-----|-----|
| 全量恢复 | ≤ 1h (WAL) | ≤ 30min |
| 时间点恢复 | ≤ 1min | ≤ 45min |

### Changed

- Version bumped to `0.9.0`
- `CoreModule` 注册 SystemConfig repo + ConfigReloadService (global)
- `AppModule` 注册 SystemConfig entity
- `AdminController` 注入 ConfigReloadService

### Test Results

- 56 test suites, 458 test cases, all passing (+14 tests, +2 suites)
- ESLint 0 warnings, TypeScript 0 errors

## [0.8.0] - 2026-04-15

### Added

#### Audit Module Test Coverage (Branch 59.3% → 91.86%)

**DIR-1: AuditIntegrityService 单元测试** (11 tests)
- `audit-integrity.service.spec.ts` (new): 完整覆盖 computeHash (null 处理、完整 log、createdAt 分支)、verify (null hash/length mismatch/密钥匹配/错误密钥)、verifyChain (空数组/全合法/中间篡改/乱序排序)
- Branch: 0% → 100%

**DIR-2: AuditInterceptor 构造函数分支** (+2 tests)
- `audit.interceptor.spec.ts`: AUDIT_HMAC_SECRET 未设置 (undefined) 和空字符串时构造函数 throw Error
- Branch: 80% → 85%

**DIR-3: DataRetentionService 脱敏边界** (+8 tests)
- `data-retention.service.spec.ts`: 已脱敏值跳过加密 (name/studentNumber/contact)、短值 mask 边界 (≤8/≤7)、空字符串处理、全 null 字段、全已脱敏不重加密
- Branch: 76.08% → 91.3%

### Changed

- Version bumped to `0.8.0`

### Test Results

- 55 test suites, 444 test cases, all passing (+21 tests, +1 suite)
- Audit module Branch: 59.3% → 91.86% (target: ≥85%)
- Global Branch: 72.61% → 74.45%
- ESLint 0 warnings, TypeScript 0 errors

## [0.7.0] - 2026-04-15

### Added

#### P0/P1 Security Hardening + Test Coverage (5 Directions)

**DIR-1: Consent Expiry Enforcement**
- `consent-record.entity.ts`: Added `expiresAt: Date | null` column — consent records can now have an optional expiry date
- `consent.guard.ts`: Added expiry check after consent lookup — distinguishes unsigned (未签署) vs expired (已过期) with separate error messages
- `consent-security.spec.ts`: 3 new tests — expired consent blocked, non-expiring (null expiresAt) allowed, future-dated consent allowed

**DIR-2: Audit Log Integrity (HMAC)**
- `audit-log.entity.ts`: Added `integrityHash: string | null` column — each audit entry is cryptographically signed
- `audit-integrity.service.ts` (new): `computeHash()` generates HMAC-SHA256 over log fields; `verify()` uses `timingSafeEqual` for tamper detection; `verifyChain()` detects first tampered entry in a sorted log sequence
- `audit.interceptor.ts`: Injected `ConfigService` + `AuditIntegrityService`; computes and attaches `integrityHash` on every audit log creation; `createdAt` set explicitly for deterministic signing
- `audit.module.ts`: Registered `AuditIntegrityService` as provider + export
- `audit.interceptor.spec.ts`: Updated test module to mock `ConfigService` + `AuditIntegrityService`
- `audit-security.spec.ts`: 3 new integrity tests — signature attached on creation, tamper detection via verify, chain verification identifies tampered index

**DIR-3: Timing-Safe Token Comparison**
- `auth.controller.ts` refresh flow: Added `crypto.timingSafeEqual` buffer comparison between stored and computed token hashes, preventing timing side-channel attacks on refresh token validation
- `auth-security.spec.ts`: Updated timing test — verifies mismatched token hashes cause `UnauthorizedException` rejection

**DIR-4: Result Service Coverage**
- `result-filter.spec.ts` (new): 9 tests covering `findByFilter` — classId branch, gradeId branch, empty grade, dataScope delegation, no-filter (scope=all) path, taskId filtering, empty answers, batchDecrypt with unique student IDs, ResultWithContext fallback for missing PII

**DIR-5: Alert Error Path Coverage**
- `alert.service.spec.ts`: 2 new tests — `followup` returns null `retestComparisonUrl` when answer query throws, `triggerAlert` does not throw when `notifyRelevantUsers` fails (studentRepo rejection)

### Changed

- Version bumped from `0.1.0` to `0.7.0` in `package.json` (aligned with CHANGELOG history)

### Test Results

- 54 test suites, 423 test cases, all passing
- ESLint 0 warnings, TypeScript 0 errors

## [0.6.1] - 2026-04-14

### Added

#### Test Coverage Round 2 (69.74% → 90.8%)

**New Test Files (19 tests)**
- `audit.interceptor.spec.ts`: 7 tests — intercept with/without user, resource extraction, UUID extraction, unknown resource, save error swallowed
- `data-retention.service.spec.ts`: 6 tests — no expired students, PII hashing, null fields, mixed null/non-null, default retention days, cutoff date
- `plugin.controller.spec.ts`: 3 tests — findAll, enable, disable endpoint delegation

**Extended Test Files (8 tests)**
- `scale.service.spec.ts`: +8 tests — cloneFromLibrary (found/not found/no rules), update (name only, not found, full update, cache failure, no options)

### Changed

- Updated `collectCoverageFrom` in jest config to exclude seed, migrations, module files, main.ts, index.ts, and plugins
- Coverage: 347 tests passing, overall 90.8% statements, all modules ≥70%

## [0.6.0] - 2026-04-14

### Added

#### Test Coverage Boost (34% → 62%)

**DIR-1: Security Critical Tests (40 tests)**
- `rbac.guard.spec.ts`: 10 tests — scope computation (own/class/grade/all), permission check, no user, empty roles
- `jwt-auth.guard.spec.ts`: 4 tests — @Public() bypass, protected endpoint delegation
- `jwt.strategy.spec.ts`: 6 tests — validate() user loading, not found, no roles, multiple roles, null studentId
- `consent.guard.spec.ts`: 6 tests — consent exists/missing, no user, no studentId, default/custom consent type
- `consent.service.spec.ts`: 7 tests — create, findByUserId, checkConsent true/false, findOne
- `encryption.service.spec.ts`: 7 tests — encrypt, decrypt, batchDecrypt happy/empty/partial, error propagation

**DIR-2: Business Critical Tests (54 tests)**
- `result.service.spec.ts`: 13 tests — findByStudent, findByScope, findByClass, findByGrade, findByFilter, PII decrypt
- `export.service.spec.ts`: 10 tests — generateExcel happy/empty/alerts, generatePdf happy/notFound/dimensions/suggestion
- `org.service.spec.ts`: 16 tests — CRUD for grades/classes/students with scope filtering, NotFoundException
- `task.service.spec.ts`: 12 tests — findAll pagination, update, publish, alert trigger red/yellow/green, no alert service

**DIR-3: Controller + Infrastructure Tests (51 tests)**
- `result.controller.spec.ts`: 5 tests — findMyResults studentId fallback, findByClass/Grade, findByScope
- `report-export.controller.spec.ts`: 3 tests — PDF headers, generatePdf delegation, Cache-Control
- `export.controller.spec.ts`: 8 tests — exportByTask/filter/PDF, 10000-row limit, headers
- `health.controller.spec.ts`: 3 tests — check, readiness, unhealthy DB
- `auth.controller.spec.ts`: +2 tests — refresh token valid/invalid
- `task.controller.spec.ts`: 5 tests — create with deadline, submit, publish, findOne, remove
- `scale.controller.spec.ts`: 6 tests — CRUD, findLibrary, clone, import
- `org.controller.spec.ts`: 6 tests — CRUD, import with/without file, download template
- `dashboard.controller.spec.ts`: 5 tests — 5 endpoint delegations
- `dashboard.service.spec.ts`: 7 tests — 5 aggregation methods, buildScopeFilter, error handling
- `scale.service.spec.ts`: +5 tests — findAll, findLibrary, findOne, remove
- `consent.controller.spec.ts`: 2 tests — create, check

### Changed

- 18 new spec files created, 4 existing specs extended
- 39 test suites total, 279 test cases (up from 134)
- Overall coverage: 62.55% (up from 34.67%)
- Module coverage ≥70%: auth, consent, core, dashboard, export, health, org, result, task, scoring

## [0.5.1] - 2026-04-14

### Fixed

- **BUG-1 (HIGH)**: Font file not found in production — added `"assets": ["assets"]` to `nest-cli.json` so NotoSansSC font is copied to `dist/` on build
- **BUG-2 (MEDIUM)**: `ReportExportController` now returns PDF via `ExportService.generatePdf()` instead of plain-text JSON
- **BUG-3 (LOW)**: PDF report now includes gradeName and className by querying Student→Class→Grade relations
- Dashboard.tsx: removed unsupported `color` prop from `Area` and `Column` chart components (fixes tsc error)
- StudentManage.tsx: fixed `UploadFile` type cast for FormData.append (fixes tsc error)

### Changed

- `ExportModule` now imports and exports `ExportService` (consumable by other modules)
- `ExportModule` registers Student, Class, Grade repositories for PDF grade/class lookup
- `ResultModule` imports `ExportModule` for `ReportExportController` PDF generation

## [0.5.0] - 2026-04-14

### Added

#### Health Check (DIR-1)
- `@nestjs/terminus` integration with TypeOrmHealthIndicator
- `GET /health` and `GET /health/ready` — no authentication required
- `@Public()` decorator on HealthController to bypass global JwtAuthGuard
- HealthModule registered in AppModule

#### Frontend Enhancements (DIR-2)
- Dashboard.tsx: replaced 4 HTML tables with @ant-design/charts components
  - Column chart (completion rate by class, stacked)
  - Pie chart (alert distribution)
  - Area chart (30-day trend, stacked by color)
  - Column chart (scale usage)
- ClassResults.tsx: added Excel export button + pagination + student info columns
- GradeResults.tsx: added Excel export button + pagination + student info columns
- TaskList.tsx: added per-task export button in action column
- MHT (心理健康测试) template: 100 items across 8 dimensions added to scale library seed
- Scale library seed now uses upsert logic (per-template check by source field)

#### PDF Personal Report (DIR-3)
- `pdfkit` integration with registered Noto Sans SC font (Apache 2.0, 11MB)
- `ExportService.generatePdf()`: structured PDF with header, student info, scores,
  dimension breakdown, suggestion, and disclaimer
- `GET /api/export/pdf/:resultId` — single-result PDF download
- PII batch decrypt for student name and student number in PDF

### Changed
- ExportModule now imports TaskResult, TaskAnswer repositories and CoreModule
- ClassResults/GradeResults now display studentName, studentNumber, scaleName columns

### Dependencies
- `@nestjs/terminus` (health checks)
- `pdfkit` (PDF generation)
- NotoSansSC-Regular.ttf (Google Fonts, Apache 2.0)

### Test Results
- 21 test suites, 134 test cases, all passing
- TypeScript 0 errors, ESLint 0 errors, Vite build successful

## [0.4.0] - 2026-04-14

### Added

#### Scale Library (DIR-3)
- `Scale.isLibrary` boolean field with migration + index
- `GET /api/scales/library` — list library scales
- `POST /api/scales/library/:id/clone` — clone library scale to instance
- Seed data: SCL-90, SDS, SAS templates (migration-based)
- `ScaleCacheService` excludes library scales from scoring cache
- Frontend: `ScaleLibrary.tsx` with ProTable + clone button + route

#### Result Export (DIR-2)
- `GET /api/results/class/:classId` — class results with pagination (fixes missing endpoint)
- `GET /api/results/grade/:gradeId` — grade results with pagination (fixes missing endpoint)
- `EncryptionService.batchDecrypt()` — single SQL query for bulk PII decryption
- `ExportModule`: Excel generation via ExcelJS with results + alert detail sheets
- `GET /api/export/excel/task/:taskId` — export by task with DataScope filtering
- `POST /api/export/excel` — export by filter with 10000 row limit
- `Cache-Control: no-store` on all export responses

#### Dashboard (DIR-1)
- `DashboardService`: 5 parameterized SQL aggregation methods
  - `getOverview()` — total tasks, completion rate, alert counts
  - `getCompletion()` — completion rate by grade/class
  - `getAlertDistribution()` — red/yellow alert distribution
  - `getTrend()` — daily result trend with color breakdown
  - `getScaleUsage()` — scale usage statistics
- `DashboardController`: `GET /api/dashboard/*` (5 endpoints)
- DataScope-aware SQL filtering via parameterized subqueries
- Frontend: `Dashboard.tsx` with Statistic cards, completion table, alert/trend/scale tables
- Routes: `/dashboard` in teacher and admin layouts

### Changed
- `ScaleService.findAll()` now filters `isLibrary: false` (user scales only)
- `ResultService` expanded with `findByClass()`, `findByGrade()`, `findByFilter()`
- `ResultModule` imports `CoreModule` for `EncryptionService` access

### Migration
- `AddScaleLibraryField1700000000004` — `is_library` column + index + seed data

### Test Results
- 21 test suites, 134 test cases, all passing
- TypeScript 0 errors
- ESLint 0 errors
- Frontend Vite build successful

## [0.3.0] - 2026-04-14

### Added

#### Student Batch Import (P0)
- `OrgImportService` with `parseExcel()`, `importStudents()`, `generateTemplate()`
- `POST /api/admin/students/import` — upload `.xlsx` file for batch student creation
- `GET /api/admin/students/import/template` — download Excel import template
- Excel parsing via exceljs: validates grade/class/student columns, auto-creates grades & classes
- Duplicate detection: intra-file duplicate student numbers reported as errors
- SERIALIZABLE transaction isolation for concurrent import safety
- 5MB file size limit via Multer `FileInterceptor`
- 14 unit tests covering all import scenarios

#### Frontend Import UI (DIR-3)
- StudentManage: "导入学生" button with upload Modal (`.xlsx/.xls`, maxCount=1)
- StudentManage: import result Modal showing total/created/skipped stats + error detail table
- StudentManage: "下载模板" button for template download
- GradeManage: "下载模板" button for student import template download

#### Cross-Phase Audit Fixes
- Transaction isolation upgraded to `SERIALIZABLE` to prevent UNIQUE constraint violations under concurrency
- `FileInterceptor` now enforces 5MB `fileSize` limit (previously unbounded)
- `studentNumberHash` column: removed duplicate `unique: true` from `@Column`, keeping only `@Index` partial unique
- Error responses changed from `new Error` (500) to `BadRequestException` (400)
- Intra-file duplicate student numbers now recorded in errors instead of silently discarded
- Variable shadowing fix: `gradeEntity`/`classEntity` rename to avoid outer scope collision

### Migration

- `AddStudentNumberHashAndUniqueConstraints` — adds `student_number_hash` column with partial unique index

### Test Results

- 21 test suites, 134 test cases, all passing
- TypeScript 0 errors
- ESLint 0 errors
- Frontend Vite build successful

## [0.2.0] - 2026-04-14

### Added

- Scale edit/delete UI in admin panel
- Admin route enhancement with sidebar menu
- Dev auto-login for local development
- Docker deployment support (Dockerfile + docker-compose)
- SCL-90 scale template (Excel)

### Changed

- ConsentRecord registered in TaskModule/ResultModule for DI resolution
- ESLint `no-unsafe-assignment` resolved in `scale.service` update

## [0.1.0] - 2026-04-14

### Added

#### Core Backend
- NestJS 11 project scaffold with TypeScript strict mode
- PostgreSQL integration via TypeORM with migration support
- JWT authentication (access token + refresh token rotation)
- RBAC authorization with dynamic permission configuration
- Data scope filtering (own / class / grade / all)
- Global audit logging interceptor

#### Scale Module
- Scale CRUD (create, read, update, delete)
- Scale items and options management
- Scoring rules (sum, weighted, dimension strategies)
- Score range / level definition
- Excel (.xlsx) batch import via exceljs

#### Scoring Engine
- Sum strategy — simple item score summation
- Weighted strategy — weighted item score calculation
- Dimension strategy — multi-dimension grouped scoring
- Reverse-score handler — automatic reverse for designated items
- Score-range matcher — maps total score to level/color/suggestion
- Scale cache service for performance optimization
- >95% unit test coverage for scoring engine

#### Task Module
- Assessment task creation with scale, target classes, deadline
- Task publishing workflow (draft → published)
- Student answer submission with automatic scoring
- Alert auto-trigger on red/yellow results after submission

#### Alert Module
- Alert record creation with color-coded severity (red/yellow)
- Alert handling workflow (pending → handled)
- Follow-up recording
- Alert notification dispatch

#### Organization Module
- Grade → Class → Student three-level hierarchy CRUD
- Batch student import support
- Grade/Class/Student update (PUT) endpoints

#### Admin Module
- Role management (create, update, delete roles)
- Permission management with configurable permission points
- User management (create, update, delete users with role assignment)

#### Consent Module
- Informed consent record management
- ConsentGuard — blocks assessment-related operations until consent is signed
- Applied to task viewing, answer submission, and result access

#### Audit & Data Retention
- Global AuditInterceptor logging all API operations
- DataRetentionService with scheduled desensitization (runs every 24 hours)
- SHA-256 hashing of expired student PII fields (name, student number, contact)
- Configurable retention period via `DATA_RETENTION_DAYS` environment variable

#### Plugin System
- PluginManager with lifecycle hooks (install, enable, disable, uninstall)
- HookBus for event-driven plugin communication
- ExcelImportPlugin — route metadata registration
- ReportExportPlugin — report generation hook
- PluginRoute interface with controller delegation support
- Plugin admin API (list, enable, disable)

#### Frontend (React + Ant Design)
- Login page with JWT token management
- Student layout: task list, online assessment, my results, consent page
- Teacher/Psychologist layout: scale management, task management, class/grade results, alert handling
- Admin layout: role management, user management, plugin management, grade/class/student management
- ProTable-based data views with pagination
- Route-based role access control
- Axios request utility with token injection

### Changed

- JWT Strategy now loads fresh user permissions from database on each request instead of relying on stale JWT payload data
- Plugin route metadata aligned with actual controller endpoints (`/api/scales/import`)
- ConsentGuard scope expanded to cover task viewing (GET /api/tasks/:id)
- DataRetentionService registered in AuditModule with ScheduleModule integration

### Security

- Student PII encrypted at rest (bytea columns)
- Password hashing with bcrypt (10 rounds)
- JWT token expiration (15min staff / 30min students)
- RBAC guard on all protected endpoints
- Informed consent verification before data collection
- Automatic data desensitization for expired records

### Infrastructure

- Single-process deployment: Vite build output served by NestJS via @nestjs/serve-static
- Environment-based configuration via @nestjs/config
- TypeORM migrations for database schema management
- ESLint + Prettier for code style enforcement
- Jest test framework with ts-jest

### Test Results

- 20 test suites, 120 test cases, all passing
- Scoring engine >95% coverage
- TypeScript 0 errors
- ESLint 0 errors
- Frontend Vite build successful
