# Indicadores: identidade dos militares e equipes

A correção acontece na consulta dos indicadores, sem reescrever nomes ou apagar lançamentos das planilhas. Aplica-se a Atendimento (atendente), Conferência (conferente), Vistorias (equipe/militar) e PSE (militar).

## Identidade

1. O RG identifica a pessoa, independentemente de o lançamento usar nome completo ou nome de guerra. São normalizados espaços, pontuação de RG e sufixo decimal de valores numéricos. Zeros iniciais são preservados.
2. O cadastro `Cadastro` (ou `DADOS`) fornece o nome de exibição, preferindo nome de guerra. Nome completo e identificação militar são aliases exatos, também considerando maiúsculas/minúsculas, acentos, espaços e prefixos de posto conhecidos.
3. Registros com RG no próprio histórico também estabelecem aliases. Isso permite reunir variações históricas mesmo sem cadastro disponível.
4. Sem RG, um nome só é associado a uma identidade conhecida se houver uma correspondência única. Homônimos não são unidos por suposição. Casos não identificáveis aparecem com marcação de sem RG e aviso; homônimos conhecidos aparecem com RG no rótulo.
5. Não há busca aproximada por primeiro nome ou pedaços de sobrenome. Nomes começando com letras de postos, como CAPISTRANO e STEFAN, não são truncados.

A associação depende da qualidade do cadastro e dos RGs históricos. Um nome antigo sem RG e sem alias exato confiável continua separado, sinalizado para verificação. Não se inventa uma relação para fazer os números coincidirem.

## Vistorias

Em Indicadores → Vistorias, tanto no gráfico quanto em Detalhar por:

- **Equipe / dupla (sem ordem):** a chave considera os integrantes pelo RG, em ordem estável. A/B e B/A formam o mesmo grupo. Visita individual continua como equipe de um integrante, identificada no rótulo.
- **Militar — análise individual:** cada integrante recebe uma participação naquela visita. Em dupla, os dois recebem uma; o total geral continua sendo uma visita.
- **Individual ou dupla:** separa as duas composições. Uma mesma pessoa repetida nos dois campos não forma uma dupla nem recebe participação duplicada.

Os números de distribuições, realizadas, não realizadas, futuras e retornos são apresentados nessas duas análises. Uma pendência com integrantes invertidos passa a corresponder à equipe correta antes do recurso de correspondência por protocolo/data.

Não se excluem lançamentos reais para unir pessoas ou equipes. As regras anteriores de não realizadas por Pendências, retornos, cancelamentos e visitas futuras permanecem válidas. PSE mantém as regras de RAI e cálculo de valores.

## Desempenho e instalação

O cadastro é carregado uma vez por consulta (cabeçalho e dados), e os mapas de RG/aliases são montados em memória. Não há consultas à planilha por militar ou integrante. Trocar entre equipe/individual nos controles usa os agregados já recebidos, sem nova chamada ao servidor.

Sem migração, limpeza do histórico, novas colunas ou gatilhos. Atualizar WebApp.gs e Index.html, salvar e publicar nova versão. Reabrir os Indicadores ou usar Atualizar para renovar consultas já carregadas.

A análise relacionada à área construída fica para uma etapa futura e não foi implementada nesta alteração.

Testes com dados fictícios e Google simulado incluem nomes históricos, aliases sem RG, homônimos, RG com pontuação, equipes invertidas, atuação individual/dupla, participação duplicada nos dois campos, vínculo de pendência e leitura constante do cadastro em uma base de dois mil atendimentos. Não são medições de tempo na implantação do Google.
