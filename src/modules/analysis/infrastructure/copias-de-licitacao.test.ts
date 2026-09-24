import { describe, expect, it } from "vitest";

import { paraConsulta } from "@/modules/analysis/infrastructure/copias-de-licitacao";

describe("lista de cópias para a consulta", () => {
  it("passa os ids adiante quando há cópia", () => {
    expect(paraConsulta(["a", "b"])).toEqual(["a", "b"]);
  });

  /**
   * ⚠️ Sem isto, o caso NORMAL — nenhuma duplicata — apagaria a tela inteira
   * ou quebraria a consulta: `NOT IN ()` é erro de sintaxe no Postgres e
   * `NOT IN (NULL)` descarta todas as linhas sem erro nenhum, que é pior.
   */
  it("sem cópia nenhuma, devolve um id impossível em vez de lista vazia", () => {
    const saida = paraConsulta([]);
    expect(saida).toHaveLength(1);
    expect(saida[0]).toBe("sem-copia-nenhuma");
  });
});
