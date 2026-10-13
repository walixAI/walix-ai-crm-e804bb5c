import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendTemplateEmail, type SendTemplateEmailOptions, type SendTemplateEmailResult } from './send-email.ts'
import { TEMPLATES } from './registry.ts'

// Sends a registered template and records the outcome in email_send_log
// (kept history table). A log failure never changes the send result.
export async function sendAndLog(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {},
): Promise<SendTemplateEmailResult> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const admin = url && key ? createClient(url, key) : null
  const recipient = TEMPLATES[templateName]?.to || to

  const log = async (row: Record<string, unknown>) => {
    if (!admin) return
    const { error } = await admin.from('email_send_log').insert({
      message_id: null,
      template_name: templateName,
      recipient_email: recipient,
      ...row,
    })
    if (error) console.error('email_send_log insert failed', { code: error.code, message: error.message })
  }

  try {
    const result = await sendTemplateEmail(templateName, to, options)
    await log({ status: result.sent ? 'sent' : 'suppressed' })
    return result
  } catch (e) {
    await log({ status: 'failed', error_message: String((e as Error)?.message ?? e).slice(0, 1000) })
    throw e
  }
}
