import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://teams.microsoft.com https://*.teams.microsoft.com https://*.cloud.microsoft https://*.microsoft365.com https://*.office.com" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // O unrar é WebAssembly e carrega o .wasm do próprio pacote em tempo de
  // execução. Empacotado pelo bundler ele perde o caminho do arquivo e falha
  // só em produção, ao abrir o primeiro .rar — deixá-lo externo evita isso.
  serverExternalPackages: ["node-unrar-js"],
  // ⚠️ Trava do .wasm. A imagem sobe só `.next/standalone`, ou seja, só o que o
  // rastreador do Next achou — e ele acha o binário pelo pacote inteiro, não
  // por leitura de código: o carregamento é um `readFileSync(__dirname +
  // "unrar.wasm")` que nenhum rastreador enxerga. Hoje o arquivo vai junto sem
  // esta linha (conferido no `.next/standalone`); a linha existe para o dia em
  // que isso mudar, porque a falha seria silenciosa — build verde, teste verde,
  // e todo edital publicado em .rar voltando vazio em produção.
  outputFileTracingIncludes: {
    "/api/scouting/scouted-tenders/[id]/edital": ["./node_modules/**/node-unrar-js/**/*.wasm"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
