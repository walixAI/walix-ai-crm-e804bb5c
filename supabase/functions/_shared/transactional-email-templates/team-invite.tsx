/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface TeamInviteProps {
  empresa?: string
  invitadoPor?: string
  rol?: string
  inviteUrl?: string
  expiraEl?: string
  logoUrl?: string
}

function iniciales(nombre: string) {
  const w = nombre.trim().split(/\s+/).filter(Boolean)
  if (w.length === 0) return 'W'
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase()
  return (w[0][0] + w[1][0]).toUpperCase()
}

export function TeamInviteEmail({
  empresa = 'tu equipo',
  invitadoPor = '',
  rol = 'miembro del equipo',
  inviteUrl = '#',
  expiraEl = '',
  logoUrl = '',
}: TeamInviteProps) {
  return (
    <Html>
      <Head />
      <Preview>Te invitaron a {empresa} en Walix.ai</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandRow}>
            {logoUrl ? (
              <Img src={logoUrl} alt={empresa} width="40" height="40" style={brandLogo} />
            ) : (
              <Text style={brandMono}>{iniciales(empresa)}</Text>
            )}
            <Text style={brandName}>{empresa}</Text>
          </Section>
          <Heading style={h1}>Te invitaron a {empresa}</Heading>
          <Text style={row}>
            {invitadoPor ? `${invitadoPor} te invitó` : 'Te invitaron'} a colaborar en el CRM de{' '}
            <b>{empresa}</b> con el rol de <b>{rol}</b>.
          </Text>
          <Section style={{ margin: '24px 0' }}>
            <Button href={inviteUrl} style={button}>Aceptar invitación</Button>
          </Section>
          <Text style={muted}>
            Si el botón no funciona, copia y pega este enlace:<br />{inviteUrl}
          </Text>
          {expiraEl ? <Text style={muted}>La invitación vence el {expiraEl}.</Text> : null}
          <Hr />
          <Text style={footer}>Walix.ai — CRM inteligente para equipos comerciales</Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: '#f6f7f9', fontFamily: 'Arial, sans-serif' }
const container = { backgroundColor: '#ffffff', padding: '28px', borderRadius: '12px', margin: '24px auto', maxWidth: '560px' }
const brandRow = { marginBottom: '16px' }
const brandLogo = { borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', objectFit: 'contain' as const, padding: '4px' }
const brandMono = { display: 'inline-block', width: '40px', height: '40px', lineHeight: '40px', textAlign: 'center' as const, borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '14px', fontWeight: 'bold' as const, margin: '0' }
const brandName = { color: '#64748b', fontSize: '12px', margin: '6px 0 0', letterSpacing: '0.4px', textTransform: 'uppercase' as const }
const h1 = { color: '#0f172a', fontSize: '20px', margin: '0 0 16px' }
const row = { color: '#334155', fontSize: '14px', margin: '6px 0', lineHeight: '22px' }
const muted = { color: '#64748b', fontSize: '12px', margin: '8px 0', wordBreak: 'break-all' as const }
const button = { backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 20px', borderRadius: '8px', fontSize: '14px', textDecoration: 'none' }
const footer = { color: '#94a3b8', fontSize: '12px' }

export const template = {
  component: TeamInviteEmail,
  displayName: 'Invitación al equipo',
  subject: (d: TeamInviteProps) => `Te invitaron a ${d?.empresa ?? 'un equipo'} en Walix.ai`,
  previewData: {
    empresa: 'Refrigeración G&R',
    invitadoPor: 'Erick Zendejas',
    rol: 'Administrador',
    inviteUrl: 'https://s1.walix.app/invitacion?token=demo',
    expiraEl: '12 de agosto de 2026',
    logoUrl: '',
  },
} satisfies TemplateEntry
