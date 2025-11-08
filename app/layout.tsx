import type { Metadata } from "next";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}
