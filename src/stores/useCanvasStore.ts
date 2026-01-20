import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// 탭 하나(워크스페이스)의 데이터 구조
export interface CanvasTab {
    id: string;
    title: string;
    nodes: any[];
    links: any[];
    // 병합된 맵들을 구분하기 위한 그룹 정보 (테두리/색상용)
    groups: { id: string; name: string; color: string }[];
    notes: string;      // 탭별 메모장
    clipboard: string[]; // 탭별 클립보드 (주소 등)
    createdAt: number;
}

interface CanvasState {
    tabs: CanvasTab[];
    activeTabId: string | null;

    // Actions
    addTab: (title?: string) => void;
    removeTab: (id: string) => void;
    setActiveTab: (id: string) => void;

    // 데이터 조작
    updateActiveTabData: (data: Partial<CanvasTab>) => void;
    addNodesToActiveTab: (newNodes: any[], newLinks: any[]) => void;

    // [핵심] 세션 불러오기 (새 탭 vs 병합)
    importSession: (sessionData: any, mode: 'new_tab' | 'merge') => void;
}

export const useCanvasStore = create<CanvasState>()(
    persist(
        (set, get) => ({
            tabs: [],
            activeTabId: null,

            // 1. 탭 추가
            addTab: (title = 'New Investigation') => {
                const newTab: CanvasTab = {
                    id: crypto.randomUUID(),
                    title,
                    nodes: [],
                    links: [],
                    groups: [{ id: 'default', name: 'Base Layer', color: '#94a3b8' }],
                    notes: '',
                    clipboard: [],
                    createdAt: Date.now(),
                };
                set((state) => ({
                    tabs: [...state.tabs, newTab],
                    activeTabId: newTab.id
                }));
            },

            // 2. 탭 닫기
            removeTab: (id) => set((state) => {
                const newTabs = state.tabs.filter((t) => t.id !== id);
                // 닫은 탭이 활성 탭이었다면, 마지막 탭을 활성화
                const newActiveId = id === state.activeTabId
                    ? (newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null)
                    : state.activeTabId;
                return { tabs: newTabs, activeTabId: newActiveId };
            }),

            // 3. 탭 전환
            setActiveTab: (id) => set({ activeTabId: id }),

            // 4. 현재 탭 데이터 업데이트 (메모, 제목 등)
            updateActiveTabData: (data) => set((state) => ({
                tabs: state.tabs.map((tab) =>
                    tab.id === state.activeTabId ? { ...tab, ...data } : tab
                )
            })),

            // 5. 노드/링크 추가 (검색이나 확장을 통해)
            addNodesToActiveTab: (newNodes, newLinks) => set((state) => {
                const activeTab = state.tabs.find(t => t.id === state.activeTabId);
                if (!activeTab) return state;

                // 중복 방지 (기존에 없는 노드만 추가)
                const existingIds = new Set(activeTab.nodes.map(n => n.id));
                const filteredNodes = newNodes.filter(n => !existingIds.has(n.id));

                // 링크 중복 방지 로직 (간소화)
                const combinedLinks = [...activeTab.links, ...newLinks];

                return {
                    tabs: state.tabs.map(t => t.id === state.activeTabId ? {
                        ...t,
                        nodes: [...t.nodes, ...filteredNodes],
                        links: combinedLinks
                    } : t)
                };
            }),

            // 6. [핵심] 세션 불러오기 & 병합 로직
            importSession: (sessionData, mode) => {
                const state = get();

                // (A) 새 탭으로 열기
                if (mode === 'new_tab' || state.tabs.length === 0) {
                    const newTab: CanvasTab = {
                        id: crypto.randomUUID(),
                        title: sessionData.title || `Imported: ${new Date().toLocaleTimeString()}`,
                        nodes: sessionData.nodes,
                        links: sessionData.links,
                        // 그룹 ID 부여 (시각적 구분용)
                        groups: [{
                            id: sessionData.id || 'imported_1',
                            name: sessionData.title || 'Imported Map',
                            color: '#3b82f6' // Blue
                        }],
                        notes: sessionData.notes || '',
                        clipboard: [],
                        createdAt: Date.now(),
                    };
                    set((s) => ({ tabs: [...s.tabs, newTab], activeTabId: newTab.id }));
                }
                // (B) 현재 탭에 병합 (Merge)
                else {
                    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
                    if (!activeTab) return;

                    // 1. 노드 병합 (ID가 같으면 하나로 합쳐짐 = 자연스러운 연결)
                    const existingNodeIds = new Set(activeTab.nodes.map(n => n.id));

                    // 새 그룹 정보 생성 (랜덤 컬러)
                    const newGroupId = sessionData.id || crypto.randomUUID();
                    const newGroupColor = `#${Math.floor(Math.random() * 16777215).toString(16)}`;

                    const newNodes = sessionData.nodes.filter((n: any) => !existingNodeIds.has(n.id))
                        .map((n: any) => ({ ...n, groupId: newGroupId })); // 그룹 태깅

                    // 2. 링크 병합
                    const newLinks = [...activeTab.links, ...sessionData.links];

                    set((s) => ({
                        tabs: s.tabs.map(t => t.id === s.activeTabId ? {
                            ...t,
                            nodes: [...t.nodes, ...newNodes],
                            links: newLinks,
                            // 그룹 리스트에 추가 (범례 표시용)
                            groups: [...t.groups, {
                                id: newGroupId,
                                name: sessionData.title || 'Merged Map',
                                color: newGroupColor
                            }]
                        } : t)
                    }));
                }
            }
        }),
        { name: 'transight-canvas-storage', storage: createJSONStorage(() => localStorage) }
    )
);