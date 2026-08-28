import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Regressão do erro 500 de 28/08/2026 em /opportunities/scouted.
 *
 * A tela passava `onClick` a um `<div>` renderizado no servidor. React Server
 * Components não podem entregar função ao navegador, e o React derruba a
 * renderização inteira ao encontrar uma. O trecho ficava dentro do laço que
 * desenha cada licitação, então a página só quebrava quando a fila tinha
 * linhas — passou despercebido enquanto a fila estava vazia e explodiu assim
 * que a primeira varredura trouxe 453 registros.
 *
 * Nenhum teste de unidade pegava isso: o defeito só aparece na fronteira
 * servidor/cliente, que a suíte não atravessa. Esta verificação estática
 * fecha a porta para o padrão voltar em qualquer tela.
 */

const APP_DIR = join(process.cwd(), "src", "app");

/** `onClick={`, mas não o `onId={` que existe dentro de `competitionId={`. */
const HANDLER_PATTERN = /(^|[\s{])on[A-Z][A-Za-z]*=\{/;

function tsxFilesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return tsxFilesIn(path);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [path] : [];
  });
}

function isClientComponent(source: string): boolean {
  return /^\s*(["'])use client\1/.test(source);
}

describe("fronteira servidor/cliente em src/app", () => {
  it("nenhum componente de servidor passa manipulador de evento", () => {
    const offenders: string[] = [];

    for (const file of tsxFilesIn(APP_DIR)) {
      const source = readFileSync(file, "utf8");
      if (isClientComponent(source)) continue;

      source.split(/\r?\n/).forEach((line, index) => {
        if (HANDLER_PATTERN.test(line)) {
          offenders.push(`${file.slice(process.cwd().length + 1)}:${index + 1}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });

  it("reconhece o padrão que derrubou a fila de triagem", () => {
    // Guarda do próprio guarda: se a expressão parar de casar, o teste acima
    // passaria a aprovar tudo em silêncio.
    expect(HANDLER_PATTERN.test('  <div onClick={(event) => event.preventDefault()}>')).toBe(true);
    expect(HANDLER_PATTERN.test('  <Form competitionId={competition.id}/>')).toBe(false);
    expect(HANDLER_PATTERN.test('  <Uploader extractionDefinitions={definitions}/>')).toBe(false);
  });
});
