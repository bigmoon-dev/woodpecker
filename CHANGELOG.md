# Changelog

## [0.41.0] - 2026-04-25
### Added
- 访谈模板文件上传功能：支持上传 .doc/.docx/.xls/.xlsx/.pdf 文件作为访谈模板
- 模板列表新增"模板文件"列，显示文件名和下载链接，支持替换文件
- 使用帮助页面表格和排版样式（remark-gfm + CSS）

### Fixed
- OTA 更新后自动重启服务进程（修复 needsRestart 未生效的问题）
- 使用帮助页面 GFM 表格渲染（安装 remark-gfm 插件）
- 说明书版本号更新为 v0.40.0，移除学生适用对象
- NestJS 静态文件服务（main.ts 添加 useStaticAssets）

## [0.39.0] - 2026-04-25
### Fixed — 前后端字段名系统性对齐（whitelist 静默丢数据修复）
- Interview: CreateInterviewDto 和 UpdateInterviewDto 添加 `riskLevel` 字段（@IsIn(['normal','low','medium','high'])），修复创建/编辑面谈时风险等级被 whitelist 静默剥掉的问题
- Interview: 前端状态更新改用 `PUT /interviews/:id/status` 端点（UpdateStatusDto），修复状态流转（draft→reviewed→completed）永远失败的问题
- Grade: 实体添加 `year` 字段（string, nullable），CreateGradeDto 添加 `year` 字段，修复年级年份被 whitelist 剥掉的问题
- Grade/Class: CreateGradeDto 和 CreateClassDto 的 `sortOrder` 改为 @IsOptional()，service 层自动计算 MAX(sortOrder)+1，修复创建年级/班级必报 400 的问题
- Consent: 前端提交前计算 content 的 SHA256 作为 contentHash，后端 CreateConsentDto 的 contentHash 改为 optional 并增加 content 字段，修复同意书签署完全不可用的问题
- Follow-up: InterviewController.createFollowUp 从 @Param('id') 取 interviewId 注入 DTO，修复随访创建必失败的问题
- MyResults: API 路径从 `/classes` 和 `/grades` 改为 `/admin/classes` 和 `/admin/grades`，修复筛选下拉框永远为空的问题

### Removed
- 移除 desktop/start-desktop.js 中的运行时猴子补丁（regex 修改编译后 JS 的临时方案），学生学号兼容性已通过源码层面 DTO + Service 修复
- 移除 org.controller.ts createStudent 方法中的调试 console.log

## [0.38.0] - 2026-04-24
### Changed
- 角色名从中文改为英文（admin/psychologist/teacher/student）+ displayName 中文展示，代码逻辑全部使用英文 name
- AdminLayout/TeacherLayout 一级菜单精简，删除重复管理项
- SettingsPage 删除年级管理 tab，保留：班级管理、学生管理、角色管理、用户管理、插件管理、数据库备份
- Layout avatar 显示真实用户名（从 localStorage 读取）

### Fixed
- org.service.ts findAllStudents() 增加 batchDecrypt 解密 name/studentNo + 返回 className，修复学生管理列表姓名不显示
- interview.service.ts findOne() 增加 batchDecrypt，修复访谈详情学生姓名为空
- follow-up.service.ts findPending() 增加 batchDecrypt + StudentProfileService 增加 User→Student 映射，修复随访列表学生姓名为空
- audit_logs.action 字段加 `default: ''`，修复首次启动报错
- 前端 6 个页面的 studentName 列增加 render 降级（显示 encryptedName 前缀作为 fallback）
- Migration GrantPsychologistAdminAll 兼容中英文角色名，确保心理老师拥有管理员权限

## [0.35.0] - 2026-04-23
### Changed
- 删除「预警管理」一级菜单（Admin/Teacher Layout），按设计要求整合到访谈管理子菜单
- 删除独立「随访工作台」路由和菜单，功能由「访谈管理 > 随访管理」替代
- StudentProfile 未找到档案时返回按钮改为「返回随访管理」
- AlertList 删除「随访工作台」工具栏按钮

### Fixed
- FollowupManageService.getStudents 返回 studentId 改为 realStudentId（student entity ID），修复查看详情 404
- InterviewService.findAll 添加 user→student 映射后再 batchDecrypt，修复访谈列表学生姓名为空
- OCR 异步回调 Promise.resolve() 包装，防止 mock 环境下 undefined.catch 崩溃

## [0.34.2] - 2026-04-23
### Fixed
- 文件上传后异步 OCR 回调添加 .catch() 保护，防止文件被删除后 NotFoundException 导致进程崩溃

## [0.34.1] - 2026-04-23
### Fixed
- PDF 报告导出 500 错误：`import * as PDFDocument` 编译后 `__importStar` 包装为非构造函数对象，改为默认导入
- export.controller.ts PDF 导出添加 try/catch 错误日志输出

## [0.34.0] - 2026-04-23
### Fixed
- audit_logs.action 列长度从 varchar(50) 扩展到 varchar(255)，修复含 UUID 的 URL 写入失败
- PUT /scales/:id 更新 scoringRules/scoreRanges 时先删除旧记录再创建新记录，修复 scaleId null 约束违反
- 139 端点黑盒测试全部通过（含答题提交流程）

## [0.33.0] - 2026-04-23
### Fixed
- PDF 导出：通过 User.studentId 解析学生信息，替代直接使用 TaskAnswer.studentId
- 前端 AdminLayout/TeacherLayout：添加数据看板和预警管理菜单入口
- 前端 SettingsPage：使用 hasRole('admin') 过滤管理员工具标签页
- 前端 MyResults：添加班级/年级 Select 下拉筛选入口
- 前端路由：注册 followup 工作台路由到 teacher+admin
- POST /scales/:id/validations：添加必填字段验证，500→400
- POST /results/report-templates：添加 name/schema 必填校验，500→400
- POST /admin/plugins/:name/enable：使用 NotFoundException 替代 Error，500→404

## [0.32.0] - 2026-04-22
### Added
- 数据库备份/恢复功能（BackupModule）：使用 pg 库替代 pg_dump，跨平台兼容
- desktop/backup.js：OTA 更新前自动数据库备份
- 系统设置页面 + 数据库备份管理 UI
- 管理员/心理老师布局合并，共享系统设置菜单

### Changed
- OTA 发布 v0.32.0，500 个文件，137.4 MB

## [0.31.0] - 2026-04-22
### Fixed
- AlertList、ScaleDetail 等前端 pre-existing TS 类型错误修复
- 测试全部通过：823 jest + 48 vitest

## [0.30.0] - 2026-04-22
### Added
- 量表库初始数据（SCL-90、SDS、SAS、MHT）写入 desktop seed
- pgcrypto 扩展 + student/teacher 角色权限写入 seed
- createStudent 端点增加姓名/学号加密

### Fixed
- 所有 raw SQL 列名改为 camelCase（适配 TypeORM synchronize 模式）
- result.service 中 userId vs studentEntityId 映射修正
- report-generator、intervention-analysis 的 SQL 列名修正

## [0.29.0] - 2026-04-21
### Fixed
- encryption.service.ts：处理 NULL encryptedName/encryptedStudentNumber
- result.service.ts：修复 userId 与 studentEntityId 不匹配问题（task_answers.studentId 存的是 userId）
- result.controller.ts：同时传递 userId 和 studentEntityId
- student-login.service.ts：兼容 'student' 和 '学生' 角色名
- desktop seed：补充 task:submit 权限、student/teacher 角色权限、pgcrypto 扩展

## [0.28.0] - 2026-04-21
### Added
- 学生创建时自动生成登录账号（StudentLoginService 监听 on:student.imported hook）
- 自动创建 User（stu_<id8> / Test1234）并绑定学生角色

### Fixed
- Seed 验证数据完整性（roles>=4, users>=2, perms>=20），失败最多重试 3 次
- Seed 错误日志写入 DATA_DIR/seed-error.log

## [0.27.0] - 2026-04-21
### Added
- 自定义量表维度命名功能：支持用户自定义量表维度名称（上限100个）
- 4维度黑盒测试脚本（焦虑/抑郁/躯体化/强迫，40学生×20题）
- 随访管理 followup:read/write/manage 权限
- 量表创建/更新时重名检查

### Fixed
- Bug1: 维度显示上限从10提高到100
- Bug2: 删除自定义量表增加任务引用检查，防止FK冲突
- Bug3: 测评结果页面补充学生姓名、班级、量表名称显示
- Bug4: 随访管理查询优化，改为SQL直接过滤风险学生（替代全表加载）
- 评分引擎：自定义量表使用维度总分匹配 ranges，不再强制除以题数取均分
- 随访/结果接口修复 userId→studentId 映射，正确解密加密学生信息
- 结果详情页 (ResultDetail) 数据展示修复

### Changed
- UX重构V2：随访管理模块、结果详情页、MyResults增强、菜单路由调整
- OTA 环境变量永久写入 ~/.bashrc (OTA_BASE_URL, OTA_REMOTE_HOST, OTA_REMOTE_PATH)
- 登录限流放宽至 1000次/分钟（单用户环境）

## [0.24.0] - TBD
### Added
- 预警处理历史记录：新增 alert_handling_records 表，每次处理/随访自动保存记录
- 点击学生名或"查看"按钮可查看预警详情 + 完整处理/随访记录时间线
- 后端新增端点：GET /alerts/:id、GET /alerts/:id/history、GET /alerts?studentId=

### Fixed
- 预警随访不再覆盖上一次处理记录（历史记录永久保留）

## [0.23.0] - TBD
### Added
- OTA 自动更新功能（增量更新 dist/ + public/）
- RSA-SHA256 签名验证
- 版本检查和差异下载
- 备份和回滚机制
- 独立更新检查脚本 (desktop/check-update.js)
- OTA 发布脚本 (scripts/publish-ota.js)
- 单元测试（ota-client + publish-ota）

### Changed
- build-desktop.sh 改为自动读取 package.json 版本号
- start-desktop.js 集成 OTA 更新检查（5步启动流程）
