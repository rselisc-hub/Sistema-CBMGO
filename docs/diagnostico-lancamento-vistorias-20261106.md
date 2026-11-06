# Verificação local de lançamento de vistorias — 06/11/2026

Executados lotes de 5, 20 e 27 protocolos com 1.000 e 10.000 linhas fictícias tanto no roteiro quanto no rascunho. Todos foram lançados na quantidade esperada. Os testes de regressão também verificam repetição sem duplicar, prioridade preservada, afastamento, falha recuperável e concorrência.

No cenário simulado, o contador registra seis leituras e duas buscas para todos os lotes. As escritas registradas são 18/46/62 para lotes de 5/20/27. Os números se repetem com 1.000 e 10.000 linhas: representam chamadas contadas pelo adaptador, não tempo, chamadas HTTP reais ou custo do Google. O cenário usa metade das origens de pendência como CADASTRO MANUAL; cada uma requer quatro escritas específicas para preservar outros campos. Preparação de abas, normalização de região e sincronização derivada são substituídas no adaptador. Resultados brutos no JSON ao lado; executar `node tests/diagnostico-lancamento-vistorias.cjs`.

Pontos observados no código real:

- Distribuição grava roteiro e histórico em lote e confirma antes da sincronização das planilhas derivadas. O cliente impede envio duplo e preserva os dados após falha.
- A busca de distribuições usa variações de data por TextFinder e lê as linhas encontradas. Para mais de três datas, lê as colunas data/protocolo e depois status. Não é uma busca individual para cada protocolo.
- Finalização do rascunho lê as colunas data/protocolo e status de todas as linhas utilizadas. O número de chamadas permanece estável, mas o volume de dados cresce com a planilha; o teste não prova que uma base maior terá a mesma latência no Google.
- Origens de pendência manual ainda fazem quatro gravações por origem. Este é um candidato concreto a otimização, dependendo de quais origens estão lentas no uso real.
- A distribuição aguarda o bloqueio compartilhado por até dez segundos; outras rotinas concorrentes podem consumir essa espera. O teste local não demonstra que isso esteja ocorrendo em produção.
- A seleção consulta os afastamentos uma vez ao abrir o formulário, antes da confirmação. Não há consulta por militar.

Não foi alterada a distribuição nesta revisão, nem a cópia do SIAPI. Não há acesso ao ambiente Google implantado para confirmar o gargalo ou fornecer um tempo real. Para fechar o diagnóstico de produção, comparar duração e horário das execuções de `lancarDistribuicaoRoteiroSiapi` e da sincronização no histórico de Execuções do Apps Script durante um lançamento lento.
