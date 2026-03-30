"use client";

import "./globals.css";
import "./style.css"
import "@copilotkit/react-core/v2/styles.css";

import { CopilotKit } from "@copilotkit/react-core/v2";
import { ThemeProvider } from "@/hooks/use-theme";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
        <ThemeProvider>
          <CopilotKit runtimeUrl="/api/copilotkit">
            {children}
          </CopilotKit>
        </ThemeProvider>
      </body>
    </html>
  );
}
