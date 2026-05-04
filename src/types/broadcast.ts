// Broadcast Types
export interface Broadcast {
  id: number
  lineAccountId: number
  content: string
  mediaUrl?: string | null
  flexContent?: FlexMessage | null
  targetSegmentId?: number | null
  scheduledAt?: string | null
  sentAt?: string | null
  totalRecipients: number
  deliveredCount: number
  readCount: number
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled'
  createdBy: number
  createdAt: string
  updatedAt: string
}

export interface BroadcastTemplate {
  id: number
  name: string
  description?: string
  content?: string
  flexContent?: FlexMessage
  mediaUrl?: string
  category: 'text' | 'flex' | 'image' | 'video'
  isActive: boolean
  createdAt: string
  sourceId?: number
  sourceTable?: 'quick_reply_templates' | 'flex_templates' | 'templates'
}

export interface FlexMessage {
  type: 'flex'
  altText: string
  contents: FlexBubble | FlexCarousel
}

export interface FlexBubble {
  type: 'bubble'
  size?: 'nano' | 'micro' | 'deca' | 'hecto' | 'kilo' | 'mega' | 'giga'
  hero?: FlexComponent
  header?: FlexBox
  body?: FlexBox
  footer?: FlexBox
}

export interface FlexCarousel {
  type: 'carousel'
  contents: FlexBubble[]
}

export type FlexComponent = FlexBox | FlexText | FlexImage | FlexButton | FlexSeparator | FlexSpacer | FlexFiller

export interface FlexBox {
  type: 'box'
  layout: 'vertical' | 'horizontal' | 'baseline'
  contents: FlexComponent[]
  spacing?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
  paddingAll?: string
  backgroundColor?: string
  alignItems?: 'start' | 'center' | 'end'
  justifyContent?: 'start' | 'center' | 'end' | 'spaceBetween' | 'spaceAround' | 'spaceEvenly'
  flex?: number
}

export interface FlexText {
  type: 'text'
  text: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | '3xl' | '4xl' | '5xl'
  weight?: 'regular' | 'bold'
  color?: string
  align?: 'start' | 'center' | 'end'
  wrap?: boolean
  margin?: string
  decoration?: 'none' | 'underline' | 'line-through'
  flex?: number
}

export interface FlexImage {
  type: 'image'
  url: string
  size?: string
  aspectRatio?: string
  aspectMode?: 'cover' | 'fit'
  margin?: string
  flex?: number
}

export interface FlexButton {
  type: 'button'
  action: {
    type: 'uri' | 'message' | 'postback'
    label: string
    uri?: string
    text?: string
    data?: string
  }
  style?: 'primary' | 'secondary' | 'link'
  color?: string
  height?: 'sm' | 'md' | 'lg'
  margin?: string
}

export interface FlexSeparator {
  type: 'separator'
  margin?: string
  color?: string
}

export interface FlexSpacer {
  type: 'spacer'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
}

export interface FlexFiller {
  type: 'filler'
}

export interface CreateBroadcastInput {
  content?: string
  mediaUrl?: string
  messageType?: 'text' | 'image' | 'video' | 'flex'
  flexContent?: FlexMessage
  /** Multiple flex messages bundled in a single LINE push (max 5). */
  flexContents?: FlexMessage[]
  templateId?: number
  templateSourceTable?: 'quick_reply_templates' | 'flex_templates' | 'templates'
  /** Source IDs of the templates picked when bundling multiple flexes. */
  templateIds?: number[]
  targetSegmentId?: number
  targetCustomerIds?: number[]
  targetTagIds?: number[]
  scheduledAt?: string
  /** Multiple scheduled dates. The API creates one broadcast record per date. */
  scheduledDates?: string[]
}

export interface BroadcastStats {
  totalBroadcasts: number
  sentToday: number
  scheduledCount: number
  avgSuccessRate: number
}
