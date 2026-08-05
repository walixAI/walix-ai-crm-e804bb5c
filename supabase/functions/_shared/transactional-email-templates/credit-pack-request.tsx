/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface CreditPackRequestProps {
  nombre?: string
  email?: string
  telefono?: string
  paquete?: string
  tipo?: string
  cantidad?: string
  mensaje?: string
  tenant_id?: string
}

export function CreditPackRequestEmail({
  nombre = '—', email = '—', telefono = '—', paquete = '—',
  tipo = '—', cantidad = '1', mensaje = '', tenant_id = '—',
}: CreditPackRequestProps) {
  return (
    <Html>
      <Head />
      <Preview>Solicitud de paquete adicional: {paquete}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Solicitud de paquete adicional</Heading>
          <Section>
            <Text style={row}><b>Paquete:</b> {paquete} ({tipo})</Text>
            <Text style={row}><b>Cantidad:</b> {cantidad}</Text>
            <Text style={row}><b>Nombre:</b> {nombre}</Text>
            <Text style={row}><b>Email:</b> {email}</Text>
            <Text style={row}><b>Teléfono:</b> {telefono}</Text>
            <Text style={row}><b>Tenant:</b> {tenant_id}</Text>
          </Section>
          <Hr />
          <Text style={row}><b>Comentarios:</b></Text>
          <Text style={row}>{mensaje || 'Sin comentarios'}</Text>
          <Hr />
          <Text style={footer}>Enviado desde Facturación en Walix.ai</Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: '#f6f7f9', fontFamily: 'Arial, sans-serif' }
const container = { backgroundColor: '#ffffff', padding: '28px', borderRadius: '12px', margin: '24px auto', maxWidth: '560px' }
const h1 = { color: '#0f172a', fontSize: '20px', margin: '0 0 16px' }
const row = { color: '#334155', fontSize: '14px', margin: '6px 0' }
const footer = { color: '#94a3b8', fontSize: '12px' }

export const template = {
  component: CreditPackRequestEmail,
  displayName: 'Solicitud de paquete adicional',
  subject: (d: CreditPackRequestProps) => `Paquete adicional: ${d?.paquete ?? ''} — ${d?.nombre ?? ''}`.trim(),
  to: 'hola@walix.app',
  previewData: {
    nombre: 'Erick Z',
    email: 'erick@ejemplo.com',
    telefono: '+52 55 1234 5678',
    paquete: '500 créditos IA',
    tipo: 'Créditos de IA',
    cantidad: '2',
    mensaje: 'Lo necesitamos esta semana.',
    tenant_id: '6d0ad953',
  },
} satisfies TemplateEntry
