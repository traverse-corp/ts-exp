export const TRANSLATIONS = {
  ko: {
    // Common
    confirm_delete_node: "이 노드와 연결된 링크를 삭제하시겠습니까?",
    confirm_dissolve_cluster: "이 클러스터를 해체하시겠습니까?",
    toast_memo_saved: "✅ 메모가 저장되었습니다!",
    toast_copied: "📋 복사되었습니다!",
    toast_trace_started: "🚀 추적이 시작되었습니다",
    
    // NetworkGraph (Instruction)
    inst_shift: "Shift + 드래그: 다중 선택",
    inst_right_click: "우클릭: 클러스터 생성",

    // DetailPanel
    inspector_node: "주소 분석",
    inspector_link: "트랜잭션 분석",
    btn_delete: "삭제",
    btn_close: "닫기",
    btn_req_coop: "수사 협조 요청 (공문)",
    
    label_identified: "식별된 개체 (VASP)",
    label_memo: "메모",
    placeholder_tag: "태그 입력...",
    btn_save: "저장",
    label_color: "색상",
    label_address: "주소",
    
    bal_usdt: "USDT 잔액",
    bal_trx: "TRX 잔액",
    
    recent_tx: "최근 트랜잭션",
    loading: "로딩중...",
    items: "건",
    no_tx_limit: "1.0 이상의 트랜잭션 없음",
    btn_trace: "추적",
    
    total_usdt: "총 USDT",
    total_trx: "총 TRX",
    label_from: "보낸사람",
    label_to: "받는사람",
    included_tx: "포함된 트랜잭션",
    no_details: "상세 내역 없음",

    // RequestModal
    req_title: "수사 및 컴플라이언스 요청",
    req_target: "대상:",
    req_menu_1: "1. VASP 자산 동결 요청",
    req_menu_1_desc: "해당 VASP 입금 주소에 대한 즉각적인 자산 동결을 요청합니다.",
    req_menu_2: "2. VASP KYC/KYT 정보 요청",
    req_menu_2_desc: "해당 주소 사용자의 신원(KYC) 및 거래 내역(KYT) 정보를 요청합니다.",
    req_menu_3: "3. 토큰 재단 동결 요청",
    req_menu_3_desc: "USDT/USDC 발행사에 블랙리스트 등재를 요청합니다. (서비스 준비중)",
    
    req_reason_label: "1. 요청 사유 선택",
    reason_vp: "보이스피싱",
    reason_fraud: "사기 / 스캠",
    reason_hack: "해킹",
    
    req_tx_label: "2. 증거 트랜잭션 선택",
    req_no_inflow: "최근 입금 내역이 없습니다.",
    
    req_summary_1: "", // 변수 조합이라 컴포넌트에서 처리
    req_summary_2: "에게 해당 주소에 대한",
    req_summary_3: "요청을 진행합니다.",
    req_summary_4: "개의 증거 트랜잭션 선택됨.",
    
    btn_back: "뒤로",
    btn_send: "요청 전송",
    btn_cancel: "취소",
    
    msg_coming_soon: "🚧 서비스 준비중입니다",
    msg_not_vasp: "🚫 VASP 입금 주소가 아닙니다.\n협조 요청을 진행할 수 없습니다.",
    msg_sent_success: "✅ 협조 요청이 성공적으로 전송되었습니다!",

    // ClusterPanel
    cluster_new: "새 클러스터 생성",
    cluster_edit: "클러스터 수정",
    cluster_name_label: "이름",
    cluster_name_ph: "클러스터 이름 입력",
    cluster_color_label: "색상",
    cluster_members: "포함된 노드",
    cluster_select_all: "전체 선택",
    cluster_search_ph: "검색...",
    cluster_no_match: "일치하는 노드가 없습니다.",
    cluster_no_avail: "추가 가능한 노드가 없습니다.",
    cluster_btn_cancel: "취소",
    cluster_btn_create: "생성",
    cluster_btn_update: "수정",
    cluster_nodes_count: "개 노드",
    
    msg_enter_name: "이름을 입력해주세요",
    msg_min_nodes: "최소 2개의 노드가 필요합니다",
  },
  en: {
    // Common
    confirm_delete_node: "Delete this node and connections?",
    confirm_dissolve_cluster: "Dissolve this cluster?",
    toast_memo_saved: "✅ Memo Saved!",
    toast_copied: "📋 Copied!",
    toast_trace_started: "🚀 Trace Started",

    // NetworkGraph
    inst_shift: "Hold Shift + Drag to Select",
    inst_right_click: "Right Click to Cluster",

    // DetailPanel
    inspector_node: "Node Inspector",
    inspector_link: "Link Inspector",
    btn_delete: "Delete",
    btn_close: "Close",
    btn_req_coop: "Request Cooperation",
    
    label_identified: "Identified Entity",
    label_memo: "Memo",
    placeholder_tag: "Tag...",
    btn_save: "Save",
    label_color: "Color",
    label_address: "Address",
    
    bal_usdt: "USDT (TRC20)",
    bal_trx: "TRX Balance",
    
    recent_tx: "Recent Transactions",
    loading: "Fetching...",
    items: "items",
    no_tx_limit: "No transactions > 1.0",
    btn_trace: "Trace",
    
    total_usdt: "Total USDT",
    total_trx: "Total TRX",
    label_from: "From",
    label_to: "To",
    included_tx: "Included Transactions",
    no_details: "No details available",

    // RequestModal
    req_title: "Legal / Compliance Request",
    req_target: "Target:",
    req_menu_1: "1. Request VASP a Freeze",
    req_menu_1_desc: "Request immediate freezing of assets for the identified VASP deposit address.",
    req_menu_2: "2. Request VASP KYC/KYT Info",
    req_menu_2_desc: "Request user identity (KYC) and transaction history (KYT) data.",
    req_menu_3: "3. Request Token Foundation a Freeze",
    req_menu_3_desc: "Contact USDT/USDC issuer to blacklist the address (Service Prep).",
    
    req_reason_label: "1. Select Reason",
    reason_vp: "Voice Phishing",
    reason_fraud: "Fraud / Scam",
    reason_hack: "Hacking",
    
    req_tx_label: "2. Select Evidence Transactions",
    req_no_inflow: "No recent inflow transactions found.",
    
    req_summary_1: "You are requesting",
    req_summary_2: "to",
    req_summary_3: "associated with this address.",
    req_summary_4: "transactions selected.",
    
    btn_back: "Back",
    btn_send: "Send Request",
    btn_cancel: "Cancel",
    
    msg_coming_soon: "🚧 Service Coming Soon",
    msg_not_vasp: "🚫 This is not a VASP's Deposit Address.\nCannot request cooperation.",
    msg_sent_success: "✅ Request sent successfully!",

    // ClusterPanel
    cluster_new: "New Cluster",
    cluster_edit: "Edit Cluster",
    cluster_name_label: "Name",
    cluster_name_ph: "Cluster Name",
    cluster_color_label: "Color",
    cluster_members: "Members",
    cluster_select_all: "Select All",
    cluster_search_ph: "Search...",
    cluster_no_match: "No matching nodes.",
    cluster_no_avail: "No available nodes.",
    cluster_btn_cancel: "Cancel",
    cluster_btn_create: "Create",
    cluster_btn_update: "Update",
    cluster_nodes_count: "Nodes",
    
    msg_enter_name: "Enter name",
    msg_min_nodes: "Min 2 nodes",
  }
};