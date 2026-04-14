# Changelog

All notable changes to **啄木鸟心理预警辅助系统 (Woodpecker)**.

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
