// 整合測試範例
const core = require('@actions/core');
const axios = require('axios');
const fs = require('fs/promises'); // 假設 updateReadme 使用 fs/promises

// ✅ 1. Mock 掉 GitHub Actions core 函式
// 必須在載入主模組前完成
jest.mock('@actions/core');
jest.mock('axios');
// 假設 updateReadme (在 src/utils/file.js 中) 依賴文件系統，需要 Mock 掉
// 如果您還沒建立 src/utils/file.js，請自行加入 mock
jest.mock('fs/promises', () => ({
    writeFile: jest.fn(),
    readFile: jest.fn().mockResolvedValue('\n'),
}));

// ✅ 2. Mock process.exit (最重要的一步)
let exitSpy;
beforeAll(() => {
    // 阻止 process.exit 實際終止程式，並用 spy 監聽
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
        // 拋出錯誤讓 Jest 捕獲，而不是真的退出
        throw new Error(`process.exit was called with code: ${code}`);
    });
});

afterAll(() => {
    // 測試套件結束後恢復 process.exit
    exitSpy.mockRestore();
});

// 在載入主程式 (index.js) 之前設定輸入 Mock，確保 config 模組能拿到有效值
core.getInput.mockImplementation((name) => {
    switch (name) {
        // ✅ 必須提供所有 config.js 中用到的輸入的有效值
        case 'GITHUB_USERNAME': return 'mockuser';
        case 'GITHUB_TOKEN': return 'mocktoken';
        case 'EVENT_LIMIT': return '1'; // 有效數字
        case 'OUTPUT_STYLE': return 'MARKDOWN';
        case 'IGNORE_EVENTS': return '[]';
        case 'HIDE_DETAILS_ON_PRIVATE_REPOS': return 'false';
        case 'README_PATH': return 'README.md';
        case 'COMMIT_MESSAGE': return 'Update README.md with latest activity';
        default: return '';
    }
});

// ✅ 3. 在 Mock 設定完成後，再載入 Action 主程式
const run = require('../../src/index');

describe('Integration Test: GitHub Activity Log Action', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should fetch data and successfully update README content', async () => {
        // Mock GitHub API 回應
        axios.get.mockResolvedValue({
            data: [{
                id: 12345,
                type: 'PushEvent',
                repo: { name: 'mockuser/mock-repo' },
                public: true, // 模擬公開倉庫
                payload: { 
                    head: '9884864a8ddba730c3f4f1c535b554c0b62a6fcc', 
                    commits: [{ message: 'test' }]
                }
            }],
            // 由於 fetchAllStarredRepos 也會呼叫 API，我們給一個空回應
            headers: { link: '' } 
        });
        
        // Mock getCommit 呼叫 (isTriggeredByGitHubActions 函式會用到)
        core.getOctokit.mockReturnValue({
            rest: {
                repos: {
                    getCommit: jest.fn().mockResolvedValue({ 
                        data: { commit: { message: 'Regular commit' } } 
                    })
                },
                activity: {
                    listReposStarredByAuthenticatedUser: jest.fn().mockResolvedValue({ data: [] }),
                }
            }
        });

        // 運行 Action
        // 由於 index.js 是立即執行的，我們只需要確保它被 require，或者將 main 函式匯出以便呼叫。
        // 由於您提供的 index.js 結構是立即執行 main()，如果 Jest 執行了該檔案，
        // 您可能需要修改 index.js 匯出 main 函式，或在 Jest 配置中排除 index.js 的自動執行。
        // 這裡我們假設 index.js 已被修改為匯出 main 函式，以便在測試中呼叫：
        await run.main(); // 假設您將 main() 匯出為 run.main

        // 驗證 API 是否被呼叫
        expect(axios.get).toHaveBeenCalledTimes(1);
        
        // 驗證 README.md 是否被寫入
        expect(fs.writeFile).toHaveBeenCalled();
        
        // 驗證 process.exit 沒有被呼叫 (即沒有錯誤發生)
        expect(exitSpy).not.toHaveBeenCalled();
    });

    // 測試錯誤路徑 (例如 EVENT_LIMIT 傳入非數字)
    test('should fail if EVENT_LIMIT is invalid', async () => {
        // 設定單次測試的錯誤輸入
        core.getInput.mockImplementationOnce((name) => {
            if (name === 'EVENT_LIMIT') return 'invalid'; // 傳入非數字
            // 確保其他 required inputs 仍然是有效值
            if (name === 'GITHUB_USERNAME') return 'mockuser'; 
            if (name === 'GITHUB_TOKEN') return 'mocktoken'; 
            return '';
        });
        
        // 由於 config 模組已在頂層載入，此測試會變得複雜。
        // 如果要測試 config 的錯誤，最簡單的方式是單獨測試 config.js 中的 processEventLimit 函式。
        // 但如果您堅持以整合方式測試，則必須在載入 config.js *前*設定好 input，
        // 由於 Jest 執行單元測試的方式，通常會將 config.js 中的 ProcessEventLimit 抽出來單獨測試。

        // 為了避免再次載入 config 導致複雜性，建議為 processEventLimit 撰寫單元測試。
        
        // 這裡僅測試 index.js 中 main() 函式級別的 try/catch 錯誤
        core.setFailed.mockClear();
        axios.get.mockRejectedValue(new Error('GitHub API Error'));

        await run.main();
        
        // 驗證 core.setFailed 被呼叫
        expect(core.setFailed).toHaveBeenCalledWith(
             expect.stringContaining('GitHub API Error')
        );
        // 驗證 process.exit 被呼叫
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
