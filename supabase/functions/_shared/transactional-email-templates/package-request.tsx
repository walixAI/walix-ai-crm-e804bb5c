/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface PackageRequestProps {
  nombre?: string
  empresa?: string
  email?: string
  telefono?: string
  paquete?: string
  mensaje?: string
}

export function PackageRequestEmail({
  nombre = '—',
  empresa = '—',
  email = '—',
  telefono = '—',
  paquete = '—',
  mensaje = '',
}: PackageRequestProps) {
  return (
    <Html>
      <Head />
      <Preview>Nueva solicitud de paquete: {paquete}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Nueva solicitud de paquete</Heading>
          <Section>
            <Text style={row}><b>Paquete de interés:</b> {paquete}</Text>
            <Text style={row}><b>Nombre:</b> {nombre}</Text>
            <Text style={row}><b>Empresa:</b> {empresa}</Text>
            <Text style={row}><b>Email:</b> {email}</Text>
            <Text style={row}><b>Teléfono:</b> {telefono}</Text>
          </Section>
          <Hr />
          <Text style={row}><b>Mensaje:</b></Text>
          <Text style={row}>{mensaje || 'Sin mensaje'}</Text>
          <Hr />
          <Text style={footer}>Enviado desde el sitio de Walix.ai</Text>
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
  component: PackageRequestEmail,
  displayName: 'Solicitud de paquete',
  subject: (d: PackageRequestProps) => `Solicitud de paquete ${d?.paquete ?? ''} — ${d?.empresa ?? d?.nombre ?? ''}`.trim(),
  to: 'hola@walix.app',
  previewData: {
    nombre: 'Erick Z',
    empresa: 'Refrigeración G&R',
    email: 'erick@ejemplo.com',
    telefono: '+52 55 1234 5678',
    paquete: 'Growth',
    mensaje: 'Quiero más información sobre el paquete.',
  },
} satisfies TemplateEntry