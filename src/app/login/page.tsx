import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-knowon-teal/10 via-background to-knowon-pink/10 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-knowon-purple">
            KnowOn <span className="text-knowon-teal">Content Studio</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Marketing-Content für alle Kanäle in einem Workflow.
          </p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
