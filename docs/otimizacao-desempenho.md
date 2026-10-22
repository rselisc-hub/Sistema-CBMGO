# Revisão de desempenho do Sistema-CBMGO

As alterações preservam as abas, colunas e formatos de dados existentes. Não há migração de banco, novo serviço externo ou cache persistente dos dados dos usuários. A referência de comparação é o commit `7f5300f0f89b31286fc4e08e91db5d2ab082b609`.

## Cobertura da revisão

| Processo | Alteração aplicada ou resultado da revisão |
|---|---|
| Login, acessos e troca obrigatória | A migração de troca de senha escreve apenas células vazias, sem regravar a coluna inteira. |
| Pessoal, funções e indicadores | Cabeçalhos lidos em bloco; nomes/graduações só são gravados quando mudam. |
| Afastamentos | Verificação do cabeçalho em bloco; formatação apenas quando a estrutura é criada ou ajustada. |
| Atendimento | Evita repetir formatação e ajuste de largura em cada registro/consulta. |
| Documentos, despachos e isenções | Inicialização compartilhada mais leve, preservando os cabeçalhos existentes. A lógica de decisões e históricos permanece. |
| TACs | CRUD já lê/grava conjuntos pequenos por operação; nenhuma alteração específica foi necessária nesta rodada. |
| Credenciamento | Inicialização mais leve; alimentação e importação histórica gravam blocos de linhas consecutivas, incluindo entradas novas. |
| Conferência: concluir, assumir, liberar, importar e atribuir | Inicialização compartilhada mais leve; bloqueios de escrita compatíveis com Web App. Mantém transições e histórico. |
| Conferência: fila e indicadores | Leituras dos eventos do dia agrupadas; consultas não adquirem o bloqueio de escrita. A fila continua sendo uma fotografia, podendo mudar após sua leitura. |
| Conferência: interface | Impede conclusão duplicada por clique, libera botão em erro, invalida respostas anteriores à conclusão e suspende consulta periódica em página oculta ou durante a conclusão. |
| SIAPI: análise e rascunhos | Busca de múltiplos protocolos em uma leitura de coluna e leitura das linhas encontradas em blocos limitados. |
| Distribuição e pendências | Busca agrupada de existentes, finalização de rascunhos via RangeList, verificação leve de cabeçalhos das solicitações/pendências. |
| Edição de dados SIAPI | Busca só as ocorrências do protocolo, agrupa gravações e preserva campos não editados. |
| Mapa de setores | Evita formatar e redimensionar toda vez que o mapa é consultado. |
| Inscrições | Uma gravação por lote, preservando ordem e filtro de turnos. |
| Escalas PSE/extra | Lançamento de voluntários em lote, preservando bloqueios de duplicidade e sincronização posterior existente. |
| Ranking e financeiro AC-4 | Configuração compartilhada lida em duas faixas; cabeçalhos intactos não são regravados. Salvamento de período e configuração financeira em bloco. Cálculos e critérios de ranking não foram alterados. |
| PDF e preparação para SEI | Consomem os dados existentes; criação/conversão de documento Google permanece síncrona. Não há integração HTTP direta com SEI. |
| Planilhas derivadas de vistorias | Mantida a geração existente e a marcação de sincronização pendente. Reconstrução completa continua sendo um ponto de custo. |

## Evidência local

Execute a partir da raiz do repositório, usando Node.js:

```sh
node --test tests/*.test.cjs
node --check < WebApp_APLICACAO_CREDENCIAMENTO_V94_PRODUTIVIDADE.gs
```

Os testes usam uma simulação de Sheets e comparam saídas, células e históricos com a referência Git. Validam também a proteção da interface contra cliques duplicados e respostas anteriores à conclusão. Não são uma execução dos serviços Google nem uma medição de latência real.

| Cenário simulado | Antes | Depois |
|---|---:|---:|
| Histórico de 100 protocolos: leituras + buscas | 400 | 4 |
| Edição SIAPI com pendência: gravações | 17 | 4 |
| Conclusão de conferência: leituras | 31 | 4 |
| Fila com 100 eventos do dia: leituras | 130 | 4 |
| Alimentação de credenciamento, lote misto de 52 itens: gravações | 52 | 1 |

Essas contagens não incluem todos os métodos de metadados e formatação e não representam segundos ou percentual de ganho em produção. Linhas muito esparsas exigem mais blocos de leitura; blocos têm limite de 500 linhas e lacunas de até 19 linhas. As escritas esparsas só agrupam linhas consecutivas, preservando registros intermediários.

## Validação na implantação Google

1. Usar uma cópia da planilha e uma implantação de teste. Manter a identidade de execução, permissões e fuso da implantação original. No editor Apps Script, o HTML precisa continuar com o nome `Index`, solicitado por `doGet`; os arquivos de testes/documentação não são arquivos do projeto Apps Script.
2. Repetir lotes pequenos, médios e grandes de importação SIAPI, distribuição e edição. Conferir duplicidades, rascunhos removidos/reativados e campos não editados.
3. Concluir protocolos comuns e F-7 com aprovação/exigência; verificar fila, responsáveis, observações e histórico. Testar dois usuários assumindo o mesmo protocolo. As escritas usam ScriptLock, que serializa as operações do script, inclusive de outros módulos; medir contenção junto com geração de planilhas derivadas.
4. Validar credenciamento novo/existente, importação repetida, escalas com duplicados, inscrições, pessoal/afastamentos, documentos/isenções/TACs e financeiro mensal. Conferir os relatórios e PDF.
5. Comparar os tempos nas execuções do Apps Script, com volumes equivalentes e vários usuários. Verificar erros, limites e dados finais. As alterações locais ainda não foram publicadas.

## Trabalho que depende dessas medições

- Dimensionar processamento incremental das planilhas derivadas: hoje ainda há limpeza, reconstrução e formatação completa.
- Avaliar leituras completas do histórico em consultas gerais e reconstrução do ranking; separar o custo por volume real antes de adicionar índices ou outra fonte de dados.
- Avaliar a divisão de trabalhos longos em tarefas retomáveis com gatilhos, preservando o estado e a recuperação de falhas. Nenhum novo gatilho foi instalado nesta revisão.
- Medir conversão de PDF nos serviços Google, renderização de tabelas grandes e contenção do bloqueio global de escrita.

O repositório não inclui o manifesto Apps Script nem a configuração da implantação. A aprovação dos testes locais não comprova desempenho, permissões ou concorrência na implantação real.
