import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { FocusProvider } from "@/app/focus/_context/focus-context";
import { FocusDynamicIsland } from "@/components/layout/focus-dynamic-island";
import { ThemeProvider } from "@/components/layout/theme-provider";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

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
    <html lang="en" className={`h-full antialiased ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
            <FocusProvider>
              <FocusDynamicIsland />
              <Navbar />
              {children}
            </FocusProvider>
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
