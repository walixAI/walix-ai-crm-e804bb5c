import { Card } from "@/components/ui/card";
import { ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";

const PROTECTIONS = [
  "Baja automática: si el contacto escribe «baja», «stop» o similar, se detienen sus campañas y el agente; con «alta» vuelve a quedar activo.",
  "Permiso del contacto: solo se envían campañas a contactos que escribieron primero, vinieron de un anuncio o formulario, o tienen permiso marcado por un asesor.",
  "Límite de plantillas: máximo 1 plantilla por lead cada 24 h, hasta 3 intentos sin respuesta y 30 envíos por asesor al día; una respuesta reinicia el contador.",
  "Freno por fallas: si los envíos fallan de forma repetida, la campaña se pausa para proteger el número.",
  "Subida gradual: los números nuevos empiezan con pocos envíos diarios y el tope sube con el tiempo.",
  "Semáforo de calidad: Walix vigila la calidad que Meta asigna al número y pausa el envío si baja.",
];

const META_RULES = [
  "Meta sanciona el número (reduce límites o lo desactiva) por calidad baja: bloqueos de usuarios, reportes de spam o mensajes no solicitados.",
  "El Administrador Comercial del cliente casi nunca se bloquea por mensajes; se restringe por políticas de comercio, suplantación o pagos rechazados.",
  "Fuera de la ventana de 24 h solo se pueden enviar plantillas aprobadas por Meta.",
  "Evita bases de datos compradas y no insistas después de un «no».",
];

export function WaProtectionInfoCard() {
  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Protección del número de WhatsApp</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Walix usa la API oficial de WhatsApp Business de Meta, el método más seguro para enviar mensajes a escala.
        Estas son las protecciones activas en tu cuenta y las reglas de Meta que debes conocer.
      </p>

      <div className="space-y-2">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-primary" /> Protecciones activas en Walix
        </h3>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          {PROTECTIONS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 text-warning" /> Reglas de Meta que debes conocer
        </h3>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          {META_RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground border-t pt-3">
        Recomendación: usa siempre consentimiento claro, pocos intentos espaciados y detén los mensajes ante cualquier rechazo o baja.
      </p>
    </Card>
  );
}
