# Layout responsivo

O HTML contém a meta tag `viewport` com `width=device-width, initial-scale=1`. O backend já configurava o mesmo viewport via `HtmlOutput.addMetaTag`, mecanismo próprio do Apps Script, e foi preservado.

Como o projeto usa CSS no bloco `<style>` do Index, as regras continuam ali: não é necessário instalar um arquivo extra. As faixas de tela são explícitas e não se sobrepõem:

- Celulares: até 767,98 px. Cabeçalho e menus quebram linha, símbolo menor, cartões com espaçamento reduzido, campos com fonte de 16 px e botões com altura mínima de 40 px. Filtros de Minhas Vistorias e Controle de Escala podem ocupar mais de uma linha.
- Tablets: de 768 a 1199,98 px. Cabeçalho flexível, espaçamento intermediário e símbolo de 56 x 42 px.
- Computadores: a partir de 1200 px. Mantém o espaçamento original, símbolo de 62 x 46 px e altura máxima de 520 px nos contêineres de tabelas.

Tabelas e roteiros extensos continuam com rolagem horizontal dentro de seus contêineres. As regras não limitam o zoom do navegador nem alteram permissões, operações, cores das equipes ou dados. O JavaScript foi comparado integralmente com a versão anterior e permaneceu idêntico. Backend sem alterações.

Verificado no Chromium em larguras de 320, 390, 834 e 1440 px, usando viewport móvel nos tamanhos menores, nas telas de login, Controle de Escala, Minhas Vistorias e Roteiro. Sem transbordamento horizontal da página nos cenários verificados; grades mantêm sua rolagem própria. Mais 20 cenários existentes de Vistoriador, PSE/Atendimento e Gestor/Escalas passaram com serviços Google simulados. Isso não equivale a teste em aparelhos físicos ou na implantação Google.

Instalação: substituir Index.html, salvar e publicar uma nova versão. O ZIP inclui também o backend atual, sem mudanças nesta entrega.
