import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { FocusProvider } from "@/app/focus/_context/focus-context";
import { FocusDynamicIsland } from "@/components/layout/focus-dynamic-island";

export const metadata: Metadata = {
  title: "curriculum.os",
  description: "Technical learning operating system by Echo11.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
          <FocusProvider>
            <FocusDynamicIsland />
            <Navbar />
            {children}
          </FocusProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
