/**
 * Sidebar Component
 * Main navigation sidebar with collapsible menu groups
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Home,
  BarChart3,
  MessageSquare,
  Users,
  Settings,
  FileText,
  Tags,
  Layers,
  MessagesSquare,
  UserCog,
  Link2,
  Package,
  Briefcase,
  Send,
  ShoppingBag,
  Tag,
  Receipt,
  CalendarDays,
  Sparkles,
  Bot,
} from 'lucide-react';

interface MenuItem {
  title: string;
  icon: React.ReactNode;
  href: string;
  badge?: number;
  // ปลายทางออกนอกแอป (route ที่ 302 ไปอีกโดเมน) — ต้องใช้ <a> ธรรมดา เพราะ
  // <Link> จะ navigate ฝั่ง client แล้วไปติด CORS ก่อนถอยมาโหลดเต็มหน้าอยู่ดี
  external?: boolean;
}

interface MenuGroup {
  groupId: string;
  groupTitle: string;
  groupIcon: string;
  menus: MenuItem[];
}

interface SidebarProps {
  className?: string;
}

// โดเมนหน้าบ้านขายส่ง — ฝังตรงนี้เลยไม่ผ่าน env เพราะ Sidebar เป็น client component
// การทำให้อ่าน env ได้ต้องใช้ NEXT_PUBLIC_* ซึ่งต้องมีตั้งแต่ตอน build (ต้องเพิ่ม
// build-arg ใน Dockerfile อีก) ไม่คุ้มกับลิงก์เมนูอันเดียว
// ฝั่งหลังบ้านไม่ต้องฝัง เพราะวิ่งผ่าน /api/admin/wholesale-sso ที่อ่าน env ฝั่ง server
const WHOLESALE_STOREFRONT_URL = 'https://wholesale.re-ya.com'

// ปักหมุดไว้เหนือทุกกลุ่ม — ทีมเปิดดูทุกวันจนไม่ควรต้องไล่หาในกลุ่มที่พับอยู่
const PINNED_MENU: MenuItem = {
  title: 'สรุปสลิปที่ตรวจ',
  icon: <Receipt className="h-4 w-4" />,
  href: '/inbox/slip-report',
};

const menuGroups: MenuGroup[] = [
  {
    groupId: 'wholesale',
    groupTitle: 'ระบบขายส่ง',
    groupIcon: '🏪',
    menus: [
      // เข้าหลังบ้านโดยไม่ต้องล็อกอินซ้ำ — route ปั้น token แล้ว 302 ออกไป
      { title: 'หลังบ้านขายส่ง', icon: <Package className="h-4 w-4" />, href: '/api/admin/wholesale-sso', external: true },
      { title: 'หน้าบ้านขายส่ง', icon: <ShoppingBag className="h-4 w-4" />, href: WHOLESALE_STOREFRONT_URL, external: true },
    ],
  },
  {
    groupId: 'overview',
    groupTitle: 'ภาพรวม',
    groupIcon: '📊',
    menus: [
      { title: 'หน้าแรก', icon: <Home className="h-4 w-4" />, href: '/dashboard' },
      { title: 'งานของฉัน', icon: <Briefcase className="h-4 w-4" />, href: '/dashboard/my-work' },
      { title: 'Admin Dashboard', icon: <UserCog className="h-4 w-4" />, href: '/dashboard/admin' },
      { title: 'Customer Dashboard', icon: <Users className="h-4 w-4" />, href: '/dashboard/customers' },
    ],
  },
  {
    groupId: 'conversations',
    groupTitle: 'การสนทนา',
    groupIcon: '💬',
    menus: [
      { title: 'กล่องข้อความ', icon: <MessageSquare className="h-4 w-4" />, href: '/inbox' },
      { title: 'แชทกลุ่ม', icon: <MessagesSquare className="h-4 w-4" />, href: '/inbox/groups' },
      { title: 'Broadcast', icon: <Send className="h-4 w-4" />, href: '/inbox/broadcasts' },
      { title: 'AI Agent', icon: <Bot className="h-4 w-4" />, href: '/ai-agent' },
      { title: 'แคตตาล็อค & โปรโมชัน', icon: <ShoppingBag className="h-4 w-4" />, href: '/inbox/promotions' },
      { title: 'ปฏิทินการส่ง', icon: <CalendarDays className="h-4 w-4" />, href: '/inbox/calendar' },
      { title: 'Slip Center', icon: <Receipt className="h-4 w-4" />, href: '/dashboard/slip-center' },
    ],
  },
  {
    groupId: 'automation',
    groupTitle: 'ระบบอัตโนมัติ',
    groupIcon: '🤖',
    menus: [
      { title: 'Quick Reply', icon: <FileText className="h-4 w-4" />, href: '/inbox/templates' },
      { title: 'Auto Reply Rules', icon: <BarChart3 className="h-4 w-4" />, href: '/inbox/auto-reply-rules' },
      { title: 'Auto Tags', icon: <Tags className="h-4 w-4" />, href: '/inbox/auto-tags' },
    ],
  },
  {
    groupId: 'customers',
    groupTitle: 'ลูกค้า',
    groupIcon: '👥',
    menus: [
      { title: 'Segments', icon: <Layers className="h-4 w-4" />, href: '/inbox/segments' },
    ],
  },
  {
    groupId: 'settings',
    groupTitle: 'ตั้งค่า',
    groupIcon: '⚙️',
    menus: [
      { title: 'ตั้งค่าทั่วไป', icon: <Settings className="h-4 w-4" />, href: '/inbox/settings' },
      { title: 'การเชื่อมต่อแพลตฟอร์ม', icon: <Link2 className="h-4 w-4" />, href: '/inbox/settings?tab=integrations' },
      { title: 'AI Control', icon: <Sparkles className="h-4 w-4" />, href: '/admin/ai-control' },
    ],
  },
];

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  // กาง 'wholesale' ไว้ด้วยตั้งแต่แรก ไม่งั้นลิงก์ข้ามระบบจะจมอยู่ในกลุ่มที่พับอยู่
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['wholesale', 'overview', 'conversations']);
  const pathname = usePathname();

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed');
      if (saved === 'true') {
        setCollapsed(true);
      }
    }
  }, []);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const isActive = (href: string) => {
    return pathname === href || Boolean(pathname?.startsWith(href + '/'));
  };

  // Store collapsed state in localStorage
  const handleToggleCollapse = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar-collapsed', String(newState));
      // Dispatch custom event for layout to listen
      window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: { collapsed: newState } }));
    }
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-30 h-screen border-r bg-white transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white font-bold">
              I
            </div>
            <span className="font-semibold text-lg">Inbox</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleCollapse}
          className="h-8 w-8"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Menu Groups */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        <Link
          href={PINNED_MENU.href}
          title={PINNED_MENU.title}
          className={cn(
            'mb-2 flex items-center rounded-lg border transition-colors',
            collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2',
            isActive(PINNED_MENU.href)
              ? 'border-green-600 bg-green-600 text-white shadow-sm'
              : 'border-green-300 bg-green-50 font-semibold text-green-800 hover:bg-green-100'
          )}
        >
          {PINNED_MENU.icon}
          {!collapsed && <span className="flex-1 text-sm">{PINNED_MENU.title}</span>}
        </Link>

        {menuGroups.map((group) => {
          const isExpanded = expandedGroups.includes(group.groupId);

          return (
            <div key={group.groupId} className="">
              {/* Group Header */}
              <button
                onClick={() => !collapsed && toggleGroup(group.groupId)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  'hover:bg-gray-100',
                  collapsed && 'justify-center'
                )}
              >
                <span className="text-lg">{group.groupIcon}</span>
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left whitespace-nowrap">{group.groupTitle}</span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </>
                )}
              </button>

              {/* Menu Items */}
              {(!collapsed && isExpanded) && (
                <div className="mt-1 space-y-1 pl-2">
                  {group.menus.map((menu) => {
                    const Anchor = menu.external ? 'a' : Link;
                    return (
                    <Anchor
                      key={menu.href}
                      href={menu.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        isActive(menu.href)
                          ? 'bg-green-50 text-green-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      {menu.icon}
                      <span className="flex-1">{menu.title}</span>
                      {menu.badge && menu.badge > 0 && (
                        <Badge variant="default" className="h-5 min-w-[20px] px-1">
                          {menu.badge}
                        </Badge>
                      )}
                    </Anchor>
                    );
                  })}
                </div>
              )}

              {/* Collapsed view - show icon only */}
              {collapsed && (
                <div className="mt-1 space-y-1">
                  {group.menus.map((menu) => {
                    const Anchor = menu.external ? 'a' : Link;
                    return (
                    <Anchor
                      key={menu.href}
                      href={menu.href}
                      className={cn(
                        'flex items-center justify-center rounded-lg p-2 transition-colors',
                        isActive(menu.href)
                          ? 'bg-green-50 text-green-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                      title={menu.title}
                    >
                      {menu.icon}
                    </Anchor>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
