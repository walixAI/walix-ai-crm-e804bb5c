/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface TeamInviteProps {
  empresa?: string
  invitadoPor?: string
  rol?: string
  inviteUrl?: string
  expiraEl?: string
}

export function TeamInviteEmail({
  empresa = 'tu equipo',
  invitadoPor = '',
  rol = 'miembro del equipo',
  inviteUrl = '#',
  expiraEl = '',
}: TeamInviteProps) {
  return (
    <Html>
      <Head />
      <Preview>Te invitaron a {empresa} en Walix.ai</Preview>
      <Body style={main}>
        <Container style={container}>
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
  },
} satisfies TemplateEntry
