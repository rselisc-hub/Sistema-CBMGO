Gestor — escalas, voluntários, PSE e distribuição

Revisão baseada na versão 6503f05. O objetivo foi reduzir leituras repetidas, escrita de planilhas durante consultas, formatação por pessoa e recargas desnecessárias depois de gravar.

Distribuição: para lotes de até três datas (a interface normalmente usa uma), a verificação de duplicidade busca as datas na coluna A e carrega os blocos correspondentes. Continua verificando protocolo/data/status, ignorando cancelados e mantendo a trava de lançamento. Para mais datas, mantém o índice estreito anterior. A cópia do SIAPI e as regras de rascunho, afastamento, notas e prioridade permanecem.

Ranking e inscrições: consultas calculam o ranking em memória, sem limpar/regravar RANKING e reler essa aba para montar o mapa. A consulta de inscritos reutiliza o cadastro de militares já lido para calcular o ranking e lê somente as oito colunas utilizadas da lista. As rotinas de alteração e o recálculo explícito continuam persistindo RANKING; escolher um filtro na consulta não muda mais o conteúdo físico dessa aba. Ordenações, posições, empates, exclusão de EXTRA e contagens por dia azul/vermelho foram preservados.

Escala PSE: preparação de registros e montagem visual foram separadas. A consulta de grade monta a mesma matriz diretamente do controle, sem reconstruir/formular a planilha física. Os filtros inicial/final passam a ser aplicados, com período inclusivo. A aba física Escala PSE continua sendo atualizada pelas rotinas de gravação, sem adiamento novo. Na reconstrução, a matriz de cores é escrita de uma vez, em vez de chamada por militar, e a formatação comum das observações é aplicada à coluna em lote. Conteúdo, prioridade da função/RG da lista de voluntários, agrupamento DIA/TURNO, mesclagens, cores e bordas foram preservados. O endpoint da Escala PSE aceita explicitamente GESTOR e CONFERENCIA, conforme as telas que o utilizam.

Gravações: atualizações de OS/SEI/RAI e cancelamentos usam RangeList para as células encontradas, preservando as demais colunas. As consultas de duplicidade de escala, remoção e OS/SEI/RAI leem sete colunas, suficientes para seus critérios. Escala extra, remoção e OS/SEI/RAI passam a usar ScriptLock na checagem/gravação; voluntários já possuíam essa trava. A compatibilidade da função OS/SEI/RAI com quatro argumentos foi mantida. Não houve alteração de campos, tabelas ou regras de elegibilidade. A regra diária dos voluntários e a regra por turno da escala extra permanecem como antes.

Financeiro: a classificação por minuto foi substituída por intervalos que terminam às 05h, 22h ou meia-noite, pontos em que a tarifa pode mudar. Mantém as mesmas tarifas, separação diurno/noturno e dias azuis/vermelhos, inclusive na virada do serviço. Foram comparados exatamente 248 casos de outubro de 2026, com minutos limítrofes, noites, viradas de semana e períodos completos. Valores e horas coincidiram com o algoritmo anterior; não foi introduzida nova regra de pagamento.

Interface: escalar voluntários e gravar escala extra/OS/SEI/RAI bloqueiam cliques repetidos e edição durante o envio; falha mantém campos e permite repetir. Não anunciam sucesso antes da resposta. A atualização do ranking oculto foi retirada do retorno do lançamento; a próxima consulta calcula o valor atual. Consultas do Gestor ignoram respostas de filtros/sessões antigas. A grade e o ranking mantêm a tabela anterior durante atualização. Sair durante gravação solicita aguardar sua confirmação.

Evidências locais (Google simulado):

| Caso | Antes | Depois |
| --- | --- | --- |
| Distribuição, base de 2.000 linhas, 20 da data consultada | 6.000 células lidas | 220 células lidas |
| Formatação PSE, 200 militares em 25 dias | 572 chamadas de formatação | 174 chamadas de formatação |
| OS/SEI/RAI para 10 linhas do turno | 10 gravações de célula | 1 gravação em lote |
| Cálculo de serviço de 6 horas | 361 construções de Date | 3 construções de Date |
| Consulta de ranking | Regrava RANKING | Nenhuma gravação |
| Consulta da grade da escala | Reconstrói a aba física | Nenhuma gravação/formatação |

As contagens representam os métodos instrumentados dos testes e não todos os metadados/chamadas de serviço. Não são uma medição de segundos em produção nem uma promessa de redução proporcional de latência.

Validação acumulada: 179 testes Node e 65 cenários Chromium com serviços Google simulados. Inclui lotes de 5 e 27 voluntários, bloqueios/duplicidades, funções/horários, equivalência de matriz/cores/mesclagens, filtros por período, cálculo financeiro, compatibilidade, trava de escala extra, clique duplo, falha e repetição, OS/SEI/RAI, além das regressões de distribuição e demais módulos. Nenhum dado pessoal real foi adicionado aos testes. Sem implantação ou medição real no Google neste ambiente.

Instalação: atualizar WebApp.gs e Index.html juntos, salvar e publicar uma nova versão. Sem migração, novas colunas ou novo gatilho.
