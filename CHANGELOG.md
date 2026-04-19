# Changelog

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
