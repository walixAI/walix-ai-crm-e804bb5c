import type * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

import { template as packageRequest } from './package-request.tsx'
import { template as creditPackRequest } from './credit-pack-request.tsx'
import { template as teamInvite } from './team-invite.tsx'
import { template as walixNotification } from './walix-notification.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'package-request': packageRequest,
  'credit-pack-request': creditPackRequest,
  'team-invite': teamInvite,
  'walix-notification': walixNotification,
}