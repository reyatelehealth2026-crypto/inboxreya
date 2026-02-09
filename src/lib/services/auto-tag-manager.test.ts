import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AutoTagManager } from './auto-tag-manager'
import prisma from '@/lib/prisma'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
    default: {
        autoTagRule: {
            findMany: vi.fn(),
        },
        lineUser: {
            findUnique: vi.fn(),
        },
        userTagAssignment: {
            upsert: vi.fn(),
        },
    },
}))

describe('AutoTagManager', () => {
    let manager: AutoTagManager
    const mockLineAccountId = 1
    const mockUserId = 123

    beforeEach(() => {
        manager = new AutoTagManager(mockLineAccountId)
        vi.clearAllMocks()
    })

    it('should assign tag when message contains keyword', async () => {
        // 1. Mock Rules
        const mockRules = [
            {
                id: 1,
                tagId: 10,
                triggerType: 'on_message',
                conditions: JSON.stringify([
                    { field: 'message_content', operator: 'contains', value: 'hello' }
                ]),
                isActive: true,
            },
        ]
            ; (prisma.autoTagRule.findMany as any).mockResolvedValue(mockRules)

            // 2. Mock User
            ; (prisma.lineUser.findUnique as any).mockResolvedValue({
                id: mockUserId,
                lineAccountId: mockLineAccountId,
            })

        // 3. Act
        await manager.onMessage(mockUserId, 'Hello world')

        // 4. Assert
        expect(prisma.userTagAssignment.upsert).toHaveBeenCalledWith({
            where: { userId_tagId: { userId: mockUserId, tagId: 10 } },
            create: expect.objectContaining({ userId: mockUserId, tagId: 10, assignedBy: 'auto' }),
            update: expect.any(Object),
        })
    })

    it('should NOT assign tag when message does not match', async () => {
        // 1. Mock Rules
        const mockRules = [
            {
                id: 1,
                tagId: 10,
                triggerType: 'on_message',
                conditions: JSON.stringify([
                    { field: 'message_content', operator: 'contains', value: 'buy' }
                ]),
                isActive: true,
            },
        ]
            ; (prisma.autoTagRule.findMany as any).mockResolvedValue(mockRules)
            ; (prisma.lineUser.findUnique as any).mockResolvedValue({ id: mockUserId })

        // 2. Act
        await manager.onMessage(mockUserId, 'Hello world')

        // 3. Assert
        expect(prisma.userTagAssignment.upsert).not.toHaveBeenCalled()
    })
})
