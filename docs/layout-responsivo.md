# Layout responsivo e roteiro móvel

O HTML tem viewport `width=device-width, initial-scale=1`; o Apps Script conserva o mesmo viewport em `doGet`. O CSS permanece no Index.html, sem arquivo adicional.

Faixas: celulares até 767,98 px; tablets de 768 a 1199,98 px; computadores a partir de 1200 px. As regras adaptam cabeçalho, navegação, campos e espaçamentos, preservando o zoom do navegador.

## Roteiro dos Vistoriadores no celular

Abaixo de 768 px, o roteiro usa blocos por equipe, com militar, canga, períodos, região e protocolos legíveis sem grade horizontal. Tipo de serviço, VTR, situação da viatura e setores ficam em Ver detalhes da equipe. Os protocolos mantêm suas cores e os que possuem observação abrem o mesmo modal pelo toque. Afastamentos visíveis na resposta também aparecem.

O computador conserva a grade existente. Apenas uma representação do roteiro é montada de cada vez; ao mudar de faixa de largura, a tela usa os dados já carregados. Não dispara RPC nem nova leitura da planilha. Ao sair, os dados dessa adaptação são apagados. Uma consulta vazia ou com erro invalida a cópia anterior para evitar que ela reapareça ao redimensionar.

Minhas Vistorias e Vistorias do Dia usam listas verticais no celular, com rótulos por campo. São os mesmos inputs, seleções e eventos, sem duplicação de formulários. Nas linhas com equipe mesclada, o nome acompanha cada protocolo na apresentação móvel. As permissões de leitura continuam aplicadas. A preparação desses rótulos roda apenas na faixa móvel.

No rascunho editável, a tabela continua permitindo edição e seleção; a regra que impedia conter sua rolagem horizontal foi corrigida. Não foram alterados parser SIAPI, distribuição, prioridades ou salvamentos.

## Consulta por perfil

Somente o perfil VISTORIADOR recebe os protocolos cujo RG coincide com o primeiro ou segundo integrante. O filtro é aplicado no servidor, antes de agrupar por titular, para não incluir protocolos de outro canga que trabalhe com o mesmo titular. Ver todos também continua limitado às próprias visitas. A identificação não usa aproximação por nome; ausência de RG válido solicita correção no cadastro. Afastamentos dessa resposta ficam limitados ao próprio RG.

GESTOR, CONFERENCIA, ATENDIMENTO e CONSULTA mantêm exatamente o conteúdo completo anterior. A restrição adicional se aplica somente ao endpoint do Roteiro dos Vistoriadores; não muda os demais acessos já existentes.

## Verificação

281 testes locais passaram, incluindo sete comparações de perfil e de titular/canga. Para os quatro outros perfis, respostas por dia e completas foram comparadas com a versão anterior.

40 cenários Chromium relacionados passaram: sete novos de roteiro móvel, sete de Vistoriador, seis de Atendimento, três de distribuição, oito de rascunhos/DOCs e nove de Pendências/Atendimento. Incluem larguras de 320, 390 e 1200 px, toque em protocolo, detalhes, mudança de faixa, seleção preservada, ocultação de ações não autorizadas e limpeza ao sair. Serviços Google simulados, sem publicação ou acesso à planilha em produção. Não equivale a teste em aparelho físico.

Instalação: atualizar WebApp.gs e Index.html juntos, salvar e publicar nova versão. O backend mudou para aplicar o filtro por perfil.

## Vistorias do Dia: próprias primeiro no celular (04/11/2026)

Somente no perfil VISTORIADOR e em telas de até 767,98 px, os registros cujo RG do titular ou canga coincide com o usuário aparecem primeiro, identificados como Suas vistorias. Depois aparecem Demais vistorias. Nenhum protocolo é ocultado. Homônimos são distinguidos por RG. A ordenação dentro de cada equipe e os índices usados pela tela são preservados.

No computador e nos outros perfis, o HTML da lista mantém a apresentação anterior. A mudança de largura reapresenta os dados locais, sem nova chamada à planilha. Ao sair, o cache e a seleção são limpos.

Verificação: 294 testes locais e 20 cenários Chromium relacionados passaram, incluindo comparação com a versão c7946ce para os demais perfis e computador. Serviços Google simulados; sem validação em produção ou aparelho físico. Nesta entrega basta atualizar Index.html e publicar nova versão.

## Entrada direta do Vistoriador

Ao aplicar a sessão do perfil VISTORIADOR, abre Vistorias do Dia na data atual de Brasília, independentemente da última tela armazenada. Isso vale no celular e computador. Outros perfis mantêm a navegação anterior. Ao sair, limpa a data e a marca de consulta carregada. Consulta vazia também limpa os registros em cache, evitando reapresentação de resultado anterior ao mudar a largura da tela.

Cinco novos cenários Chromium com Google simulado verificam a entrada, data, consulta vazia, falha/recuperação e preservação dos outros perfis. O erro informado pelo usuário ainda não teve mensagem fornecida e não foi reproduzido nesses cenários.
