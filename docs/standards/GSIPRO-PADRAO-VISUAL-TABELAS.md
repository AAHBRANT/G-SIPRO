# G-SIPRO — Padrão visual de painéis com tabelas

Status: aprovado pelo proprietário  
Referências oficiais: telas **Propostas** e **Oportunidades**  
Aplicação: novas telas e futuras revisões de painéis com listagens

## Princípio visual

O painel deve ser sóbrio, compacto e funcional, seguindo a identidade visual do G-SIPRO/AAHBRANT. Evitar blocos intermediários desnecessários, excesso de cores, sombras densas e informações repetidas.

## Estrutura obrigatória

1. Manter os cards de indicadores acima da listagem quando forem relevantes para a página.
2. Apresentar a listagem em um único painel branco, com borda leve, cantos discretos e sombra suave.
3. Colocar o título da relação e os controles na mesma barra superior.
4. Usar título em caixa alta, tipografia compacta e ícone temático à esquerda.
5. Posicionar à direita, nesta ordem:
   - campo de busca compacto;
   - botão **Filtros**;
   - botão **Exportar**, apenas quando a funcionalidade existir.
6. Não inserir texto explicativo ou faixa vazia entre a barra superior e o cabeçalho da tabela.

## Busca e filtros

- A busca deve aceitar os principais identificadores e descrições da entidade.
- A lupa deve executar a busca e a tecla Enter também deve funcionar.
- O botão **Filtros** abre uma área compacta logo abaixo da barra superior.
- Os filtros aplicados devem ser preservados durante busca, paginação e mudança da quantidade de linhas.
- Sempre disponibilizar a opção **Limpar filtros**.

## Tabela

- Cabeçalho com fundo cinza muito claro, texto pequeno, caixa alta e peso forte.
- Linhas compactas, com altura equivalente ao painel de Propostas.
- Separadores horizontais leves e realce sutil ao passar o mouse.
- Código ou identificador principal em cor da marca e com acesso ao registro.
- Textos longos devem usar truncamento visual e preservar o conteúdo completo em `title` quando necessário.
- Status em etiqueta arredondada, com cores suaves e sem preenchimentos densos.
- Ações alinhadas à direita ou centralizadas na última coluna, usando ícones com descrição acessível.

## Rodapé e paginação

- Exibir o intervalo e o total de registros à esquerda.
- Usar um único seletor de quantidade de linhas com as opções **10, 25, 50 e 100**.
- Apresentar, na sequência, **Anterior**, página atual, total de páginas e **Próximo**.
- O seletor e os botões devem seguir exatamente a densidade visual do painel de Propostas.

## Critério de aceite

Uma tela atende a este padrão quando:

- mantém a mesma hierarquia visual de Propostas e Oportunidades;
- busca, filtros, paginação e seletor de linhas funcionam de forma integrada;
- não apresenta blocos vazios ou explicações redundantes;
- permanece legível em resoluções menores, com rolagem horizontal somente na tabela;
- passa por validação funcional, visual e de acessibilidade antes da publicação.
