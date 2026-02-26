/**
 * PHP Bridge - Integration layer for communicating with PHP backend
 * Provides type-safe wrappers for PHP service calls
 */

interface PhpApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

interface PhpBridgeError extends Error {
  statusCode?: number
  response?: any
}

class PhpBridgeError extends Error {
  constructor(message: string, public statusCode?: number, public response?: any) {
    super(message)
    this.name = 'PhpBridgeError'
  }
}

/**
 * Call PHP API endpoint with enhanced error handling
 * @throws PhpBridgeError if request fails
 */
export async function callPhpApi<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<PhpApiResponse<T>> {
  try {
    const isAbsolute = /^https?:\/\//i.test(endpoint)
    const baseUrl =
      process.env.PHP_API_URL ||
      process.env.NEXT_PUBLIC_PHP_API_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      ''
    
    if (!baseUrl && !isAbsolute) {
      throw new PhpBridgeError('PHP_API_URL is not configured', 500)
    }

    const url = isAbsolute ? endpoint : `${baseUrl}${endpoint}`
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Request': 'true',
          ...options?.headers,
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText)

        let parsedError: any = null
        try {
          parsedError = JSON.parse(errorText)
        } catch {
          parsedError = null
        }

        const backendMessage =
          parsedError?.error ||
          parsedError?.message ||
          (typeof errorText === 'string' && errorText.trim() ? errorText.trim() : response.statusText)

        throw new PhpBridgeError(
          `PHP API error (${response.status}): ${backendMessage}`,
          response.status,
          parsedError ?? errorText
        )
      }

      const data = await response.json()
      
      // Handle PHP error responses
      if (data.success === false && data.error) {
        throw new PhpBridgeError(data.error, response.status, data)
      }

      return data
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof PhpBridgeError) {
        throw error
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new PhpBridgeError('Request timeout - PHP API did not respond', 504)
      }
      
      throw error
    }
  } catch (error) {
    console.error('PHP Bridge error:', error)
    
    if (error instanceof PhpBridgeError) {
      return {
        success: false,
        error: error.message,
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * ส่งข้อความผ่าน LINE API (ใช้ PHP endpoint)
 * @param params.userId - Database user ID
 * @param params.message - ข้อความที่จะส่ง
 * @param params.type - ประเภทข้อความ
 * @param params.sentBy - Admin ID who sent the message
 * @param params.quoteToken - Quote Token สำหรับ quote reply (optional)
 */
export async function sendLineMessage(params: {
  userId: string // Database user ID
  message: string
  type?: string
  sentBy?: string | null // Admin ID who sent the message
  quoteToken?: string | null // Quote token for quote reply
}) {
  // PHP endpoint expects form data, not JSON
  const formData = new URLSearchParams()
  formData.append('action', 'send')
  formData.append('user_id', params.userId)
  formData.append('message', params.message)
  formData.append('type', params.type || 'text')
  if (params.sentBy) {
    formData.append('sent_by', params.sentBy)
  }
  if (params.quoteToken) {
    formData.append('quote_token', params.quoteToken)
  }

  const baseUrl = process.env.PHP_API_URL || process.env.NEXT_PUBLIC_PHP_API_URL || ''
  
  try {
    const response = await fetch(`${baseUrl}/api/messages.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Internal-Request': 'true',
      },
      body: formData.toString(),
      credentials: 'include',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText)
      console.error('PHP send message error:', errorText)
      return { success: false, error: errorText }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Send message error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * ดึงข้อมูลออเดอร์จากระบบ PHP
 */
export async function getCustomerOrders(userId: string) {
  return callPhpApi(`/api/orders.php?user_id=${userId}`)
}

/**
 * ดึงข้อมูล Points จากระบบ PHP
 */
export async function getCustomerPoints(userId: string) {
  return callPhpApi(`/api/points.php?user_id=${userId}`)
}

/**
 * อัปเดต Customer profile ในระบบ PHP
 */
export async function updateCustomerProfile(userId: string, data: any) {
  return callPhpApi('/api/customers/update.php', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, ...data }),
  })
}

export async function updateCustomerInfoField(params: {
  userId: string
  field: string
  value: string | null
  adminId?: string | null
}) {
  return callPhpApi('/api/inbox-v2.php?action=update_customer_info', {
    method: 'POST',
    body: JSON.stringify({
      user_id: params.userId,
      field: params.field,
      value: params.value ?? '',
      admin_id: params.adminId ?? undefined,
    }),
  })
}

export async function getTemplates(search?: string) {
  const query = search ? `&search=${encodeURIComponent(search)}` : ''
  return callPhpApi(`/api/inbox/templates?${query.replace(/^&/, '')}`)
}

/**
 * Sync ข้อมูลระหว่าง Next.js และ PHP
 */
export async function syncWithPhp(action: string, data: any) {
  return callPhpApi('/api/sync.php', {
    method: 'POST',
    body: JSON.stringify({ action, data }),
  })
}

/**
 * เรียก PHP API endpoint ด้วย FormData (สำหรับ upload ไฟล์)
 */
export async function callPhpApiFormData<T = any>(
  endpoint: string,
  formData: FormData
): Promise<PhpApiResponse<T>> {
  try {
    const baseUrl =
      process.env.PHP_API_URL ||
      process.env.NEXT_PUBLIC_PHP_API_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      ''
    if (!baseUrl) {
      return {
        success: false,
        error: 'PHP_API_URL is not configured',
      }
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {
        'X-Internal-Request': 'true',
        // ไม่ใส่ Content-Type ให้ browser จัดการ multipart boundary
      },
    })

    if (!response.ok) {
      throw new Error(`PHP API error: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('PHP Bridge FormData error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Upload และส่ง media (รูปภาพ/ไฟล์) ไปยัง LINE ผ่าน PHP API
 */
export async function uploadAndSendMedia(params: {
  userId: string // LINE user ID
  file: File
  type: 'image' | 'file'
}): Promise<PhpApiResponse<{ mediaUrl?: string; messageId?: string }>> {
  const formData = new FormData()
  formData.append('file', params.file)
  formData.append('user_id', params.userId)
  formData.append('type', params.type)

  return callPhpApiFormData('/api/line/send-media.php', formData)
}

/**
 * อัปโหลดไฟล์ไปยัง PHP server เท่านั้น (ไม่ส่งไป LINE)
 * ใช้เมื่อต้องการแค่อัปโหลดและได้ public URL
 */
export async function uploadMediaOnly(params: {
  file: File
  type: 'image' | 'file'
}): Promise<PhpApiResponse<{ mediaUrl?: string; filename?: string }>> {
  const formData = new FormData()
  formData.append('file', params.file)
  formData.append('type', params.type)

  return callPhpApiFormData('/api/line/upload-only.php', formData)
}

// ============================================================================
// Service Wrappers - Type-safe wrappers for PHP backend services
// ============================================================================

/**
 * Points Service - Customer loyalty points management
 */
export const PointsService = {
  /**
   * Calculate points for an order
   */
  async calculatePoints(orderId: number): Promise<PhpApiResponse<{ points: number }>> {
    return callPhpApi('/api/points.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'calculate', order_id: orderId }),
    })
  },

  /**
   * Get customer points balance
   */
  async getBalance(userId: string): Promise<PhpApiResponse<{ points: number; tier: string }>> {
    return callPhpApi(`/api/points.php?action=balance&user_id=${userId}`)
  },

  /**
   * Adjust customer points manually
   */
  async adjustPoints(params: {
    userId: string
    points: number
    reason: string
    adminId: string
  }): Promise<PhpApiResponse<{ newBalance: number }>> {
    return callPhpApi('/api/points.php', {
      method: 'POST',
      body: JSON.stringify({
        action: 'adjust',
        user_id: params.userId,
        points: params.points,
        reason: params.reason,
        admin_id: params.adminId,
      }),
    })
  },
}

/**
 * Pharmacy AI Service - AI-powered pharmacy features
 */
export const PharmacyAIService = {
  /**
   * Check drug interactions
   */
  async checkInteractions(drugs: string[]): Promise<
    PhpApiResponse<{
      hasInteraction: boolean
      severity: 'minor' | 'moderate' | 'severe'
      details: string
    }>
  > {
    return callPhpApi('/api/pharmacy-ai.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'check_interaction', drugs }),
    })
  },

  /**
   * Analyze symptom image
   */
  async analyzeSymptom(imageUrl: string): Promise<
    PhpApiResponse<{
      symptoms: string[]
      confidence: number
      recommendations: string[]
    }>
  > {
    return callPhpApi('/api/pharmacy-ai.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'analyze_symptom', image_url: imageUrl }),
    })
  },

  /**
   * Identify drug from image
   */
  async identifyDrug(imageUrl: string): Promise<
    PhpApiResponse<{
      drugName: string
      confidence: number
      details: any
    }>
  > {
    return callPhpApi('/api/pharmacy-ai.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'identify_drug', image_url: imageUrl }),
    })
  },

  /**
   * Extract prescription data via OCR
   */
  async extractPrescription(imageUrl: string): Promise<
    PhpApiResponse<{
      drugs: Array<{ name: string; dosage: string; frequency: string }>
      confidence: number
    }>
  > {
    return callPhpApi('/api/pharmacy-ai.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'extract_prescription', image_url: imageUrl }),
    })
  },
}

/**
 * Inbox V2 Service - Vibe Selling OS features
 */
export const InboxV2Service = {
  /**
   * Process auto-reply for incoming message
   */
  async processAutoReply(params: {
    message: string
    userId: string
  }): Promise<PhpApiResponse<{ shouldReply: boolean; reply?: string }>> {
    return callPhpApi('/api/inbox-v2.php', {
      method: 'POST',
      body: JSON.stringify({
        action: 'process_auto_reply',
        message: params.message,
        user_id: params.userId,
      }),
    })
  },

  /**
   * Get ghost draft suggestion
   */
  async getGhostDraft(params: {
    conversationId: number
    context: any
  }): Promise<PhpApiResponse<{ draft: string; confidence: number }>> {
    return callPhpApi('/api/inbox-v2.php', {
      method: 'POST',
      body: JSON.stringify({
        action: 'ghost_draft',
        conversation_id: params.conversationId,
        context: params.context,
      }),
    })
  },

  /**
   * Triage conversation priority
   */
  async triageConversation(params: {
    conversationId: number
    message: string
  }): Promise<
    PhpApiResponse<{
      priority: 'low' | 'medium' | 'high' | 'urgent'
      hasRedFlag: boolean
      reason: string
    }>
  > {
    return callPhpApi('/api/inbox-v2.php', {
      method: 'POST',
      body: JSON.stringify({
        action: 'triage',
        conversation_id: params.conversationId,
        message: params.message,
      }),
    })
  },
}

/**
 * Order Service - Order management
 */
export const OrderService = {
  /**
   * Get customer orders
   */
  async getCustomerOrders(userId: string): Promise<
    PhpApiResponse<{
      orders: Array<{
        id: number
        orderNumber: string
        total: number
        status: string
        createdAt: string
      }>
    }>
  > {
    return callPhpApi(`/api/orders.php?action=list&user_id=${userId}`)
  },

  /**
   * Get order details
   */
  async getOrderDetails(orderId: number): Promise<PhpApiResponse<any>> {
    return callPhpApi(`/api/orders.php?action=details&order_id=${orderId}`)
  },

  /**
   * Create order from inbox
   */
  async createOrder(params: {
    userId: string
    items: Array<{ productId: number; quantity: number }>
    adminId: string
  }): Promise<PhpApiResponse<{ orderId: number; orderNumber: string }>> {
    return callPhpApi('/api/orders.php', {
      method: 'POST',
      body: JSON.stringify({
        action: 'create',
        user_id: params.userId,
        items: params.items,
        admin_id: params.adminId,
      }),
    })
  },
}

/**
 * Health Profile Service - Customer health information
 */
export const HealthProfileService = {
  /**
   * Get customer health profile
   */
  async getProfile(userId: string): Promise<
    PhpApiResponse<{
      allergies: string[]
      conditions: string[]
      currentMedications: string[]
      bloodType: string | null
    }>
  > {
    return callPhpApi(`/api/health-profile.php?user_id=${userId}`)
  },

  /**
   * Update health profile
   */
  async updateProfile(params: {
    userId: string
    allergies?: string[]
    conditions?: string[]
    currentMedications?: string[]
    bloodType?: string
  }): Promise<PhpApiResponse<{ success: boolean }>> {
    return callPhpApi('/api/health-profile.php', {
      method: 'POST',
      body: JSON.stringify({
        action: 'update',
        user_id: params.userId,
        ...params,
      }),
    })
  },
}

/**
 * Notification Service - Send notifications to admins
 */
export const NotificationService = {
  /**
   * Send Telegram notification to admin
   */
  async sendTelegram(params: {
    message: string
    adminId?: string
  }): Promise<PhpApiResponse<{ sent: boolean }>> {
    return callPhpApi('/api/notifications.php', {
      method: 'POST',
      body: JSON.stringify({
        action: 'telegram',
        message: params.message,
        admin_id: params.adminId,
      }),
    })
  },

  /**
   * Send red flag alert
   */
  async sendRedFlagAlert(params: {
    conversationId: number
    reason: string
  }): Promise<PhpApiResponse<{ sent: boolean }>> {
    return callPhpApi('/api/notifications.php', {
      method: 'POST',
      body: JSON.stringify({
        action: 'red_flag',
        conversation_id: params.conversationId,
        reason: params.reason,
      }),
    })
  },
}

/**
 * Odoo Slip Service - Forward payment slips to Odoo ERP
 */
export const OdooSlipService = {
  /**
   * Forward a payment slip image to Odoo.
   * Called by admin from inbox when they identify an image as a payment slip.
   */
  async forwardSlip(params: {
    lineUserId: string
    imageUrl: string
    lineAccountId?: number | null
    amount?: number
    transferDate?: string // YYYY-MM-DD
    invoiceId?: number
    orderId?: number
  }): Promise<
    PhpApiResponse<{
      slip_id: number | null
      slip_name: string | null
      status: string
      matched: boolean
      match_result: string | null
      matched_invoices: Array<{ id: number; number: string; amount: number }>
      amount: number | null
    }>
  > {
    return callPhpApi('/api/odoo-slip-upload.php', {
      method: 'POST',
      body: JSON.stringify({
        line_user_id: params.lineUserId,
        image_url: params.imageUrl,
        line_account_id: params.lineAccountId ?? undefined,
        skip_line_notify: true,
        ...(params.amount !== undefined && { amount: params.amount }),
        ...(params.transferDate && { transfer_date: params.transferDate }),
        ...(params.invoiceId && { invoice_id: params.invoiceId }),
        ...(params.orderId && { order_id: params.orderId }),
      }),
    })
  },
}

/**
 * Helper function to call PHP service with automatic error handling
 * Throws error if PHP service returns success: false
 */
export async function callPhpService<T>(
  service: string,
  action: string,
  params: Record<string, any> = {}
): Promise<T> {
  const response = await callPhpApi<T>(`/api/${service}.php`, {
    method: 'POST',
    body: JSON.stringify({
      action,
      ...params,
    }),
  })

  if (!response.success) {
    throw new PhpBridgeError(
      response.error || response.message || 'PHP service call failed'
    )
  }

  return response.data as T
}

