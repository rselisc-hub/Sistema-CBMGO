# Controle de Viaturas — Atendimento

Entrega de 05/11/2026. Substituir WebApp.gs e Index.html juntos, salvar e publicar nova versão. Na primeira abertura de Atendimento > Controle de Viaturas, são criadas VIATURAS_CADASTRO e VIATURAS_MOVIMENTOS. Não altera a aba DADOS, roteiros, escala ou respostas do Forms. AV-857 foi excluída da relação inicial a pedido do usuário.

## Cadastro inicial: 14 viaturas

| Prefixo | Placa |
|---|---|
| AV-843 | TGK0A44 |
| AV-841 | TGJ3E34 |
| AV-840 | TGJ2A14 |
| AV-839 | TGI7E74 |
| AV-836 | TGG6G44 |
| AV-835 | TGG2A04 |
| AV-834 | TGF5E54 |
| AV-832 | TGF1B44 |
| AV-831 | TGE3E34 |
| AV-822 | TFZ8A04 |
| AV-821 | TFZ4C24 |
| AV-883 | TFW4A69 |
| AV-446 | PRZ1136 |
| AV-452 | PRZ1336 |

Prefixos e placas transcritos da imagem enviada. Marca e Renavam não foram coletados, pois não são necessários ao controle solicitado. Inicialização não se repete se o cadastro já existir. Não importa cautelas antigas do Forms: antes de movimentações, disponível significa ausência de cautela aberta registrada neste módulo; a tabela informa Sem movimentação registrada.

## Uso

Cautela / Devolução: pesquisar militar pelo nome de guerra/RG, selecionar viatura e operação, informar observação opcional e confirmar. Todos os militares da aba DADOS com RG e nome de guerra identificável entram na lista; não há filtro por função ou participação nas vistorias. Posto e RG distinguem nomes iguais. Colunas RG, NOME DE GUERRA e POSTO/GRADUAÇÃO são reconhecidas por cabeçalho; ID MILITAR serve como alternativa ao nome de guerra quando disponível, retirando o posto. Cadastro incompleto produz aviso; não inventa nomes de guerra a partir do nome completo.

Situação das viaturas: prefixo/placa, disponível ou cautelada, responsável atual, data/hora da cautela e última devolução com militar/data/hora somente quando disponível. Botão no prefixo abre as últimas 100 movimentações, da mais recente à mais antiga. Consultas abertas não recebem transmissão em tempo real: use Atualizar para consultar mudanças feitas por outras pessoas.

Gerenciar viaturas: exclusivo do Gestor. Novo cadastro, edição de prefixo/placa, baixa/inativação e reativação na mesma caixa. Inativas saem da seleção e relatório operacional; continuam no gerenciamento e histórico. Placa/prefixo não podem duplicar nem uma viatura inativa. Não permite editar ou baixar uma viatura cautelada: primeiro registre a devolução.

Quem pode registrar/consultar: Gestor e perfis Atendimento/Conferência que acessam o Atendimento. Perfil Vistoriador não recebe acesso. Integração com o roteiro, preenchimento pelos vistoriadores e integração com Forms continuam para depois.

## Integridade e armazenamento

- Militar selecionado é o responsável por receber/devolver. Usuário autenticado que registrou fica separado no histórico, com RG/nome. Data e horário são calculados no servidor pelo horário de Brasília.
- Uma movimentação confirmada equivale a uma linha append-only em VIATURAS_MOVIMENTOS. O JSON da linha preserva a situação resultante. Não há segundo registro de situação que possa ficar dessincronizado após falha entre gravações.
- ID de tentativa, bloqueio de escrita e validação no servidor impedem repetição e cautelas concorrentes. Após resposta perdida, repetir o mesmo envio confirma o evento existente e consulta a situação atual. Não cria outro evento.
- Não permite nova cautela ocupada, devolução sem cautela ou pedido de devolução de uma cautela antiga encerrando outra nova. Baixa preserva todos os eventos.
- Depois de confirmação, só a viatura afetada é substituída no resultado local. Busca de militar é local, sem chamadas adicionais. Relatório lê em lote os IDs do histórico e somente as últimas linhas necessárias para montar as situações, sem baixar todas as colunas de todos os eventos. Histórico detalhado é consultado sob demanda e limitado a 100 registros.
- Falha mantém os dados da tentativa; campos ficam protegidos para permitir repetição idêntica. Consultar antes de novo lançamento permite atualizar a situação. Saída durante envio é bloqueada; ao fechar a página com envio incerto, o navegador apresenta sua proteção padrão. Cache/dados da tela são limpos ao sair, e respostas antigas são descartadas por sessão/sequência.

## Verificação

323 testes locais e 39 cenários Chromium relacionados passaram, com Google simulado. Oito testes novos verificam cadastro inicial sem AV-857, nomes de guerra de não vistoriadores, permissões, cautela/devolução, cadastro/baixa/reativação, histórico, concorrência e repetição após perda da resposta. Sete cenários novos no navegador exercitam consulta/busca, permissões, clique duplo, resposta perdida, devolução/relatório, cadastro do Gestor, largura mobile e limpeza da sessão. Outros cenários cobrem Atendimento (6), Pendências/Atendimento (9), PSE (10) e Vistoriador (7). Não houve publicação no Google, integração com Forms ou medição de latência real de produção.
