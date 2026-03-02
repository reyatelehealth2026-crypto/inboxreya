import pool from '@/lib/db';
import { analyzeMessageWithGemini, analyzeMessageBatch } from './gemini';
import { SentimentAnalysisResult, MessageForAnalysis } from '@/lib/analytics/types';

/**
 * Get messages that haven't been analyzed yet
 */
export async function getUnanalyzedMessages(limit: number = 100): Promise<MessageForAnalysis[]> {
  const [rows] = await pool.execute(
    `
    SELECT 
      m.id,
      m.user_id as userId,
      m.content,
      m.created_at as createdAt
    FROM messages m
    LEFT JOIN message_sentiment_analysis msa ON m.id = msa.message_id
    WHERE msa.id IS NULL
      AND m.content IS NOT NULL
      AND LENGTH(TRIM(m.content)) > 0
      AND m.direction = 'in'  -- Only analyze incoming messages from customers
    ORDER BY m.created_at DESC
    LIMIT ?
    `,
    [limit]
  );

  return (rows as any[]).map(row => ({
    id: row.id,
    userId: row.userId,
    content: row.content,
    createdAt: row.createdAt
  }));
}

/**
 * Save sentiment analysis result to database
 */
export async function saveSentimentAnalysis(
  messageId: number,
  userId: number,
  result: SentimentAnalysisResult
): Promise<void> {
  await pool.execute(
    `
    INSERT INTO message_sentiment_analysis 
      (message_id, user_id, sentiment, confidence, keywords, categories, summary, is_complaint, urgency)
    VALUES 
      (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      sentiment = VALUES(sentiment),
      confidence = VALUES(confidence),
      keywords = VALUES(keywords),
      categories = VALUES(categories),
      summary = VALUES(summary),
      is_complaint = VALUES(is_complaint),
      urgency = VALUES(urgency),
      analyzed_at = CURRENT_TIMESTAMP
    `,
    [
      messageId,
      userId,
      result.sentiment,
      result.confidence,
      JSON.stringify(result.keywords),
      JSON.stringify(result.categories),
      result.summary,
      result.isComplaint,
      result.urgency
    ]
  );
}

/**
 * Analyze a single message and save result
 */
export async function analyzeAndSaveMessage(
  messageId: number,
  userId: number,
  content: string
): Promise<SentimentAnalysisResult> {
  const result = await analyzeMessageWithGemini(content);
  await saveSentimentAnalysis(messageId, userId, result);
  return result;
}

/**
 * Run batch analysis on unanalyzed messages
 */
export async function runBatchSentimentAnalysis(batchSize: number = 50): Promise<{
  processed: number;
  complaints: number;
}> {
  const messages = await getUnanalyzedMessages(batchSize);
  
  if (messages.length === 0) {
    return { processed: 0, complaints: 0 };
  }

  let complaintCount = 0;

  // Process in batches to avoid rate limiting
  const batch = messages.map(msg => ({ id: msg.id, content: msg.content }));
  const results = await analyzeMessageBatch(batch);

  // Save all results
  await Promise.all(
    results.map(async ({ messageId, result }, index) => {
      const userId = messages[index].userId;
      await saveSentimentAnalysis(messageId, userId, result);
      if (result.isComplaint) {
        complaintCount++;
      }
    })
  );

  return { processed: messages.length, complaints: complaintCount };
}

/**
 * Get sentiment statistics for a date range
 */
export async function getSentimentStats(days: number = 30): Promise<{
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}> {
  const [rows] = await pool.execute(
    `
    SELECT 
      COALESCE(SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END), 0) as positive,
      COALESCE(SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END), 0) as neutral,
      COALESCE(SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END), 0) as negative,
      COUNT(*) as total
    FROM message_sentiment_analysis
    WHERE analyzed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `,
    [days]
  );

  const result = (rows as any[])[0];
  return {
    positive: Number(result.positive || 0),
    neutral: Number(result.neutral || 0),
    negative: Number(result.negative || 0),
    total: Number(result.total || 0)
  };
}

/**
 * Get complaint statistics by category
 */
export async function getComplaintStats(days: number = 30): Promise<Array<{
  category: string;
  count: number;
}>> {
  const [rows] = await pool.execute(
    `
    SELECT 
      category,
      COUNT(*) as count
    FROM message_sentiment_analysis,
    JSON_TABLE(
      categories,
      '$[*]' COLUMNS (category VARCHAR(50) PATH '$')
    ) AS jt
    WHERE is_complaint = TRUE
      AND analyzed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    GROUP BY category
    ORDER BY count DESC
    `,
    [days]
  );

  return (rows as any[]).map(row => ({
    category: row.category,
    count: Number(row.count)
  }));
}

/**
 * Get recent issues (complaints)
 */
export async function getRecentIssues(limit: number = 10): Promise<Array<{
  id: string;
  userId: number;
  userName: string | null;
  message: string;
  category: string;
  urgency: 'high' | 'medium' | 'low';
  sentiment: 'positive' | 'neutral' | 'negative';
  detectedAt: string;
}>> {
  const [rows] = await pool.execute(
    `
    SELECT 
      msa.id,
      msa.user_id as userId,
      COALESCE(u.real_name, u.display_name, u.custom_display_name) as userName,
      m.content as message,
      JSON_UNQUOTE(JSON_EXTRACT(msa.categories, '$[0]')) as category,
      msa.urgency,
      msa.sentiment,
      msa.analyzed_at as detectedAt
    FROM message_sentiment_analysis msa
    JOIN messages m ON msa.message_id = m.id
    JOIN users u ON msa.user_id = u.id
    WHERE msa.is_complaint = TRUE
    ORDER BY msa.analyzed_at DESC
    LIMIT ?
    `,
    [limit]
  );

  return (rows as any[]).map(row => ({
    id: String(row.id),
    userId: row.userId,
    userName: row.userName,
    message: row.message,
    category: row.category || 'other',
    urgency: row.urgency,
    sentiment: row.sentiment,
    detectedAt: row.detectedAt
  }));
}

/**
 * Get top complaining customers
 */
export async function getTopComplainers(limit: number = 10): Promise<Array<{
  userId: number;
  userName: string | null;
  complaintCount: number;
  lastComplaintAt: string;
}>> {
  const [rows] = await pool.execute(
    `
    SELECT 
      msa.user_id as userId,
      COALESCE(u.real_name, u.display_name, u.custom_display_name) as userName,
      COUNT(*) as complaintCount,
      MAX(msa.analyzed_at) as lastComplaintAt
    FROM message_sentiment_analysis msa
    JOIN users u ON msa.user_id = u.id
    WHERE msa.is_complaint = TRUE
    GROUP BY msa.user_id, u.real_name, u.display_name, u.custom_display_name
    ORDER BY complaintCount DESC
    LIMIT ?
    `,
    [limit]
  );

  return (rows as any[]).map(row => ({
    userId: row.userId,
    userName: row.userName,
    complaintCount: Number(row.complaintCount),
    lastComplaintAt: row.lastComplaintAt
  }));
}
