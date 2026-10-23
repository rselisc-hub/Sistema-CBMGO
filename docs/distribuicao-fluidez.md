Distribuição de vistorias — redução da finalização

Escopo: confirmar lançamento/distribuição e a sincronização derivada que concorria pela mesma trava. A leitura/colagem de SIAPI, parser, persistência da entrada, renderização da prévia e salvamento automático das preferências de cópia foram preservados. O teste compara o código dessas funções com ebb4e9b para comprovar que não mudaram.

A checagem de duplicidade lê data/protocolo e, quando necessário, status em consultas por lote. Continua impedindo o mesmo protocolo na mesma data, permite novo lançamento após cancelamento e preserva notas, histórico, prioridades e períodos. As abas são inicializadas dentro da trava da distribuição.

A validação de afastamentos lê a base uma vez e verifica somente os militares envolvidos nas datas solicitadas. A regra de elegibilidade continua usando função VISTORIADOR ou compatibilidade por nome; o mapa de funções é obtido uma vez, evitando reler pessoal para cada afastamento. Todos os itens são validados antes da gravação do lote.

A finalização do rascunho lê somente data/protocolo e status, em duas consultas. Atualiza em lote apenas RASCUNHO da data e dos protocolos confirmados. REMOVIDO, LANÇADO, outras datas e outros protocolos permanecem. Origens de pendência/solicitação são localizadas uma vez por base e os status são gravados em lote. Pendências de cadastro manual mantêm seus dados complementares, com blocos menores de escrita e preservação das outras colunas.

A geração de ROTEIRO/MODELO em segundo plano agora usa uma posse registrada em propriedades e uma trava curta para coordená-la. Não segura ScriptLock durante a renderização em segundo plano; a distribuição continua protegida por ScriptLock. Todas as entradas antigas da geração usam a mesma posse, inclusive as chamadas que já possuem trava (passada explicitamente, sem aquisição aninhada). A geração antiga com trava externa preserva essa trava. As gravações são efetivadas antes de publicar uma revisão única. Ao concluir, a geração só apaga a revisão que processou; um lançamento posterior continua pendente. Uma falha mantém a revisão, libera a posse e pode ser repetida. Interrupção sem finalização pode manter a posse por até 7 minutos, depois recuperável. As consultas do aplicativo continuam usando ROTEIRO_VISTORIAS; as abas de apresentação podem ficar pendentes até a próxima sincronização, como antes.

A confirmação na tela não usa alerta bloqueante após sucesso. Mostra o resultado no status e remove os protocolos confirmados localmente. O modal bloqueia edição/cliques repetidos durante o envio, preserva valores em falha e só indica sucesso após resposta válida. O fechamento também funciona se o servidor responder durante a animação de abertura do modal.

Comparação local com ebb4e9b: 1.000 linhas antigas no roteiro, 1.000 no rascunho, 40 afastamentos de outros militares e origens de pendência/solicitação no lote. Foram comparados os conteúdos de todas as bases, notas e resposta:

| Lote | Leituras antes/depois | Buscas antes/depois | Gravações antes/depois | Soma antes/depois |
| --- | --- | --- | --- | --- |
| 5 | 88 / 7 | 10 / 0 | 38 / 18 | 136 / 25 |
| 27 | 132 / 7 | 54 / 0 | 170 / 62 | 356 / 69 |

Esses números são operações instrumentadas de leitura/busca/gravação na simulação, incluindo leitura simulada de funções de pessoal. Não incluem todas as chamadas de metadados, flush ou PropertiesService, nem medem latência real do Google. A redução não é uma promessa equivalente de segundos ou percentual de velocidade em produção.

Validação acumulada: 168 testes Node e 60 cenários Chromium com serviços Google simulados. Os novos testes cobrem lotes de 5/27, afastados, rascunhos, repetição/cancelamento, cópia intacta, concorrência com geração, revisão nova, falha/expiração da posse, trava preexistente, publicação após flush e confirmação/falha da tela. O teste de clique duplo de DOCs também passou a usar barreira explícita no mock, evitando depender da velocidade do computador para verificar o estado anterior à gravação.

Atualização: substituir WebApp.gs e Index.html juntos pelo ZIP, salvar e publicar nova versão. Sem migração, limpeza ou novo gatilho. Nenhuma implantação ou medição no Google real foi feita neste ambiente.
