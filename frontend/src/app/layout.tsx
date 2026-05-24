import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const fkGrotesk = localFont({
  src: [
    {
      path: "../../public/fonts/FK Grotesk light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/fonts/fk-grotesk-nueue.ttf",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-sans",
});

const ppEditorial = localFont({
  src: [
    {
      path: "../../public/fonts/PP Editorial Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/PP Editorial Italic.ttf",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "RepoHawk - The Diagrams are the UI",
  description: "Instantly generate interactive diagrams from your codebase.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fkGrotesk.variable} ${ppEditorial.variable} h-full antialiased`}
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans transition-colors duration-300">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
