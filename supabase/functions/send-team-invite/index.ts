import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3.23.8'
import { sendAndLog } from '../_shared/transactional-email-templates/logged-send.ts'

const ROLE_LABELS: Record<string, string> = {
  tenant_owner: 'Propietario',
  tenant_admin: 'Administrador',
  sales_manager: 'Gerente de ventas',
  sales_rep: 'Vendedor',
}

const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const Body = z.object({ invitationId: z.string().uuid() })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const authHeader = req.headers.get('Authorization') ?? ''
  const url = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: auth } = await userClient.auth.getUser()
  if (!auth?.user) return json({ error: 'No autorizado' }, 401)

  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400)

  // RLS: the caller can only read invitations of their own tenant.
  const { data: inv } = await userClient
    .from('invitations')
    .select('id, email, role, token, expires_at, tenant_id')
    .eq('id', parsed.data.invitationId)
    .maybeSingle()
  if (!inv?.token) return json({ error: 'Invitación no encontrada' }, 404)

  const [{ data: tenant }, { data: prof }] = await Promise.all([
    userClient.from('tenants').select('name, brand_name, logo_url').eq('id', inv.tenant_id).maybeSingle(),
    userClient.from('profiles').select('full_name').eq('id', auth.user.id).maybeSingle(),
  ])

  try {
    const result = await sendAndLog('team-invite', inv.email, {
      idempotencyKey: `invite-${inv.id}`,
      templateData: {
        empresa: (tenant as any)?.brand_name || (tenant as any)?.name || 'tu equipo',
        logoUrl: (tenant as any)?.logo_url ?? '',
        invitadoPor: (prof as any)?.full_name ?? '',
        rol: ROLE_LABELS[inv.role] ?? inv.role,
        inviteUrl: `https://s1.walix.app/invitacion?token=${inv.token}`,
        expiraEl: inv.expires_at
          ? new Date(inv.expires_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
          : '',
      },
    })
    return json({ success: result.sent })
  } catch (e) {
    console.error('team-invite send failed', (e as Error)?.message)
    return json({ error: 'No se pudo enviar' }, 500)
  }
})
