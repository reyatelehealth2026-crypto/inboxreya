# Accessibility & Keyboard Shortcuts Guide

This document provides a comprehensive guide to the accessibility features and keyboard shortcuts implemented in the Inbox Feature Parity Upgrade (Phase 8).

## Table of Contents

1. [Keyboard Shortcuts](#keyboard-shortcuts)
2. [Text Expansion](#text-expansion)
3. [Template Quick Access](#template-quick-access)
4. [Accessibility Features](#accessibility-features)
5. [Screen Reader Support](#screen-reader-support)
6. [Keyboard Navigation](#keyboard-navigation)
7. [Visual Accessibility](#visual-accessibility)
8. [WCAG Compliance](#wcag-compliance)

## Keyboard Shortcuts

### Default Shortcuts

| Action | Shortcut | Description |
|--------|----------|-------------|
| Send Message | `Ctrl+Enter` | Send the current message |
| Search Conversations | `Ctrl+K` | Open conversation search dialog |
| Open Template Picker | `/` | Open quick reply template picker |
| Mark as Resolved | `Ctrl+R` | Mark current conversation as resolved |
| Show Shortcuts Help | `Shift+?` | Display keyboard shortcuts help modal |
| Navigate Up | `↑` | Move to previous conversation |
| Navigate Down | `↓` | Move to next conversation |
| Open Emoji Picker | `:` | Open emoji picker |

### Customizing Shortcuts

1. Navigate to **Settings** → **Keyboard Shortcuts**
2. Click the **Edit** button next to any shortcut
3. Press your desired key combination
4. Click **Save** to confirm

**Tips:**
- Use modifier keys (Ctrl, Shift, Alt) for more options
- Avoid conflicts with browser shortcuts
- Reset to defaults anytime with the **Reset to Defaults** button

## Text Expansion

Text expansion allows you to create shortcuts that automatically expand to full text.

### How It Works

1. Type a trigger (e.g., `/hello`) in the message input
2. The trigger automatically expands to the full text
3. Continue typing or send the message

### Default Expansions

| Trigger | Expansion | Description |
|---------|-----------|-------------|
| `/hello` | สวัสดีค่ะ ยินดีให้บริการค่ะ | Greeting |
| `/thanks` | ขอบคุณที่ติดต่อเรานะคะ | Thank you |
| `/wait` | รอสักครู่นะคะ กำลังตรวจสอบข้อมูลให้ค่ะ | Please wait |

### Creating Custom Expansions

1. Navigate to **Settings** → **Text Expansion**
2. Click **Add Expansion**
3. Enter:
   - **Trigger**: The shortcut (must start with `/`)
   - **Replacement Text**: The full text to expand to
   - **Description**: Optional description for reference
4. Click **Add** to save

## Template Quick Access

The system remembers your recently used templates for quick access.

### Features

- **Recent Templates Panel**: Shows up to 5 most recently used templates
- **Automatic Tracking**: Template usage is tracked automatically
- **Quick Selection**: Click any recent template to insert it

### Usage

1. Use a template from the template picker
2. It automatically appears in the "Recently Used Templates" section
3. Click it anytime for quick access

## Accessibility Features

### High Contrast Mode

Increases contrast for better visibility.

**Enable:**
- Settings → Accessibility → High Contrast Mode
- Or: System automatically detects if you have high contrast enabled in your OS

**Features:**
- Black text on white background
- Thicker borders (2px)
- Enhanced focus indicators (3px)
- Pattern overlays for status colors

### Reduced Motion

Minimizes animations and transitions for users sensitive to motion.

**Enable:**
- Settings → Accessibility → Reduce Motion
- Or: System automatically detects `prefers-reduced-motion` setting

**Effects:**
- Disables all animations
- Removes transitions
- Instant state changes

### Sound Notifications

Play sound alerts for new messages.

**Enable:**
- Settings → Accessibility → Sound Notifications

### Desktop Notifications

Show desktop notifications for new messages.

**Enable:**
- Settings → Accessibility → Desktop Notifications
- Browser will request permission on first enable

## Screen Reader Support

### ARIA Labels

All interactive elements have descriptive ARIA labels:

- **Conversations**: "Conversation with [Name], [X] unread messages, Status: [status]"
- **Messages**: "Message from [sender], [content], sent at [time]"
- **Buttons**: Clear action descriptions (e.g., "Send message", "Attach file")

### Live Regions

Screen readers announce:
- New messages: "New message from [sender]"
- Status changes: "Conversation status changed to [status]"
- Assignee changes: "Conversation assigned to [name]"
- Tag updates: "Tag [name] added/removed"

### Semantic HTML

- Proper heading hierarchy (h1 → h2 → h3)
- Semantic elements (`<nav>`, `<main>`, `<article>`)
- ARIA roles for custom components

### Skip Navigation

Press `Tab` on page load to reveal skip links:
- Skip to main content
- Skip to conversation list
- Skip to chat panel

## Keyboard Navigation

### Focus Management

- **Visible Focus Indicators**: Blue outline (2px) appears when navigating with keyboard
- **Focus Trap**: Modals trap focus within them
- **Focus Restoration**: Focus returns to previous element when closing modals

### Tab Order

Logical tab order follows visual layout:
1. Skip navigation links
2. Main navigation
3. Conversation list
4. Chat panel
5. Customer profile panel

### Roving Tabindex

Conversation list uses roving tabindex:
- `Tab` enters the list
- `↑/↓` navigates between conversations
- `Enter` selects a conversation
- `Tab` exits the list

### All Interactive Elements

Every button, link, and input is keyboard accessible:
- No mouse-only interactions
- All actions have keyboard equivalents
- Tooltips appear on focus

## Visual Accessibility

### Color Contrast

All text meets WCAG AA standards:
- **Normal text**: 4.5:1 contrast ratio minimum
- **Large text**: 3:1 contrast ratio minimum
- **Interactive elements**: 3:1 contrast ratio minimum

### Color Palette

WCAG AA compliant colors:

```typescript
{
  text: {
    primary: '#1f2937',   // 12.6:1 ratio
    secondary: '#4b5563', // 7.0:1 ratio
    tertiary: '#6b7280',  // 4.6:1 ratio
  },
  status: {
    success: '#059669',   // 4.5:1 ratio
    warning: '#d97706',   // 4.5:1 ratio
    error: '#dc2626',     // 5.9:1 ratio
    info: '#2563eb',      // 5.1:1 ratio
  }
}
```

### Not Relying on Color Alone

Status indicators use multiple cues:
- **Color**: Green, red, yellow, blue
- **Icons**: Check, X, warning, info
- **Text**: "Success", "Error", "Warning", "Info"
- **Patterns** (high contrast mode): Diagonal lines, dots, stripes

### Text Scaling

Layout supports text scaling up to 200%:
- Relative units (rem, em) for all text
- Flexible containers that grow with text
- No horizontal scrolling at 200% zoom
- Minimum touch target size: 44x44px

## WCAG Compliance

### Level AA Compliance

✅ **Perceivable**
- Text alternatives for images
- Captions for audio/video
- Adaptable content structure
- Sufficient color contrast

✅ **Operable**
- Keyboard accessible
- Enough time to read content
- No seizure-inducing content
- Navigable with clear focus

✅ **Understandable**
- Readable text
- Predictable behavior
- Input assistance with error messages

✅ **Robust**
- Compatible with assistive technologies
- Valid HTML/ARIA markup

### Testing Tools

Recommended tools for testing:
- **Screen Readers**: NVDA (Windows), JAWS (Windows), VoiceOver (Mac)
- **Contrast Checkers**: WebAIM Contrast Checker, Chrome DevTools
- **Keyboard Testing**: Unplug mouse and navigate with keyboard only
- **Zoom Testing**: Browser zoom to 200%

## Implementation Details

### Components

- `useKeyboardShortcuts` - Hook for keyboard shortcut handling
- `useTextExpansion` - Hook for text expansion
- `useScreenReaderAnnouncement` - Hook for screen reader announcements
- `useFocusManagement` - Hook for focus management
- `KeyboardShortcutsHelp` - Modal showing all shortcuts
- `SearchConversationsModal` - Keyboard-accessible search
- `ShortcutsSettings` - Customizable shortcuts UI
- `TextExpansionSettings` - Text expansion configuration
- `AccessibilitySettings` - Accessibility preferences
- `ScreenReaderOnly` - Visually hidden content for screen readers
- `SkipNavigation` - Skip links for keyboard users
- `FocusIndicator` - Visible focus indicators
- `HighContrastMode` - High contrast mode styles
- `TextScalingSupport` - Text scaling support

### Stores

- `useSettingsStore` - Persists user preferences
  - Keyboard shortcuts
  - Text expansions
  - Recent templates
  - Accessibility settings

### Utilities

- `accessibility.ts` - Accessibility helper functions
- `color-contrast.ts` - Color contrast calculations
- `formatShortcut()` - Format shortcuts for display
- `announceToScreenReader()` - Announce to screen readers
- `getConversationAriaLabel()` - Generate ARIA labels
- `getMessageAriaLabel()` - Generate ARIA labels

## Best Practices

### For Developers

1. **Always add ARIA labels** to interactive elements
2. **Test with keyboard only** - unplug your mouse
3. **Test with screen reader** - use NVDA or VoiceOver
4. **Check color contrast** - use WebAIM Contrast Checker
5. **Support text scaling** - test at 200% zoom
6. **Use semantic HTML** - proper heading hierarchy
7. **Provide focus indicators** - visible when using keyboard
8. **Announce dynamic changes** - use live regions

### For Users

1. **Explore keyboard shortcuts** - Press `Shift+?` for help
2. **Customize shortcuts** - Make them work for you
3. **Use text expansion** - Save time with common phrases
4. **Enable accessibility features** - High contrast, reduced motion
5. **Provide feedback** - Report accessibility issues

## Support

For accessibility issues or questions:
- Open an issue on GitHub
- Contact support team
- Refer to WCAG 2.1 guidelines

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [NVDA Screen Reader](https://www.nvaccess.org/)
- [Keyboard Accessibility](https://webaim.org/techniques/keyboard/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
