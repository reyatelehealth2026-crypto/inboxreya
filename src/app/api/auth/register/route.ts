import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  try {
    const { username, email, password, displayName } = await req.json()

    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      )
    }

    // Check if user exists
    const existingUser = await prisma.adminUser.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้งานแล้ว' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    // Note: In a real app, you might want to create a LINE account first or assign one later.
    // For now, we'll create a user without a lineAccountId or assign to the first available one.
    
    // Try to find default or first line account
    const lineAccount = await prisma.lineAccount.findFirst({
      where: { isActive: true },
      orderBy: { isDefault: 'desc' }
    })

    // Create the admin user
    await prisma.adminUser.create({
      data: {
        username,
        email,
        password: hashedPassword,
        displayName: displayName || username,
        role: 'admin', // Default role for self-registered users
        lineAccountId: lineAccount?.id, // Optional: assign to default line account if exists
        isActive: true,
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' },
      { status: 500 }
    )
  }
}
