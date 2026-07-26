# GSIPRO-OPS-001 — Plano de Operação e Produção — REV00

## Identificação

- Data: 25/07/2026
- Situação: em construção — pendências abertas, sem aprovação formal para produção
- Responsável do projeto: Gutemberg Pontes
- Origem: decisões registradas em conversa com o assistente em 25/07/2026, motivadas pela lacuna identificada na avaliação estrutural do G-SIPRO (a pasta `026_IMPLANTACAO`, prevista para conter este plano, estava completamente vazia)

## Objetivo

Registrar as decisões e pendências necessárias para que o G-SIPRO possa ser autorizado para produção, conforme já exigido pelo próprio `README.md` do projeto e pelo relatório `GSIPRO-REL-070`: ambiente de produção definido, backup/restauração testados e operação/suporte aprovados.

## 1. Suporte técnico

- **Decisão:** haverá uma pessoa ou empresa designada para suporte técnico de produção, além da automação de IA já existente para correções simples (incremento I6, ver `docs/traceability/i6-status.md`).
- **Pendência:** a pessoa/empresa ainda não foi definida. Até que isso aconteça, um alerta de produção fora do alcance da automação não tem um responsável humano formalmente designado.
- **Próximo passo:** definir e registrar aqui o nome/contato do responsável antes de qualquer entrada em produção.

## 2. Backup e restauração

- **Situação conhecida:** o ambiente de homologação tem backup automático do PostgreSQL Flexible Server com retenção de 7 dias (confirmado em `GSIPRO-REL-070`).
- **Pendência crítica:** não há confirmação de que um teste real de restauração já foi feito. Backup que nunca foi restaurado na prática não é uma garantia — só um teste completo (restaurar para um ambiente separado e conferir a integridade dos dados) comprova que funciona.
- **Recomendação:** para produção, considerar aumentar a retenção do backup (ex.: 30 dias), já que o sistema trata de propostas comerciais e editais com valor jurídico.

## 3. Ambiente de produção

- **Decisão:** ainda não tomada.
- **Recomendação:** usar a mesma assinatura Azure já existente, mas um grupo de recursos separado e dedicado à produção (ex.: `rg-gsipro-prod-brazilsouth`, espelhando o padrão já usado em homologação `rg-gsipro-hml-brazilsouth`). Isso evita o custo e a complexidade de uma conta Azure inteiramente nova, mas mantém produção isolada de homologação — dados, réplicas e custos não se misturam.
- **Pendência:** decisão final e criação efetiva do ambiente.

## 4. Domínio

- **Decisão:** produção vai usar o endereço genérico gerado pelo Azure Container Apps — não haverá domínio próprio da empresa (ex.: `gsipro.suaempresa.com.br`).
- **Implicação registrada:** o endereço de produção terá o formato `https://ca-gsipro-<identificador>.<região>.azurecontainerapps.io`, do mesmo jeito que o de homologação hoje. É uma opção válida; só vale lembrar que adotar um domínio próprio depois exigirá reconfigurar o retorno (callback) do Microsoft Entra ID.

## 5. Pendências para tirar o "bloqueado para produção"

1. Definir e registrar o responsável por suporte técnico de produção (item 1).
2. Executar e documentar um teste real de restauração de backup (item 2).
3. Decidir e criar o ambiente de produção (item 3).
4. Resolver as pendências de desempenho e integrações externas já apontadas no relatório `GSIPRO-HML-701` (Modo Analítico Inteligente).
5. Aprovação formal do proprietário — só depois de todos os itens acima.

## Conclusão

Este plano ainda **não autoriza produção**. Ele documenta, pela primeira vez, o que falta e quem decide cada ponto — preenchendo a lacuna que antes deixava a etapa de implantação sem nenhum registro. Deve ser atualizado à medida que cada pendência for resolvida.
