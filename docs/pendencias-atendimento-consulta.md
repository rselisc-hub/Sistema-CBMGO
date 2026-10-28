# Pendências de Vistorias no Atendimento — consulta

Em Atendimento → Pendências de Vistorias, é possível pesquisar protocolo, razão social e região, filtrar por origem e abrir as informações do protocolo. A consulta usa a mesma grade por região, cores, legendas e seção sem região da tela de Pendências de Vistorias. Pesquisa e filtros são locais. A atualização ocorre ao abrir ou por Atualizar; não há consultas periódicas. Durante falha, a lista anterior permanece com aviso.

A janela de detalhes oferece somente Fechar. Não há ações de cadastrar, editar, excluir, finalizar, atribuir ou adicionar ao roteiro nessa tela, inclusive para Gestor que esteja usando essa consulta. A tela operacional de Vistorias mantém suas ações e permissões anteriores.

## Dados e autorização

- Endpoint `consultarPendenciasVistoriasAtendimento`: exige sessão com perfil ATENDIMENTO, CONFERENCIA ou GESTOR. VISTORIADOR/CONSULTA e sessão inválida são recusados.
- Lê as mesmas abas `PENDENCIAS_VISTORIAS`, `SOLICITACOES_VISTORIA` e `ROTEIRO_VISTORIAS`. Não cria abas, escreve cabeçalhos, duplica registros ou altera status.
- A leitura compartilhada conserva a regra por ID de origem: uma pendência só desaparece quando aquele ID específico foi redistribuído; distribuição cancelada não a consome. Diferentes pendências do mesmo protocolo não são eliminadas indevidamente.
- As rotinas de alteração/distribuição continuam exigindo Conferência/Gestor no servidor. Não se ampliou a autorização de nenhuma rotina de escrita.
- O modal é exclusivo de consulta, separado do modal operacional. Conteúdo da planilha é escapado antes da apresentação. Sair da sessão limpa o estado local e respostas antigas são descartadas.

## Instalação e validação

Substituir os dois arquivos do ZIP, salvar e publicar nova versão. Nenhuma coluna, migração ou gatilho novo.

Testes com serviços Google simulados cobrem autorização real por perfil, recusa de chamada direta de alteração pelo Atendimento, nenhuma gravação na consulta, abas ausentes, equivalência com a lista operacional anterior, pesquisa, equivalência da grade, detalhes, falha/repetição e término da sessão. Isso não representa medição de tempo no Google.

O menu completo do Atendimento permanece disponível ao navegar entre Atendimentos, Solicitações, Roteiro, PSE, Pendências e DOCs. O destaque acompanha a tela atual e a navegação não recria os formulários preenchidos.
