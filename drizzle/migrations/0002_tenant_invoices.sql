CREATE TABLE public.tenant_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period date NOT NULL,
  folio text,
  uuid_fiscal text,
  subtotal numeric(12,2),
  tax numeric(12,2),
  total numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'MXN',
  status text NOT NULL DEFAULT 'paid',
  pdf_path text,
  xml_path text,
  issuer_name text,
  issuer_rfc text,
  receiver_name text,
  receiver_rfc text,
  concept text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period)
);

GRANT SELECT ON public.tenant_invoices TO authenticated;
GRANT ALL ON public.tenant_invoices TO service_role;

ALTER TABLE public.tenant_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read own invoices"
ON public.tenant_invoices FOR SELECT TO authenticated
USING (public.user_can_use_tenant(auth.uid(), tenant_id));
