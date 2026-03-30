"use client";

import "./globals.css";
import "@copilotkit/react-core/v2/styles.css";

import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import { ThemeProvider } from "@/hooks/use-theme";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
        <ThemeProvider>
          <CopilotKitProvider runtimeUrl="/api/copilotkit" useSingleEndpoint>
            {children}
          </CopilotKitProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
