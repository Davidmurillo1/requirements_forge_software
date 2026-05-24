import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <Button type="submit" variant="outline" size="sm">
        Cerrar sesión
      </Button>
    </form>
  );
}
