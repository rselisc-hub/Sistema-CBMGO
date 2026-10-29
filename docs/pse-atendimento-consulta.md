# Escala PSE — Consulta no Atendimento

Em Atendimento, abrir **Escala PSE — Consulta**. Usa a mesma escala operacional consultada pelo Gestor: data, posto/graduação, RG, nome, função, horário, turno e OS/SEI/RAI. Permite consultar um dia ou toda a escala. Voltar retorna ao Atendimento.

A navegação operacional de Vistorias fica oculta nessa entrada, inclusive para Gestor usando a consulta pelo Atendimento. Não há lançamento, edição ou remoção de militares nessa tela. A navegação anterior continua disponível ao entrar por Vistorias.

O servidor permite a leitura para ATENDIMENTO, CONFERENCIA e GESTOR. As autorizações de gravação não foram ampliadas. Atendimento não cria/sincroniza a planilha caso ela esteja ausente; recebe uma lista vazia. A consulta não duplica dados nem altera o esquema do banco.

Respostas antigas de consulta são descartadas por sequência e token. Encerramento de sessão limpa o conteúdo e invalida respostas em andamento.

Substituir WebApp.gs e Index.html do ZIP, salvar e publicar uma nova versão. Sem migração ou novo gatilho. Testes com Google simulado cobrem perfis, nenhuma gravação, abas ausentes, bloqueio das alterações por chamada direta, filtros, navegação e fim da sessão.

## Correção da consulta por dia — 29/10/2026

A grade operacional pode exibir datas sem zero à esquerda (5/11/2026). A consulta comparava esse texto diretamente com o filtro formatado (05/11/2026), retornando zero mesmo com militares visíveis na escala completa. Agora as datas são normalizadas em memória antes da comparação e do agrupamento. A origem não é reescrita, a consulta não acrescenta leituras de planilha e cores, turnos e OS/SEI/RAI permanecem associados aos registros.

Dois testes de regressão cobrem datas sem zeros, formatos mistos no mesmo grupo, meses diferentes, ausência de registros e perfis autorizados. O cenário Chromium reproduz a consulta de 05/11/2026 com uma linha armazenada como 5/11/2026, sem incluir a escala de outro dia. Serviços Google simulados.
