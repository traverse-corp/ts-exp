import React, { useEffect, useRef, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import * as d3 from 'd3-force';
import { useGlobalStore } from '../../stores/useGlobalStore';
import { TRANSLATIONS } from '../../constants/lang';

// [Helper] 원형 좌표 계산 함수
const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
};

const createDonutSlice = (x: number, y: number, radius: number, innerRadius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const innerStart = polarToCartesian(x, y, innerRadius, endAngle);
  const innerEnd = polarToCartesian(x, y, innerRadius, startAngle);

  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    "L", innerEnd.x, innerEnd.y,
    "A", innerRadius, innerRadius, 0, largeArcFlag, 1, innerStart.x, innerStart.y,
    "Z"
  ].join(" ");
};

// [Modified] Props Interface added
interface NetworkGraphProps {
  nodes?: any[];
  links?: any[];
  groups?: any[];
  onNodeClick?: (node: any, event: any) => void;
}

const NetworkGraph = ({ nodes: propNodes, links: propLinks, groups: propGroups, onNodeClick: propOnNodeClick }: NetworkGraphProps) => {
  const {
    graphData: storeGraphData, clusters: storeClusters, selectedNode, setSelectedNode, setSelectedLink,
    layoutMode, isPhysicsActive, selectedIds, selectNodesByIds, clearSelection, toggleSelectNode,
    setPendingClusterNodes,
    expandNode, removeNode, expandingNodes 
  } = useGlobalStore();

  // [Modified] Use props if available, otherwise fallback to store
  const displayNodes = propNodes || storeGraphData.nodes;
  const displayLinks = propLinks || storeGraphData.links;
  const displayClusters = propGroups || storeClusters;

  // Reconstruct graphData object for ForceGraph2D
  const activeGraphData = { nodes: displayNodes, links: displayLinks };
  const { language } = useGlobalStore();
  const t = TRANSLATIONS[language];

  const graphRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [nodeMenuPos, setNodeMenuPos] = useState<{ x: number, y: number } | null>(null);
  // [New] 2단계 메뉴 활성화 상태 ('in' | 'out' | null)
  const [activeSub, setActiveSub] = useState<'in' | 'out' | null>(null);
  // [New] 화면 전체 사이즈 동적 관리
  const [dimensions, setDimensions] = useState({ w: window.innerWidth, h: window.innerHeight });

  // Group Drag State
  const dragState = useRef<{
    peers: Array<{ node: any; offsetX: number; offsetY: number }>;
  } | null>(null);

  // Box Selection State
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  // Shift & Menu State
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [showInstruction, setShowInstruction] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // [New] 윈도우 리사이즈 이벤트 리스너
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ============================================================
  // Shift Key Listener
  // ============================================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(true);
      if (e.key === 'Escape') {
          clearSelection();
          setContextMenu(null);
          setNodeMenuPos(null);
          setActiveSub(null); // 서브메뉴 닫기
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // ============================================================
  // Physics / Forces
  // ============================================================
  useEffect(() => {
    if (graphRef.current) {
      const fg = graphRef.current;

      if (layoutMode === 'horizontal') {
        fg.d3Force('collide', d3.forceCollide(12));
        fg.d3Force('cluster', null);
        fg.d3Force('charge').strength(-50);
        fg.d3Force('link').distance(30);
      } else {
        fg.d3Force('charge').strength(-60);
        fg.d3Force('link').distance(25);

        const clusterForce = (alpha: number) => {
          const nodes = displayNodes;
          const clusterMap = new Map();

          displayClusters.forEach(cluster => {
            const members = nodes.filter((n: any) => n.clusterId === cluster.id);
            if (members.length === 0) return;
            let sx = 0, sy = 0;
            members.forEach((n: any) => { sx += n.x || 0; sy += n.y || 0; });
            const cx = sx / members.length;
            const cy = sy / members.length;
            let maxDist = 0;
            members.forEach((n: any) => {
              const dx = (n.x || 0) - cx;
              const dy = (n.y || 0) - cy;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > maxDist) maxDist = dist;
            });
            clusterMap.set(cluster.id, { x: cx, y: cy, radius: maxDist + 15 });
          });

          nodes.forEach((node: any) => {
            if (node.clusterId) {
              const center = clusterMap.get(node.clusterId);
              if (center) {
                const strength = 0.8 * alpha;
                node.vx += (center.x - node.x) * strength;
                node.vy += (center.y - node.y) * strength;
              }
            }
            clusterMap.forEach((center, clusterId) => {
              if (node.clusterId !== clusterId) {
                const dx = node.x - center.x;
                const dy = node.y - center.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                if (dist < center.radius) {
                  const strength = 2.0 * alpha;
                  const pushX = (dx / dist) * (center.radius - dist) * strength;
                  const pushY = (dy / dist) * (center.radius - dist) * strength;
                  node.vx += pushX;
                  node.vy += pushY;
                }
              }
            });
          });
        };
        fg.d3Force('cluster', clusterForce);
        fg.d3Force('collide', d3.forceCollide((node: any) => node.clusterId ? 8 : 15).iterations(4));
      }

      if (isPhysicsActive) {
        fg.d3ReheatSimulation();
      }
    }
  }, [activeGraphData, displayClusters, layoutMode, isPhysicsActive]);

  // ============================================================
  // [New] Menu Position Updater (Throttle applied)
  // ============================================================
  const updateMenuPosition = useCallback(() => {
      // 선택된 노드가 없으면 메뉴 위치 초기화 (단, 이미 null이면 스킵)
      if (!selectedNode) {
          return;
      }
      
      const fg = graphRef.current;
      if (!fg) return;

      // 노드의 현재 화면 좌표 계산
      const coords = fg.graph2ScreenCoords(selectedNode.x, selectedNode.y);
      
      // 좌표 유효성 검사
      if (!coords || typeof coords.x !== 'number' || typeof coords.y !== 'number') return;

      // [최적화] 이전 좌표와 차이가 있을 때만 상태 업데이트 (무한 렌더링 방지)
      setNodeMenuPos(prev => {
          if (!prev) return coords;
          const dx = Math.abs(prev.x - coords.x);
          const dy = Math.abs(prev.y - coords.y);
          // 1px 이상 움직였을 때만 업데이트
          if (dx > 1 || dy > 1) return coords;
          return prev;
      });
  }, [selectedNode]);


  // ============================================================
  // Interaction Handlers
  // ============================================================
  const handleMouseDown = (e: React.MouseEvent) => {
    if (contextMenu) setContextMenu(null);
    if (e.shiftKey) {
      e.preventDefault();
      setIsSelecting(true);
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        dragStartPos.current = { x, y };
        setSelectionBox({ x, y, w: 0, h: 0 });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isSelecting && dragStartPos.current && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      const startX = dragStartPos.current.x;
      const startY = dragStartPos.current.y;
      setSelectionBox({
        x: Math.min(startX, currentX),
        y: Math.min(startY, currentY),
        w: Math.abs(currentX - startX),
        h: Math.abs(currentY - startY)
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isSelecting && selectionBox && graphRef.current) {
      const { x, y, w, h } = selectionBox;
      const fg = graphRef.current;
      const nodesInBox: string[] = [];
      displayNodes.forEach((node: any) => {
        const coords = fg.graph2ScreenCoords(node.x, node.y);
        if (coords.x >= x && coords.x <= x + w && coords.y >= y && coords.y <= y + h) {
          nodesInBox.push(node.id);
        }
      });
      if (nodesInBox.length > 0) selectNodesByIds(nodesInBox);
      else clearSelection();
    }
    setIsSelecting(false);
    setSelectionBox(null);
    dragStartPos.current = null;
  };

  const handleBackgroundClick = (e: any) => {
      if (e.shiftKey) return;
      setContextMenu(null);
      // 배경 클릭 시 도넛 메뉴 닫기
      setNodeMenuPos(null);
      setActiveSub(null); // 서브메뉴 초기화

      const fg = graphRef.current;
      if (!fg) return;

      const graphCoords = fg.screen2GraphCoords(e.clientX, e.clientY);
      const clickX = graphCoords.x;
      const clickY = graphCoords.y;

      let clickedClusterId: string | null = null;

      for (const cluster of displayClusters) {
          const members = displayNodes.filter((n: any) => n.clusterId === cluster.id);
          if (members.length === 0) continue;

          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          members.forEach(n => {
              if (typeof n.x !== 'number' || typeof n.y !== 'number') return;
              minX = Math.min(minX, n.x);
              maxX = Math.max(maxX, n.x);
              minY = Math.min(minY, n.y);
              maxY = Math.max(maxY, n.y);
          });

          if (minX === Infinity) continue;

          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          const radius = Math.max(maxX - minX, maxY - minY) / 2 + 15;

          const dist = Math.sqrt((clickX - centerX)**2 + (clickY - centerY)**2);
          if (dist <= radius) {
              clickedClusterId = cluster.id;
              break;
          }
      }

      if (clickedClusterId) {
          const memberIds = displayNodes
              .filter((n: any) => n.clusterId === clickedClusterId)
              .map((n: any) => n.id);
          selectNodesByIds(memberIds);
      } else {
          clearSelection();
          setSelectedNode(null);
      }
  };

  // Context Menu Handlers
  const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault(); 
      e.stopPropagation();
      if (selectedIds.size === 0) return;
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (rect) {
          setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
  };

  const handleAddToCluster = () => {
      setPendingClusterNodes(Array.from(selectedIds));
      setContextMenu(null);
  };

  // Group Drag Handlers
  const onNodeDragStart = (node: any) => {
    if (typeof node.x !== 'number' || typeof node.y !== 'number') return;
    const peersIds = new Set<string>();
    if (node.clusterId) {
      displayNodes.forEach((n: any) => {
        if (n.clusterId === node.clusterId && n.id !== node.id) peersIds.add(n.id);
      });
    }
    if (selectedIds.has(node.id)) {
      selectedIds.forEach(id => {
        if (id !== node.id) peersIds.add(id);
      });
    }
    const peersData: Array<{ node: any; offsetX: number; offsetY: number }> = [];
    peersIds.forEach(id => {
      const peer = displayNodes.find((n: any) => n.id === id);
      if (peer && typeof peer.x === 'number' && typeof peer.y === 'number') {
        peersData.push({ node: peer, offsetX: peer.x - node.x, offsetY: peer.y - node.y });
        peer.fx = peer.x;
        peer.fy = peer.y;
      }
    });
    dragState.current = { peers: peersData };
  };

  const onNodeDrag = (node: any) => {
    // 드래그 중에도 메뉴 위치 업데이트
    updateMenuPosition();

    if (!dragState.current) return;
    if (typeof node.x !== 'number' || typeof node.y !== 'number') return;
    const { peers } = dragState.current;
    peers.forEach(p => {
       const targetX = node.x + p.offsetX;
       const targetY = node.y + p.offsetY;
       p.node.fx = targetX;
       p.node.fy = targetY;
       p.node.x = targetX;
       p.node.y = targetY;
    });
  };

  const onNodeDragEnd = (node: any) => {
    dragState.current = null;
  };


  const handleDeleteNode = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (selectedNode) {
          if (confirm('Delete this node and connections?')) {
              removeNode(selectedNode.id);
              setSelectedNode(null);
              setNodeMenuPos(null);
          }
      }
  };

  // [New] Menu Actions
  const handleMenuClick = (e: React.MouseEvent, type: 'in' | 'out') => {
      e.stopPropagation();
      // 이미 켜져있으면 끄기, 아니면 켜기
      setActiveSub(prev => prev === type ? null : type);
  };

  const executeExpand = (e: React.MouseEvent, type: 'time' | 'value') => {
      e.stopPropagation();
      if (selectedNode && activeSub) {
          expandNode(selectedNode.id, activeSub, type);
          setActiveSub(null); // 실행 후 닫기
      }
  };

  return (
    <div
      ref={wrapperRef}
      className="fixed inset-0 z-0 bg-slate-50 overflow-hidden select-none"
      style={{ cursor: isShiftPressed ? 'crosshair' : 'default' }}
      onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      <ForceGraph2D
        ref={graphRef}
        graphData={activeGraphData}
        backgroundColor="#f8fafc"
        
        enableNodeDrag={true}
        enablePanInteraction={!isShiftPressed}
        enableZoomInteraction={!isShiftPressed}
        
        onRenderFramePost={updateMenuPosition}
        
        onNodeDrag={onNodeDrag} onNodeDragEnd={onNodeDragEnd}
        // @ts-ignore
        onNodeDragStart={onNodeDragStart}

        linkWidth={link => Math.min(2 + Math.log((link as any).value + 1) * 0.7, 10)}
        linkDirectionalArrowLength={4} linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={3} linkDirectionalParticleSpeed={0.01}
        linkDirectionalParticleWidth={link => (link as any).value > 50000 ? 6 : (link as any).value > 1000 ? 4 : 2}

        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const cluster = displayClusters.find((c: any) => c.id === node.clusterId);
          const isSelected = selectedNode?.id === node.id || selectedIds.has(node.id);
          const isStart = node.isStart;
          const isDbMatched = node.isTerminal === true;
          const r = isStart ? 12 : isDbMatched ? 10 : 6;

          if (expandingNodes.has(node.id)) {
              const time = Date.now();
              const angle = (time % 1000) / 1000 * 2 * Math.PI;
              ctx.beginPath();
              ctx.arc(node.x, node.y, r + 6, angle, angle + Math.PI * 1.5);
              ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 3/globalScale; ctx.lineCap = 'round'; ctx.stroke();
          }

          if (isStart) {
             const time = Date.now(); const pulse = (time % 2000) / 2000;
             ctx.beginPath(); ctx.arc(node.x, node.y, r + pulse * r * 4, 0, 2*Math.PI);
             ctx.strokeStyle = `rgba(6, 182, 212, ${1-pulse})`; ctx.lineWidth = 2/globalScale; ctx.stroke();
          }
          if (isDbMatched) {
             const pulse = Math.abs(Math.sin(Date.now() / 200)) * 10 + 15;
             ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = pulse;
          } else { ctx.shadowBlur = 0; }

          if (isSelected) {
             ctx.beginPath(); ctx.arc(node.x, node.y, r * 2.0, 0, 2*Math.PI);
             ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'; ctx.fill();
             ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1/globalScale; ctx.stroke();
          }

          ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = node.customColor || (isStart ? '#06b6d4' : node.group === 'exchange' ? '#3b82f6' : node.isTerminal ? '#ef4444' : '#22c55e');
          ctx.fill();

          ctx.strokeStyle = '#fff';
          if (cluster) { ctx.strokeStyle = cluster.color; ctx.lineWidth = 2.5/globalScale; } 
          else { ctx.lineWidth = 1.5/globalScale; }
          ctx.stroke();

          if (isStart || isDbMatched) {
            ctx.fillStyle = '#ffffff'; ctx.font = `bold ${r}px Sans-Serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(isStart ? 'S' : '!', node.x, node.y + 1/globalScale);
          }
          const fontSize = 10 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowBlur = 0;
          const label = node.memo || node.label || node.id.slice(0, 4);
          if (node.memo) {
            let memoText = node.memo.length > 8 ? node.memo.slice(0,8)+'...' : node.memo;
            const textY = node.y - r - fontSize * 1.5;
            ctx.fillStyle = '#fef08a'; const w = ctx.measureText(memoText).width;
            ctx.fillRect(node.x - w/2 - 2, textY - fontSize/2 - 2, w + 4, fontSize + 4);
            ctx.fillStyle = '#854d0e'; ctx.fillText(memoText, node.x, textY);
          } else {
            ctx.fillStyle = isStart || isDbMatched ? '#1e293b' : '#475569';
            if (isDbMatched) ctx.font = `bold ${fontSize}px Sans-Serif`;
            ctx.fillText(label, node.x, node.y + r + fontSize + 3);
          }
        }}

        onRenderFramePre={(ctx, globalScale) => {
          displayClusters.forEach((cluster: any) => {
            const nodesInCluster = displayNodes.filter((n: any) => n.clusterId === cluster.id);
            if (nodesInCluster.length === 0) return;
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            nodesInCluster.forEach((n: any) => {
              if (typeof n.x === 'number') { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y); }
            });
            if (minX === Infinity) return;
            const centerX = (minX + maxX) / 2; const centerY = (minY + maxY) / 2;
            const radius = Math.max(maxX - minX, maxY - minY) / 2 + 15;
            const isClusterSelected = nodesInCluster.every(n => selectedIds.has(n.id));
            ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            if (isClusterSelected) { ctx.shadowColor = cluster.color; ctx.shadowBlur = 20; ctx.fillStyle = cluster.color + '20'; } 
            else { ctx.shadowBlur = 0; ctx.fillStyle = cluster.color + '10'; }
            ctx.fill();
            ctx.strokeStyle = cluster.color; ctx.lineWidth = (isClusterSelected ? 4 : 1.5) / globalScale;
            if (!isClusterSelected) ctx.setLineDash([6 / globalScale, 4 / globalScale]); else ctx.setLineDash([]);
            ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
            const fontSize = (isClusterSelected ? 18 : 14) / globalScale;
            ctx.font = `bold ${fontSize}px Sans-Serif`; ctx.fillStyle = cluster.color; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillText(cluster.name, centerX, minY - 8);
          });
        }}

// [수정된 부분] onNodeClick 핸들러 로직 병합
        onNodeClick={(node, event) => {
            // 1. [기본 동작] 무조건 실행: 노드 선택 및 도넛 메뉴 위치 잡기
            // (이게 실행되어야 DetailPanel에 데이터가 가고, 도넛 메뉴가 뜹니다)
            if ((event as any).shiftKey) {
                toggleSelectNode((node as any).id, true);
            } else {
                setSelectedNode(node as any);
                setActiveSub(null);
                if (graphRef.current) {
                    setNodeMenuPos(graphRef.current.graph2ScreenCoords(node.x, node.y));
                }
            }

            // 2. [외부 동작] Props로 전달된 핸들러가 있다면 추가로 실행
            // (Canvas 모드에서 노드 클릭 시 자동 확장 기능 등)
            if (propOnNodeClick) {
                propOnNodeClick(node, event);
            }
        }}
        onLinkClick={link => setSelectedLink(link as any)}
        onBackgroundClick={handleBackgroundClick}
        cooldownTicks={isPhysicsActive ? Infinity : 0}
        dagMode={layoutMode === 'horizontal' ? 'lr' : undefined}
        dagLevelDistance={150} 
      />

      {selectionBox && (
        <div className="absolute border border-blue-500 bg-blue-500/20 pointer-events-none z-50" style={{ left: selectionBox.x, top: selectionBox.y, width: selectionBox.w, height: selectionBox.h }} />
      )}

      {contextMenu && (
        <div onMouseDown={(e) => e.stopPropagation()} className="absolute z-[100] bg-white/95 backdrop-blur rounded-lg shadow-xl border border-slate-200 py-1 min-w-[160px] animate-in zoom-in-95 duration-100 origin-top-left" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-lg">
             <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Selection</div>
             <div className="text-xs font-bold text-slate-800">{selectedIds.size} Nodes</div>
          </div>
          <button onClick={handleAddToCluster} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-2">
             <span className="text-sm">✨</span> Add to Cluster
          </button>
          <div className="px-3 py-1 text-[9px] text-slate-300">More options soon...</div>
        </div>
      )}

      {/* [SVG Donut Menu - Emoji Version] */}
      {selectedNode && nodeMenuPos && (
        <div 
            className="absolute z-30 pointer-events-none"
            style={{ 
                left: nodeMenuPos.x, 
                top: nodeMenuPos.y, 
                transform: 'translate(-50%, -50%)',
                width: '240px', height: '240px' // 서브메뉴 공간 확보
            }}
        >
            <div className="relative w-full h-full pointer-events-auto flex items-center justify-center">
               <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-xl" preserveAspectRatio="xMidYMid meet">
                  
                  {/* 중앙 터널 (클릭 통과용) */}
                  <circle cx="100" cy="100" r="22" fill="none" pointerEvents="none" />
                  
                  {/* ================================================= */}
                  {/* Main Ring (r=25 ~ 55) */}
                  {/* ================================================= */}
                  
                  {/* 1. OUT (Green) : -90 ~ 30 deg (Center: -30) */}
                  <g 
                    className={`cursor-pointer transition-all hover:opacity-90 ${activeSub === 'out' ? 'opacity-100' : 'opacity-80'}`}
                    onClick={(e) => handleMenuClick(e, 'out')}
                  >
                      <path 
                        d={createDonutSlice(100, 100, 55, 25, -90, 30)}
                        fill="white" stroke={activeSub === 'out' ? "#22c55e" : "#cbd5e1"} strokeWidth={activeSub === 'out' ? 2 : 1}
                      />
                      {/* 이모지 위치: 각도 -30도, 거리 40 */}
                      <text x={polarToCartesian(100, 100, 40, -30).x} y={polarToCartesian(100, 100, 40, -30).y + 4} 
                            fontSize="16" textAnchor="middle" pointerEvents="none">⏫</text>
                  </g>
                  
                  {/* 2. DEL (Red) : 30 ~ 150 deg (Center: 90) */}
                  <g 
                    className="cursor-pointer transition-all hover:opacity-100 opacity-80"
                    onClick={handleDeleteNode}
                  >
                      <path 
                        d={createDonutSlice(100, 100, 55, 25, 30, 150)}
                        fill="white" stroke="#cbd5e1" strokeWidth="1" className="hover:stroke-red-400 hover:fill-red-50"
                      />
                      <text x={polarToCartesian(100, 100, 40, 90).x} y={polarToCartesian(100, 100, 40, 90).y + 5} 
                            fontSize="16" textAnchor="middle" pointerEvents="none">🗑️</text>
                  </g>

                  {/* 3. IN (Blue) : 150 ~ 270 deg (Center: 210) */}
                  <g 
                    className={`cursor-pointer transition-all hover:opacity-90 ${activeSub === 'in' ? 'opacity-100' : 'opacity-80'}`}
                    onClick={(e) => handleMenuClick(e, 'in')}
                  >
                      <path 
                        d={createDonutSlice(100, 100, 55, 25, 150, 270)}
                        fill="white" stroke={activeSub === 'in' ? "#3b82f6" : "#cbd5e1"} strokeWidth={activeSub === 'in' ? 2 : 1}
                      />
                      <text x={polarToCartesian(100, 100, 40, 210).x} y={polarToCartesian(100, 100, 40, 210).y + 4} 
                            fontSize="16" textAnchor="middle" pointerEvents="none">⬇️</text>
                  </g>


                  {/* ================================================= */}
                  {/* Sub Menu (Buttons outside) */}
                  {/* ================================================= */}
                  
                  {/* IN Submenu (Left Side - Angles 190, 230) */}
                  {activeSub === 'in' && (
                    <g className="animate-in fade-in zoom-in-90 duration-200">
                       {/* Time Button */}
                       <g 
                          transform={`translate(${polarToCartesian(100, 100, 75, 190).x}, ${polarToCartesian(100, 100, 75, 190).y})`}
                          onClick={(e) => executeExpand(e, 'time')} 
                          className="cursor-pointer group" // [수정] scale 제거, group 추가
                       >
                           {/* [수정] hover 시 stroke 두꺼워지게 변경 (안정적) */}
                           <circle r="15" fill="white" stroke="#3b82f6" strokeWidth="1.5" 
                                   className="transition-all duration-200 group-hover:stroke-[3px] group-hover:fill-blue-50 shadow-sm" />
                           <text y="5" textAnchor="middle" fontSize="12" pointerEvents="none">🕒</text>
                           <text y="16" textAnchor="middle" fontSize="5" fill="#3b82f6" fontWeight="bold" pointerEvents="none">Recent</text>
                       </g>

                       {/* Value Button */}
                       <g 
                          transform={`translate(${polarToCartesian(100, 100, 75, 230).x}, ${polarToCartesian(100, 100, 75, 230).y})`}
                          onClick={(e) => executeExpand(e, 'value')} 
                          className="cursor-pointer group"
                       >
                           <circle r="15" fill="white" stroke="#3b82f6" strokeWidth="1.5" 
                                   className="transition-all duration-200 group-hover:stroke-[3px] group-hover:fill-blue-50 shadow-sm" />
                           <text y="5" textAnchor="middle" fontSize="12" pointerEvents="none">💰</text>
                           <text y="16" textAnchor="middle" fontSize="5" fill="#3b82f6" fontWeight="bold" pointerEvents="none">Value</text>
                       </g>
                    </g>
                  )}

                  {/* OUT Submenu (Right Side - Angles -10, -50) */}
                  {activeSub === 'out' && (
                    <g className="animate-in fade-in zoom-in-90 duration-200">
                       {/* Time Button */}
                       <g 
                          transform={`translate(${polarToCartesian(100, 100, 75, -50).x}, ${polarToCartesian(100, 100, 75, -50).y})`}
                          onClick={(e) => executeExpand(e, 'time')} 
                          className="cursor-pointer group"
                       >
                           <circle r="15" fill="white" stroke="#22c55e" strokeWidth="1.5" 
                                   className="transition-all duration-200 group-hover:stroke-[3px] group-hover:fill-green-50 shadow-sm" />
                           <text y="5" textAnchor="middle" fontSize="12" pointerEvents="none">🕒</text>
                           <text y="16" textAnchor="middle" fontSize="5" fill="#22c55e" fontWeight="bold" pointerEvents="none">Recent</text>
                       </g>

                       {/* Value Button */}
                       <g 
                          transform={`translate(${polarToCartesian(100, 100, 75, -10).x}, ${polarToCartesian(100, 100, 75, -10).y})`}
                          onClick={(e) => executeExpand(e, 'value')} 
                          className="cursor-pointer group"
                       >
                           <circle r="15" fill="white" stroke="#22c55e" strokeWidth="1.5" 
                                   className="transition-all duration-200 group-hover:stroke-[3px] group-hover:fill-green-50 shadow-sm" />
                           <text y="5" textAnchor="middle" fontSize="12" pointerEvents="none">💰</text>
                           <text y="16" textAnchor="middle" fontSize="5" fill="#22c55e" fontWeight="bold" pointerEvents="none">Value</text>
                       </g>
                    </g>
                  )}

               </svg>
            </div>
        </div>
      )}

      {showInstruction && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur text-white text-[11px] pl-4 pr-2 py-1.5 rounded-full z-[40] shadow-lg flex items-center gap-3 animate-fade-in-down border border-slate-600">
          <span>{t.inst_shift} <span className="mx-1 text-slate-400">|</span> {t.inst_right_click}</span>
          <button onClick={() => setShowInstruction(false)} className="text-slate-400 hover:text-white hover:bg-slate-700 rounded-full p-0.5 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(NetworkGraph);