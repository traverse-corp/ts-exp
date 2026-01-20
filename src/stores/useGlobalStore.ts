import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import type { GraphNode, GraphLink } from '../types/graph';
import { fetchNodeExpansion } from '../services/tronScanner';

// Node & Cluster Types
export interface ExtendedNode extends GraphNode {
    createdAt: number;
    clusterId?: string;
    memo?: string;
    customColor?: string;
    isStart?: boolean;
    isTerminal?: boolean;
    x?: number; y?: number; fx?: number; fy?: number; vx?: number; vy?: number;
}

export interface Cluster {
    id: string;
    name: string;
    color: string;
    nodeIds: string[];
}

// App Mode Type
export type AppMode = 'bigbrother' | 'autotracer' | 'dashboard' | 'canvas';

// Global State Interface
interface GlobalState {
    // Graph Data
    graphData: { nodes: ExtendedNode[], links: GraphLink[] };
    clusters: Cluster[];

    // [NEW] 대시보드 데이터 영구 저장 (탭 이동해도 유지됨)
    dashboardTxs: any[];
    dashboardLastUpdated: Date | null;
    setDashboardData: (txs: any[], time: Date) => void;

    // Selection & UI
    selectedNode: ExtendedNode | null;
    selectedLink: GraphLink | null;
    selectedIds: Set<string>;
    pendingClusterNodes: string[];
    expandingNodes: Set<string>; // Loading Ring

    // Settings
    language: 'ko' | 'en';
    layoutMode: 'physics' | 'horizontal';
    isPhysicsActive: boolean;

    // Auth
    session: any | null;

    // [수정] 운영 지갑 관련 Actions
    opWallets: string[];

    // [NEW] Report Generator State
    isReportOpen: boolean;
    reportTargetTx: any | null; // 보고 대상 트랜잭션

    // [NEW] 모니터링 모드 (Standard vs Extended)
    monitorMode: 'standard' | 'extended';
    setMonitorMode: (mode: 'standard' | 'extended') => void;

    openReport: (tx: any) => void;
    closeReport: () => void;

    // [New] DB에서 불러오기
    fetchOpWallets: () => Promise<void>;

    // [Modified] DB에 저장/삭제 (비동기)
    addOpWallet: (address: string) => Promise<void>;
    removeOpWallet: (address: string) => Promise<void>;

    // [NEW] App Modes & Inputs (Moved from App.tsx local state)
    mode: AppMode;
    isMonitoring: boolean; // BigBrother Active State

    // BigBrother Inputs
    inputAddr: string;

    // AutoTracer Inputs
    traceAddr: string;
    hopCount: number;
    txLimit: number;
    traceMode: 'relation' | 'timeflow';
    startTime: string;

    // External Hooks Data (Placeholder for sharing if needed, but usually kept in hooks)
    bb: any; // BigBrother Hook State (managed in App.tsx via useAutoTrace, stored here if needed to share)
    at: any; // AutoTracer Hook State
    riskNodes: ExtendedNode[]; // Computed Risk Nodes

    // --- Actions ---
    setLanguage: (lang: 'ko' | 'en') => void;
    setSession: (session: any) => void;
    signOut: () => Promise<void>;

    setMode: (mode: AppMode) => void;
    setIsMonitoring: (isActive: boolean) => void;

    setInputAddr: (addr: string) => void;
    setTraceAddr: (addr: string) => void;
    setHopCount: (n: number) => void;
    setTxLimit: (n: number) => void;
    setTraceMode: (m: 'relation' | 'timeflow') => void;
    setStartTime: (time: string) => void;

    // Hooks Data Setters (Used by App.tsx to share state with panels)
    setHooksState: (data: { bb?: any, at?: any, riskNodes?: ExtendedNode[] }) => void;

    // Graph Actions
    setGraphData: (data: { nodes: ExtendedNode[], links: GraphLink[] }) => void;
    setSelectedNode: (node: ExtendedNode | null) => void;
    setSelectedLink: (link: GraphLink | null) => void;

    addNodes: (nodes: ExtendedNode[]) => void;
    addLinks: (links: any[]) => void;
    removeNode: (nodeId: string) => void;
    updateNode: (nodeId: string, updates: Partial<ExtendedNode>) => void;

    addCluster: (name: string, color: string, nodeIds: string[]) => void;
    removeCluster: (clusterId: string) => void;
    updateCluster: (clusterId: string, name: string, color: string, nodeIds: string[]) => void;

    setLayoutMode: (mode: 'physics' | 'horizontal') => void;
    setIsPhysicsActive: (isActive: boolean) => void;

    toggleSelectNode: (nodeId: string, multi?: boolean) => void;
    selectNodesByIds: (ids: string[]) => void;
    clearSelection: () => void;

    setPendingClusterNodes: (ids: string[]) => void;
    clearPendingClusterNodes: () => void;

    saveSession: (title: string, mode: string) => Promise<boolean>;
    loadSession: (sessionId: string) => Promise<void>;

    expandNode: (nodeId: string, direction: 'in' | 'out', sortType: 'time' | 'value') => Promise<void>;
}

// Helpers
const sanitizeLinks = (links: any[]) => {
    return links.map((link: any) => ({
        ...link,
        source: (link.source && typeof link.source === 'object') ? link.source.id : link.source,
        target: (link.target && typeof link.target === 'object') ? link.target.id : link.target
    }));
};

const applyHotWalletLogic = (nodes: ExtendedNode[], links: any[]): ExtendedNode[] => {
    const hotWalletMap = new Map<string, string>();
    nodes.forEach(node => {
        if (!node.label) return;
        const normalizedLabel = node.label.toLowerCase().replace(/\s/g, '');
        if (normalizedLabel.includes('hotwallet')) hotWalletMap.set(node.id, node.label);
    });

    if (hotWalletMap.size === 0) return nodes;

    const depositorMap = new Map<string, { color: string, memo: string }>();
    links.forEach((link: any) => {
        const sourceId = (link.source && typeof link.source === 'object') ? link.source.id : link.source;
        const targetId = (link.target && typeof link.target === 'object') ? link.target.id : link.target;
        if (hotWalletMap.has(targetId)) {
            const targetLabel = hotWalletMap.get(targetId);
            depositorMap.set(sourceId, { color: '#fca5a5', memo: `Deposit Address of ${targetLabel}` });
        }
    });

    return nodes.map(node => {
        if (depositorMap.has(node.id)) {
            const update = depositorMap.get(node.id)!;
            return { ...node, customColor: update.color, memo: update.memo, x: node.x, y: node.y, fx: node.fx, fy: node.fy, vx: node.vx, vy: node.vy };
        }
        return node;
    });
};

export const useGlobalStore = create<GlobalState>((set, get) => ({
    // Initial States
    graphData: { nodes: [], links: [] },
    clusters: [],
    session: null,
    selectedNode: null,
    selectedLink: null,
    layoutMode: 'physics',
    isPhysicsActive: true,
    selectedIds: new Set(),
    pendingClusterNodes: [],
    expandingNodes: new Set(),
    language: 'ko',

    opWallets: [],
    // App Mode & Inputs (Default Values)
    mode: 'autotracer',
    isMonitoring: false,
    inputAddr: '',
    traceAddr: '',
    hopCount: 3,
    txLimit: 20,
    traceMode: 'relation',
    startTime: '',

    bb: { logs: [], lastUpdated: null, isRefreshing: false },
    at: { traceLog: [], isTracing: false, progress: null },
    riskNodes: [],

    // [NEW] 초기값
    dashboardTxs: [],
    dashboardLastUpdated: null,

    isReportOpen: false,
    reportTargetTx: null,

    openReport: (tx) => set({ isReportOpen: true, reportTargetTx: tx }),
    closeReport: () => set({ isReportOpen: false, reportTargetTx: null }),

    monitorMode: 'standard', // 기본값
    setMonitorMode: (mode) => set({ monitorMode: mode }),

    // 1. 불러오기 (로그인 직후 호출)
    fetchOpWallets: async () => {
        const { session } = get();
        if (!session?.user) return;

        const { data, error } = await supabase
            .from('operational_wallets')
            .select('address')
            .eq('user_id', session.user.id);

        if (!error && data) {
            // DB 객체 배열 -> 문자열 배열로 변환
            set({ opWallets: data.map(row => row.address) });
        }
    },

    // 2. 추가하기 (DB Insert + State Update)
    addOpWallet: async (address) => {
        const { session, opWallets } = get();
        if (!session?.user) return;
        if (opWallets.includes(address)) return; // 중복 방지

        // (1) UI 즉시 반영 (낙관적 업데이트)
        set({ opWallets: [...opWallets, address] });

        // (2) DB 저장
        const { error } = await supabase
            .from('operational_wallets')
            .insert({ user_id: session.user.id, address });

        // (3) 실패 시 롤백 (선택 사항 - 여기선 간단히 에러 로그만)
        if (error) {
            console.error("Failed to add wallet:", error);
            // 롤백 로직이 필요하면 여기서 set으로 다시 제거
        }
    },

    // 3. 삭제하기 (DB Delete + State Update)
    removeOpWallet: async (address) => {
        const { session, opWallets } = get();
        if (!session?.user) return;

        // (1) UI 즉시 반영
        set({ opWallets: opWallets.filter(w => w !== address) });

        // (2) DB 삭제
        const { error } = await supabase
            .from('operational_wallets')
            .delete()
            .eq('user_id', session.user.id)
            .eq('address', address);

        if (error) console.error("Failed to remove wallet:", error);
    },
    // -----

    // [NEW] 액션
    setDashboardData: (txs, time) => set({ dashboardTxs: txs, dashboardLastUpdated: time }),

    // --- Actions ---
    setLanguage: (lang) => set({ language: lang }),
    setSession: (session) => set({ session }),
    signOut: async () => { await supabase.auth.signOut(); set({ session: null }); },

    setMode: (mode) => set({ mode }),
    setIsMonitoring: (isActive) => set({ isMonitoring: isActive }),

    setInputAddr: (addr) => set({ inputAddr: addr }),
    setTraceAddr: (addr) => set({ traceAddr: addr }),
    setHopCount: (n) => set({ hopCount: n }),
    setTxLimit: (n) => set({ txLimit: n }),
    setTraceMode: (m) => set({ traceMode: m }),
    setStartTime: (t) => set({ startTime: t }),



    setHooksState: (data) => set((state) => ({ ...state, ...data })),

    setGraphData: (data) => {
        const cleanLinks = sanitizeLinks(data.links);
        const processedNodes = applyHotWalletLogic(data.nodes, cleanLinks);
        set({ graphData: { nodes: processedNodes, links: cleanLinks } });
    },

    setSelectedNode: (node) => set({ selectedNode: node, selectedLink: null }),
    setSelectedLink: (link) => set({ selectedLink: link, selectedNode: null }),

    addNodes: (newNodes) => set((state) => {
        const nodeMap = new Map(state.graphData.nodes.map(n => [n.id, n]));
        newNodes.forEach(newNode => {
            const existing = nodeMap.get(newNode.id);
            if (existing) nodeMap.set(newNode.id, { ...existing, ...newNode, x: existing.x, y: existing.y, fx: existing.fx, fy: existing.fy, vx: existing.vx, vy: existing.vy });
            else nodeMap.set(newNode.id, newNode);
        });
        let mergedNodes = Array.from(nodeMap.values());
        const cleanLinks = sanitizeLinks(state.graphData.links);
        mergedNodes = applyHotWalletLogic(mergedNodes, cleanLinks);
        return { graphData: { nodes: mergedNodes, links: cleanLinks } };
    }),

    addLinks: (newLinks) => set((state) => {
        const currentLinks = sanitizeLinks(state.graphData.links);
        newLinks.forEach((link: any) => {
            const linkSource = (typeof link.source === 'object') ? link.source.id : link.source;
            const linkTarget = (typeof link.target === 'object') ? link.target.id : link.target;
            const existingIdx = currentLinks.findIndex((l: any) => {
                const s = (typeof l.source === 'object') ? l.source.id : l.source;
                const t = (typeof l.target === 'object') ? l.target.id : l.target;
                return (s === linkSource && t === linkTarget) || (s === linkTarget && t === linkSource);
            });
            if (existingIdx > -1) {
                currentLinks[existingIdx].value += link.value;
                if (link.txDetails) {
                    if (!currentLinks[existingIdx].txDetails) currentLinks[existingIdx].txDetails = [];
                    currentLinks[existingIdx].txDetails.push(...link.txDetails);
                }
            } else {
                if (!link.txDetails) link.txDetails = [];
                currentLinks.push(link);
            }
        });
        const processedNodes = applyHotWalletLogic(state.graphData.nodes, currentLinks);
        return { graphData: { nodes: processedNodes, links: currentLinks } };
    }),

    removeNode: (nodeId) => set((state) => ({
        graphData: {
            nodes: state.graphData.nodes.filter(n => n.id !== nodeId),
            links: state.graphData.links.filter((l: any) => {
                const s = (typeof l.source === 'object') ? l.source.id : l.source;
                const t = (typeof l.target === 'object') ? l.target.id : l.target;
                return s !== nodeId && t !== nodeId;
            })
        },
        selectedNode: state.selectedNode?.id === nodeId ? null : state.selectedNode
    })),

    updateNode: (nodeId, data) => set((state) => {
        const nodes = state.graphData.nodes;
        const idx = nodes.findIndex(n => n.id === nodeId);
        if (idx > -1) {
            const newNodes = [...nodes];
            Object.assign(newNodes[idx], data);
            return { graphData: { nodes: newNodes, links: state.graphData.links }, selectedNode: state.selectedNode?.id === nodeId ? { ...newNodes[idx] } : state.selectedNode };
        }
        return {};
    }),

    addCluster: (name, color, nodeIds) => set((state) => {
        const newClusterId = crypto.randomUUID();
        const newNodes = [...state.graphData.nodes];
        newNodes.forEach(node => { if (nodeIds.includes(node.id)) node.clusterId = newClusterId; });
        return { graphData: { ...state.graphData, nodes: newNodes }, clusters: [...state.clusters, { id: newClusterId, name, color, nodeIds }] };
    }),

    removeCluster: (clusterId) => set((state) => {
        const newNodes = [...state.graphData.nodes];
        newNodes.forEach(node => { if (node.clusterId === clusterId) node.clusterId = undefined; });
        return { graphData: { ...state.graphData, nodes: newNodes }, clusters: state.clusters.filter(c => c.id !== clusterId) };
    }),

    updateCluster: (clusterId, name, color, nodeIds) => set((state) => {
        const newNodes = [...state.graphData.nodes];
        newNodes.forEach(node => {
            if (node.clusterId === clusterId && !nodeIds.includes(node.id)) node.clusterId = undefined;
            if (nodeIds.includes(node.id)) node.clusterId = clusterId;
        });
        const updatedClusters = state.clusters.map(c => c.id === clusterId ? { ...c, name, color, nodeIds } : c);
        return { graphData: { ...state.graphData, nodes: newNodes }, clusters: updatedClusters };
    }),

    setLayoutMode: (mode) => set({ layoutMode: mode, isPhysicsActive: true }),
    setIsPhysicsActive: (isActive) => set({ isPhysicsActive: isActive }),

    toggleSelectNode: (nodeId, multi = false) => set((state) => {
        const newSet = multi ? new Set<string>(state.selectedIds) : new Set<string>();
        if (newSet.has(nodeId)) newSet.delete(nodeId); else newSet.add(nodeId);
        const selectedNode = newSet.size === 1 ? state.graphData.nodes.find(n => n.id === Array.from(newSet)[0]) || null : (newSet.has(nodeId) ? state.graphData.nodes.find(n => n.id === nodeId) || null : state.selectedNode);
        return { selectedIds: newSet, selectedNode };
    }),

    selectNodesByIds: (ids) => set((state) => {
        const newSet = new Set<string>(state.selectedIds);
        ids.forEach(id => newSet.add(id));
        return { selectedIds: newSet };
    }),

    clearSelection: () => set({ selectedIds: new Set<string>(), selectedNode: null }),
    setPendingClusterNodes: (ids) => set({ pendingClusterNodes: ids }),
    clearPendingClusterNodes: () => set({ pendingClusterNodes: [] }),

    saveSession: async (title, mode) => {
        const { session, graphData, clusters, layoutMode } = get();
        if (!session) return false;
        const cleanNodes = graphData.nodes.map(n => ({
            id: n.id, group: n.group, val: n.val, label: n.label, memo: n.memo, customColor: n.customColor, isStart: n.isStart, isTerminal: n.isTerminal, clusterId: n.clusterId, createdAt: n.createdAt,
            x: n.x, y: n.y, fx: n.fx, fy: n.fy
        }));
        const cleanLinks = graphData.links.map((l: any) => ({
            source: l.source.id || l.source, target: l.target.id || l.target, value: l.value, txDetails: l.txDetails
        }));
        const saveData = { nodes: cleanNodes, links: cleanLinks, clusters, layoutMode };
        // [수정 후] 새로운 DB 구조에 맞춘 방식
        const { error } = await supabase.from('saved_sessions').insert({
            user_id: session.user.id,
            title,
            mode,
            // 이제 컬럼이 분리되었으므로 각각 넣어줍니다.
            nodes: graphData.nodes,
            links: graphData.links,
            groups: [], // Dashboard 모드에서는 그룹이 없으면 빈 배열
            notes: ''   // Dashboard 모드에서는 메모가 없으면 빈 문자열
        });
        return !error;
    },
    loadSession: async (sessionId) => {
        const { data, error } = await supabase.from('saved_sessions').select('graph_data').eq('id', sessionId).single();
        if (error || !data) return;
        const { nodes, links, clusters, layoutMode } = data.graph_data;
        const cleanLinks = sanitizeLinks(links);
        const processedNodes = applyHotWalletLogic(nodes, cleanLinks);
        set({ graphData: { nodes: processedNodes, links: cleanLinks }, clusters: clusters || [], layoutMode: layoutMode || 'physics', isPhysicsActive: true, selectedNode: null, selectedLink: null });
    },

    expandNode: async (nodeId, direction, sortType) => {
        set(state => {
            const newSet = new Set(state.expandingNodes);
            newSet.add(nodeId);
            return { expandingNodes: newSet };
        });
        try {
            const { nodes, links } = await fetchNodeExpansion(nodeId, direction, sortType);
            if (nodes.length > 0) get().addNodes(nodes);
            if (links.length > 0) get().addLinks(links);
        } catch (e) {
            console.error(e);
        } finally {
            set(state => {
                const newSet = new Set(state.expandingNodes);
                newSet.delete(nodeId);
                return { expandingNodes: newSet };
            });
        }
    }
}));