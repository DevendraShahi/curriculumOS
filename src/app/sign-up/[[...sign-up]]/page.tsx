import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <SignUp
        fallbackRedirectUrl="/"
        signInUrl="/sign-in"
      />
    </main>
  );
}
