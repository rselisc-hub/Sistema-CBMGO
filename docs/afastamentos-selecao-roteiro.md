# Afastamentos na distribuição — 06/11/2026

A seleção de titular e canga oculta militares com afastamento ativo na data da vistoria, incluindo início e fim. Ao mudar a data, as opções são recalculadas localmente; fora do período o militar reaparece. A troca em lote considera todas as datas selecionadas e exclui quem estiver afastado em qualquer uma delas.

Os períodos ativos são consultados uma vez ao abrir cada formulário de distribuição ou alteração. Falhas na consulta impedem a abertura da seleção. A resposta não contém motivo ou observações. Não há polling nem consulta por militar. Respostas de sessão encerrada são ignoradas.

O servidor revalida distribuição inicial, edição individual e troca em lote antes de gravar os lançamentos. A comparação do RG aceita diferenças de zeros à esquerda e formato numérico. Registros EXCLUÍDO/EXCLUIDO são ignorados. A lista principal de militares e os lançamentos já existentes são preservados; esta alteração não cancela distribuições anteriores ao cadastro do afastamento.

Verificação local: 347 testes unitários aprovados; navegador Chromium confirma ocultação e limpeza de seleção para titular/canga e retorno fora do período. Os testes existentes de distribuição verificam envio duplo, gravação e recuperação após falha com serviços Google simulados. Não houve teste no Google em produção nem medição de latência real.

Instalação: substituir GS e HTML do mesmo ZIP, salvar e implantar nova versão.
