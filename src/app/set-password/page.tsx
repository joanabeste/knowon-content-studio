import { SetPasswordForm } from "./set-password-form";

export default function SetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-knowon-teal/10 via-background to-knowon-pink/10 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-knowon-purple">
            Passwort setzen
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Lege ein Passwort für deinen KnowOn-Account an.
          </p>
        </div>
        <SetPasswordForm />
      </div>
    </main>
  );
}
