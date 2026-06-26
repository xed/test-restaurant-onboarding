import type { Metadata } from "next";

import { OnboardingShell } from "@/components/onboarding-shell";
import { Providers } from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Restaurant Onboarding",
  description: "Document-based restaurant onboarding flow"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <OnboardingShell>{children}</OnboardingShell>
        </Providers>
      </body>
    </html>
  );
}
