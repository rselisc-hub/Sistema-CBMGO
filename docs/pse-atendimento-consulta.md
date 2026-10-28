# Escala PSE — Consulta no Atendimento

Em Atendimento, abrir **Escala PSE — Consulta**. Usa a mesma escala operacional consultada pelo Gestor: data, posto/graduação, RG, nome, função, horário, turno e OS/SEI/RAI. Permite consultar um dia ou toda a escala. Voltar retorna ao Atendimento.

A navegação operacional de Vistorias fica oculta nessa entrada, inclusive para Gestor usando a consulta pelo Atendimento. Não há lançamento, edição ou remoção de militares nessa tela. A navegação anterior continua disponível ao entrar por Vistorias.

O servidor permite a leitura para ATENDIMENTO, CONFERENCIA e GESTOR. As autorizações de gravação não foram ampliadas. Atendimento não cria/sincroniza a planilha caso ela esteja ausente; recebe uma lista vazia. A consulta não duplica dados nem altera o esquema do banco.

Respostas antigas de consulta são descartadas por sequência e token. Encerramento de sessão limpa o conteúdo e invalida respostas em andamento.

Substituir WebApp.gs e Index.html do ZIP, salvar e publicar uma nova versão. Sem migração ou novo gatilho. Testes com Google simulado cobrem perfis, nenhuma gravação, abas ausentes, bloqueio das alterações por chamada direta, filtros, navegação e fim da sessão.
