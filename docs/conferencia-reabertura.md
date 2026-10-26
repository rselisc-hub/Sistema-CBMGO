Conferência — correção de conclusão indevida

Local: Conferência > Consulta Geral, botão Reabrir ao lado do histórico. Aparece somente em registros de estado interno CONCLUÍDO, para GESTOR ou usuários CONFERENCIA com permissão individual de atribuição. Não cria opção para Atendimento, Vistoriador, Consulta ou conferente sem atribuição.

A ação exige motivo (até 1.000 caracteres). O servidor usa exigirAtribuicaoConferencia_, que confere a permissão na base de ACESSOS; não aceita uma permissão enviada pelo navegador. A validação é repetida após adquirir ScriptLock, antes da mudança. Chamada direta por usuário não autorizado também é recusada.

Só reabre o registro ainda CONCLUÍDO da consulta apresentada. Ciclo, data de conclusão e última atualização são comparados com a referência da tela. Se mudou, exige atualizar; assim uma tela antiga não desfaz uma conferência posterior. O botão e os campos ficam bloqueados durante o envio, e a situação da base é checada sob trava contra repetição/concorrrência.

Resultado: estado DISPONÍVEL, sem RG/nome de conferente e sem datas atuais de início/conclusão. Abre novo ciclo, registra responsável/data da disponibilização e atualiza o horário. O protocolo volta à fila comum e pode ser assumido pelo fluxo normal. Preserva cadastro, movimentação, observação, dados de importação e último status informado do SIAPI. Não faz alteração no SIAPI externo. A consulta continua exibindo o último conferente por meio do histórico.

O histórico anterior não é apagado. A tentativa é registrada antes da mudança como REABERTURA SOLICITADA, com motivo, autor, última conclusão e último conferente. Após a gravação confirmada, a mesma linha passa a REABERTO PARA CONFERÊNCIA com o novo snapshot. Se houver interrupção, uma tentativa solicitada pode permanecer sem confirmação; a tela orienta consultar a situação antes de repetir. Os registros antigos de conclusão permanecem nos indicadores; reabrir não inventa nem apaga uma conferência histórica.

Após sucesso, a consulta é recarregada, o botão deixa de aparecer para aquele protocolo disponível e respostas antigas da consulta/fila são invalidadas. Em falha, mantém o motivo e não anuncia sucesso antecipado. Também foi alinhada a célula de observação ao cabeçalho já existente da Consulta Geral.

Validação acumulada: 195 testes Node e 70 cenários Chromium com serviços Google simulados. Cobertura nova: perfis negados, permissão individual real versus flag forjada, Gestor/atribuidor autorizados, revogação durante espera/modal, estados não concluídos, referência desatualizada, motivo obrigatório, clique duplo/repetição, preservação de dados/histórico e falhas de auditoria/gravação. Não houve acesso nem alteração no Google de produção.

Instalação: substituir WebApp.gs e Index.html juntos, salvar e publicar nova versão. Sem novas colunas, planilhas ou gatilhos.
