import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PackageRequestForm } from "@/components/walix/PackageRequestForm";

export default function CreateAccount() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container max-w-3xl py-12 md:py-20">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> Volver al inicio
        </Link>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Crea una cuenta</h1>
        <p className="text-muted-foreground mt-2 mb-8">
          Déjanos tus datos y un asesor de Walix.ai te contactará para activar tu cuenta.
        </p>
        <PackageRequestForm />
        <p className="text-sm text-muted-foreground mt-6 text-center">
          ¿Ya tienes cuenta? <Link to="/login" className="text-primary font-medium hover:underline">Inicia sesión</Link>
        </p>
      </div>
    </main>
  );
}
