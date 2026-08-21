/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface WalixNotificationProps {
  titulo?: string
  mensaje?: string
  ctaUrl?: string
  ctaLabel?: string
  empresa?: string
}

export function WalixNotificationEmail({
  titulo = 'Novedad en Walix',
  mensaje = '',
  ctaUrl = 'https://s1.walix.app/mi-dia',
  ctaLabel = 'Abrir en Walix',
  empresa = '',
}: WalixNotificationProps) {
  return (
    <Html>
      <Head />
      <Preview>{titulo}</Preview>
      <Body style={main}>
        <Container style={container}>
          {empresa ? <Text style={brandName}>{empresa}</Text> : null}
          <Heading style={h1}>{titulo}</Heading>
          <Text style={row}>{mensaje}</Text>
          <Section style={{ margin: '24px 0' }}>
            <Button href={ctaUrl} style={button}>{ctaLabel}</Button>
          </Section>
          <Text style={muted}>
            Recibes este correo porque activaste avisos por email en tu perfil de Walix.
          </Text>
          <Hr />
          <Text style={footer}>Walix.ai — CRM inteligente para equipos comerciales</Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: '#f6f7f9', fontFamily: 'Arial, sans-serif' }
const container = { backgroundColor: '#ffffff', padding: '28px', borderRadius: '12px', margin: '24px auto', maxWidth: '560px' }
const brandName = { color: '#64748b', fontSize: '12px', margin: '0 0 8px', letterSpacing: '0.4px', textTransform: 'uppercase' as const }
const h1 = { color: '#0f172a', fontSize: '20px', margin: '0 0 16px' }
const row = { color: '#334155', fontSize: '14px', margin: '6px 0', lineHeight: '22px' }
const muted = { color: '#64748b', fontSize: '12px', margin: '8px 0' }
const button = { backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 20px', borderRadius: '8px', fontSize: '14px', textDecoration: 'none' }
const footer = { color: '#94a3b8', fontSize: '12px' }

export const template = {
  component: WalixNotificationEmail,
  displayName: 'Aviso de Walix',
  subject: (d: WalixNotificationProps) => d?.titulo ?? 'Novedad en Walix',
  previewData: {
    titulo: 'Walix IA tiene una propuesta',
    mensaje: 'Llamar a Raquel Amiga — mantenimiento programado en 3 días.',
    ctaUrl: 'https://s1.walix.app/mi-dia?proposals=open',
    ctaLabel: 'Ver propuesta',
    empresa: 'Refrigeración G&R',
  },
} satisfies TemplateEntry
