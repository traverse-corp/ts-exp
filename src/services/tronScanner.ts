import { tronWeb, isValidAddress } from '../lib/tronClient';
import axios from 'axios';

export interface CleanTx {
  txID: string;
  sender: string;
  receiver: string;
  amount: number;
  token: 'TRX' | 'USDT';
  timestamp: number;
}

export interface AccountDetail {
  address: string;
  balance_trx: number;
  balance_usdt: number;
  txCount: number;
}

const MIN_AMOUNT = 1.0;
const PROXY_BASE_URL = '/api/tronscan/api';

// ==========================================
// [New] API Key Rotation System
// ==========================================
// 1. 환경변수에서 콤마로 구분된 키들을 배열로 변환
const RAW_KEYS = import.meta.env.VITE_TRONSCAN_API_KEYS || '';
const API_KEYS = RAW_KEYS.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);

let currentKeyIndex = 0;

// 2. 키를 순서대로 하나씩 꺼내주는 함수 (Round Robin)
const getNextApiKey = (): string | null => {
  if (API_KEYS.length === 0) return null;
  const key = API_KEYS[currentKeyIndex];
  // 다음 인덱스로 이동 (끝에 다다르면 다시 0번으로)
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return key;
};

// 로그로 키 개수 확인 (개발자 도구에서 확인용)
if (API_KEYS.length > 0) {
    console.log(`✅ ${API_KEYS.length} TronScan API Keys loaded for rotation.`);
} else {
    console.warn('⚠️ No TronScan API Keys found. Rate limits will be strict.');
}

// ==========================================
// Request Queue (Rate Limit 방지기)
// ==========================================
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  // 키가 많아졌으니 딜레이를 0.3초로 확 줄여서 속도를 높입니다! (기존 1초)
  private delayMs = 300; 

  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await task();
        await new Promise(r => setTimeout(r, this.delayMs));
      }
    }

    this.isProcessing = false;
  }
}

const tronScanQueue = new RequestQueue();

// ==========================================
// Main Scanner Functions
// ==========================================
export const fetchAddressTransactions = async (
  address: string, 
  sinceTimestamp: number, 
  limit: number = 20
): Promise<CleanTx[]> => {
  if (!isValidAddress(address)) return [];

  const transactions: CleanTx[] = [];

  // [STEP 1] TRX History
  try {
    const fetchTrx = async () => {
         const url = `${PROXY_BASE_URL}/transaction?sort=-timestamp&count=true&limit=${limit * 3}&start=0&address=${address}`;
         
         // [핵심] 요청할 때마다 새 키를 가져옴
         const apiKey = getNextApiKey(); 
         
         const options = {
             method: 'GET',
             headers: {
                 'Content-Type': 'application/json',
                 ...(apiKey ? { 'TRON-PRO-API-KEY': apiKey } : {})
             }
         };

         const res = await fetch(url, options);
         if (!res.ok) throw new Error(`TronScan Error: ${res.status}`);
         return await res.json();
    };

    const data = await tronScanQueue.add(fetchTrx);

    if (data?.data) {
        data.data.forEach((tx: any) => {
            if (tx.timestamp < sinceTimestamp) return;
            const amount = parseFloat(tx.amount) / 1_000_000;
            if (tx.contractType === 1 && amount >= MIN_AMOUNT) {
                transactions.push({
                    txID: tx.hash,
                    sender: tx.ownerAddress,
                    receiver: tx.toAddress,
                    amount: amount,
                    token: 'TRX',
                    timestamp: tx.timestamp
                });
            }
        });
    }
  } catch (e) {
    console.warn(`TronScan TRX failed for ${address}:`, e);
  }

  // [STEP 2] USDT (TRC20) History
  try {
    const fetchUsdt = async () => {
        const trc20Url = `${PROXY_BASE_URL}/token_trc20/transfers?limit=${limit * 3}&start=0&sort=-timestamp&count=true&relatedAddress=${address}&contract_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`;
        
        const apiKey = getNextApiKey(); // 키 교체

        const options = {
             method: 'GET',
             headers: {
                 'Content-Type': 'application/json',
                 ...(apiKey ? { 'TRON-PRO-API-KEY': apiKey } : {})
             }
         };

        const res = await fetch(trc20Url, options);
        if (!res.ok) throw new Error(`TronScan Error: ${res.status}`);
        return await res.json();
    };

    const trcData = await tronScanQueue.add(fetchUsdt);

    if (trcData?.token_transfers) {
        trcData.token_transfers.forEach((tx: any) => {
            if (tx.block_ts < sinceTimestamp) return;
            const amount = parseFloat(tx.quant) / 1_000_000;
            if (amount >= MIN_AMOUNT) {
                transactions.push({
                    txID: tx.transaction_id,
                    sender: tx.from_address,
                    receiver: tx.to_address,
                    amount: amount,
                    token: 'USDT',
                    timestamp: tx.block_ts
                });
            }
        });
    }
  } catch (e) {
      console.warn(`TronScan USDT failed for ${address}:`, e);
  }
  
  return transactions.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
};

export const fetchAccountDetail = async (address: string): Promise<AccountDetail | null> => {
  try {
    const fetchDetail = async () => {
        const apiKey = getNextApiKey(); // 키 교체
        const options = {
             method: 'GET',
             headers: {
                 'Content-Type': 'application/json',
                 ...(apiKey ? { 'TRON-PRO-API-KEY': apiKey } : {})
             }
         };

        const response = await fetch(`${PROXY_BASE_URL}/account?address=${address}`, options);
        if (!response.ok) throw new Error('Failed');
        return await response.json();
    };

    const data = await tronScanQueue.add(fetchDetail);
    
    const usdtToken = data.trc20token_balances?.find((t: any) => t.tokenId === "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");

    return {
      address: data.address,
      balance_trx: (data.balance || 0) / 1_000_000,
      balance_usdt: usdtToken ? parseFloat(usdtToken.balance) / 1_000_000 : 0,
      txCount: data.totalTransactionCount || 0
    };
  } catch (e) {
    return null;
  }
};

export const fetchRecentHistory = async (address: string): Promise<CleanTx[]> => {
    return fetchAddressTransactions(address, 0);
};

// [수정] 수동 확장 함수 (기존 Safety Lock 우회 버전)
export const fetchNodeExpansion = async (address: string, direction: 'in' | 'out', sortType: 'time' | 'value'): Promise<{ nodes: any[], links: any[] }> => {
  try {
    // [핵심] 기존 fetchRecentHistory를 쓰지 않고, 여기서 직접 API를 호출합니다.
    // 이렇게 하면 "라벨링된 주소인지 확인하는 로직"을 타지 않으므로 무조건 데이터를 가져옵니다.
    
    // 1. API 호출 (TRX + USDT 병렬 호출)
    // 트론스캔 API: 최근 50개 정도만 가져와서 분석
    const [trxRes, usdtRes] = await Promise.all([
        axios.get(`https://apilist.tronscan.org/api/transfer`, {
            params: { sort: '-timestamp', count: 'true', limit: '50', address: address }
        }),
        axios.get(`https://apilist.tronscan.org/api/token_trc20/transfers`, {
            params: { sort: '-timestamp', count: 'true', limit: '50', relatedAddress: address, contract_address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' }
        })
    ]);

    // 2. 데이터 정제 (Raw Data -> CleanTx)
    const rawTrx = trxRes.data.data || [];
    const rawUsdt = usdtRes.data.token_transfers || [];

    const cleanTrx: CleanTx[] = rawTrx.map((tx: any) => ({
        txID: tx.transactionHash,
        timestamp: tx.timestamp,
        sender: tx.transferFromAddress,
        receiver: tx.transferToAddress,
        amount: tx.amount / 1_000_000, // TRX Decimals 6
        token: 'TRX'
    }));

    const cleanUsdt: CleanTx[] = rawUsdt.map((tx: any) => ({
        txID: tx.transaction_id,
        timestamp: tx.block_ts,
        sender: tx.from_address,
        receiver: tx.to_address,
        amount: Number(tx.quant) / 1_000_000, // USDT Decimals 6
        token: 'USDT'
    }));

    // 3. 통합 및 필터링
    const allHistory = [...cleanTrx, ...cleanUsdt];

    // (1) 1 TRX/USDT 미만 제거 (잡음 제거)
    // (2) 방향(In/Out) 필터링
    const filtered = allHistory.filter(tx => {
       if (tx.amount < 1) return false;
       if (direction === 'in') return tx.receiver === address;
       if (direction === 'out') return tx.sender === address;
       return false;
    });

    // 4. 정렬 (사용자 선택 기준)
    if (sortType === 'value') {
        filtered.sort((a, b) => b.amount - a.amount); // 고액순
    } else {
        filtered.sort((a, b) => b.timestamp - a.timestamp); // 최신순
    }

    // 5. 상위 10개 Cut
    const top10 = filtered.slice(0, 10);

    // 6. 그래프 포맷 변환
    const newNodes: any[] = [];
    const newLinks: any[] = [];
    const nodeIds = new Set<string>();

    top10.forEach(tx => {
        const otherAddr = direction === 'in' ? tx.sender : tx.receiver;
        
        // 이미 맵에 존재하는지 여부는 Store의 addNodes가 알아서 처리하므로 여기선 일단 생성
        if (!nodeIds.has(otherAddr)) {
            newNodes.push({
                id: otherAddr,
                group: 'target',
                val: 5,
                label: otherAddr.slice(0, 4), // 일단 앞자리만
                createdAt: Date.now()
            });
            nodeIds.add(otherAddr);
        }

        newLinks.push({
            source: direction === 'in' ? otherAddr : address,
            target: direction === 'in' ? address : otherAddr,
            value: tx.amount,
            txDetails: [tx]
        });
    });

    return { nodes: newNodes, links: newLinks };

  } catch (error) {
    console.error("Manual Expand Error:", error);
    return { nodes: [], links: [] };
  }
};