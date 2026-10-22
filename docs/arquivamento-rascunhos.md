# Arquivamento de rascunhos após 15 dias

Escopo exclusivo: aba RASCUNHO_ROTEIRO. ROTEIRO_VISTORIAS, HISTORICO_VISTORIAS, Conferência e demais bases estatísticas não são limpas por esta rotina. O tratamento de colagem do campo Vistoriado por foi preservado.

## Regra

Somente RASCUNHO e REMOVIDO, com protocolo preenchido, data do roteiro anterior ao dia atual e SALVO_EM válido há pelo menos 15 dias. LANÇADO, datas futuras, hoje e datas inválidas permanecem. Abrir os rascunhos de uma data, reimportar um protocolo ativo ou removê-lo renova SALVO_EM. O prazo usa a hora de São Paulo. Edições ainda não salvas no navegador não fazem parte da cópia.

Há um lote de até 50 linhas por execução diária, aproximadamente entre 03h e 04h de São Paulo. Uma execução ocupada pelo uso do sistema é pulada. Assim, não se deve esperar que todas as mil linhas desapareçam ao ativar, especialmente registros LANÇADO.

## Armazenamento e segurança da cópia

O instalador cria outra planilha no Drive da conta executora, ARQUIVO_RASCUNHOS_DIC, aba RASCUNHOS_ARQUIVADOS. A aba de origem recebe somente uma coluna adicional, ARQUIVO_RASCUNHO_ID (24). Nenhuma coluna existente é deslocada. A cópia guarda os 23 campos originais, ID e metadados de origem, arquivamento e recuperação.

A rotina confere a cópia gravada antes de excluir blocos da origem. Também relê cada bloco antes da exclusão e preserva o que divergir. Um ID permite repetir a operação após falha sem duplicar a cópia. IDs duplicados ou incompatibilidades interrompem ou preservam os registros afetados. O bloqueio de script coordena as operações do aplicativo; mudanças manuais diretas nas planilhas não respeitam esse bloqueio, portanto evite editar a base durante a execução. Não há transação entre duas planilhas.

## Consulta e recuperação

Na tela Roteiros, junto de Limpar lista inteira: Rascunhos arquivados. Somente Conferência e Gestor, também validados no servidor. Selecione antes a data original do roteiro. A consulta mostra até os últimos 100 registros dessa data. Recuperar devolve o registro como RASCUNHO, renova SALVO_EM e marca a cópia como recuperada. Não sobrescreve outro rascunho ativo do mesmo protocolo/data. A cópia arquivada permanece. Uma lista local com trabalho em andamento não é recarregada automaticamente.

A planilha separada não recebe compartilhamento automático. A implantação deve executar como a conta responsável que tem acesso às duas planilhas. Caso execute como usuário acessando, esse usuário precisará das permissões correspondentes no Google, além do perfil no aplicativo.

## Ativação no Google

1. Faça backup e atualize WebApp.gs e Index.html, inicialmente na cópia de teste. Preserve os demais scripts.
2. No editor vinculado à planilha correta, execute simularArquivamentoRascunhos_: apenas informa contagens, não move dados.
3. Com a conta responsável, execute instalarArquivamentoRascunhos_ uma vez e autorize as permissões solicitadas pelo Google. O log mostra o link da planilha de arquivo. Se o projeto não estiver vinculado, configure antes a propriedade RASCUNHO_ORIGEM_ID com o ID da base correta.
4. Publique uma nova versão da implantação para disponibilizar a interface. A instalação do gatilho é uma etapa separada da publicação.
5. Confira a nova planilha e as execuções do gatilho. Para interromper: desativarArquivamentoRascunhos_. Isso não apaga nenhuma cópia.

Não reutilize as propriedades RASCUNHO_ORIGEM_ID e RASCUNHO_ARQUIVO_ID do teste na produção: cada origem deve ter seu próprio arquivo. Reexecutar o instalador na mesma conta não duplica o gatilho dessa conta. Contas diferentes têm seus próprios gatilhos: use uma única responsável.

## Validação

66 testes locais passaram, incluindo retenção, preservação de lançados, cópia divergente, falha e repetição, concorrência simulada, limite de lote, recuperação repetida, colisão de rascunho ativo, novo ciclo e instalação repetida. Verificação de sintaxe do backend e dos scripts HTML. Testes usam serviços Google simulados; não houve execução, medição de tempo, instalação de gatilho ou alteração de planilhas no Google neste ambiente.
