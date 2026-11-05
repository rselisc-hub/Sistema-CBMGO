# Conferência: APROVADO e EXPIRADO fora da fila operacional

05/11/2026. A regra das demais divisões permanece: concluir a verificação encerra o ciclo. A exceção F-7 passa a encerrar o ciclo tanto em APROVADO quanto em EXPIRADO. Os demais resultados de F-7 continuam retornando à fila disponível.

Concluir um F-7 como EXPIRADO agora grava CONCLUÍDO, preserva a auditoria da conclusão e devolve permaneceNaFila=false à interface. A interface existente retira o protocolo após a resposta confirmada, sem consulta completa adicional.

Registros antigos que tenham permanecido operacionais com APROVADO/EXPIRADO e data de conclusão são omitidos da fila e dos respectivos contadores. A mesma regra vale no resumo do Gestor e impede assumir esses registros por uma lista antiga. A consulta não altera suas linhas nem gera eventos fictícios. Consulta Geral e indicadores históricos permanecem disponíveis.

Uma nova atribuição/reabertura limpa a conclusão anterior e pode voltar à fila; indicação de nova movimentação ou data/hora de movimentação posterior à conclusão também preserva o retorno. Isso evita ocultar um novo ciclo só porque STATUS_SIAPI ainda contém o resultado do ciclo anterior.

A conferência da planilha enviada pelo usuário mostrou oito F-7 disponíveis: seis sem status e dois com EXIGÊNCIA. Nenhum deles era APROVADO/EXPIRADO. Portanto essa cópia não sofre redução desses oito casos por esta regra; ela evita que novos expirados voltem à fila e trata eventuais registros antigos elegíveis. A análise foi local, sem alteração da planilha de produção.

Sem novas abas/colunas, sem migração e sem novas buscas na conclusão. O resumo do Gestor lê status/estado em lote e busca detalhes somente dos registros operacionais candidatos à exclusão, sem varredura completa de todas as colunas.

Verificação: 337 testes locais e 13 cenários Chromium relacionados passaram, com Google simulado. Oito testes novos verificam APROVADO/EXPIRADO nas divisões F-7/C-1, manutenção de F-7 em exigência, tratamento de registros antigos, preservação da Consulta Geral/histórico, nova movimentação/reabertura, bloqueio de assumir e consistência do resumo do Gestor. Os cenários existentes cobrem reabertura autorizada (5) e DOCs/rascunhos/último conferente (8).

Instalação: nesta alteração apenas WebApp.gs mudou. Substituir o arquivo, salvar e publicar nova versão. O ZIP inclui também Index.html, igual ao da versão c3e4c6b, para instalação completa. Depois consulte/atualize a fila; telas já abertas não recebem transmissão automática.
