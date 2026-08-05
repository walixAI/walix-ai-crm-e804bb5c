import type * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

import { template as packageRequest } from './package-request.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'package-request': packageRequest,
}