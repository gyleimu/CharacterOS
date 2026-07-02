import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "CharacterOS — MindSpace3D",
  description: "Immersive 3D personality nebula visualization",
  icons: [{ rel: "icon", url: "/favicon.svg", type: "image/svg+xml" }],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
