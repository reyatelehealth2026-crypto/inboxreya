# Visual Guide: Real-time SSE Implementation (Tasks 4.1-4.7)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Browser                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              React Component (InboxPage)                    │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  useRealtime Hook                                     │  │ │
│  │  │  - Manages EventSource connection                     │  │ │
│  │  │  - Handles reconnection with exponential backoff      │  │ │
│  │  │  - Monitors heartbeat (45s timeout)                   │  │ │
│  │  │  - Dispatches events to handlers                      │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │                           │                                 │ │
│  │                           ▼                                 │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  Event Handlers                                       │  │ │
│  │  │  - onNewMessage → Invalidate queries, show notif     │  │ │
│  │  │  - onConversationUpdate → Invalidate conversations   │  │ │
│  │  │  - onTyping → Update typing users in store           │  │ │
│  │  │  - onReadReceipt → Invalidate messages               │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│                           │ EventSource                          │
│                           │ GET /api/inbox/realtime              │
│                           ▼                                      │
└─────────────────────────────────────────────────────────────────┘
                            │
     