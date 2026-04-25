const readline = require('readline');
const ota = require('./ota-client');

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const force = args.includes('--force');

  const currentVersion = ota.getCurrentVersion();
  console.log(`当前版本: ${currentVersion || '未知'}`);

  console.log('检查更新...');
  const updateInfo = await ota.checkForUpdate();

  if (!updateInfo) {
    console.log('当前已是最新版本');
    return;
  }

  if (updateInfo.needsFullUpdate) {
    console.log(`发现新版本 ${updateInfo.version}，但当前版本过低，需要下载全量安装包`);
    console.log(`请访问项目主页下载最新版本`);
    return;
  }

  const sizeInfo = updateInfo.size?.common ? ` (${formatBytes(updateInfo.size.common)})` : '';
  console.log('');
  console.log(`📦 发现新版本: ${updateInfo.version}${sizeInfo}`);
  if (updateInfo.notes) {
    console.log(`   更新说明: ${updateInfo.notes}`);
  }
  console.log('');

  if (checkOnly) return;

  if (!force) {
    const answer = await askQuestion('是否更新? [Y/n] ');
    if (answer && answer.toLowerCase() !== 'y') {
      console.log('已取消更新');
      return;
    }
  }

  try {
    console.log('获取更新清单...');
    const manifestUrl = `${ota._config.baseUrl}/${updateInfo.version}/manifest.json`;
    const { manifest, diff } = await ota.getUpdateFiles(manifestUrl);

    if (diff.length === 0) {
      console.log('所有文件已是最新，无需更新');
      ota.setCurrentVersion(updateInfo.version);
      return;
    }

    const diffSize = diff.reduce((s, f) => s + f.size, 0);
    console.log(`需要更新 ${diff.length} 个文件 (${formatBytes(diffSize)})`);

    console.log('备份当前版本...');
    const oldVersion = ota.getCurrentVersion() || 'unknown';
    ota.backupCurrent(diff);

    console.log('下载更新文件...');
    const buffers = await ota.downloadFiles(updateInfo.version, diff, (downloaded, total) => {
      const pct = total > 0 ? Math.round((downloaded / total) * 100) : 0;
      const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
      process.stdout.write(`\r  [${bar}] ${pct}% (${formatBytes(downloaded)}/${formatBytes(total)})`);
    });
    console.log('');

    console.log('应用更新...');
    ota.applyUpdate(buffers);
    ota.setPendingVersion(updateInfo.version);

    console.log('');
    console.log(`✅ 已更新到 v${updateInfo.version}，请重启应用以完成更新`);
  } catch (err) {
    console.error('');
    console.error(`❌ 更新失败: ${err.message}`);
    console.error('尝试回滚...');
    try {
      const oldVersion = ota.getCurrentVersion() || 'unknown';
      ota.rollback(oldVersion);
      console.error('已回滚到更新前的状态');
    } catch (rollbackErr) {
      console.error(`回滚失败: ${rollbackErr.message}`);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('错误:', err.message);
    process.exit(1);
  });
}
