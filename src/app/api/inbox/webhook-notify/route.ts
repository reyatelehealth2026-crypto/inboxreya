/**
 * Webhook Notification API
 * Called by PHP webhook.php when a new message is received from LINE
 * This triggers Pusher events for real-time updates
 */

import { NextRequest, NextResponse } from 'next/server'
import { broadcastNewMessage, broadcastConversationUpdate } from '@/lib/pusher'
import prisma from '@/lib/prisma'

// Simple API key validation (use INTERNAL_API_SECRET)
function validateRequest(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '')
  const expectedKey = process.env.INTERNAL_API_SECRET
  
  if (!expectedKey) {
    console.warn('INTERNAL_API_SECRET not configured')
    return false
  }
  
  return apiKey === expectedKey
}

export async function POST(request: NextRequest) {
  try {
    // Validate request
    if (!validateRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, data } = body

    switch (type) {
      case 'new_message': {
        const { conversationId, message } = data
        
        if (!conversationId || !message) {
          return NextResponse.json({ error: 'Missing conversationId or message' }, { status: 400 })
        }

        // Auto-reopen resolved conversations when customer sends a new message
        if (message.direction === 'incoming') {
          try {
            const conversation = await prisma.lineUser.findUnique({
              where: { id: Number(conversationId) },
              select: { chatStatus: true, lineAccountId: true },
            })

            if (conversation && conversation.chatStatus === 'resolved') {
              // Reopen the conversation
              await prisma.lineUser.update({
                where: { id: Number(conversationId) },
                data: {
                  chatStatus: 'new',
                  lastInteraction: new Date(),
                },
              })

              // Log the auto-reopen
              await prisma.activity_logs.create({
                data: {
                  log_type: 'conversation',
                  action: 'status_change',
                  description: 'Auto-reopened due to new customer message',
                  entity_type: 'conversation',
                  entity_id: Number(conversationId),
                  old_value: 'resolved',
                  new_value: 'new',
                  line_account_id: conversation.lineAccountId,
                },
              })

              // Broadcast status change
              await broadcastConversationUpdate({
                conversationId: String(conversationId),
                updates: {
                  status: 'new',
                },
              })
            }
          } catch (error) {
            console.error('Error auto-reopening conversation:', error)
            // Don't fail the webhook if auto-reopen fails
          }
        }

        // Broadcast new message via Pusher
        await broadcastNewMessage({
          conversationId: String(conversationId),
          message: {
            id: String(message.id),
            userId: String(message.userId || conversationId),
            direction: message.direction || 'incoming',
            messageType: message.messageType || 'text',
            content: message.content || null,
            mediaUrl: message.mediaUrl || null,
            createdAt: message.createdAt || new Date().toISOString(),
            sentBy: message.sentBy || null,
          },
        })

        // Also broadcast conversation update for unread count
        await broadcastConversationUpdate({
          conversationId: String(conversationId),
          updates: {
            lastMessage: message,
            unreadCount: message.direction === 'incoming' ? 1 : 0, // Will be accumulated on client
          },
        })

        return NextResponse.json({ success: true, event: 'new_message' })
      }

      case 'conversation_update': {
        const { conversationId, updates } = data
        
        if (!conversationId) {
          return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 })
        }

        await broadcastConversationUpdate({
          conversationId: String(conversationId),
          updates: updates || {},
        })

        return NextResponse.json({ success: true, event: 'conversation_update' })
      }

      default:
        return NextResponse.json({ error: `Unknown event type: ${type}` }, { status: 400 })
    }
  } catch (error) {
    console.error('Webhook notify error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}

// Allow GET for health check
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    service: 'webhook-notify',
    pusherConfigured: !!process.env.PUSHER_APP_ID,
  })
}
