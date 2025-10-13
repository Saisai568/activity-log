const core = require('@actions/core');
const github = require('@actions/github');
// 由於我們將 Mock 整個 utils/github，所以不需要 axios 和 fs/promises

// ✅ 1. 隔離 API 邏輯：Mock utils/github
// 確保 fetchAndFilterEvents 總是返回一個預期的活動字串
const mockFetchAndFilterEvents = jest.fn();
jest.mock('../../src/utils/github', () => ({
    fetchAndFilterEvents: mockFetchAndFilterEvents,
}));

// ✅ 2. 隔離文件操作：Mock utils/file
// 確保 updateReadme 是一個被監聽的 Mock 函式
const mockUpdateReadme = jest.fn();
jest.mock('../../src/utils/file', () => ({
    updateReadme: mockUpdateReadme.mockResolvedValue(),
}));

// Mock process.exit (解決未處理的 process.exit(1) 錯誤)
let exitSpy;
beforeAll(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`process.exit was called with code: ${code}`);
    });
});

afterAll(() => {
    exitSpy.mockRestore();
});

// 設定 Actions Input Mock (確保 config 模組能拿到有效值)
core.getInput.mockImplementation((name) => {
    switch (name) {
        case 'GITHUB_USERNAME': return 'mockuser';
        case 'GITHUB_TOKEN': return 'mocktoken';
        case 'EVENT_LIMIT': return '1'; 
        case 'OUTPUT_STYLE': return 'MARKDOWN';
        case 'IGNORE_EVENTS': return '[]';
        case 'HIDE_DETAILS_ON_PRIVATE_REPOS': return 'false';
        case 'README_PATH': return 'README.md';
        case 'COMMIT_MESSAGE': return 'Update README.md with latest activity';
        default: return '';
    }
});

// 在所有 Mock 設定完畢後，載入 Action 主程式
const run = require('../../src/index');

describe('Integration Test: GitHub Activity Log Action', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // 修正了 should fetch data and successfully update README content 測試
    test('should fetch data and successfully update README content', async () => {
        const mockActivity = "1. 📝 Committed to [mockuser/mock-repo]";

        // 設定 fetchAndFilterEvents 的預期回傳值
        mockFetchAndFilterEvents.mockResolvedValue(mockActivity); 

        // 運行 Action
        await run.main(); 

        // 驗證 fetchAndFilterEvents 被呼叫
        expect(mockFetchAndFilterEvents).toHaveBeenCalled();
        
        // 驗證 updateReadme 被呼叫，且帶有預期的活動字串和來自 config 的參數
        expect(mockUpdateReadme).toHaveBeenCalledWith(
            mockActivity,
            'README.md', // 從 core.getInput 來的預設值
            'Update README.md with latest activity' // 從 core.getInput 來的預設值
        );
        
        // 驗證 process.exit 沒有被呼叫
        expect(exitSpy).not.toHaveBeenCalled();
    });

    // 保持 should handle GitHub API errors 測試 (但現在它是測試 index.js 的 try/catch 區塊)
    test('should handle GitHub API errors', async () => {
        // 讓 fetchAndFilterEvents 拒絕承諾 (模擬 GitHub API 錯誤)
        const error = new Error('GitHub API Error: Rate Limit');
        mockFetchAndFilterEvents.mockRejectedValue(error);

        core.setFailed.mockClear();

        // 運行 Action，預期拋出錯誤 (因為 process.exit 被 spy 攔截)
        await expect(run.main()).rejects.toThrow('process.exit was called with code: 1');
        
        // 驗證 core.setFailed 被呼叫，且帶有錯誤訊息
        expect(core.setFailed).toHaveBeenCalledWith(
             expect.stringContaining(error.message)
        );
        // 驗證 process.exit 被呼叫
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
