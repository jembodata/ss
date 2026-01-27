import "./globals.css";
import type { Metadata } from "next";
import { ToastProvider } from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "Screenshot Service",
  description: "Automated screenshot runner"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <div className="page-shell min-h-screen">
            <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
