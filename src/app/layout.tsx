import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Artisan 3D — Photos to 3D Furniture Models",
  description: "A minimal, precision 3D shop for furniture merchants. Transform 4-angle product photos into realistic interactive 3D GLB models.",
};

import { AuthProvider } from "@/lib/auth/auth-context";
import { FeaturesProvider } from "@/lib/features/features-context";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable}`}>
      <body className="min-h-screen text-[hsl(var(--foreground))] font-sans antialiased">
        <AuthProvider>
          <FeaturesProvider>{children}</FeaturesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
