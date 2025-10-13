const { fetchAndFilterEvents } = require('./utils/github');
const { updateReadme } = require('./utils/file');
const config = require('./config'); // 使用 config 模組，避免解構賦值
const core = require('@actions/core')

// Main function to execute the update process
async function main() {
    try {
        const activity = await fetchAndFilterEvents();
        // 確保 updateReadme 收到 config 中的路徑和訊息
        await updateReadme(activity, config.readmePath, config.commitMessage);
    } catch (error) {
        core.setFailed(`❌ Error in the update process: ${error.message}`);
        console.error(error)
        process.exit(1);
    }
}

// 關鍵修改：只有當檔案作為主程式執行時才呼叫 main()
if (require.main === module) {
    main();
}

// 匯出 main 函式，供測試使用
module.exports.main = main;
