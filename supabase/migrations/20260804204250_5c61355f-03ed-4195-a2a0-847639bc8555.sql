UPDATE public.whatsapp_channels
SET tenant_id = NULL,
    is_platform = true,
    kind = 'team',
    label = 'Walix Bot (global)',
    display_name = 'Walix Bot',
    phone_number = '+525556539892',
    is_default = false,
    status = 'pending',
    last_error = NULL,
    position = 0
WHERE id = 'd365aad4-8fd2-4473-b2cf-8cea256f28cb';