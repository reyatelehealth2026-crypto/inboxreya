import { GoogleGenerativeAI } from '@google/generative-ai';
import { SentimentAnalysisResult } from '@/lib/analytics/types';

// Initialize Gemini API
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
  }
  return new GoogleGenerativeAI(apiKey);
};

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

/**
 * Analyze sentiment of a message using Gemini AI
 */
export async function analyzeMessageWithGemini(
  message: string
): Promise<SentimentAnalysisResult> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });

  const prompt = `
วิเคราะห์ข้อความจากลูกค้าร้านขายยา:

ข้อความ: "${message}"

ตอบเป็น JSON ตามรูปแบบนี้เท่านั้น (ไม่ต้องมี markdown code block):
{
  "sentiment": "positive" | "neutral" | "negative",
  "confidence": 0.0-1.0,
  "keywords": ["คำสำคัญ1", "คำสำคัญ2"],
  "categories": ["delivery" | "product" | "price" | "service" | "other"],
  "summary": "สรุปประเด็นหลัก 1 ประโยค",
  "is_complaint": true | false,
  "urgency": "high" | "medium" | "low"
}

กฎการตัดสิน:
- sentiment "negative" + is_complaint true = ร้องเรียน
- urgency "high" = ปัญหาร้ายแรง (ส่งผลกระทบต่อธุรกิจ)
- categories เลือกจาก: delivery(การจัดส่ง), product(สินค้า), price(ราคา), service(บริการ), other(อื่นๆ)
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Parse JSON response
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanText);

    return {
      sentiment: parsed.sentiment || 'neutral',
      confidence: parsed.confidence || 0.5,
      keywords: parsed.keywords || [],
      categories: parsed.categories || ['other'],
      summary: parsed.summary || '',
      isComplaint: parsed.is_complaint || false,
      urgency: parsed.urgency || 'low'
    };
  } catch (error) {
    console.error('Gemini analysis error:', error);
    // Return neutral fallback
    return {
      sentiment: 'neutral',
      confidence: 0,
      keywords: [],
      categories: ['other'],
      summary: 'Analysis failed',
      isComplaint: false,
      urgency: 'low'
    };
  }
}

/**
 * Analyze multiple messages in batch
 */
export async function analyzeMessageBatch(
  messages: { id: number; content: string }[]
): Promise<Array<{ messageId: number; result: SentimentAnalysisResult }>> {
  const results = await Promise.all(
    messages.map(async (msg) => {
      const result = await analyzeMessageWithGemini(msg.content);
      return { messageId: msg.id, result };
    })
  );
  return results;
}
