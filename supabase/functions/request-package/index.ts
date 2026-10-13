import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3.23.8'
import { sendAndLog } from '../_shared/transactional-email-templates/logged-send.ts'

// Public form: the template always goes to Walix's fixed inbox.
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const opt = (n: number) => z.string().trim().max(n).optional().or(z.literal(''))
const Body = z.object({
  nombre: z.string().trim().min(1).max(100),
  empresa: opt(120),
  email: z.string().trim().email().max(255),
  telefono: opt(30),
  paquete: z.string().trim().min(1).max(60),
  mensaje: opt(1000),
})

const hits = new Map<string, number[]>()
function limited(ip: string) {
  const now = Date.now()
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000)
  list.push(now)
  hits.set(ip, list)
  return list.length > 5
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (limited(ip)) return json({ error: 'Demasiadas solicitudes' }, 429)
  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400)
  try {
    await sendAndLog('package-request', '', {
      templateData: parsed.data,
      replyTo: parsed.data.email,
    })
    return json({ success: true })
  } catch (e) {
    console.error('package-request send failed', (e as Error)?.message)
    return json({ error: 'No se pudo enviar' }, 500)
  }
})
