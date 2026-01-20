import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// [NEW] 병합 기록을 위한 인터페이스
export interface ImportRecord {
    id: string;
    title: string;
    nodeCount: number;
    timestamp: number;
}

export interface CanvasTab {
    id: string;
    title: string;
    nodes: any[];
    links: any[];
    groups: any[];
    notes: string;
    clipboard: string[];
    importHistory: ImportRecord[]; // [NEW] 병합 이력 배열 추가
    createdAt: number;
}

interface CanvasState {
    tabs: CanvasTab[];
    activeTabId: string | null;
    addTab: (title?: string) => void;
    removeTab: (id: string) => void;
    setActiveTab: (id: string) => void;
    updateActiveTabData: (data: Partial<CanvasTab>) => void;
    addNodesToActiveTab: (nodes: any[], links: any[]) => void;
    importSession: (sessionData: any, mode: 'new_tab' | 'merge') => void;
}

export const useCanvasStore = create<CanvasState>()(
    persist(
        (set, get) => ({
            tabs: [],
            activeTabId: null,

            addTab: (title = 'Untitled Project') => {
                const newTab: CanvasTab = {
                    id: crypto.randomUUID(),
                    title,
                    nodes: [],
                    links: [],
                    groups: [],
                    notes: '',
                    clipboard: [],
                    importHistory: [], // 초기화
                    createdAt: Date.now(),
                };
                set((state) => ({
                    tabs: [...state.tabs, newTab],
                    activeTabId: newTab.id
                }));
            },

            removeTab: (id) => {
                set((state) => {
                    const newTabs = state.tabs.filter(t => t.id !== id);
                    let newActiveId = state.activeTabId;
                    if (id === state.activeTabId) {
                        newActiveId = newTabs.length > 0 ? newTabs[0].id : null;
                    }
                    return { tabs: newTabs, activeTabId: newActiveId };
                });
            },

            setActiveTab: (id) => set({ activeTabId: id }),

            updateActiveTabData: (data) => {
                set((state) => ({
                    tabs: state.tabs.map(t => t.id === state.activeTabId ? { ...t, ...data } : t)
                }));
            },

            addNodesToActiveTab: (newNodes, newLinks) => {
                const state = get();
                const activeTab = state.tabs.find(t => t.id === state.activeTabId);
                if (!activeTab) return;

                const existingNodeIds = new Set(activeTab.nodes.map(n => n.id));
                const uniqueNodes = newNodes.filter(n => !existingNodeIds.has(n.id));

                // 링크 중복 제거 (간단 버전)
                const existingLinkKeys = new Set(activeTab.links.map(l => `${l.source}-${l.target}`));
                const uniqueLinks = newLinks.filter(l => !existingLinkKeys.has(`${l.source}-${l.target}`));

                set((s) => ({
                    tabs: s.tabs.map(t => t.id === s.activeTabId ? {
                        ...t,
                        nodes: [...t.nodes, ...uniqueNodes],
                        links: [...t.links, ...uniqueLinks]
                    } : t)
                }));
            },

            importSession: (sessionData, mode) => {
                const state = get();
                const importGroupId = sessionData.id || crypto.randomUUID();
                const importGroupName = sessionData.title || 'Imported Map';
                const importGroupColor = `#${Math.floor(Math.random() * 16777215).toString(16)}`;

                const processedNodes = (sessionData.nodes || []).map((node: any) => ({
                    ...node,
                    groupId: node.groupId || importGroupId
                }));

                const processedLinks = (sessionData.links || []).map((link: any) => ({
                    ...link,
                    source: typeof link.source === 'object' ? link.source.id : link.source,
                    target: typeof link.target === 'object' ? link.target.id : link.target
                }));

                // [NEW] 병합 기록 생성
                const importRecord: ImportRecord = {
                    id: sessionData.id || crypto.randomUUID(),
                    title: sessionData.title || 'Unknown Source',
                    nodeCount: processedNodes.length,
                    timestamp: Date.now()
                };

                if (mode === 'new_tab' || state.tabs.length === 0) {
                    const newTab: CanvasTab = {
                        id: crypto.randomUUID(),
                        title: sessionData.title || `Project ${new Date().toLocaleTimeString()}`,
                        nodes: processedNodes,
                        links: processedLinks,
                        groups: [{ id: importGroupId, name: importGroupName, color: '#3b82f6' }],
                        notes: sessionData.notes || '',
                        clipboard: [],
                        importHistory: [importRecord], // 최초 기록
                        createdAt: Date.now(),
                    };
                    set((s) => ({ tabs: [...s.tabs, newTab], activeTabId: newTab.id }));
                }
                else {
                    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
                    if (!activeTab) return;

                    const existingNodeIds = new Set(activeTab.nodes.map(n => n.id));
                    const newUniqueNodes = processedNodes.filter((n: any) => !existingNodeIds.has(n.id));
                    const newLinks = [...activeTab.links, ...processedLinks];

                    // 실제 추가된 노드 수로 기록 업데이트
                    importRecord.nodeCount = newUniqueNodes.length;

                    set((s) => ({
                        tabs: s.tabs.map(t => t.id === s.activeTabId ? {
                            ...t,
                            nodes: [...t.nodes, ...newUniqueNodes],
                            links: newLinks,
                            groups: t.groups.some(g => g.id === importGroupId)
                                ? t.groups
                                : [...t.groups, { id: importGroupId, name: importGroupName, color: importGroupColor }],
                            // [NEW] 기존 히스토리에 추가
                            importHistory: [...(t.importHistory || []), importRecord],
                            // [Fix] 제목이 기본값(Untitled Project)이거나 비어있으면 불러온 파일명으로 변경
                            title: (t.title === 'Untitled Project' || t.title === 'New Investigation' || t.nodes.length === 0)
                                ? (sessionData.title || t.title)
                                : t.title
                        } : t)
                    }));
                }
            }
        }),
        { name: 'transight-canvas-storage', storage: createJSONStorage(() => localStorage) }
    )
);