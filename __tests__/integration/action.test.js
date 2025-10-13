// 整合測試範例
const core = require('@actions/core');
const axios = require('axios');
const path = require('path');
// 引入 Action 的主程式 (index.js)
const run = require('../../src/index'); 

// Mock 掉 GitHub Actions core 函式
jest.mock('@actions/core');
// Mock 掉 axios 以避免真實的網路請求
jest.mock('axios');

describe('Integration Test: GitHub Activity Log Action', () => {
    // 測試整個 Action 成功執行的流程
    test('should fetch data and successfully update README content', async () => {
        // 1. 設定 Mock 輸入值
        core.getInput.mockImplementation((name) => {
            switch (name) {
                case 'GITHUB_USERNAME': return 'mockuser';
                case 'GITHUB_TOKEN': return 'mocktoken';
                case 'EVENT_LIMIT': return '1';
                case 'README_PATH': return 'README.md'; // 確保路徑是可寫入的
                default: return '';
            }
        });
        
        // 2. Mock GitHub API 回應 (最關鍵的一步)
        axios.get.mockResolvedValue({
            data: [{
                id: 12345,
                type: 'PushEvent',
                created_at: '2025-01-01T10:00:00Z',
                repo: { name: 'mockuser/mock-repo' },
                payload: { commits: [{ message: 'Initial commit' }], ref: 'refs/heads/main' }
            }]
        });

        // 3. 運行 Action
        await run();

        // 4. 驗證結果
        // 驗證是否呼叫了 API 
        expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('https://api.github.com/users/mockuser/events/public'),
            expect.any(Object)
        );
        
        // 驗證是否輸出了正確的結果到 README (通常是 Mock 掉文件寫入的 util 函數)
        // 由於我們沒有看到文件寫入的 util 函數，這裡假設它會被呼叫
        // 這裡可以驗證 core.setOutput 或其他最終輸出
        expect(core.setOutput).toHaveBeenCalledWith(
            'activity_log',
            expect.stringContaining('Committed to [mockuser/mock-repo]')
        );

        // 驗證 Action 是否以成功狀態結束
        expect(core.setFailed).not.toHaveBeenCalled();
    });

    // ... 其他測試：例如測試 API 錯誤、無活動時的表現等
});
