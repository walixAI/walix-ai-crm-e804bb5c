import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3.23.8'
import { sendAndLog } from '../_shared/transactional-email-templates/logged-send.ts'

// Signed-in users request credit packs; the template goes to Walix's fixed inbox.
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const opt = (n: number) => z.string().trim().max(n).optional().or(z.literal(''))
const Body = z.object({
  nombre: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  telefono: opt(30),
  cantidad: opt(20),
  mensaje: opt(1000),
  paquete: z.string().trim().min(1).max(120),
  tipo: z.string().trim().max(60),
  tenant_id: opt(60),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: auth } = await userClient.auth.getUser()
  if (!auth?.user) return json({ error: 'No autorizado' }, 401)
  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400)
  try {
    await sendAndLog('credit-pack-request', '', {
      templateData: parsed.data,
      replyTo: parsed.data.email,
    })
    return json({ success: true })
  } catch (e) {
    console.error('credit-pack-request send failed', (e as Error)?.message)
    return json({ error: 'No se pudo enviar' }, 500)
  }
})
