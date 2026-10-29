# Perfil Vistoriador — consultas e não realizadas

O perfil VISTORIADOR (e o nome antigo CONSULTA, por compatibilidade) passa a mostrar somente:

- Roteiro dos Vistoriadores — leitura.
- Vistorias do Dia — leitura, sem seleção de equipe, edição ou exclusão.
- Escala PSE — leitura, sem gerar a planilha quando ela estiver ausente.
- Minhas Vistorias — visitas da data atribuídas ao RG da sessão como primeiro ou segundo integrante; seleção das não realizadas com motivo.

A distribuição, edição, exclusão, finalização de pendências e mudanças de equipe continuam restritas no servidor a Conferência/Gestor. O Vistoriador não dispara a reconstrução de apresentações físicas. Conferência/Gestor mantêm a rotina manual existente.

## Não realizadas

Escolher a data, selecionar as visitas e informar um motivo. Outro exige observação. São aceitas até 100 visitas por envio. Visitas futuras não podem ser marcadas. A falta de marcação não confirma realização.

O servidor valida novamente sessão/perfil, linha, protocolo, data, equipe e assinatura da visita. O lote é validado antes de gravar; alterações de equipe/cancelamento/referência antiga são recusadas. A assinatura não substitui a autorização pelo RG.

O envio cria a Pendência e um evento no histórico com o motivo, observação, militar que informou e horário de Brasília, preservando a distribuição original. A informação também é visível ao segundo integrante. Uma mesma visita não gera duas pendências porque os dois militares informaram ou repetiram o envio.

Os dados são confirmados na tela somente após a resposta do servidor. Falha mantém a tentativa para repetir o mesmo envio. Se o registro da pendência ocorreu, mas a etapa do histórico falhou, uma consulta mostra envio pendente de confirmação e permite completar a operação sem nova pendência. Não há transação única entre abas: a recuperação se apoia em IDs estáveis e etapas repetíveis.

Não realizadas legadas da mesma data/protocolo/equipe são reconhecidas mesmo após a redistribuição, para evitar duplicação da visita anterior. A pendência de origem da nova distribuição não é herdada como resultado da visita nova. Correções e redistribuição devem seguir o fluxo da Conferência, não a edição direta das abas.

## Armazenamento e desempenho

Adiciona automaticamente somente quando ocorrer o primeiro registro:

- Coluna 27 de ROTEIRO_VISTORIAS: ID_VISITA_CHECKLIST.
- Coluna 18 de HISTORICO_VISTORIAS: ID_EVENTO_CHECKLIST.

As colunas anteriores e os históricos são preservados. Se uma dessas posições já tiver outro cabeçalho, a rotina recusa a gravação e pede verificação, em vez de sobrescrever. Não é necessário executar migração ou configurar gatilho.

Minhas Vistorias lê a coluna de datas e os blocos do dia, filtra o RG no servidor e consulta as pendências apenas quando há visitas da equipe. O registro agrupa validações/leitura dos alvos e grava em lote as novas pendências e eventos; IDs contíguos também são gravados em bloco. Não reconstrói ROTEIRO nem recarrega a lista inteira após cada envio confirmado.

Não envia e-mails, não altera o SIAPI, não implementa o checklist de confirmação de realizadas e não altera as regras dos indicadores. Os indicadores continuam identificando não realizadas pelas Pendências.

## Instalação e testes

Atualizar WebApp.gs e Index.html, salvar e publicar nova versão. Testes com dados fictícios e serviços Google simulados incluem acesso por perfil, proprietário/segundo integrante, lote com outra equipe, cancelamento e referência antiga, dia futuro, repetição, falha entre etapas, consulta de duas mil linhas, telas operacionais da Conferência e viewport móvel. A consulta pessoal não grava na planilha. Os testes não medem o tempo real da implantação Google nem substituem uma validação com a conta real do Vistoriador.

## Motivos e vínculo com o dia da visita

Novos registros pelo vistoriador oferecem somente IMPEDIMENTO OPERACIONAL (NÃO DEU TEMPO) e OUTRO. Outro continua exigindo observação. Os outros motivos são recusados para novos envios pessoais; os registros históricos não são reescritos. O valor antigo IMPEDIMENTO OPERACIONAL é aceito como equivalente e normalizado para o novo texto.

A identificação de pendência pessoal exige também a mesma data e protocolo, mesmo quando há ID técnico coincidente. Uma nova visita do mesmo protocolo em outro dia não herda a indicação de não realizada.

No fluxo manual da Conferência, a busca não oferece visitas futuras, o envio informa a data selecionada e o servidor valida esse vínculo sob trava. O histórico recebe um novo evento com a data e equipe corretas, sem sobrescrever o último evento apenas por número do protocolo. Chamadas antigas sem referência usam a visita mais recente até hoje. Consultar Vistorias do Dia mantém a separação já existente de data + protocolo. Não há limpeza nem correção automática de históricos antigos sem confirmação da visita a que pertencem.

Validação desta entrega: 269 testes automatizados e 30 cenários Chromium relacionados (Gestor/escala, Vistoriador, Controle de dados e consulta PSE), com serviços Google simulados.
