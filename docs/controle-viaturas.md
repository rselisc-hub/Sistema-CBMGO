# Controle de Viaturas — Atendimento

Entrega de 05/11/2026. Substituir WebApp.gs e Index.html juntos, salvar e publicar nova versão. Na primeira abertura de Atendimento > Controle de Viaturas, são criadas VIATURAS_CADASTRO e VIATURAS_MOVIMENTOS. Não altera a aba DADOS, roteiros, escala ou respostas do Forms. AV-857 foi excluída da relação inicial a pedido do usuário.

## Cadastro inicial: 14 viaturas

| Prefixo | Placa |
|---|---|
| AV-843 | TGK0A44 |
| AV-841 | TGJ3E34 |
| AV-840 | TGJ2A14 |
| AV-839 | TGI7E74 |
| AV-836 | TGG6G44 |
| AV-835 | TGG2A04 |
| AV-834 | TGF5E54 |
| AV-832 | TGF1B44 |
| AV-831 | TGE3E34 |
| AV-822 | TFZ8A04 |
| AV-821 | TFZ4C24 |
| AV-883 | TFW4A69 |
| AV-446 | PRZ1136 |
| AV-452 | PRZ1336 |

Prefixos e placas transcritos da imagem enviada. Marca e Renavam não foram coletados, pois não são necessários ao controle solicitado. Inicialização não se repete se o cadastro já existir. Não importa cautelas antigas do Forms: antes de movimentações, disponível significa ausência de cautela aberta registrada neste módulo; a tabela informa Sem movimentação registrada.

## Uso

Cautela / Devolução: pesquisar militar pelo nome de guerra/RG, selecionar viatura e operação, informar observação opcional e confirmar. Todos os militares da aba DADOS com RG e nome de guerra identificável entram na lista; não há filtro por função ou participação nas vistorias. Posto e RG distinguem nomes iguais. Colunas RG, NOME DE GUERRA e POSTO/GRADUAÇÃO são reconhecidas por cabeçalho; ID MILITAR serve como alternativa ao nome de guerra quando disponível, retirando o posto. Cadastro incompleto produz aviso; não inventa nomes de guerra a partir do nome completo.

Situação das viaturas: prefixo/placa, disponível ou cautelada, responsável atual, data/hora da cautela e última devolução com militar/data/hora somente quando disponível. Botão no prefixo abre as últimas 100 movimentações, da mais recente à mais antiga. Consultas abertas não recebem transmissão em tempo real: use Atualizar para consultar mudanças feitas por outras pessoas.

Gerenciar viaturas: exclusivo do Gestor. Novo cadastro, edição de prefixo/placa, baixa/inativação e reativação na mesma caixa. Inativas saem da seleção e relatório operacional; continuam no gerenciamento e histórico. Placa/prefixo não podem duplicar nem uma viatura inativa. Não permite editar ou baixar uma viatura cautelada: primeiro registre a devolução.

Quem pode registrar/consultar: Gestor e perfis Atendimento/Conferência que acessam o Atendimento. Perfil Vistoriador não recebe acesso. Integração com o roteiro, preenchimento pelos vistoriadores e integração com Forms continuam para depois.

## Integridade e armazenamento

- Militar selecionado é o responsável por receber/devolver. Usuário autenticado que registrou fica separado no histórico, com RG/nome. Data e horário são calculados no servidor pelo horário de Brasília.
- Uma movimentação confirmada equivale a uma linha append-only em VIATURAS_MOVIMENTOS. O JSON da linha preserva a situação resultante. Não há segundo registro de situação que possa ficar dessincronizado após falha entre gravações.
- ID de tentativa, bloqueio de escrita e validação no servidor impedem repetição e cautelas concorrentes. Após resposta perdida, repetir o mesmo envio confirma o evento existente e consulta a situação atual. Não cria outro evento.
- Não permite nova cautela ocupada, devolução sem cautela ou pedido de devolução de uma cautela antiga encerrando outra nova. Baixa preserva todos os eventos.
- Depois de confirmação, só a viatura afetada é substituída no resultado local. Busca de militar é local, sem chamadas adicionais. Relatório lê em lote os IDs do histórico e somente as últimas linhas necessárias para montar as situações, sem baixar todas as colunas de todos os eventos. Histórico detalhado é consultado sob demanda e limitado a 100 registros.
- Falha mantém os dados da tentativa; campos ficam protegidos para permitir repetição idêntica. Consultar antes de novo lançamento permite atualizar a situação. Saída durante envio é bloqueada; ao fechar a página com envio incerto, o navegador apresenta sua proteção padrão. Cache/dados da tela são limpos ao sair, e respostas antigas são descartadas por sessão/sequência.

## Verificação

323 testes locais e 39 cenários Chromium relacionados passaram, com Google simulado. Oito testes novos verificam cadastro inicial sem AV-857, nomes de guerra de não vistoriadores, permissões, cautela/devolução, cadastro/baixa/reativação, histórico, concorrência e repetição após perda da resposta. Sete cenários novos no navegador exercitam consulta/busca, permissões, clique duplo, resposta perdida, devolução/relatório, cadastro do Gestor, largura mobile e limpeza da sessão. Outros cenários cobrem Atendimento (6), Pendências/Atendimento (9), PSE (10) e Vistoriador (7). Não houve publicação no Google, integração com Forms ou medição de latência real de produção.

## Correção da lista de militares — 05/11/2026

A estrutura antiga de DADOS usa Nome; parte dos registros reúne posto, quadro, RG e nome completo na mesma célula. O cadastro mais novo acrescentou Nome de guerra. A leitura anterior considerava só as colunas novas, ocultando os demais militares.

A seleção agora lê os formatos antigo e novo e inclui todos os registros nomeados de DADOS. RG explícito no texto estruturado é separado quando há um único número válido e prefixo de posto reconhecido. Cadastro complementa o nome de guerra pelo RG, incluindo o campo ID Militar e diferenças de zeros à esquerda. Não importa militares extras existentes somente no Cadastro. As duas bases são apenas lidas.

Nome de guerra ausente: exibe o nome disponível, com indicação na seleção e aviso; não presume sobrenome/abreviação. Se o RG também estiver ausente, usa identidade do registro de DADOS (linha e assinatura do nome/posto), sem inventar RG. Esse identificador é revalidado no servidor e preservado no JSON da movimentação, mantendo o histórico e o envio idempotente. Mudança do registro exige atualizar a seleção. Registros duplicados do mesmo RG são unificados, dando preferência ao que possui nome de guerra.

Na planilha enviada anteriormente, a leitura local identificou 69 militares distintos: 44 com nome de guerra recuperado do cadastro e 25 apresentados pelo nome disponível. Esses números pertencem à cópia antiga, não são uma consulta à planilha de produção atual.

Validação: 327 testes locais passaram; 20 cenários Chromium passaram (7 com cadastro novo, os mesmos 7 com estrutura antiga e 6 de Atendimento), usando Google simulado. Quatro novos testes verificam coexistência antigo/novo, complemento por RG sem importar pessoas extras, RG dentro do texto estruturado e movimentação sem RG sem inventar identificação. Atualizar WebApp.gs e Index.html juntos, publicar nova versão e clicar em Atualizar no Controle de Viaturas.

## Nome de guerra pelo negrito e quadros na mesma tela — 05/11/2026

Conforme esclarecido pelo usuário, o trecho em negrito dentro do nome identifica o nome de guerra. A leitura de DADOS consulta RichText em lote nas colunas Nome/Nome completo e extrai somente os trechos em negrito dentro da parte do nome, excluindo posto, quadro e RG do formato antigo. Suporta nomes compostos e estilos contíguos. O negrito tem prioridade sobre o campo explícito/alias do Cadastro; linhas repetidas do mesmo RG também dão preferência ao registro com negrito. Sem negrito, mantém o nome de guerra explícito ou Cadastro/ID Militar; se não houver, mantém o nome disponível com indicação. Não modifica dados ou formatação da planilha. Se a formatação em negrito não estiver preservada no Google Sheets, ela não pode ser recuperada da imagem; nesse caso valem as alternativas cadastradas.

Layout: Cautela/Devolução à esquerda e Situação das viaturas à direita, sempre visíveis, sem alternância por abas. Usa colunas 4/8 em telas de pelo menos 992 px; em telas menores, os quadros ficam um abaixo do outro. A tabela mantém rolagem dentro do quadro quando necessário. A confirmação continua atualizando a situação local da viatura sem nova consulta completa.

Validação: 329 testes locais e 20 cenários de navegador passaram, com Google simulado. Dois novos testes verificam negrito, exclusão de posto/RG, nome composto e prioridade sobre alias. O navegador foi executado com cadastro novo e com DADOS antigo/negrito, verificando ambos os quadros visíveis, alinhamento horizontal no computador, empilhamento e ausência de rolagem horizontal da página em 390 px. Os seis cenários de Atendimento também passaram. Atualizar WebApp.gs e Index.html juntos e publicar nova versão.
