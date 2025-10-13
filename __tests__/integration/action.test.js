const core = require('@actions/core');
const github = require('@actions/github'); // ✅ 必須引入 github 模組
// 這裡省略 axios 的引入，因為 src/utils/github.js 中僅使用 Octokit 進行 API 呼叫
const fs = require('fs/promises'); 

// Mock 掉所有需要的模組
jest.mock('@actions/core');
jest.mock('@actions/github'); // ✅ Mock 掉 @actions/github
// 假設 updateReadme 在 utils/file.js 中使用 fs/promises
jest.mock('fs/promises', () => ({
    writeFile: jest.fn(),
    // 模擬 README 內容包含開始/結束標記
    readFile: jest.fn().mockResolvedValue('\n'),
}));

// Mock process.exit (解決未處理的 process.exit(1) 錯誤)
let exitSpy;
beforeAll(() => {
    // 阻止 process.exit 實際終止程式
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`process.exit was called with code: ${code}`);
    });
});

afterAll(() => {
    // 測試套件結束後恢復 process.exit
    exitSpy.mockRestore();
});

// 定義 Mock 的 Octokit 客戶端，包含所有被呼叫的方法
const mockOctokit = {
    rest: {
        activity: {
            // 解決 fetchAllStarredRepos 呼叫 (模擬無 Star Repo)
            listReposStarredByAuthenticatedUser: jest.fn().mockResolvedValue({ data: [] }),
            // 解決 fetchEvents 呼叫 (模擬事件列表)
            listEventsForAuthenticatedUser: jest.fn(),
        },
        repos: {
            // 解決 isTriggeredByGitHubActions 呼叫 (模擬常規 Commit)
            getCommit: jest.fn().mockResolvedValue({ 
                data: { commit: { message: 'Regular commit' }, author: { login: 'regularuser' } } 
            }),
        }
    }
};

// ✅ 修正 Error 1: 確保 mock 發生在正確的模組上
github.getOctokit.mockReturnValue(mockOctokit);

// 設定 Actions Input Mock (在載入 src/index.js 前必須完成)
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
        // 重設 Octokit 內部方法的 Mock
        mockOctokit.rest.activity.listEventsForAuthenticatedUser.mockClear();
    });

    test('should fetch data and successfully update README content', async () => {
        const mockEvents = [
            {
                id: 12345,
                type: 'PushEvent',
                repo: { name: 'mockuser/mock-repo' },
                public: true, 
                payload: { head: '9884864a8ddba730c3f4f1c535b554c0b62a6fcc', commits: [{ message: 'test' }] },
            },
        ];

        // 設定事件列表 API 的回應
        mockOctokit.rest.activity.listEventsForAuthenticatedUser
            .mockResolvedValueOnce({ data: mockEvents })
            .mockResolvedValue({ data: [] }); 

        // 運行 Action
        await run.main(); 

        // 驗證 API 是否被呼叫
        expect(mockOctokit.rest.activity.listEventsForAuthenticatedUser).toHaveBeenCalledTimes(1);
        
        // 驗證 README.md 是否被寫入
        expect(fs.writeFile).toHaveBeenCalled();
        
        // 驗證 process.exit 沒有被呼叫
        expect(exitSpy).not.toHaveBeenCalled();
    });

    // 測試錯誤路徑
    test('should handle GitHub API errors', async () => {
        // 設定事件列表 API 失敗
        mockOctokit.rest.activity.listEventsForAuthenticatedUser
            .mockRejectedValue(new Error('GitHub API Error: Rate Limit'));

        core.setFailed.mockClear();

        // 運行 Action，預期拋出錯誤 (因為 process.exit 被 spy 攔截)
        // 這裡我們預期 main() 內部會呼叫 process.exit(1)，所以我們捕獲這個錯誤
        await expect(run.main()).rejects.toThrow('process.exit was called with code: 1');
        
        // 驗證 core.setFailed 被呼叫
        expect(core.setFailed).toHaveBeenCalledWith(
             expect.stringContaining('GitHub API Error: Rate Limit')
        );
        // 驗證 process.exit 被呼叫
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
