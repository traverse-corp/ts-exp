export const TRANSLATIONS = {
  ko: {
    // Common
    confirm_delete_node: "이 노드와 연결된 링크를 삭제하시겠습니까?",
    confirm_dissolve_cluster: "이 클러스터를 해체하시겠습니까?",
    toast_memo_saved: "✅ 메모가 저장되었습니다!",
    toast_copied: "복사되었습니다!",
    toast_trace_started: "추적이 시작되었습니다",

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

    msg_coming_soon: "서비스 준비중입니다",
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

    // [New] Dashboard
    dash_title: "AML 통합 관제 대시보드",
    dash_subtitle: "실시간 가상자산 자금세탁 방지 및 리스크 모니터링 시스템",

    // Cards
    card_risk_score: "기관 위험 노출도",
    card_monitored_vol: "금일 모니터링 자산",
    card_alert_count: "심각 단계 경보",

    // Sanction Data
    sanc_title: "제재 대상 KYT 데이터베이스",
    sanc_ofac: "OFAC/OFSI 제재 대상",
    sanc_kofiu: "KoFIU 미신고 가상자산사업자",
    sanc_crime: "국내외 주요 범죄 지갑",

    // Ops Wallets
    ops_title: "기관 운영 지갑 (Hot Wallets)",
    ops_add_placeholder: "운영 지갑 주소 등록...",
    ops_btn_add: "등록",
    ops_customer_inflow: "고객 입금 식별",

    // Tx Table
    tx_col_time: "시간",
    tx_col_hash: "TX Hash",
    tx_col_type: "유형",
    tx_col_counterparty: "상대방 (고객/외부)",
    tx_col_amount: "수량",
    tx_col_risk: "리스크",

    // Customer Actions
    cust_label: "고객 입금 주소",
    btn_check_kyc: "KYC 정보 확인",
    btn_freeze_acc: "계좌/지갑 동결",

    msg_freeze_done: "✅ 해당 고객의 계좌 및 지갑 동결 조치가 완료되었습니다.",
    msg_kyc_check: "✅ KYC 데이터 조회 완료: Verified User (Level 2)",
    tx_col_ops: "운영 지갑 (당사)", // 컬럼명 추가
    btn_instant_trace: "즉시 추적", // 버튼 텍스트 추가

    // [NEW] Report Generator
    btn_str_report: "STR 보고",

    report_title: "AI 의심거래보고서(STR) 생성",
    report_step1: "1. 혐의 사유 선택",
    report_step2: "2. 보고서 생성",

    reason_sanction: "국제 제재 대상 (Sanctions)",
    reason_unreg_vasp: "미신고 가상자산사업자",
    reason_sexual: "디지털 성범죄",
    reason_gambling: "불법 도박",
    reason_drug: "마약 거래",

    btn_generate: "AI 보고서 생성 시작",
    btn_copy_report: "보고서 전체 복사",
    msg_copied: "보고서가 클립보드에 복사되었습니다.",
  },
  en: {
    // Common
    confirm_delete_node: "Delete this node and connections?",
    confirm_dissolve_cluster: "Dissolve this cluster?",
    toast_memo_saved: "✅ Memo Saved!",
    toast_copied: "Copied!",
    toast_trace_started: "Trace Started",

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

    msg_coming_soon: "Service Coming Soon",
    msg_not_vasp: "This is not a VASP's Deposit Address.\nCannot request cooperation.",
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

    // [New] Dashboard
    dash_title: "Enterprise AML Dashboard",
    dash_subtitle: "Real-time Anti-Money Laundering & Risk Monitoring System",

    // Cards
    card_risk_score: "Risk Exposure Level",
    card_monitored_vol: "Monitored Volume (24h)",
    card_alert_count: "Critical Alerts",

    // Sanction Data
    sanc_title: "Global Sanction Database Status",
    sanc_ofac: "OFAC/OFSI Sanctions",
    sanc_kofiu: "KoFIU Watchlist",
    sanc_crime: "Major Criminal Addresses",

    // Ops Wallets
    ops_title: "Operational Wallets (Hot Wallets)",
    ops_add_placeholder: "Register Wallet Address...",
    ops_btn_add: "Add",
    ops_customer_inflow: "Customer Inflow",

    // Tx Table
    tx_col_time: "Time",
    tx_col_hash: "TX Hash",
    tx_col_type: "Type",
    tx_col_counterparty: "Counterparty",
    tx_col_amount: "Amount",
    tx_col_risk: "Risk",

    // Customer Actions
    cust_label: "Customer Deposit Addr",
    btn_check_kyc: "Check KYC Info",
    btn_freeze_acc: "Freeze Account",

    msg_freeze_done: "✅ Customer account & wallet successfully FROZEN.",
    msg_kyc_check: "✅ KYC Data Retrieved: Verified User (Level 2)",
    tx_col_ops: "Ops Wallet (Us)",
    btn_instant_trace: "Trace Now",

    btn_str_report: "STR Report",

    report_title: "AI STR Report Generator",
    report_step1: "1. Select Suspicion Reason",
    report_step2: "2. Generate Report",

    reason_sanction: "Int'l Sanctions",
    reason_unreg_vasp: "Unregistered VASP",
    reason_sexual: "Digital Sexual Crime",
    reason_gambling: "Illegal Gambling",
    reason_drug: "Narcotics Trafficking",

    btn_generate: "Generate Report with AI",
    btn_copy_report: "Copy to Clipboard",
    msg_copied: "Report copied to clipboard.",
  }
};