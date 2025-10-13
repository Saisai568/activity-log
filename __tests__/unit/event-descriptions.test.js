// ✅ 修正匯入方式：匯入整個物件
const eventDescriptions = require('../../src/utils/eventDescriptions');

describe('Unit Test: eventDescriptions (Basic Events)', () => {
    // 測試 PushEvent 公開倉庫
    test('should correctly describe a public PushEvent', () => {
        // PushEvent 函式需要 { repo, isPrivate, payload } 作為參數
        const input = {
            repo: { name: 'user/repo-name' },
            isPrivate: false,
            payload: { 
                head: '9884864a8ddba730c3f4f1c535b554c0b62a6fcc' 
            }
        };
        
        // ✅ 直接呼叫 eventDescriptions 物件中的 PushEvent 函式
        const result = eventDescriptions['PushEvent'](input);
        
        expect(result).toContain('📝 Committed to');
        expect(result).toContain('[user/repo-name](');
        expect(result).toContain('/commit/9884864a8ddba730c3f4f1c535b554c0b62a6fcc)');
    });

    // 測試 CreateEvent (repository) 公開倉庫
    test('should correctly describe a public CreateEvent (repository)', () => {
        const input = {
            repo: { name: 'user/new-repo' },
            isPrivate: false,
            payload: { ref_type: 'repository' }
        };
        
        // ✅ 直接呼叫 eventDescriptions 物件中的 CreateEvent 函式
        const result = eventDescriptions['CreateEvent'](input);
        
        expect(result).toContain('🎉 Created a new repository');
        expect(result).toContain('[user/new-repo]');
    });
    
    // 測試 IssuesEvent (closed) 公開倉庫
    test('should correctly describe a public IssuesEvent (closed)', () => {
        const input = {
            repo: { name: 'user/project-repo' },
            isPrivate: false,
            payload: {
                action: 'closed',
                issue: { number: 42 }
            }
        };
        
        // ✅ 呼叫 IssuesEvent 物件中巢狀的 'closed' 函式
        const result = eventDescriptions['IssuesEvent']['closed'](input);
        
        expect(result).toContain('❌ Closed an issue');
        expect(result).toContain('[#42](');
        expect(result).toContain('[user/project-repo]');
    });
    
    // 測試 PushEvent 私有倉庫 (隱藏細節)
    test('should correctly describe a private PushEvent', () => {
        const input = {
            repo: { name: 'user/private-repo' },
            isPrivate: true, // 私有
            payload: { head: '9884864a8ddba730c3f4f1c535b554c0b62a6fcc' }
        };
        
        const result = eventDescriptions['PushEvent'](input);
        
        expect(result).toBe('📝 Committed to a private repo');
    });
});
