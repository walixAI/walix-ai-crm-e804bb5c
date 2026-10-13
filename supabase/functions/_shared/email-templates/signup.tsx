/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirma tu email para empezar con {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{siteName}</Text>
        <Heading style={h1}>Confirma tu cuenta</Heading>
        <Text style={text}>
          ¡Gracias por unirte a{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          ! Estás a un clic de empezar a gestionar tus conversaciones de WhatsApp y tu CRM con IA.
        </Text>
        <Text style={text}>
          Confirma tu correo (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) para activar tu cuenta:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar mi cuenta
        </Button>
        <Text style={footer}>
          Si no creaste esta cuenta, puedes ignorar este mensaje sin problema.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brand = { fontSize: '13px', fontWeight: 'bold' as const, color: 'hsl(239, 84%, 60%)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, margin: '0 0 16px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: 'hsl(215, 28%, 17%)', margin: '0 0 20px', lineHeight: '1.3' }
const text = { fontSize: '15px', color: 'hsl(215, 16%, 47%)', lineHeight: '1.6', margin: '0 0 24px' }
const link = { color: 'hsl(239, 84%, 60%)', textDecoration: 'underline' }
const button = { backgroundColor: 'hsl(239, 84%, 60%)', color: '#ffffff', fontSize: '15px', fontWeight: 'bold' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '13px', color: 'hsl(215, 16%, 47%)', margin: '32px 0 0', paddingTop: '24px', borderTop: '1px solid hsl(214, 32%, 91%)' }
