"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithMagicLink, type AuthFormState } from "@/server/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    signInWithMagicLink,
    {},
  );

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Requirements Forge</CardTitle>
          <CardDescription>
            Te enviaremos un enlace mágico a tu correo. No necesitas contraseña.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="tu@empresa.com"
                required
                autoComplete="email"
                disabled={pending}
              />
            </div>

            {state.error ? (
              <p className="text-sm text-destructive" role="alert">
                {state.error}
              </p>
            ) : null}
            {state.success ? (
              <p className="text-sm text-emerald-600" role="status">
                {state.success}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Enviando…" : "Enviar enlace mágico"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
