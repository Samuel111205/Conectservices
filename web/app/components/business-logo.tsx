import Image from "next/image";

const paletas = [
  ["#0756a8", "#1aa2e8", "#d5f2ff"],
  ["#5333a5", "#a772e8", "#f1e4ff"],
  ["#08765d", "#28b68a", "#d6faed"],
  ["#a34820", "#ee9142", "#fff0d9"],
  ["#a72f62", "#eb6f9b", "#ffe0ec"],
  ["#264e8a", "#5a91dc", "#deebff"],
];

function initialsDaEmpresa(nome: string) {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  const significativas = palavras.filter(
    (palavra) => !["e", "de", "da", "do", "das", "dos"].includes(palavra.toLocaleLowerCase("pt-AO")),
  );
  const escolhidas = significativas.length ? significativas : palavras;
  return escolhidas
    .slice(0, 2)
    .map((palavra) => Array.from(palavra)[0] ?? "C")
    .join("")
    .toLocaleUpperCase("pt-AO");
}

function gerarImagemDeMarca(nome: string) {
  let hash = 0;
  for (const caracter of nome) hash = (hash * 31 + caracter.charCodeAt(0)) | 0;
  const [escuro, claro, brilho] = paletas[Math.abs(hash) % paletas.length];
  const iniciais = initialsDaEmpresa(nome).replace(/[&<>"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${claro}"/><stop offset="1" stop-color="${escuro}"/></linearGradient></defs><rect width="160" height="160" rx="42" fill="url(#f)"/><circle cx="128" cy="30" r="37" fill="${brilho}" opacity=".35"/><circle cx="27" cy="139" r="42" fill="#fff" opacity=".12"/><path d="M39 54c8-16 22-24 41-24 13 0 25 5 33 14" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="5" opacity=".75"/><text x="80" y="105" fill="#fff" font-family="Arial,sans-serif" font-size="53" font-weight="700" letter-spacing="-3" text-anchor="middle">${iniciais}</text><circle cx="119" cy="119" r="12" fill="${brilho}"/><path d="m114 119 4 4 7-9" fill="none" stroke="${escuro}" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function BusinessLogo({
  companyName,
  logoUrl,
  className,
  width = 64,
  height = 64,
}: {
  companyName: string;
  logoUrl?: string | null;
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <Image
      className={className}
      src={logoUrl || gerarImagemDeMarca(companyName)}
      alt={logoUrl ? `Logótipo de ${companyName}` : `Imagem de perfil de ${companyName}`}
      width={width}
      height={height}
      unoptimized
    />
  );
}
