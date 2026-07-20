# Rastreabilidade — Incremento I5

Data de abertura: 19/07/2026  
Baseline: GSIPRO-PLN-302; GSIPRO-FUN-111, 113 e 114; GSIPRO-TEC-201 a 205 — revisões aprovadas

| Item | Resultado previsto | Situação |
|---|---|---|
| BL-501 | Casos de uso, modelos e versões | Concluído |
| BL-502 | Extração com fontes e evidências | Concluído |
| BL-503 | Busca semântica e similaridade assistiva | Em andamento |
| BL-504 | Confiança, limitações e validação humana | Pendente |
| BL-505 | Avaliação de qualidade e correções | Pendente |

## Portão de entrada

- I4 concluído e homologado: sim.
- FUN-111 e backlog aprovados: sim.
- Fontes, auditoria, segurança e avaliação como pré-condições: preservadas.
- Execução autônoma de decisão, alçada, desconto, margem, prazo ou envio: proibida.

## Corte ativo

BL-503: implementar busca semântica e similaridade como apoio, preservando filtros de acesso, fonte, explicabilidade e validação humana.

## BL-501 concluído

- Inventário imutável registra fornecedor, modelo, versão do fornecedor, serviço, região de processamento, retenção, fonte e situação.
- Caso de uso registra finalidade, entradas, saídas, público, riscos, limitações, fontes autorizadas, critérios de avaliação e proprietário.
- Prompt crítico é armazenado com SHA-256 calculado no servidor; mudança cria nova versão e exige reavaliação.
- Caso de uso só referencia modelo ativo e revisão preserva código e histórico.
- Autor não aprova a própria versão; somente a versão mais recente pode ser aprovada.
- Interface `/ai-governance` e três APIs protegidas incorporadas.
- Validação: 180 testes em 53 arquivos, lint, tipos e build aprovados.
- Banco exclusivo com 55 migrações e 59 permissões; smoke confirmou versões, hashes, segregação, imutabilidade e auditoria.
- Conclusão formal registrada em GSIPRO-REL-063.

## BL-502 concluído

- Integração com a OpenAI Responses API isolada em adaptador, usando saída estruturada por JSON Schema e `store: false`.
- Chave `OPENAI_API_KEY` exclusivamente no ambiente do servidor; segredo não é persistido, auditado ou exibido.
- Execução exige versão mais recente e aprovada do caso de uso, modelo OpenAI ativo, serviço Responses API e fonte documental autorizada.
- Acesso à fonte nunca supera as permissões do usuário; `ai.execute`, `documents.read` e a permissão declarada no caso são verificadas.
- Fonte enviada por versão imutável e SHA-256 novamente conferido no armazenamento antes do processamento.
- Resultado é explicitamente assistivo e registra conteúdo estruturado, confiança, limitações, evidências, modelo, prompt, usuário, horários, idempotência e correlação.
- Falhas são persistidas com código sanitizado; transição de estado e evidências possuem guardas no PostgreSQL.
- Interface `/ai-extractions` e API `/api/ai-extractions` incorporadas.
- Validação: 185 testes em 56 arquivos, lint, tipos, build e smoke aprovados; smoke não realizou chamada externa.
- Banco exclusivo com 56 migrações e 60 permissões.
- Conclusão formal registrada em GSIPRO-REL-064.
