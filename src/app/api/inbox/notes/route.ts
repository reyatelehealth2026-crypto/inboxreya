import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

type NoteRecord = {
  id: number | bigint
  userId: number | bigint
  adminId: number | bigint | null
  content: string
  isPinned: boolean
  createdAt: Date
  updatedAt: Date
}

const formatAdmin = (
  admin: { id: number; displayName: string | null; avatarUrl: string | null } | null | undefined
) =>
  admin
    ? {
        id: admin.id.toString(),
        displayName: admin.displayName,
        avatarUrl: admin.avatarUrl,
      }
    : undefined

const toIdString = (value: number | bigint | null | undefined) => {
  if (value === null || value === undefined) return '0'
  return String(value)
}

const toNumberId = (value: number | bigint | null | undefined) => {
  if (value === null || value === undefined) return null
  const asNumber = typeof value === 'bigint' ? Number(value) : Number(value)
  return Number.isFinite(asNumber) ? asNumber : null
}

const formatNote = (
  note: NoteRecord,
  admin?: { id: number; displayName: string | null; avatarUrl: string | null } | null
) => ({
  id: toIdString(note.id),
  userId: toIdString(note.userId),
  adminId: toIdString(note.adminId),
  content: note.content,
  isPinned: note.isPinned,
  createdAt: note.createdAt.toISOString(),
  updatedAt: note.updatedAt.toISOString(),
  admin: formatAdmin(admin),
})

// Get notes for a user
export async function GET(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/93a2d762-e9a0-44b0-a3f0-f6fecdab7f7f', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'H1',
      location: 'notes/route.ts:GET:entry',
      message: 'GET notes entry',
      data: { url: request.url },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion agent log
  try {
    const session = await auth()
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/93a2d762-e9a0-44b0-a3f0-f6fecdab7f7f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H4',
        location: 'notes/route.ts:GET:after-auth',
        message: 'After auth check',
        data: { hasSession: !!session, hasUser: !!session?.user, userId: session?.user?.id },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion agent log
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/93a2d762-e9a0-44b0-a3f0-f6fecdab7f7f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H3',
        location: 'notes/route.ts:GET:userId-parse',
        message: 'UserId parsing',
        data: { userId, parsedUserId: Number(userId) },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion agent log

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const parsedUserId = Number(userId)
    if (!Number.isFinite(parsedUserId)) {
      return NextResponse.json({ error: 'userId must be a number' }, { status: 400 })
    }

    // Use user_notes table: id, user_id, note, created_by, created_at (ORDER BY user_id ASC per table; per user ORDER BY created_at DESC)
    let notes: NoteRecord[] = []
    try {
      const rows = await prisma.user_notes.findMany({
        where: { user_id: parsedUserId },
        orderBy: { created_at: 'desc' },
      })
      type UserNoteRow = { id: number; user_id: number; note: string | null; created_by: number | null; created_at: Date | null }
      notes = rows.map((row: UserNoteRow) => ({
        id: row.id,
        userId: row.user_id,
        adminId: row.created_by,
        content: row.note ?? '',
        isPinned: false,
        createdAt: row.created_at ?? new Date(),
        updatedAt: row.created_at ?? new Date(),
      }))
    } catch (error) {
      console.error('Failed to fetch notes from user_notes:', error)
      return NextResponse.json({ error: 'Failed to fetch notes (database error)' }, { status: 500 })
    }

    const adminIds = Array.from(
      new Set(notes.map((note) => toNumberId(note.adminId)).filter((id): id is number => id !== null))
    )
    type AdminInfo = { id: number; displayName: string | null; avatarUrl: string | null }
    const admins: AdminInfo[] = adminIds.length
      ? await prisma.adminUser.findMany({
          where: { id: { in: adminIds } },
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        })
      : []
    const adminById = new Map<number, AdminInfo>(admins.map((admin) => [admin.id, admin]))

    return NextResponse.json({
      data: notes.map((note) => {
        const adminId = toNumberId(note.adminId)
        const admin: AdminInfo | undefined = adminId !== null ? adminById.get(adminId) : undefined
        return formatNote(note, admin ?? null)
      }),
    })
  } catch (error) {
    console.error('Error fetching notes:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
    })
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/93a2d762-e9a0-44b0-a3f0-f6fecdab7f7f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H2',
        location: 'notes/route.ts:GET:catch',
        message: 'GET notes catch block',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          errorName: error instanceof Error ? error.name : typeof error,
          stack: error instanceof Error ? error.stack : undefined,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion agent log
    return NextResponse.json(
      { 
        error: 'Failed to fetch notes',
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      }, 
      { status: 500 }
    )
  }
}

// Create a new note
export async function POST(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/93a2d762-e9a0-44b0-a3f0-f6fecdab7f7f', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'H1',
      location: 'notes/route.ts:POST:entry',
      message: 'POST note entry',
      data: { url: request.url },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion agent log
  try {
    const session = await auth()
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/93a2d762-e9a0-44b0-a3f0-f6fecdab7f7f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H4',
        location: 'notes/route.ts:POST:after-auth',
        message: 'After auth check',
        data: { hasSession: !!session, hasUser: !!session?.user, userId: session?.user?.id },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion agent log
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, content, isPinned = false } = body

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/93a2d762-e9a0-44b0-a3f0-f6fecdab7f7f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H3',
        location: 'notes/route.ts:POST:body-parse',
        message: 'Body parsed',
        data: { userId, contentLength: content?.length, isPinned },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion agent log

    if (!userId || !content) {
      return NextResponse.json({ error: 'userId and content are required' }, { status: 400 })
    }

    const parsedUserId = Number(userId)
    if (!Number.isFinite(parsedUserId)) {
      console.error('Invalid userId:', { userId, parsedUserId })
      return NextResponse.json(
        { error: 'userId must be a valid number' },
        { status: 400 }
      )
    }
    
    // session.user.id might be a CUID string or numeric string
    // Try to parse as number first, if fails, look up admin by email/username
    let parsedAdminId = Number(session.user.id)
    
    if (!Number.isFinite(parsedAdminId)) {
      // session.user.id is not a number (likely CUID), look up admin by email
      try {
        const admin = await prisma.adminUser.findFirst({
          where: { 
            OR: [
              { email: session.user.email },
              { username: session.user.name || '' }
            ],
            isActive: true
          },
          select: { id: true }
        })
        
        if (!admin) {
          console.error('Admin not found for session:', { 
            email: session.user.email,
            name: session.user.name,
            sessionId: session.user.id
          })
          return NextResponse.json(
            { error: 'Admin user not found' },
            { status: 404 }
          )
        }
        
        parsedAdminId = admin.id
      } catch (lookupError) {
        console.error('Failed to lookup admin:', lookupError)
        return NextResponse.json(
          { error: 'Failed to identify admin user' },
          { status: 500 }
        )
      }
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/93a2d762-e9a0-44b0-a3f0-f6fecdab7f7f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H3',
        location: 'notes/route.ts:POST:id-parse',
        message: 'ID parsing',
        data: { 
          userId, 
          parsedUserId, 
          adminId: session.user.id,
          adminIdType: typeof session.user.id,
          parsedAdminId, 
          isFinite: Number.isFinite(parsedUserId) && Number.isFinite(parsedAdminId) 
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion agent log

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/93a2d762-e9a0-44b0-a3f0-f6fecdab7f7f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H1',
        location: 'notes/route.ts:POST:before-create',
        message: 'Before Prisma create',
        data: { parsedUserId, parsedAdminId, contentLength: content.length, isPinned },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion agent log
    
    // Verify admin exists before creating note (to provide better error message)
    const adminExists = await prisma.adminUser.findUnique({
      where: { id: parsedAdminId },
      select: { id: true },
    })
    if (!adminExists) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/93a2d762-e9a0-44b0-a3f0-f6fecdab7f7f', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'H2',
          location: 'notes/route.ts:POST:admin-not-found',
          message: 'Admin not found before note creation',
          data: { parsedAdminId },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion agent log
      return NextResponse.json(
        { error: 'Admin user not found' },
        { status: 404 }
      )
    }
    
    // Use user_notes table: user_id, note, created_by, created_at (no is_pinned)
    let note: NoteRecord
    try {
      const created = await prisma.user_notes.create({
        data: {
          user_id: parsedUserId,
          note: content,
          created_by: parsedAdminId,
        },
      })
      note = {
        id: created.id,
        userId: created.user_id,
        adminId: created.created_by,
        content: created.note ?? '',
        isPinned: false,
        createdAt: created.created_at ?? new Date(),
        updatedAt: created.created_at ?? new Date(),
      }
    } catch (createError) {
      console.error('Note creation failed:', createError)
      throw createError
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/93a2d762-e9a0-44b0-a3f0-f6fecdab7f7f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H1',
        location: 'notes/route.ts:POST:after-create',
        message: 'After Prisma create success',
        data: { noteId: note.id, noteAdminId: note.adminId },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion agent log
    let admin = null
    try {
      const adminId = toNumberId(note.adminId)
      if (adminId !== null) {
        admin = await prisma.adminUser.findUnique({
          where: { id: adminId },
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        })
      }
    } catch (adminError) {
      console.error('Admin lookup failed while creating note, continuing without admin info', adminError)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/93a2d762-e9a0-44b0-a3f0-f6fecdab7f7f', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'H1',
          location: 'notes/route.ts:POST:admin-lookup-error',
          message: 'Admin lookup failed, continuing without admin',
          data: {
            error: adminError instanceof Error ? adminError.message : 'Unknown error',
            adminId: note.adminId,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion agent log
      // Continue without admin info - note was created successfully
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/93a2d762-e9a0-44b0-a3f0-f6fecdab7f7f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H1',
        location: 'notes/route.ts:POST:after-admin-lookup',
        message: 'After admin lookup',
        data: { hasAdmin: !!admin, adminId: note.adminId },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion agent log

    return NextResponse.json(formatNote(note, admin))
  } catch (error) {
    console.error('Error creating note:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
    })
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/93a2d762-e9a0-44b0-a3f0-f6fecdab7f7f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H2',
        location: 'notes/route.ts:POST:catch',
        message: 'POST note catch block',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          errorName: error instanceof Error ? error.name : typeof error,
          stack: error instanceof Error ? error.stack : undefined,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion agent log
    return NextResponse.json(
      { 
        error: 'Failed to create note',
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      }, 
      { status: 500 }
    )
  }
}

// Update a note
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, content, isPinned } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const parsedId = Number(id)
    if (!Number.isFinite(parsedId)) {
      return NextResponse.json({ error: 'id must be a number' }, { status: 400 })
    }

    // Use user_notes table: only 'note' column can be updated (no is_pinned, updated_at)
    let note: NoteRecord
    try {
      const updated = await prisma.user_notes.update({
        where: { id: parsedId },
        data: content !== undefined ? { note: content } : {},
      })
      note = {
        id: updated.id,
        userId: updated.user_id,
        adminId: updated.created_by,
        content: updated.note ?? '',
        isPinned: false,
        createdAt: updated.created_at ?? new Date(),
        updatedAt: updated.created_at ?? new Date(),
      }
    } catch (updateError) {
      console.error('Error updating note:', updateError)
      throw updateError
    }
    
    let admin = null
    try {
      const adminId = toNumberId(note.adminId)
      if (adminId !== null) {
        admin = await prisma.adminUser.findUnique({
          where: { id: adminId },
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        })
      }
    } catch (adminError) {
      console.error('Admin lookup failed while updating note, continuing without admin info', adminError)
      // Continue without admin info
    }

    return NextResponse.json(formatNote(note, admin))
  } catch (error) {
    console.error('Error updating note:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

// Delete a note
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const parsedId = Number(id)
    if (!Number.isFinite(parsedId)) {
      return NextResponse.json({ error: 'id must be a number' }, { status: 400 })
    }

    try {
      await prisma.user_notes.delete({
        where: { id: parsedId },
      })
    } catch (deleteError) {
      console.error('Error deleting note from user_notes:', deleteError)
      throw deleteError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting note:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
