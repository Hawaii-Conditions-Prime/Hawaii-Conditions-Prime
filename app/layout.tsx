import type { Metadata } from "next";

export const metadata: Metadata = {
  title: process.env.MCP_TOOL_NAME ?? "MCP Stripe Tool",
  description: "A paid MCP tool powered by Stripe and Model Context Protocol",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
