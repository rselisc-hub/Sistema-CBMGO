Atendimento — revisão de fluidez

Foram revisados os quatro acessos do módulo: Atendimentos, Solicitações de vistoria, Roteiro dos vistoriadores e DOCs para Despacho. DOCs conserva as melhorias de gravação e listagem das versões anteriores.

Atendimentos e solicitações agora bloqueiam envio e edição durante a gravação. Cada tentativa recebe uma chave reutilizada na repetição após falha. No servidor, ScriptLock coordena a checagem e a escrita; a identificação e assinatura do conteúdo ficam na planilha. Novos atendimentos legítimos com dados iguais são permitidos. Solicitações continuam impedindo dois pendentes do mesmo protocolo, inclusive de usuários distintos. Repetir o envio original confirma a mesma linha mesmo depois de movimentada.

Os nove campos originais de ATENDIMENTOS foram preservados, incluindo o tipo Date e o formato da data. São acrescentadas as colunas 10 ID_ENVIO e 11 ASSINATURA_ENVIO. SOLICITACOES_VISTORIA mantém as primeiras 12 colunas e acrescenta 13 ASSINATURA_ENVIO. Não há mudança de planilha de armazenamento nem exclusão de dados. Versões antigas sem chave permanecem compatíveis, mas o registro de atendimento sem chave não tem garantia de repetição segura.

Após um atendimento confirmado, os contadores carregados para o dia são incrementados sem nova leitura completa. Na abertura, em repetição ou mudança de dia, são consultados no servidor. São contadores de consulta, sem atualização contínua dos atendimentos de outras pessoas; reabrir atualiza. Respostas antigas não sobrescrevem uma confirmação recente. O resumo continua lendo somente duas colunas quando necessário.

A solicitação pesquisa a coluna de protocolos e lê os detalhes apenas dos candidatos encontrados. Roteiros com data selecionada leem primeiro a coluna de datas e então as linhas correspondentes. Consultar todos preserva o retorno completo, sem novo limite de resultados. Equipes, cores e afastamentos foram comparados com a versão anterior. Na tela, o roteiro permanece visível enquanto atualiza; pedidos iguais em andamento são reunidos e respostas antigas de outro filtro são ignoradas. Reabrir a consulta busca a versão atual.

Teste local de volume: 2.000 linhas, 20 da data selecionada: leitura de 54.000 para 2.540 células (redução aproximada de 95,3%), com o mesmo resultado. Isso mede volume de leitura em simulação, não latência ou execução no Google.

Validação: 139 testes Node e 40 cenários de navegador (Chromium), com serviços Google simulados. Inclui perda da resposta após escrita, repetição, assinatura divergente, bloqueio ocupado, duplicação pendente, múltiplos atendimentos legítimos, preservação de equipes/afastamentos/cores, contadores sem segunda consulta e troca rápida de datas.

O estado da tentativa fica na memória da página: em falha, manter dados e repetir na mesma página. Fechar/recarregar perde essa chave; consultar antes de recadastrar. A saída do sistema espera envios ativos e avisa ao abandonar tentativas não confirmadas. Atualizar WebApp.gs e Index.html juntos, salvar e publicar nova versão.
