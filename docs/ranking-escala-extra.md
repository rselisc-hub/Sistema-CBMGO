# Escala extra no ranking — 06/11/2026

O formulário Escala Extra inclui “Contar para o ranking”, marcada por padrão. A escolha é enviada ao servidor e registrada como SIM/NÃO na coluna O (CONTAR_RANKING) de CONTROLE_ESCALAS. A coluna N continua reservada à função manual. Se O contiver dados de outra finalidade, a inclusão é interrompida sem sobrescrevê-los.

Novas escalas extras marcadas entram no ranking mensal e no parâmetro de ranking exibido na lista de voluntários, respeitando mês, classificação azul/vermelho e status ESCALADO. Desmarcadas ficam fora. Registros antigos sem marcador mantêm exatamente a regra anterior. Não há alteração retroativa nem mudança nos cálculos financeiros, cotas ou funções.

Atualizações de OS/SEI/RAI preservam o marcador. Após salvar com sucesso, o formulário volta à opção marcada; falhas conservam os campos. O ranking utiliza a leitura em lote existente, ampliada para 15 colunas, e uma leitura do cabeçalho, sem consulta por militar.

Verificação local: 350 testes unitários aprovados e sete casos no Chromium com serviços Google simulados. Incluem mês, cores, removidos, extras antigos, SIM/NÃO, duplicidade, preservação após OS/SEI/RAI e retorno do checkbox ao padrão após salvar. Sem acesso ou medição no Google em produção.

Instalação: substituir WebApp.gs e Index.html do mesmo ZIP e implantar nova versão.
