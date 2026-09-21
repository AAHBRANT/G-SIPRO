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
  //
  // ⚠️ pdfjs-dist tem o MESMO problema, achado em produção (21/09/2026): ele
  // carrega "pdf.worker.mjs" do próprio pacote em tempo de execução (o
  // "worker falso" que roda a extração no mesmo processo, sem Worker de
  // verdade — o normal em Node), e o caminho que ele monta some quando o
  // bundler empacota o server. Erro real capturado em produção: "Setting up
  // fake worker failed: Cannot find module '/app/.next/server/chunks/
  // pdf.worker.mjs'" — 100% das leituras automáticas falhavam por isto, nunca
  // reproduzia local (`npx tsx` roda sem passar pelo bundler do Next).
  serverExternalPackages: ["node-unrar-js", "pdfjs-dist"],
  // ⚠️ Trava do .wasm. A imagem sobe só `.next/standalone`, ou seja, só o que o
  // rastreador do Next achou — e ele acha o binário pelo pacote inteiro, não
  // por leitura de código: o carregamento é um `readFileSync(__dirname +
  // "unrar.wasm")` que nenhum rastreador enxerga. Hoje o arquivo vai junto sem
  // esta linha (conferido no `.next/standalone`); a linha existe para o dia em
  // que isso mudar, porque a falha seria silenciosa — build verde, teste verde,
  // e todo edital publicado em .rar voltando vazio em produção.
  //
  // ⚠️ pdf.worker.mjs tem a MESMA trava — `serverExternalPackages` acima
  // resolve o CAMINHO calculado (pdfjs volta a apontar para dentro do próprio
  // pacote, não para um chunk do bundler), mas não garante que o ARQUIVO
  // exista no `.next/standalone` publicado: conferido por leitura direta do
  // build (21/09/2026), com só `serverExternalPackages` o pacote inteiro é
  // copiado, mas SEM `pdf.worker.mjs` — o rastreador não segue o `import()`
  // dinâmico que pdfjs usa para montá-lo. As duas rotas que leem edital (a
  // manual e a automática do represado) precisam da entrada.
  outputFileTracingIncludes: {
    "/api/scouting/scouted-tenders/[id]/edital": [
      "./node_modules/**/node-unrar-js/**/*.wasm",
      "./node_modules/**/pdfjs-dist/**/pdf.worker.mjs",
    ],
    "/api/scouting/process-backlog": ["./node_modules/**/pdfjs-dist/**/pdf.worker.mjs"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
