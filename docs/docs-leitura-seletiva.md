DOCs — identificação do despacho e leitura seletiva

O cadastro inicial deixa de exibir o campo de oficial. Na atualização pelo Gestor, o campo permanece com o rótulo Despachado por para identificar o oficial efetivo, que pode ser diferente do usuário que digitou. A coluna Despachado por fica oculta na lista Em aberto. Nos Concluídos e em Todos, o nome aparece somente nas linhas finalizadas. Valores existentes e histórico são preservados.

Listagem com 100 ou mais registros e filtro diferente de Todos: lê origem, status, tipo e fonte antes de carregar os detalhes dos candidatos. Os históricos sempre participam da consolidação, mesmo fora do filtro, para preservar a escolha do registro mais atualizado. Linhas fora da consulta contribuem com os totais sem carregar seus 25 campos. Se mais de 70% das linhas precisarem dos detalhes, usa a leitura completa. Bases pequenas e Todos mantêm a leitura completa. Bases predominantemente históricas podem continuar exigindo grande parte dos dados; não há promessa de tempo fixo.

Comparações com a versão 9c53926 verificam conteúdo, ordem, totais, filtros e históricos duplicados. Em uma simulação com 2.000 DOCs do sistema, sendo 20 abertos, o volume da tabela cai de 50.000 para 8.500 células (aproximadamente 83% menos), além da leitura do cabeçalho. Esse teste mede volume, não segundos reais do Google.

Validação acumulada: 141 testes Node e 40 cenários no Chromium, com serviços Google simulados. Atualizar os dois arquivos juntos; não há novas colunas nem mudança no armazenamento nesta atualização.
