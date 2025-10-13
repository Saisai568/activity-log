// ✅ 1. 確保所有 Mock 函數都被明確定義為 Jest Mock Function
const mockGetInput = jest.fn();
const mockSetFailed = jest.fn();
const mockGetOctokit = jest.fn();

// ✅ 2. 使用 Mock Factory 替換 @actions/core 模組，並匯入我們定義的 Mock 函數
jest.mock('@actions/core', () => ({
    getInput: mockGetInput,
    setFailed: mockSetFailed,
    warning: jest.fn(), // 確保所有被呼叫的 core.xxx 都有定義
    // 其他 core 函數...
}));

// ✅ 3. Mock @actions/github
jest.mock('@actions/github', () => ({
    getOctokit: mockGetOctokit,
    context: { 
        payload: { pull_request: { number: 123 } }, // 模擬 PR 內容以避免某些錯誤
        repo: { owner: 'mock', repo: 'mock' }
    }
}));

// 隔離 API 邏輯：Mock utils/github
const mockFetchAndFilterEvents = jest.fn();
jest.mock('../../src/utils/github', () => ({
    fetchAndFilterEvents: mockFetchAndFilterEvents,
}));

// 隔離文件操作：Mock utils/file
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

// ✅ 4. 使用 mockGetInput.mockImplementation 設定輸入值
mockGetInput.mockImplementation((name) => {
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

// ... (以下測試邏輯不變)

describe('Integration Test: GitHub Activity Log Action', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should fetch data and successfully update README content', async () => {
        const mockActivity = "1. 📝 Committed to [mockuser/mock-repo]";

        mockFetchAndFilterEvents.mockResolvedValue(mockActivity); 

        await run.main(); 

        expect(mockFetchAndFilterEvents).toHaveBeenCalled();
        
        expect(mockUpdateReadme).toHaveBeenCalledWith(
            mockActivity,
            'README.md', 
            'Update README.md with latest activity'
        );
        
        expect(exitSpy).not.toHaveBeenCalled();
    });

    test('should handle GitHub API errors', async () => {
        const error = new Error('GitHub API Error: Rate Limit');
        mockFetchAndFilterEvents.mockRejectedValue(error);

        mockSetFailed.mockClear();

        await expect(run.main()).rejects.toThrow('process.exit was called with code: 1');
        
        expect(mockSetFailed).toHaveBeenCalledWith(
             expect.stringContaining(error.message)
        );
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
