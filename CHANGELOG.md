# Changelog

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
