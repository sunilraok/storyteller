import type { Metadata } from "next";
import { Noto_Sans_Kannada, Noto_Serif_Kannada } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const ui = Noto_Sans_Kannada({ variable: "--font-ui", subsets: ["kannada", "latin"] });
const story = Noto_Serif_Kannada({ variable: "--font-story", subsets: ["kannada", "latin"] });

export const metadata: Metadata = {
  title: "Kathā — Indian epics, told from the source",
  description:
    "Stories from the Mahābhārata and Rāmāyaṇa narrated in Kannada and English, grounded in public-domain translations with citations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script may set data-theme before React hydrates.
    <html lang="kn" className={`${ui.variable} ${story.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
