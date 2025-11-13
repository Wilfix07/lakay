import type { Metadata } from "next";
import "./globals.css";
import { DynamicDataWrapper } from "@/components/DynamicDataWrapper";

export const metadata: Metadata = {
  title: "Système de Microcrédit - Lakay",
  description: "Gestion de microcrédit avec remboursements quotidiens",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased bg-gray-50">
        <DynamicDataWrapper>
          {children}
        </DynamicDataWrapper>
      </body>
    </html>
  );
}
