import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { uploadMediaOnly } from '@/lib/php-bridge'
import { sendFlexMessage, sendImageMessage, sendTextMessage } from '@/lib/line-api'

// Upload API endpoint for sending files/images to LINE
// Note: Vercel has a 4.5MB body size limit for serverless functions
// For larger files, consider using direct upload to external storage
export async function POST(request: NextRequest) {
  try {
    const getFileFlexMeta = (fileName: string) => {
      const extension = fileName.split('.').pop()?.toLowerCase() || ''
      const lowerName = fileName.toLowerCase()
      const orderNumberMatch = fileName.match(/\d{5,}/)
      const orderNumber = orderNumberMatch?.[0] || null
      const hasOrderKeyword =
        lowerName.includes('order') ||
        lowerName.includes('invoice') ||
        lowerName.includes('receipt') ||
        lowerName.includes('bill') ||
        lowerName.includes('ใบเสร็จ') ||
        lowerName.includes('บิล') ||
        lowerName.includes('ออเดอร์') ||
        lowerName.includes('เลขออเดอร์')

      if (extension === 'pdf') {
        return {
          title: hasOrderKeyword ? 'ใบเสร็จ/บิล' : 'เอกสาร PDF',
          subtitle: orderNumber ? `เลขออเดอร์: ${orderNumber}` : fileName,
          buttonLabel: 'ดาวน์โหลด PDF'
        }
      }

      if (extension === 'xlsx' || extension === 'xls') {
        return {
          title: 'เอกสารตาราง',
          subtitle: fileName,
          buttonLabel: 'ดาวน์โหลดไฟล์'
        }
      }

      if (extension === 'csv') {
        return {
          title: 'เอกสาร CSV',
          subtitle: fileName,
          buttonLabel: 'ดาวน์โหลดไฟล์'
        }
      }

      if (extension === 'doc' || extension === 'docx') {
        return {
          title: 'เอกสาร Word',
          subtitle: fileName,
          buttonLabel: 'ดาวน์โหลดไฟล์'
        }
      }

      return {
        title: 'ไฟล์แนบ',
        subtitle: fileName,
        buttonLabel: 'ดาวน์โหลดไฟล์'
      }
    }

    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    // Check file size (Vercel limit is ~4.5MB)
    if (file && file.size > 4 * 1024 * 1024) { // 4MB
      return NextResponse.json(
        {
          error: 'File too large',
          details: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds limit (4MB). Please use a smaller file or upload directly to external storage.`
        },
        { status: 413 }
      )
    }
    const lineUserId = formData.get('user_id') as string | null
    const internalUserId = formData.get('internal_user_id') as string | null
    const type = formData.get('type') as string | null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Always try to fetch lineUserId from database using internal user id (more reliable)
    let resolvedLineUserId: string | null = null
    if (internalUserId) {
      const parsedInternalId = parseInt(internalUserId, 10)
      if (!isNaN(parsedInternalId)) {
        const userForLineId = await prisma.lineUser.findUnique({
          where: { id: parsedInternalId },
          select: { lineUserId: true, displayName: true }
        })
        resolvedLineUserId = userForLineId?.lineUserId || null

        // Log for debugging
        if (!resolvedLineUserId) {
          console.warn(`[Upload] User ${parsedInternalId} (${userForLineId?.displayName}) has no lineUserId in database`)
        }
      }
    }

    // Fallback to provided lineUserId if database lookup failed
    if (!resolvedLineUserId && lineUserId) {
      resolvedLineUserId = lineUserId
    }

    if (!resolvedLineUserId) {
      console.error(`[Upload] Failed to resolve LINE User ID. internalUserId=${internalUserId}, lineUserId=${lineUserId}`)
      return NextResponse.json({
        error: 'ไม่พบ LINE User ID - ลูกค้านี้อาจยังไม่ได้เชื่อมต่อ LINE',
        details: 'User does not have a LINE User ID in the database. They may need to re-add the LINE account.'
      }, { status: 400 })
    }

    // After the check above, we know resolvedLineUserId is a string
    const lineUserIdToUse = resolvedLineUserId

    if (!type || !['image', 'file'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be "image" or "file"' },
        { status: 400 }
      )
    }

    // MIME type verification
    const contentType = file.type
    if (type === 'image' && !contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid MIME type for image' }, { status: 400 })
    }
    if (type === 'file') {
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]
      if (!allowedTypes.includes(contentType) && !contentType.startsWith('text/')) {
        return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
      }
    }

    // Get user info for LINE account
    let lineAccountId: number | null = null
    if (internalUserId) {
      const parsedUserId = parseInt(internalUserId, 10)
      if (!isNaN(parsedUserId)) {
        const user = await prisma.lineUser.findUnique({
          where: { id: parsedUserId },
          select: { id: true, lineAccountId: true }
        })
        lineAccountId = user?.lineAccountId || null
      }
    }

    // Send via Next.js LINE API directly
    let lineSendSuccess = false
    let finalMediaUrl: string | null = null

    // Strategy: Upload file to PHP server to get public URL, then send via Next.js LINE API
    const phpApiUrl =
      process.env.PHP_API_URL ||
      process.env.NEXT_PUBLIC_PHP_API_URL ||
      process.env.NEXT_PUBLIC_BASE_URL
    if (phpApiUrl) {
      try {
        // Step 1: Upload file to PHP server to get public URL (ไม่ส่งไป LINE)
        const uploadResult = await uploadMediaOnly({
          file: file,
          type: type as 'image' | 'file',
        })

        if (uploadResult.success && uploadResult.data?.mediaUrl) {
          finalMediaUrl = uploadResult.data.mediaUrl

          // Step 2: Send via Next.js LINE API using the PHP-hosted URL
          if (type === 'image') {
            const sendResult = await sendImageMessage(
              lineUserIdToUse,
              finalMediaUrl,
              lineAccountId
            )

            if (sendResult.success) {
              lineSendSuccess = true
              console.log('✅ Image uploaded to PHP and sent via Next.js LINE API:', { mediaUrl: finalMediaUrl })
            } else {
              console.warn('❌ Failed to send image via Next.js LINE API:', sendResult.error)
            }
          } else if (type === 'file') {
            const { title, subtitle, buttonLabel } = getFileFlexMeta(file.name)
            // Send as Flex message with download button
            const flexContents = {
              type: 'bubble',
              body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: [
                  {
                    type: 'text',
                    text: title,
                    weight: 'bold',
                    size: 'md',
                  },
                  {
                    type: 'text',
                    text: subtitle,
                    size: 'sm',
                    wrap: true,
                  }
                ]
              },
              footer: {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: [
                  {
                    type: 'button',
                    style: 'primary',
                    height: 'sm',
                    action: {
                      type: 'uri',
                      label: buttonLabel,
                      uri: finalMediaUrl,
                    }
                  }
                ]
              }
            }

            const sendResult = await sendFlexMessage(
              lineUserIdToUse,
              `${title}: ${file.name}`,
              flexContents,
              lineAccountId
            )

            if (sendResult.success) {
              lineSendSuccess = true
              console.log('✅ File uploaded and flex sent via LINE API:', { mediaUrl: finalMediaUrl, fileName: file.name })
            } else {
              console.warn('❌ Failed to send file flex via LINE API:', sendResult.error)
            }
          }
        } else {
          console.warn('❌ PHP API upload failed:', uploadResult.error)
        }
      } catch (error) {
        console.warn('❌ Error in upload/send process:', error)
      }
    }

    // Fallback: Send text notification if upload/send failed
    if (!lineSendSuccess) {
      try {
        const { sendTextMessage } = await import('@/lib/line-api')
        const notificationText = type === 'image'
          ? `📷 รูปภาพ: ${file.name}\n(ไม่สามารถส่งรูปภาพได้ - กรุณาตรวจสอบการตั้งค่า)`
          : `📎 ไฟล์แนบ: ${file.name}\n(ไม่สามารถส่งไฟล์ได้ - กรุณาตรวจสอบการตั้งค่า)`

        const sendResult = await sendTextMessage(
          lineUserIdToUse,
          notificationText,
          lineAccountId
        )
        lineSendSuccess = sendResult.success
      } catch (error) {
        console.error('Failed to send notification:', error)
      }
    }

    // Save message to database if we have internal user ID
    let savedMessage = null
    if (internalUserId) {
      const parsedUserId = parseInt(internalUserId, 10)
      if (!isNaN(parsedUserId)) {
        try {
          const user = await prisma.lineUser.findUnique({
            where: { id: parsedUserId },
            select: { id: true, lineAccountId: true }
          })

          if (user) {
            const now = new Date()

            savedMessage = await prisma.message.create({
              data: {
                userId: parsedUserId,
                lineAccountId: user.lineAccountId,
                direction: 'outgoing',
                messageType: type,
                content: type === 'image' ? '[รูปภาพ]' : file.name,
                mediaUrl: finalMediaUrl,
                sentBy: session.user.id ?? null,
                isRead: true,
                createdAt: now,
                updatedAt: now,
              }
            })

            // Update last interaction
            await prisma.lineUser.updateMany({
              where: { id: parsedUserId },
              data: { lastInteraction: new Date() }
            })
          }
        } catch (dbError) {
          console.error('Database save error:', dbError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        mediaUrl: finalMediaUrl,
        filename: file.name,
        type,
        lineSent: lineSendSuccess,
        messageId: savedMessage?.id?.toString() || null
      }
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
