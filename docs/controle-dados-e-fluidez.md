# Controle de dados no Gestor e revisão de fluidez

A administração do arquivo saiu de Roteiros e ficou exclusivamente em Painel do Gestor → Controle de dados. Conferência não tem acesso, inclusive por chamada direta ao servidor. O painel permite atualizar contagens, ativar/pausar o agendamento, arquivar um lote e consultar/recuperar pela data original.

## Configuração pelo próprio aplicativo

Depois de substituir ambos os arquivos, salvar e publicar uma nova versão, o primeiro acesso autenticado de Gestor configura a planilha separada e o gatilho diário. O login não espera essa chamada terminar. Se o Google exigir permissões adicionais ou a configuração falhar, o painel mostra o erro e permite tentar novamente. Não é necessário escolher funções no editor para uso normal. Uma pausa explícita não é desfeita por novos acessos.

A instalação automática repete a verificação dentro do bloqueio, evitando duas instalações concorrentes. A configuração é exclusiva da planilha de origem. IDs de uma implantação de teste não devem ser reutilizados na produção. A conta de execução precisa de acesso às duas planilhas e autorização para criação de arquivo/gatilho. Nenhum compartilhamento externo é criado.

As regras de retenção permanecem: apenas RASCUNHO/REMOVIDO sem atividade há 15 dias e de data anterior a hoje, cópia verificada antes da exclusão, até 50 linhas por execução. Lançamentos e estatísticas são preservados. Veja [arquivamento-rascunhos.md](arquivamento-rascunhos.md).

## Resposta imediata com confirmação de gravação

Na conclusão de Conferência, o protocolo sai da lista local assim que o usuário confirma. A tela informa “Salvando na planilha”; contadores de conclusão só avançam após a resposta do servidor. Em caso de erro, o protocolo volta e status/observação digitados ficam disponíveis em Reabrir anotação durante a sessão. Não há repetição automática de gravação. O usuário pode atualizar a fila para resolver uma falha de comunicação que tenha ocorrido após a escrita no Google.

A fila não é reaplicada enquanto essa conclusão está pendente e respostas anteriores são descartadas. Outra conclusão aguarda a confirmação da primeira. Fechar/sair com gravação pendente ou anotação não confirmada é tratado para reduzir perdas. A anotação não é persistida no navegador: sair/fechar descarta a cópia local conforme a confirmação exibida. A janela também fecha corretamente quando a conclusão acontece durante a animação de abertura do Bootstrap 5.3.

Reservar, liberar e assumir protocolos continua sendo confirmado no servidor com bloqueio e validação de responsável. Depois da confirmação, a resposta atualiza a lista local e os contadores, sem forçar uma nova leitura completa da fila. A atualização periódica entre usuários permanece. Não foram criadas escritas silenciosas/offline ou mudanças antecipadas em permissões, reservas, estatísticas ou valores financeiros.

## Revisão dos módulos

| Módulo/rotina | Resultado desta rodada |
|---|---|
| Conferência: assumir lote | Cinco RangeLists para os campos alterados e uma gravação do histórico por lote; mantém conflitos e deduplicação. |
| Conferência: assumir/liberar individual | Consulta uma coluna e a última linha correspondente; grava estado/responsável juntos. |
| Conferência: fila/atribuição/consulta | Leitura das 27 colunas necessárias, corrigindo ausência dos sinalizadores e horário que estavam nas colunas 24–27. |
| Conferência: histórico | Lê a coluna de protocolos e somente os blocos dos eventos encontrados. |
| Conferência: interface | Conclusão com estado pendente/recuperação; menos recargas após operações; conserva tabela existente enquanto atualiza. |
| Gestor: indicadores | Lê apenas as colunas que alimentam as contagens. |
| Atendimento: resumo | Lê data/usuário, duas colunas em vez de nove. |
| Credenciamento: resumo | Colunas necessárias do processo; identifica eventos de hoje antes de ler detalhes históricos. |
| Documentos: histórico | Busca IDs em uma coluna, detalhes apenas nas linhas correspondentes. |
| Documentos e Afastamentos: filtros | Índices preparados em uma passagem; elimina indexOf repetido por linha, mantendo ações de edição corretas. |
| Atendimento, Pendências e Escala extra: listas | Monta opções de seleção com uma atualização de HTML, preservando escape de texto. |
| Vistorias/SIAPI/distribuição | Mantidas as otimizações anteriores e testes de regressão; parser de Vistoriado por preservado. |
| Ranking, financeiro, PDFs e escalas | Mantidos cálculos, critérios, limites e geração existente. Testes de regressão anteriores continuam passando; serviços Google e reconstrução de relatórios ainda exigem medição real. |

## Evidência e limites

Referência desta rodada: commit a815433. Serviços Sheets simulados, sem dados privados nos testes:

| Cenário | Antes | Depois |
|---|---:|---:|
| Assumir 5 protocolos: gravações | 30 | 6 |
| Assumir 27 protocolos: gravações | 162 | 6 |
| Assumir 800 protocolos: gravações | 4.800 | 6 |
| Histórico, 1.000 eventos com 10 do protocolo: células lidas | 12.000 | 1.120 |

As contagens isolam as operações de dados, com estruturas já preparadas. Não incluem todo método de metadados e não representam segundos, percentual de latência ou garantia de velocidade no Google.

86 testes Node passaram; 10 cenários adicionais passaram no Chromium local com o HTML completo, Bootstrap 5.3 e ponte Google simulada. Cobrem login inicial, acesso/painel, pausa/ativação, consulta/recuperação, respostas fora de ordem, restrição de Conferência, conclusão otimista, falha/anotação, filtro de 800 documentos e filtro de 800 afastamentos. Nenhuma implantação ou planilha real foi alterada por estes testes.

Executar:

```sh
node --test tests/*.test.cjs
# Navegador: Playwright e Chromium instalados; caminhos podem ser configurados por variáveis.
curl -fsS https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js -o /tmp/cbmgo-bootstrap.js
curl -fsS https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css -o /tmp/cbmgo-bootstrap.css
node tests/browser-controle-fluidez.cjs
```

Persistem custos de rede, permissões/cotas Google, geração de PDF e reconstrução das planilhas derivadas. A medição de ponta a ponta no Google continua pendente; esta revisão não torna todas as operações instantâneas nem altera regras de negócio para aparentar velocidade.
