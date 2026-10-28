# Análise do roteiro e entrega de Conferência / Indicadores — 28/10/2026

## Escopo

O roteiro de vistorias foi apenas analisado. Nenhuma rotina de leitura, distribuição, edição, cópia SIAPI ou geração das apresentações do roteiro foi modificada. O teste `conferencia-manual-fluidez.test.cjs` compara os métodos de roteiro/vistorias com a versão `3aa04fa` para confirmar isso.

As alterações autorizadas se limitam ao cadastro manual de Conferência e aos gráficos dos indicadores. Nenhuma mudança de esquema, exclusão de históricos, migração, novo banco ou gatilho é necessária.

## Por que o roteiro pode demorar

Há três caminhos diferentes, com custos diferentes:

| Caminho | Evidência no código | Efeito do crescimento |
| --- | --- | --- |
| Vistorias do Dia (`obterVistoriasDoDiaWeb`) | Lê todas as 26 colunas de `ROTEIRO_VISTORIAS` e depois filtra. Havendo resultados, lê as 17 colunas de todo `HISTORICO_VISTORIAS`. Consulta também os protocolos de pendências/solicitações e o cadastro de militares. | Mesmo uma consulta de um dia transfere históricos de outras datas. Com 10 mil linhas em cada uma dessas duas bases, só essas leituras representam 430 mil células. É um exemplo aritmético, não medição da planilha em produção. |
| Roteiro dos Vistoriadores (`obterRoteiroVistoriadoresWeb`) | Com data, lê a coluna de datas e os blocos correspondentes; sem data, lê todas as 27 colunas. A tela recria o conteúdo e mostra carregamento ao consultar. | O filtro por data já reduz leituras. Muitas linhas antigas ainda aumentam a busca na coluna; consulta completa e renderização de muitas equipes são mais caras. |
| Apresentações físicas (`gerarPlanilhaDiariaVistoriadoresConteudo_` / `gerarPlanilhaModeloVistoriadores_`) | Limpa `ROTEIRO` e `ROTEIRO_VISTORIADORES`, lê a origem e reconstrói todas as datas. Há formatação, notas e gravações dentro de laços por equipe e protocolo. | As chamadas de formatação e reconstrução crescem com todo o histórico, não só com o dia alterado. É o candidato mais forte quando a demora relatada é na atualização das planilhas visuais. |

A sincronização das apresentações usa revisão pendente e controle de geração única. Ela ocorre em segundo plano ao abrir telas/realizar ações relevantes, quando há revisão pendente; não em toda consulta sem necessidade. A geração já libera a trava global durante o trabalho pesado. Isso evita bloquear a distribuição pela duração inteira da formatação, mas não elimina o custo sobre o serviço de planilhas. Uma geração interrompida pode deixar a posse temporária válida por até sete minutos.

Nas telas de roteiro não existe atualização periódica ativa nesta versão. O controle de atualização da tela visível, porém, libera o marcador após 2,5 segundos, em vez de aguardar a resposta. Se a consulta demorar mais, novos cliques podem iniciar outra solicitação. Algumas consultas de roteiro também substituem o conteúdo por spinner; parte da sensação de lentidão é a espera sem a lista anterior visível.

**Conclusão:** o crescimento das abas efetivamente lidas e o modo de reconstrução podem contribuir. Não basta a planilha ter muitas abas ou mil linhas para concluir que esse é o motivo da lentidão de hoje. Linhas vazias fora de `getLastRow()` não são transferidas por essas consultas; fórmulas ou conteúdo distante podem aumentar o intervalo. Não foram acessados os dados atuais, os registros de execução da implantação, a conexão dos usuários ou o estado do serviço Google.

## Como confirmar a causa no Google, sem alterar código

1. Registrar ação exata, horário de Brasília, data pesquisada e tempo percebido. Separar consultar o dia de atualizar a planilha visual e de salvar uma alteração.
2. Em Apps Script → Execuções, comparar as funções acima, duração, situação, falhas e execuções próximas ao horário. Guardar qualquer mensagem de limite, tempo excedido ou disputa de trava.
3. Conferir quantidade de registros com conteúdo nas abas principais e histórico. Comparar a consulta de um único dia com a consulta completa.
4. Verificar se a demora afeta outros usuários/ações no mesmo momento. Isso ajuda a separar custo estrutural de conexão, serviço ou concorrência.

Próximos candidatos, sujeitos a uma alteração posterior: leitura estreita por data nas Vistorias do Dia/histórico; atualização incremental das apresentações; formatação em lote; trava de interface até o término da consulta. Não apagar históricos necessários às estatísticas como solução para a lentidão.

## Cadastro manual de Conferência

- Mantém o painel recolhido por padrão, com opção de abrir.
- Aceita um cabeçalho rotulado no mesmo formato SEI do Credenciamento. A preparação é local e não grava nem consulta planilhas.
- Protocolo, razão social, endereço, município e área são extraídos para revisão. Bairro e divisão ficam disponíveis para completar; não são deduzidos de outros campos. Serviço e demais campos específicos do Credenciamento não são convertidos artificialmente em divisão.
- Movimentação usa data/hora do servidor em `America/Sao_Paulo`, incluindo nova obtenção do relógio depois da trava. Não depende do relógio/fuso do computador do usuário.
- O cadastro novo continua com estado `CADASTRADO`, aguardando atribuição normal, e usa as mesmas validações/colunas/histórico.
- A busca individual usa `TextFinder` na coluna do protocolo, em vez de transferir todas as 27 colunas da base. A busca ainda percorre uma coluna no serviço; não é uma promessa de tempo constante.
- Se o número já existir, preserva movimentação, responsável e estado existentes, sem recadastrar nem reabrir. Repetir após uma resposta perdida não duplica o protocolo.
- Após confirmação, a tela recebe o item salvo e atualiza a lista local, respeitando os filtros; não inicia uma nova leitura completa da atribuição. Respostas antigas da listagem são descartadas.
- Envio em andamento bloqueia repetição e edição dos campos. Falha mantém os dados; sucesso só é mostrado após confirmação. Permissões de atribuição continuam exigidas no servidor.
- Clientes antigos sem a nova opção de horário mantêm o contrato anterior.

## Indicadores interativos

Atendimento, Conferência, Vistorias e PSE mantêm as regras de contagem e os dados da consulta já existentes. Os gráficos não fazem consultas adicionais ao mudar seus controles.

- Escolher agrupamento disponível, medida e formato de barras/linha.
- Ver valor ao passar o cursor ou focar com Tab. Enter/Espaço ou clique localiza o grupo no detalhamento.
- Categorias mostram os 20 maiores grupos e aviso explícito; a tabela mantém todos os grupos com paginação. Séries de dia/mês preservam a ordem disponível e permitem rolagem.
- Exportar o gráfico como SVG com área, período, medida e valores, para apresentação.
- Período vazio mostra mensagem. Gráficos não inventam dados anteriores ao registro no sistema.
- Sem bibliotecas externas ou CDN adicional. O gráfico é montado localmente a partir dos mesmos agregados dos cartões/tabela.

Continuam válidas as regras: pendência não realizada independe de cor; cada conclusão conta como uma conferência; RAI significa lançado para pagamento, não confirmação bancária. Valores de PSE usam a configuração do sistema conforme os avisos existentes.

## Validação

Testes com dados fictícios e serviços Google simulados. Incluem cadastro com duas mil linhas sem transferência completa da base, preservação de protocolo já existente, horário do servidor, bloqueio por permissão, preparação local do cabeçalho, erro/repetição, gráficos com mouse/teclado, exportação SVG e ausência de dados. Os resultados não equivalem a tempos medidos na implantação do Google.
