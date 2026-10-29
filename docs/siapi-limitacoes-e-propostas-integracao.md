# Sistema-CBMGO: limitações atuais e propostas para a equipe do SIAPI

Data: 29/10/2026. Documento para discussão técnica, não uma especificação já acordada com o SIAPI.

## Situação atual e objetivo

O Sistema-CBMGO é um aplicativo Google Apps Script com interface HTML e planilhas Google como armazenamento. Ele organiza Atendimento, distribuição de Vistorias, Conferência, Credenciamento, DOCs para Despacho, escalas/PSE e indicadores. Atualmente, a entrada de informações do SIAPI é feita por acesso ao navegador e cópia manual fornecida pelos usuários.

Não recebemos documentação de uma API oficial nem acesso de homologação do SIAPI. Portanto, não estamos afirmando que o SIAPI não tenha API, exportações ou eventos; precisamos confirmar as possibilidades com sua equipe. Também não houve auditoria da infraestrutura interna ou da disponibilidade do SIAPI.

Objetivo recomendado: começar com integração oficial **somente de leitura**, reduzindo cópia manual e divergências. Distribuição, conferência interna, pendências e demais controles locais permanecem sob as regras e permissões do Sistema-CBMGO. Registrar visita como realizada não equivale a aprovar a edificação nem a concluir o protocolo no SIAPI.

## Prioridades para solicitar ao SIAPI

| Prioridade | Limitação observada no nosso fluxo | Recurso a discutir com o SIAPI | Benefício esperado |
| --- | --- | --- | --- |
| P1 | Dependência de cópia de telas e cabeçalhos diferentes entre Vistorias, Conferência e Credenciamento | API de leitura com contrato versionado; alternativa inicial: exportação CSV/JSON com colunas fixas | Reduz erro de interpretação, campos perdidos e trabalho manual |
| P1 | Dificuldade de distinguir ausência de protocolo, mudança de filtro e atualização posterior à captura | Identificador imutável do protocolo, número de exibição, situação atual, versão/atualizadoEm, filtros e metadados da consulta | Comparação confiável entre os dois sistemas |
| P1 | Necessidade de recapturar listas grandes para descobrir o que mudou | Consulta incremental por cursor/versão ou data de atualização com desempate por ID | Transfere somente alterações; evita varrer tudo a cada consulta |
| P1 | Risco de perder registros entre páginas enquanto a fila muda | Paginação estável, identificador de snapshot ou contrato equivalente e critérios de ordenação documentados | Permite reconciliar listas sem saltar ou repetir protocolos |
| P1 | Status atual não explica toda a trajetória do protocolo | Histórico de movimentações com ID de evento, data/hora, tipo, status e responsável autorizado | Diferencia retorno, nova movimentação e conclusão; melhora auditoria |
| P1 | Nomes completos, nomes de guerra e campos de vistoriador têm significados diferentes | Identificador estável do militar e definição dos campos de responsável atual, último vistoriador e autor da movimentação | Evita tratar pessoas iguais como diferentes ou confundir equipe designada com última inspeção |
| P2 | O aplicativo só percebe mudanças quando alguém importa novamente | Webhook/eventos autenticados, ou orientação de frequência para consulta incremental | Reduz defasagem sem consultas excessivas |
| P2 | Endereço e enquadramento dependem do texto copiado | Campos estruturados de logradouro, número, complemento, bairro, município/UF, divisão/ocupação, serviço e área com unidade | Melhora distribuição, filtros, indicadores e consistência cadastral |
| P2 | Usuário precisa procurar o protocolo e seus documentos no portal | Link oficial permanente do protocolo; links de documentos com autorização, quando disponíveis | Facilita conferência sem copiar documentos desnecessariamente |
| P3 — futura | Possível necessidade de avisar o responsável pelo estabelecimento | Contatos estruturados e regra de acesso/uso, origem e atualização do e-mail/telefone | Subsídio para uma futura avaliação de notificações; nenhum envio foi implantado |

P1 é o mínimo para uma integração confiável. As propostas dependem das possibilidades técnicas e regras institucionais do SIAPI.

## Contrato de dados sugerido

Confirmar disponibilidade, significado, permissão e obrigatoriedade de cada campo:

- ID interno imutável do protocolo e número completo, incluindo ano; manter número como texto.
- ID da edificação/estabelecimento, razão social e identificações cadastrais estritamente necessárias e autorizadas.
- Tipo de serviço, divisão/ocupação e área numérica com unidade explícita; distinguir área total de outras áreas, caso existam.
- Endereço estruturado e município/UF; coordenadas somente se existentes e autorizadas.
- Status SIAPI atual, código estável do status, ID da última movimentação, atualizadoEm e data/hora da movimentação.
- Histórico com eventos identificáveis, ordem/versão e regras para retificações ou cancelamentos.
- Responsáveis com identificador estável; estabelecer mapeamento autorizado com RG/cadastro local. Nome completo e nome de guerra devem ser atributos de exibição, não a chave de identidade. Não é necessário solicitar CPF se outro identificador atender à finalidade.
- Data/hora em ISO 8601 com fuso ou offset, por exemplo `2026-10-29T10:20:00-03:00`. Distinguir movimentação, captura e última atualização.
- Metadados da listagem: filtros aplicados, unidade/escopo, ordenação, total quando confiável, próximo cursor, identificador/data do snapshot e versão do contrato.
- Representação explícita de campos ausentes/nulos e definição dos campos opcionais. Não deslocar colunas quando não houver “Vistoriado por”.

Exemplo ilustrativo de contrato, não de endpoint existente:

```json
{
  "snapshotId": "snapshot-ficticio",
  "geradoEm": "2026-10-29T10:20:00-03:00",
  "proximoCursor": null,
  "protocolos": [{
    "id": "id-protocolo-ficticio",
    "numero": "900001/26",
    "versao": 12,
    "atualizadoEm": "2026-10-29T10:15:00-03:00",
    "situacao": {"codigo": "CODIGO_OFICIAL", "descricao": "Descrição oficial"},
    "ultimaMovimentacao": {"id": "evento-ficticio", "ocorridaEm": "2026-10-29T10:15:00-03:00"},
    "edificacao": {"razaoSocial": "ESTABELECIMENTO FICTÍCIO", "divisao": "C-1", "areaM2": 1234.56}
  }]
}
```

## Segurança e operação necessárias

- Autenticação oficial para integração: avaliar OAuth, conta técnica ou mecanismo suportado pelo SIAPI; escopo mínimo, inicialmente leitura, por unidade e perfil. Confirmar também as restrições de rede e identidade do aplicativo.
- Credenciais guardadas no servidor, nunca no HTML, no GitHub ou no chat. Rotação, revogação e registro de acesso definidos institucionalmente.
- Ambiente de homologação com dados fictícios/anonimizados e documentação dos campos, códigos e erros. Evitar testes de escrita em produção.
- Limites de requisições, tamanho de página, tempo de resposta esperado, timeout, política de retentativa e tratamento de 429/5xx. Consulta incremental deve respeitar esses limites.
- Eventos precisam ter ID, autenticidade verificável e possibilidade de reconsulta. Duplicidade, atraso, perda e entrega fora de ordem precisam ser tratados por versão/ID; webhook não substitui reconciliação.
- Link e documentos devem respeitar o acesso do usuário. Não replicar contatos ou dados pessoais além do necessário para a finalidade autorizada.
- Definir qual sistema é a fonte oficial de cada campo e qual sistema pode alterá-lo. Qualquer futura escrita de volta no SIAPI exige contrato separado, aprovação institucional e proteção contra repetição.

Não é recomendável depender de automação de navegador com senha ou de raspagem das telas como integração permanente.

## Limitações que são do nosso aplicativo e não se resolvem apenas com uma API

| Limitação local | Melhoria no Sistema-CBMGO |
| --- | --- |
| Algumas consultas percorrem todo o histórico da planilha antes de filtrar | Índices estreitos, leitura por data/protocolo e agregação em memória |
| As apresentações físicas de roteiro são reconstruídas com todas as datas e várias operações de formatação | Atualização incremental das partes alteradas e formatação em lote |
| Planilha gerada e interface podem refletir momentos distintos | Exibir horário/versão de atualização e separar claramente dado salvo de apresentação pendente |
| Planilhas não oferecem uma transação única envolvendo várias abas | IDs estáveis, bloqueios curtos, operações repetíveis, auditoria e recuperação de etapas incompletas |
| Histórico contém nomes de pessoas em formatos diferentes | Identidade por RG/ID e aliases confiáveis; agrupamento dos indicadores já foi corrigido sem reescrever a base |
| Duplas em ordem invertida criavam grupos distintos nos indicadores | Composição sem ordem e análise individual; correção já entregue |
| Tabelas operacionais largas são menos confortáveis no celular | Consulta responsiva e fluxos próprios de campo; não há um aplicativo móvel separado |
| Quotas e tempo de execução do Apps Script e chamadas remotas | Reduzir leituras, agrupar gravações, monitorar execuções e medir tempos reais com dados representativos |
| Crescimento de longo prazo do banco em planilha | Monitorar volume e concorrência; avaliar migração gradual se as medições justificarem, preservando histórico e estatísticas |

Uma API pode melhorar a qualidade e a atualização dos dados, mas não elimina por si só leituras amplas, formatação custosa ou chamadas duplicadas do nosso lado. Não devemos prometer ganhos de segundos sem medir a implantação real.

## Sequência de implantação proposta

1. Confirmar recursos oficiais, campos permitidos, autenticação e homologação.
2. Se não houver API pronta, padronizar uma exportação CSV/JSON como primeiro passo.
3. Fazer uma prova de conceito somente de leitura, com uma unidade e poucos protocolos fictícios/anonimizados.
4. Validar consulta completa paginada e atualização incremental contra um mesmo snapshot, comparando IDs e movimentações.
5. Exibir prévia das diferenças antes de incorporar alterações às rotinas operacionais.
6. Validar concorrência, falhas, retomada, deduplicação, permissões e indicadores.
7. Ampliar gradualmente e monitorar os tempos. A cópia manual permanece como contingência até a integração estar validada.

Os lotes informados pelo usuário são de aproximadamente 20 protocolos por importação de Vistorias, com filas de Conferência chegando a cerca de 800 registros. São referências para testes, não uma medição atual de tráfego ou uma garantia de capacidade.

## Perguntas objetivas para a reunião

1. Existe API ou exportação oficial? Há documentação e ambiente de homologação?
2. Quais IDs são permanentes para protocolo, edificação, movimentação e militar?
3. Há filtro por última atualização, cursor estável e identificação de snapshot? Como informar exclusão, cancelamento ou retificação?
4. É possível consultar as movimentações desde uma versão/data e distinguir correção de uma movimentação antiga de um evento novo?
5. Quais campos e documentos podem ser disponibilizados à unidade, e com qual escopo de acesso?
6. Qual mecanismo de autenticação, limite de uso e política de logs/retentativa são recomendados?
7. Há eventos/webhooks? Como verificar autenticidade e recuperar eventos perdidos?
8. Quais mudanças de esquema/status podem ocorrer e como as versões serão comunicadas?
9. Quem valida a comparação de protocolos e a regra de atualização antes do uso em produção?

Este documento não autoriza mudanças no SIAPI nem envio de e-mails. IA não é necessária para sincronizar identificadores, status e movimentações; essa integração deve ser determinística e auditável. O uso de IA pode ser avaliado separadamente para apoio textual, com critérios e dados autorizados.
