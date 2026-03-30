import "./globals.css";
import "@copilotkit/react-core/v2/styles.css";

import { Providers } from "./providers";

export const metadata = {
  title: "Rail Dashboard",
  description: "Real-time fleet monitoring and maintenance planning",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={`antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
