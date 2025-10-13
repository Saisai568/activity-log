// 假設您在 src/utils/eventDescriptions.js 中有一個 describeEvent 函數

const { describeEvent } = require('../../src/utils/eventDescriptions');

describe('Unit Test: describeEvent', () => {
    // 測試 PushEvent 
    test('should correctly describe a PushEvent', () => {
        const event = {
            type: 'PushEvent',
            repo: { name: 'user/repo-name' },
            payload: { commits: [{ message: 'feat: new feature' }], ref: 'refs/heads/main' }
        };
        const result = describeEvent(event);
        // 預期的輸出會是 '📝 Committed to [user/repo-name](commit link)' 
        // 這裡我們只檢查輸出是否為字串且包含關鍵字
        expect(result).toContain('Committed to');
        expect(result).toContain('user/repo-name');
    });

    // 測試 CreateEvent
    test('should correctly describe a CreateEvent (repository)', () => {
        const event = {
            type: 'CreateEvent',
            repo: { name: 'user/new-repo' },
            payload: { ref_type: 'repository' }
        };
        const result = describeEvent(event);
        expect(result).toContain('Created a new repository');
        expect(result).toContain('user/new-repo');
    });
    
    // ... 其他事件類型測試
});
