# Changelog

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
