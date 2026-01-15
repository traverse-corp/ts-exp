// src/services/openaiService.ts

const SYSTEM_PROMPT = `
You are an expert AML (Anti-Money Laundering) Compliance Officer at a financial institution.
Your task is to write a "Suspicious Transaction Report (STR)" based on the provided transaction details and suspicion reasons.
The report must follow the specific format of the 'Korea Financial Intelligence Unit (KoFIU)' STR form.
Especially, focus on writing the "VII. Description of Suspicious Transaction (Narrative)" section based on the 6W1H principle.
Use professional, formal, and concise language (Korean).
Do not use emojis or markdown bolding excessively. Keep it plain text or standard document structure.
`;

// [수정] apiKey 인자 제거
export const generateSTR = async (
    txData: any,
    reason: string,
    evidenceSummary: string
) => {
    // [수정] 환경변수에서 키 가져오기
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error("OpenAI API Key is missing. Please check your .env file.");
    }

    const prompt = `
  [Transaction Details]
  - Time: ${new Date(txData.timestamp).toLocaleString()}
  - Amount: ${txData.amount.toLocaleString()} ${txData.token}
  - Counterparty Address: ${txData.counterparty}
  - Owner Wallet (Our Side): ${txData.ownerWallet || 'Unknown'}
  - Type: ${txData.isCustomer ? 'Inflow (Deposit)' : 'Outflow (Withdrawal)'}
  
  [Suspicion Reason]
  - Type: ${reason}
  
  [Attached Evidence]
  - ${evidenceSummary}

  [Requirement]
  Please write a detailed STR narrative in Korean. 
  Include the following sections:
  1. 의심스러운 거래자 정보 (Who)
  2. 거래 발생 일시 및 장소 (When & Where)
  3. 금융거래 수단 및 방법 (What & How)
  4. 혐의거래 판단 사유 (Why) - Analyze why this fits the '${reason}' typology.
  5. 종합 의견 (Conclusion)

  Make it look like a formal report draft.
  `;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o', // 또는 gpt-3.5-turbo
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return data.choices[0].message.content;

    } catch (error) {
        console.error("GPT Generation Error:", error);
        throw error;
    }
};