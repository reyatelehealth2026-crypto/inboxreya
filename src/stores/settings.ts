import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  description: string
}

export interface KeyboardShortcuts {
  sendMessage: KeyboardShortcut
  searchConversations: KeyboardShortcut
  openTemplatePicker: KeyboardShortcut
  markAsResolved: KeyboardShortcut
  showShortcutsHelp: KeyboardShortcut
  navigateUp: KeyboardShortcut
  navigateDown: KeyboardShortcut
  openEmojiPicker: KeyboardShortcut
}

export interface TextExpansion {
  trigger: string
  replacement: string
  description?: string
}

interface SettingsState {
  // Preferences
  autoReplyEnabled: boolean
  ghostDraftEnabled: boolean
  slaThresholdMinutes: number
  notificationsEnabled: boolean
  soundEnabled: boolean

  // General settings
  autoAdvance: boolean
  defaultFilter: 'all' | 'unread' | 'assigned' | 'urgent' | 'starred'

  // Theme settings
  theme: 'light' | 'dark' | 'auto'
  language: 'th' | 'en' | 'zh' | 'ja'
  compactMode: boolean

  // Auto-refresh settings
  autoRefresh: boolean
  refreshInterval: number // seconds

  // Keyboard shortcuts
  shortcuts: KeyboardShortcuts

  // Text expansion
  textExpansions: TextExpansion[]

  // Template quick access
  recentTemplateIds: string[]
  maxRecentTemplates: number

  // Accessibility
  highContrastMode: boolean
  reducedMotion: boolean
  fontSize: 'small' | 'medium' | 'large' | 'xlarge'
  lineSpacing: number
  focusIndicators: boolean
  screenReaderOptimized: boolean

  // Notification settings
  emailNotifications: boolean
  pushNotifications: boolean
  notificationPriority: 'all' | 'assigned' | 'mentions' | 'urgent'
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  notificationVolume: number // 0-100

  // Data & Privacy
  dataCollection: boolean
  analyticsEnabled: boolean
  chatHistory: boolean
  autoDeleteOldData: boolean

  // Hydration tracking
  _hasHydrated: boolean

  // Actions
  updateSettings: (settings: Partial<Omit<SettingsState, 'shortcuts' | 'textExpansions' | 'recentTemplateIds' | 'updateSettings' | 'updateShortcut' | 'resetShortcuts' | 'addTextExpansion' | 'removeTextExpansion' | 'addRecentTemplate' | 'exportSettings' | 'importSettings' | 'clearCache' | 'deleteAllData' | '_hasHydrated' | 'setHasHydrated'>>) => void
  updateShortcut: (action: keyof KeyboardShortcuts, shortcut: KeyboardShortcut) => void
  resetShortcuts: () => void
  addTextExpansion: (expansion: TextExpansion) => void
  removeTextExpansion: (trigger: string) => void
  addRecentTemplate: (templateId: string) => void
  exportSettings: () => string
  importSettings: (data: string) => boolean
  clearCache: () => void
  deleteAllData: () => void
  setHasHydrated: (hydrated: boolean) => void
}

const defaultShortcuts: KeyboardShortcuts = {
  sendMessage: {
    key: 'Enter',
    ctrl: true,
    description: 'Send message',
  },
  searchConversations: {
    key: 'k',
    ctrl: true,
    description: 'Search conversations',
  },
  openTemplatePicker: {
    key: '/',
    description: 'Open template picker',
  },
  markAsResolved: {
    key: 'r',
    ctrl: true,
    description: 'Mark conversation as resolved',
  },
  showShortcutsHelp: {
    key: '?',
    shift: true,
    description: 'Show keyboard shortcuts help',
  },
  navigateUp: {
    key: 'ArrowUp',
    description: 'Navigate to previous conversation',
  },
  navigateDown: {
    key: 'ArrowDown',
    description: 'Navigate to next conversation',
  },
  openEmojiPicker: {
    key: ':',
    description: 'Open emoji picker',
  },
}

const defaultTextExpansions: TextExpansion[] = [
  {
    trigger: '/hello',
    replacement: 'สวัสดีค่ะ ยินดีให้บริการค่ะ',
    description: 'Greeting',
  },
  {
    trigger: '/thanks',
    replacement: 'ขอบคุณที่ติดต่อเรานะคะ',
    description: 'Thank you',
  },
  {
    trigger: '/wait',
    replacement: 'รอสักครู่นะคะ กำลังตรวจสอบข้อมูลให้ค่ะ',
    description: 'Please wait',
  },
]

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        autoReplyEnabled: true,
        ghostDraftEnabled: true,
        slaThresholdMinutes: 30,
        notificationsEnabled: true,
        soundEnabled: true,
        shortcuts: defaultShortcuts,
        textExpansions: defaultTextExpansions,
        recentTemplateIds: [],
        maxRecentTemplates: 5,
        highContrastMode: false,
        reducedMotion: false,

        // General defaults
        autoAdvance: false,
        defaultFilter: 'all',

        // Theme defaults
        theme: 'light',
        language: 'th',
        compactMode: false,

        // Auto-refresh defaults
        autoRefresh: true,
        refreshInterval: 30,

        // Accessibility defaults
        fontSize: 'medium',
        lineSpacing: 1.5,
        focusIndicators: true,
        screenReaderOptimized: false,

        // Notification defaults
        emailNotifications: false,
        pushNotifications: false,
        notificationPriority: 'all',
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        notificationVolume: 70,

        // Data & Privacy defaults
        dataCollection: true,
        analyticsEnabled: true,
        chatHistory: true,
        autoDeleteOldData: false,

        // Hydration tracking - starts as false until persist middleware hydrates
        _hasHydrated: false,
        setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }, false, 'setHasHydrated'),

        // Actions
        updateSettings: (settings) =>
          set(
            (state) => ({ ...state, ...settings }),
            false,
            'updateSettings'
          ),

        updateShortcut: (action, shortcut) =>
          set(
            (state) => ({
              shortcuts: {
                ...state.shortcuts,
                [action]: shortcut,
              },
            }),
            false,
            'updateShortcut'
          ),

        resetShortcuts: () =>
          set({ shortcuts: defaultShortcuts }, false, 'resetShortcuts'),

        addTextExpansion: (expansion) =>
          set(
            (state) => ({
              textExpansions: [...state.textExpansions, expansion],
            }),
            false,
            'addTextExpansion'
          ),

        removeTextExpansion: (trigger) =>
          set(
            (state) => ({
              textExpansions: state.textExpansions.filter(
                (e) => e.trigger !== trigger
              ),
            }),
            false,
            'removeTextExpansion'
          ),

        addRecentTemplate: (templateId) =>
          set(
            (state) => {
              const filtered = state.recentTemplateIds.filter(
                (id) => id !== templateId
              )
              const updated = [templateId, ...filtered].slice(
                0,
                state.maxRecentTemplates
              )
              return { recentTemplateIds: updated }
            },
            false,
            'addRecentTemplate'
          ),

        // Export settings to JSON string
        exportSettings: () => {
          const state = get()
          const exportData = {
            ...state,
            // Remove functions from export
            updateSettings: undefined,
            updateShortcut: undefined,
            resetShortcuts: undefined,
            addTextExpansion: undefined,
            removeTextExpansion: undefined,
            addRecentTemplate: undefined,
            exportSettings: undefined,
            importSettings: undefined,
            clearCache: undefined,
            deleteAllData: undefined,
          }
          return JSON.stringify(exportData, null, 2)
        },

        // Import settings from JSON string
        importSettings: (data: string) => {
          try {
            const parsed = JSON.parse(data)
            set(
              (state) => ({
                ...state,
                ...parsed,
                // Preserve functions
                updateSettings: state.updateSettings,
                updateShortcut: state.updateShortcut,
                resetShortcuts: state.resetShortcuts,
                addTextExpansion: state.addTextExpansion,
                removeTextExpansion: state.removeTextExpansion,
                addRecentTemplate: state.addRecentTemplate,
                exportSettings: state.exportSettings,
                importSettings: state.importSettings,
                clearCache: state.clearCache,
                deleteAllData: state.deleteAllData,
              }),
              false,
              'importSettings'
            )
            return true
          } catch (error) {
            console.error('Failed to import settings:', error)
            return false
          }
        },

        // Clear non-essential cache data
        clearCache: () => {
          // Clear all localStorage except settings
          const settingsData = localStorage.getItem('settings-store')
          const keysToKeep = ['settings-store']

          Object.keys(localStorage).forEach(key => {
            if (!keysToKeep.includes(key)) {
              localStorage.removeItem(key)
            }
          })
        },

        // Delete all data including settings
        deleteAllData: () => {
          localStorage.clear()
          sessionStorage.clear()
          // Reload to reset to defaults
          window.location.reload()
        },
      }),
      {
        name: 'settings-store',
        onRehydrateStorage: () => (state) => {
          state?.setHasHydrated(true)
        },
      }
    ),
    { name: 'SettingsStore' }
  )
)
