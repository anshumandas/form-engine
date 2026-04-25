import type { Metadata } from "next";
import { Syne, DM_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/providers/auth-context";
import { FormEngineProvider } from "@form-engine/components/FormEngineProvider";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Form Engine",
  description: "Dynamic Form Creation & Management — FormEngineManifest v4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${syne.variable} ${dmSans.variable} font-[family-name:var(--font-dm-sans)] bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 min-h-screen`}
      >
        <AuthProvider>
          <FormEngineProvider config={{}}>
            {children}
          </FormEngineProvider>
        </AuthProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
