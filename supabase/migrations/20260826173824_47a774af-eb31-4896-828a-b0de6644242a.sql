CREATE OR REPLACE FUNCTION public.trg_seed_deal_diagnostics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.deal_blockers (tenant_id, label, description, default_resolution_days, position)
  SELECT NEW.id, v.label, v.description, v.days, v.pos
  FROM (VALUES
    ('Evaluando otros proveedores', 'Está comparando nuestra propuesta contra la competencia', 7, 1),
    ('Esperando aprobación interna', 'Necesita el visto bueno de su jefe o de otra área', 7, 2),
    ('Esperando presupuesto', 'No tiene recursos liberados todavía', 15, 3),
    ('Revisando la propuesta técnica', 'Está validando alcance, especificaciones o compatibilidad', 5, 4),
    ('Pidió contactarlo después', 'No es el momento, solicitó posponer la conversación', 15, 5),
    ('Precio en revisión', 'Le pareció alto o pidió descuento y está en negociación', 5, 6)
  ) AS v(label, description, days, pos)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.deal_blockers b WHERE b.tenant_id = NEW.id AND b.label = v.label
  );

  INSERT INTO public.deal_loss_reasons (tenant_id, label, description, position)
  SELECT NEW.id, v.label, v.description, v.pos
  FROM (VALUES
    ('Precio alto', 'Nuestro precio quedó fuera de lo que estaba dispuesto a pagar', 1),
    ('No cubre su necesidad', 'El producto o servicio no resuelve lo que buscaba', 2),
    ('Compró con la competencia', 'Eligió a otro proveedor', 3),
    ('Sin presupuesto', 'No tiene ni tendrá recursos en el corto plazo', 4),
    ('Ya no responde', 'Dejó de contestar y no fue posible retomar el contacto', 5),
    ('Ya no es el momento', 'Pospuso la decisión indefinidamente', 6)
  ) AS v(label, description, pos)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.deal_loss_reasons r WHERE r.tenant_id = NEW.id AND r.label = v.label
  );

  RETURN NEW;
END;
$$;