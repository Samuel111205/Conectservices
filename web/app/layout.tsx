import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conect Services | Pessoas certas, novas possibilidades",
  description:
    "Encontre prestadores de serviços qualificados ou aumente a visibilidade do seu negócio em Angola.",
};

export default function LayoutPrincipal({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-AO">
      <body>{children}</body>
    </html>
  );
}
