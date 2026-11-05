# Reserva de pendências no rascunho

05/11/2026. Atualizar WebApp.gs e Index.html juntos e publicar nova versão.

## Comportamento

Adicionar ao roteiro reserva o ID específico da pendência ou solicitação no rascunho ativo. Depois da confirmação, o item sai da lista disponível. A consulta do Atendimento usa a mesma regra. Não se considera a vistoria resolvida/realizada nesse momento: o histórico e o status original da pendência são preservados até a distribuição.

Remover um rascunho, limpar a data ou arquivar a linha faz o item reaparecer na próxima consulta, desde que não haja outra distribuição ativa vinculada àquela origem. Depois de distribuir, o fluxo anterior atualiza a origem para redistribuída/distribuída. Nova não realização do mesmo protocolo tem outro ID e continua independente.

## Integridade

- Se o protocolo já estiver no rascunho, a inclusão pelas Pendências incorpora o vínculo sem duplicar a linha nem sobrescrever prioridade, observação ou dados SIAPI.
- Não substitui um vínculo com outra pendência do mesmo tipo; mostra erro para conferência.
- Sob o bloqueio de escrita já existente, verifica se a origem está reservada em outro dia/protocolo. Repetição na mesma data/protocolo é idempotente.
- A tela só remove o item após resposta de sucesso contendo o protocolo e o vínculo esperado. Falha ou protocolo bloqueado por já estar distribuído na data não produz confirmação falsa.
- Clique duplo bloqueado. A cópia comum do SIAPI não ganha essa verificação adicional de reservas.
- Usa as colunas de origem e status já existentes; não cria tabelas, colunas nem exige migração. A reserva é derivada dos rascunhos ativos, evitando status de reserva órfão após remoção/arquivamento.
- Consultas fazem uma leitura em lote de sete colunas do rascunho para conferir reservas; não consultam por pendência individual. Na inclusão originada nas Pendências, data/protocolo só são lidos para as reservas correspondentes. Outras sessões já abertas precisam atualizar a lista para ver a mudança.

## Registros anteriores

Rascunhos já vinculados passam a ocultar a pendência ao atualizar a consulta. Se um protocolo tinha sido copiado ao rascunho sem o vínculo, use Adicionar ao roteiro pelas Pendências para a mesma data: a operação associa a linha existente, preservando os dados. Não há associação automática apenas pelo número do protocolo, para não consumir uma ocorrência diferente.

## Verificação

315 testes locais e 31 cenários Chromium relacionados passaram, com serviços Google simulados. Seis testes novos cobrem reserva por ID, retorno após remoção/limpeza, vínculo de protocolo previamente copiado, conflitos entre datas, reativação, distribuição e nova pendência do mesmo protocolo. Quatro cenários novos no navegador verificam confirmação, clique duplo, retorno e falhas sem remoção antecipada. Sem execução na planilha de produção.
