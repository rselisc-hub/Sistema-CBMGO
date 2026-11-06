# Edição de afastamentos — 06/11/2026

O botão já preenchia o formulário, mas mantinha o título “Novo afastamento”, dependia de RG exatamente igual nas opções carregadas e não garantia uma seleção caso o cadastro não estivesse na lista. A navegação rolava a janela, sem apontar diretamente para o formulário.

Agora editar apresenta “Editar afastamento” e “Salvar alterações”, seleciona RG com zeros diferentes e preserva o militar original quando ausente da lista ou quando as opções ainda estão carregando. A carga posterior da lista mantém a seleção do registro em edição. O formulário recebe foco e é trazido à visualização. Limpar/salvar retorna ao modo Novo. O servidor atualiza a linha pelo mesmo ID, preserva autor e data de criação, e rejeita ID ausente ou excluído, evitando criar outro registro por engano.

Verificação: 352 testes unitários aprovados; teste Chromium específico confirma carregamento, envio do mesmo ID com nova data e retorno ao modo Novo. Serviços Google simulados. Distribuição testada separadamente e sem alteração nesta revisão.
