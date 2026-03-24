 import { NextResponse } from "next/server"
 import bcrypt from "bcryptjs"
 import { auth } from "@/lib/auth"
 import prisma from "@/lib/prisma"
 import { cacheQuery, cacheInvalidate, CACHE_TTL } from '@/lib/redis'
 
 async function resolveAdminId(session: { user?: { id?: string | null; email?: string | null } }) {
   const rawId = session.user?.id
   const parsedId = rawId ? Number(rawId) : NaN
   if (Number.isFinite(parsedId)) return parsedId
 
   if (session.user?.email) {
     const admin = await prisma.adminUser.findFirst({
       where: { email: session.user.email },
       select: { id: true },
     })
     return admin?.id ?? null
   }
 
   return null
 }
 
 export async function GET() {
   const session = await auth()
   if (!session?.user) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
   }
 
   const adminId = await resolveAdminId(session)
   if (!adminId) {
     return NextResponse.json({ error: "Admin user not found" }, { status: 404 })
   }
 
   const admin = await cacheQuery(
     `admin:me:${adminId}`,
     () => prisma.adminUser.findUnique({
       where: { id: adminId },
       select: {
         id: true,
         username: true,
         email: true,
         displayName: true,
         avatarUrl: true,
         role: true,
         phone: true,
         isActive: true,
       },
     }),
     CACHE_TTL.HEALTH  // 60s
   )
 
   if (!admin) {
     return NextResponse.json({ error: "Admin user not found" }, { status: 404 })
   }
 
   return NextResponse.json({ data: { ...admin, id: admin.id.toString() } })
 }
 
 export async function PATCH(request: Request) {
   const session = await auth()
   if (!session?.user) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
   }
 
   const adminId = await resolveAdminId(session)
   if (!adminId) {
     return NextResponse.json({ error: "Admin user not found" }, { status: 404 })
   }
 
   const body = await request.json()
   const displayName = typeof body.displayName === "string" ? body.displayName.trim() : undefined
   const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : undefined
   const password = typeof body.password === "string" ? body.password : undefined
 
   if (password && password.length < 6) {
     return NextResponse.json(
       { error: "Password must be at least 6 characters" },
       { status: 400 }
     )
   }
 
   const updateData: {
     displayName?: string | null
     avatarUrl?: string | null
     password?: string
   } = {}
 
   if (displayName !== undefined) {
     updateData.displayName = displayName || null
   }
   if (avatarUrl !== undefined) {
     updateData.avatarUrl = avatarUrl || null
   }
   if (password) {
     updateData.password = await bcrypt.hash(password, 10)
   }
 
   const updated = await prisma.adminUser.update({
     where: { id: adminId },
     data: updateData,
     select: {
       id: true,
       username: true,
       email: true,
       displayName: true,
       avatarUrl: true,
       role: true,
       phone: true,
       isActive: true,
     },
   })

   // Invalidate caches
   cacheInvalidate(`admin:me:${adminId}`).catch(() => null)
   cacheInvalidate(`admins:list:*`).catch(() => null)
 
   return NextResponse.json({ data: { ...updated, id: updated.id.toString() } })
 }
