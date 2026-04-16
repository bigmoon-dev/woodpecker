# 功能清单

## 已实现

### 量表管理
- 量表 CRUD（名称、版本、描述、题目、选项）
- Excel (.xlsx) 批量导入量表模板
- 题目支持维度分组、反向计分标记
- 计分规则配置（求和/加权/维度三种策略）
- 分数区间定义（min-max → 等级 + 颜色 + 建议）
- 量表版本管理（copy-on-write 多版本、版本链 parentScaleId、publish/archive 状态）
- 量表信效度标注（ScaleValidation 实体：信度系数、效度类型、样本量、文献来源）

### 多轮测评追踪
- 同一学生多次测评结果对比（RetestComparison）
- 干预前后群体效果评估（InterventionAnalysisService：均值变化、改善率、等级转换）
- 趋势恶化自动预警（detectTrendAlerts）

### 报告生成
- 个人测评报告（PDF 导出）
- 班级/年级群体分析报告（GroupStatistics）
- 自定义报告模板（ReportTemplate + JSON schema）

### 自动计分引擎
- **求和策略** — 题目分数直接求和
- **加权策略** — 每题可配置不同权重
- **维度策略** — 按维度分组分别计分
- 反向题自动处理
- 分数→等级/颜色/建议自动匹配
- 量表缓存加速重复计算
- 单元测试覆盖率 >95%

### 测评任务
- 创建测评任务（关联量表 + 目标班级 + 截止时间）
- 任务状态管理（草稿 → 已发布）
- 学生在线答题
- 提交后自动计分并保存结果
- 结果为红/黄色时自动触发预警

### 分级预警
- 自动触发预警（红色/黄色）
- 预警处理（pending → handled + 处理备注）
- 随访记录（追加随访备注）
- 通知列表（待读/已读标记）
- 按权限范围查看预警

### 认证授权
- JWT 登录（accessToken + refreshToken）
- 基于角色的访问控制（RBAC）
- 权限变更实时生效（从数据库加载，不依赖 JWT 缓存）
- 数据范围过滤（自己 / 班级 / 年级 / 全校）
- 公开接口装饰器（@Public）

### 知情同意
- 学生签署知情同意书记录
- ConsentGuard 拦截未签署学生的答题/查看操作
- 支持多种同意类型（assessment 等）
- 知情同意过期机制（expiresAt 字段 + Guard 过期检查，区分未签署/已过期）

### 数据安全
- 学生 PII 加密存储
- 过期数据自动脱敏（每 24 小时定时任务，SHA-256 哈希）
- 可配置数据保留天数（DATA_RETENTION_DAYS）
- 全局操作审计日志（HMAC-SHA256 完整性签名，防篡改验证，链式校验）
- Refresh Token 时序安全比较（crypto.timingSafeEqual，防时序攻击）

### 测试与质量
- 自动计分引擎单元测试覆盖率 >95%
- AuditIntegrityService 分支覆盖率 100%（computeHash/verify/verifyChain 全路径）
- 全局 Statements 89.85%、Lines 90.96%
- Audit 模块 Branch 覆盖率 91.86%

### 插件系统
- 插件生命周期（安装/启用/禁用/卸载）
- HookBus 事件总线（on:user.login 等）
- 插件路由元数据注册
- 内置插件：Excel 导入、报告导出

### 前端（React）
- 三套布局（学生/教师/管理员）
- 量表列表与详情页
- 任务创建与列表
- 在线答题页
- 结果查看（我的结果/班级/年级）
- 预警列表与处理
- 知情同意签署页
- 组织架构管理页
- 角色/用户/插件管理页

---

## 规划中

### 数据看板
- ~~学校/年级/班级维度的心理健康概览统计~~（v0.4.0 已实现）
- ~~预警趋势图表（按月/学期）~~（v0.10.0 已实现）
- ~~高风险学生分布热力图~~（v0.10.0 已实现：年级×班级红/黄预警密度聚合）

### 量表库
- ~~内置常用量表模板（SCL-90、PHQ-9、GAD-7、MHT 等）~~（v0.4.0 已实现：SCL-90、SDS、SAS、MHT）
- ~~量表版本管理与升级迁移~~（v0.11.0 已实现：copy-on-write多版本、parentScaleId版本链、publish/createVersion/archive、版本历史查询）
- ~~量表信效度标注~~（v0.11.0 已实现：ScaleValidation实体、信度系数+效度类型+样本量+文献来源、CRUD+聚合摘要API）

### 多轮测评追踪
- ~~同一学生多次测评结果对比~~（v0.6.0 已实现 RetestComparison）
- ~~干预前后效果评估~~（v0.12.0 已实现 InterventionAnalysisService 群体对比+改善率+等级转换）
- ~~趋势变化预警~~（v0.12.0 已实现 detectTrendAlerts 自动扫描green→yellow/red恶化+AlertRecord）

### 报告生成
- ~~个人测评报告（PDF 导出）~~（v0.5.0 已实现）
- ~~班级/年级群体分析报告~~（v0.12.0 已实现 getGroupStatistics+generateGroupReport）
- ~~自定义报告模板~~（v0.12.0 已实现 ReportTemplate实体+CRUD+内置种子模板）

### 消息通知
- ~~预警触发时通知班主任/心理教师~~（v0.1.0 已实现 AlertNotification + 角色过滤）
- 待处理预警提醒
- 任务到期提醒
- 站内信 + 邮件/短信渠道（可配置）

### 移动端适配
- 响应式布局优化
- 微信小程序端（答题 + 查看结果）

### 数据导入导出
- ~~学生名单批量导入（Excel）~~（v0.3.0 已实现）
- ~~测评结果批量导出（Excel/CSV）~~（v0.4.0 已实现）
- 组织架构批量导入

### 系统运维
- ~~Docker 镜像 + docker-compose 一键部署~~（v0.2.0 已实现）
- ~~数据库备份与恢复策略~~（v0.9.0 已实现：backup sidecar + WAL archiving + restore/verify/drill 脚本）
- ~~运行时配置热更新（无需重启）~~（v0.9.0 已实现：SystemConfig DB 表 + ConfigReloadService + Admin API）
- ~~健康检查端点（/health）~~（v0.5.0 已实现）

### 安全增强
- 登录失败次数限制 + 账号锁定
- 操作敏感接口二次认证
- ~~数据库字段级加密（替代当前 bytea 方案）~~（v0.1.0 已实现 bytea + pgcrypto 加密）
- API 访问频率限制
- ~~审计日志完整性校验（HMAC）~~（v0.7.0 已实现）
- ~~Token 时序攻击防护~~（v0.7.0 已实现）
- ~~知情同意过期强制重签~~（v0.7.0 已实现）

### 集成扩展
- 家长端（查看孩子预警通知）
- 与学校现有教务系统对接（同步组织架构）
- SSO 单点登录支持（CAS/OAuth2）
- Webhook 回调（外部系统订阅预警事件）
