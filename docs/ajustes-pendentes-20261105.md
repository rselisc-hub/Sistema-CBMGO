# Vistorias próprias, responsáveis dos DOCs e edição da função

Entrega de 05/11/2026. Atualizar WebApp.gs e Index.html juntos e publicar nova versão. Cadastro/retirada/devolução de viaturas e Forms permanecem para definição posterior, sem implementação nesta entrega.

## Vistorias do Dia

Somente perfil VISTORIADOR: resposta do servidor inclui apenas visitas cujo RG coincide com titular ou canga, em qualquer largura de tela. Exige RG válido na sessão. Filtra após resolver a última distribuição ativa de data/protocolo, evitando mostrar uma atribuição antiga após trocar a equipe. Busca por razão social e resumo também ficam limitados ao próprio usuário. Demais perfis preservam a consulta anterior. Entrada inicial continua na data atual de Brasília.

## Indicadores de DOCs

Reutiliza o resolvedor de identidade dos indicadores: RG e aliases exatos do cadastro, exibindo o nome de guerra cadastrado. Nome completo e de guerra da mesma pessoa convergem para o mesmo grupo, sem aproximação por sobrenome. Sem responsável identificável não aparece no filtro ou grupo por responsável, mas continua nas medidas e totais gerais. Não altera nomes na planilha nem inventa nomes de guerra. Cadastro ausente/incompleto e aliases ambíguos continuam gerando aviso; para corrigir esses casos é necessário completar a identificação no cadastro. O cadastro é lido em lote, sem busca individual para cada documento.

## Editar função de escalado

Painel do Gestor > Escala > Controle da Escala > Gerenciar / Remover Militares Escalados. Escolha a data, altere o campo Função e clique em Salvar função. Consulta lista a função efetiva de CONTROLE_ESCALAS, não o serviço financeiro.

Endpoint exclusivo do Gestor, com autenticação antes e dentro do bloqueio de escrita. Identifica o registro por RG + data + turno + status ESCALADO; não aceita múltiplos registros ativos coincidentes, datas/funções inválidas ou uso preexistente da coluna de controle. Fabrício/Luciene permanecem exclusivos do Atendimento.

Atualiza somente coluna E (função) e marca a correção na coluna N, FUNCAO_MANUAL_GESTOR, criada na primeira edição se livre. O marcador preserva a correção nos próximos ajustes automáticos de função, incluindo lançamentos, remoções e ajuste mensal. Atendimento manual também é considerado ao definir os demais não vistoriadores do grupo. Não muda perfil de acesso, serviço financeiro, valores, horários, OS/SEI/RAI ou outros dias/turnos.

Reconstrói a Escala PSE antes de confirmar sucesso; dispensa salvar o RAI para sincronizar. Se ocorrer falha depois de gravar, a tela mantém os campos e permite repetir a mesma operação para concluir a sincronização. Bloqueia clique duplo. Invalida as consultas PSE locais para a próxima abertura. Não atualiza automaticamente abas de outros usuários já abertas: eles devem consultar novamente.

## Validação

309 testes locais e 42 cenários Chromium relacionados passaram, com Google simulado. Sete novos testes cobrem restrição no servidor, canga, homônimos, troca de equipe, preservação dos demais perfis, nomes/sem responsável, autorização, escrita restrita, duplicados, exceções e repetição após falha. Cinco novos cenários de navegador validam a edição, consulta após gravação, bloqueio de clique duplo, preservação dos campos em erro e restrição de perfil. Sem publicação no Google ou validação da planilha de produção.
