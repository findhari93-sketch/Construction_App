import type { Metadata } from "next";
import { Inter } from "next/font/google";
import ClientThemeProvider from "@/components/common/ClientThemeProvider";
import AppLayoutClient from "@/components/common/AppLayoutClient";

import "bootstrap/dist/css/bootstrap.min.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Construction Manager",
  description: "Construction management app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Note: this file is a Server Component (no React hooks here)
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientThemeProvider>
          <AppLayoutClient>{children}</AppLayoutClient>
          <ToastContainer position="top-right" autoClose={3000} />
        </ClientThemeProvider>
      </body>
    </html>
  );
}
