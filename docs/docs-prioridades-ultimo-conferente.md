# DOCs, prioridades do rascunho e último conferente

## DOCs para Despacho

O cadastro oferece a caixa Evento temporário. Quando marcada, o número do protocolo aparece com fundo rosa forte (#F062B0) e texto escuro, em todas as visualizações da lista de DOCs. O Gestor pode corrigir essa marca na edição dos dados cadastrais. Tipo de documento, prazo, andamento e tramitação mantêm seu funcionamento.

Armazenamento: coluna 24 EVENTO_TEMPORARIO, acrescentada à aba DOCS_DESPACHO. As 23 colunas anteriores são preservadas; cadastros antigos sem o campo são tratados como não temporários. A estrutura é completada pelo programa, sem criação manual de coluna. A marca aplica-se ao protocolo na lista de DOCs, sem alterar automaticamente a prioridade de outras rotinas.

## Prioridades e observações no rascunho de Vistorias

A mudança de prioridade e a digitação de observações passam a gravar as preferências no RASCUNHO_ROTEIRO. A tela responde imediatamente e agrupa alterações por 300 ms; mantém apenas uma gravação em voo e preserva edições feitas enquanto aguarda a resposta. Exibe confirmação ou erro com opção de repetir. Falhas não apagam as escolhas locais, que permanecem na sessão até serem gravadas ou a página ser fechada.

A gravação altera somente OBSERVAÇÃO (13), PRIORIDADE (14) e SALVO_EM (20), somente em linhas RASCUNHO. Não desloca colunas nem altera a origem SIAPI. Para localizar os registros, lê apenas data, protocolo e status. Cores escolhidas explicitamente (vermelho, laranja, rosa) não são sobrescritas pela cor de observação.

Ao acrescentar outro protocolo SIAPI, os existentes conservam suas prioridades; a reabertura da data recupera os valores gravados. Respostas de consulta anteriores a uma edição não apagam a escolha local. O programa avisa antes do fechamento da página com preferências não confirmadas.

**Ao distribuir, segue o fluxo normal:** o lançamento leva a prioridade escolhida, a linha do rascunho passa a LANÇADO e o protocolo sai da lista. As preferências locais pendentes dos protocolos distribuídos são descartadas da fila de gravação, pois o lançamento já usou os valores atuais. Uma gravação atrasada só encontra linhas RASCUNHO, portanto não reabre ou modifica o lançamento. Linhas REMOVIDO também são ignoradas. A regra anterior de arquivamento por inatividade não foi alterada.

## Último conferente na Consulta geral da Conferência

Novo filtro Último conferente, por nome (com sugestões) ou RG. Usa o último evento CONCLUÍDO do histórico, incluindo F-7 que voltou à fila e protocolos que depois foram assumidos por outra pessoa. Quando não há evento histórico, utiliza o responsável registrado em uma conclusão antiga. Não confunde o usuário que acabou de assumir com quem concluiu a última análise.

A pesquisa do histórico usa a coluna de eventos e lê os detalhes das conclusões em blocos. É uma consulta somente leitura. Demais filtros continuam combináveis; limpar filtros também limpa o conferente. Respostas de consultas antigas não substituem a pesquisa mais recente.

## Validação

114 testes Node passaram. Foram repetidos os 17 cenários anteriores de navegador e acrescentados seis cenários de DOCs/prioridades/filtro, totalizando 23 cenários no Chromium. O teste de rascunho cobre selecionar as três cores, acrescentar outro SIAPI, recarregar e distribuir. Também verifica que a gravação atrasada não altera LANÇADO. Testes usam dados fictícios e serviços Google simulados; não houve implantação ou alteração de planilhas reais.

Atualização: substituir WebApp.gs e Index.html, salvar e publicar uma nova versão. O número do commit identifica o pacote completo, que também conserva o Credenciamento SIAPI/SEI.

## Oficial que despachou

O cadastro de DOC e a atualização pelo Gestor oferecem o campo manual Oficial que despachou. A lista passa a exibi-lo em coluna própria, tanto em documentos abertos quanto concluídos. Campo opcional, com posto e nome digitados pelo operador; não presume que o oficial seja a pessoa conectada ao sistema.

A informação é armazenada na coluna 25 OFICIAL_DESPACHO de DOCS_DESPACHO, sem deslocar as colunas anteriores. Documentos antigos sem preenchimento mostram Não informado. Atualizações que não enviam esse campo preservam o valor anterior; a edição cadastral também o preserva. O histórico registra o oficial no cadastro e na atualização, incluindo o nome anterior quando alterado. Usuário que registrou e responsável pela gestão continuam separados.

Nesta atualização, passaram 116 testes locais e 25 cenários no Chromium com os serviços Google simulados. Incluem preenchimento no cadastro, correção na Gestão, consulta após conclusão e preservação do evento temporário. Nenhuma implantação ou planilha real foi alterada neste ambiente.
