// ==========================================================

// FICHEIRO COMPLETO: WebApp.gs (CBMGO - Gestão de Escalas AC-4 / PSE)

// ==========================================================



function doGet() {

  var template = HtmlService.createTemplateFromFile('Index');

  return template.evaluate()

    .setTitle('Departamento de Inspeções e Credenciamento - DIC')

    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)

    .addMetaTag('viewport', 'width=device-width, initial-scale=1');

}

// ==========================================================
// CONTROLE DE ACESSO - LOGIN POR RG + PIN
// Perfis:
//   GESTOR      = acesso total ao sistema atual
//   CONFERENCIA = acesso ao módulo Conferência
//   CONSULTA    = reservado para configuração futura
// ==========================================================

// Verifica o cabeçalho em uma leitura. Não mantém cache de dados entre usuários.
function gravarLinhasAlteradasLeve_(aba, linhas, totalColunas) {
  var numeros = Object.keys(linhas).map(Number).sort(function(a,b) { return a-b; });
  var i = 0;
  while (i < numeros.length) {
    var inicio = numeros[i];
    var valores = [linhas[inicio]];
    i++;
    while (i < numeros.length && numeros[i] === inicio + valores.length && valores.length < 500) {
      valores.push(linhas[numeros[i++]]);
    }
    aba.getRange(inicio,1,valores.length,totalColunas).setValues(valores);
  }
}

function prepararCabecalhoLeve_(aba, cab, opcoes) {
  opcoes = opcoes || {};
  var vazio = aba.getLastRow() === 0;
  var atual = vazio ? [] : aba.getRange(1,1,1,cab.length).getDisplayValues()[0];
  var completo = vazio || (opcoes.primeiroVazio && !String(atual[0] || "").trim());
  var alterou = false;
  if (completo) {
    aba.getRange(1,1,1,cab.length).setValues([cab]);
    alterou = true;
  } else {
    // Escreve só blocos alterados, preservando as demais células e fórmulas.
    var inicio = -1;
    for (var i = 0; i <= cab.length; i++) {
      var precisa = i < cab.length && (opcoes.substituir
        ? String(atual[i] || "") !== cab[i]
        : !opcoes.somenteInicial && !String(atual[i] || "").trim());
      if (precisa && inicio < 0) inicio = i;
      if (!precisa && inicio >= 0) {
        aba.getRange(1,inicio+1,1,i-inicio).setValues([cab.slice(inicio,i)]);
        inicio = -1;
        alterou = true;
      }
    }
  }
  if (alterou) {
    aba.setFrozenRows(1);
    if (opcoes.cor) {
      var faixa = aba.getRange(1,1,1,cab.length).setFontWeight("bold")
        .setBackground(opcoes.cor).setFontColor(opcoes.texto || "#FFFFFF");
      if (opcoes.centralizar) faixa.setHorizontalAlignment("center");
    }
    if (opcoes.redimensionar) aba.autoResizeColumns(1,cab.length);
  }
  return alterou;
}

function garantirEstruturaAcessos_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("ACESSOS");

  if (!aba) {
    aba = ss.insertSheet("ACESSOS");
    aba.getRange(1, 1, 1, 7).setValues([[
      "RG", "NOME", "PIN", "PERFIL", "ATIVO", "PIN_HASH", "TROCAR_SENHA"
    ]]);
    aba.setFrozenRows(1);
    return aba;
  }

  var lastCol = Math.max(aba.getLastColumn(), 1);
  var headers = aba.getRange(1, 1, 1, lastCol).getDisplayValues()[0]
    .map(function(h) { return String(h || "").trim().toUpperCase(); });

  var obrigatorios = ["RG", "NOME", "PIN", "PERFIL", "ATIVO", "PIN_HASH", "TROCAR_SENHA", "PODE_ATRIBUIR_CONFERENCIA"];

  obrigatorios.forEach(function(cab) {
    if (headers.indexOf(cab) === -1) {
      aba.getRange(1, aba.getLastColumn() + 1).setValue(cab);
      headers.push(cab);
    }
  });

  // Para usuários já existentes, a nova regra entra em vigor automaticamente:
  // se TROCAR_SENHA estiver vazio, marca SIM para obrigar a troca no próximo login.
  var mapaAtual = {};
  headers.forEach(function(h,i) { mapaAtual[h] = i; });
  if (aba.getLastRow() >= 2 && mapaAtual.TROCAR_SENHA !== undefined) {
    var qtd = aba.getLastRow() - 1;
    var faixaTroca = aba.getRange(2, mapaAtual.TROCAR_SENHA + 1, qtd, 1);
    var valoresTroca = faixaTroca.getDisplayValues();
    var trocasPendentes = [];
    var numeroColunaTroca = mapaAtual.TROCAR_SENHA + 1;
    var letraColunaTroca = "";
    while (numeroColunaTroca > 0) {
      numeroColunaTroca--;
      letraColunaTroca = String.fromCharCode(65 + numeroColunaTroca % 26) + letraColunaTroca;
      numeroColunaTroca = Math.floor(numeroColunaTroca / 26);
    }

    for (var i = 0; i < valoresTroca.length; i++) {
      if (!String(valoresTroca[i][0] || "").trim()) {
        trocasPendentes.push(letraColunaTroca + (i+2));
      }
    }

    if (trocasPendentes.length) aba.getRangeList(trocasPendentes).setValue("SIM");
  }

  aba.setFrozenRows(1);
  return aba;
}

function obterMapaCabecalhosAcessos_(aba) {
  var headers = aba.getRange(1, 1, 1, aba.getLastColumn()).getDisplayValues()[0];
  var mapa = {};

  headers.forEach(function(h, i) {
    mapa[String(h || "").trim().toUpperCase()] = i;
  });

  return mapa;
}

function obterSegredoLogin_() {
  var props = PropertiesService.getScriptProperties();
  var segredo = props.getProperty("SEGREDO_LOGIN_ACESSOS");

  if (!segredo) {
    segredo = Utilities.getUuid() + "-" + Utilities.getUuid() + "-" + Utilities.getUuid();
    props.setProperty("SEGREDO_LOGIN_ACESSOS", segredo);
  }

  return segredo;
}

function gerarHashPin_(rg, pin) {
  var mensagem = normalizarRgCadastro_(rg) + "|" + String(pin || "");
  var assinatura = Utilities.computeHmacSha256Signature(
    mensagem,
    obterSegredoLogin_(),
    Utilities.Charset.UTF_8
  );

  return Utilities.base64Encode(assinatura);
}

function perfilPermitido_(perfil) {
  perfil = String(perfil || "").trim().toUpperCase();
  return ["GESTOR", "CONFERENCIA", "VISTORIADOR", "CONSULTA", "ATENDIMENTO"].indexOf(perfil) !== -1;
}

function estaAtivoAcesso_(valor) {
  var s = String(valor || "").trim().toUpperCase();
  return ["SIM", "S", "TRUE", "1", "ATIVO"].indexOf(s) !== -1;
}

function deveTrocarSenhaAcesso_(valor) {
  var s = String(valor || "").trim().toUpperCase();

  // Usuário antigo sem marcação também deve trocar no próximo login.
  if (!s) return true;

  return ["SIM", "S", "TRUE", "1", "TROCAR", "OBRIGATÓRIO", "OBRIGATORIO"].indexOf(s) !== -1;
}

function buscarUsuarioAcessoPorRg_(rgBusca) {
  var aba = garantirEstruturaAcessos_();
  if (aba.getLastRow() < 2) return null;

  var mapa = obterMapaCabecalhosAcessos_(aba);
  var dados = aba.getRange(2, 1, aba.getLastRow() - 1, aba.getLastColumn()).getDisplayValues();

  for (var i = 0; i < dados.length; i++) {
    var r = dados[i];
    var rgLinha = normalizarRgCadastro_(r[mapa.RG]);

    if (rgLinha === rgBusca) {
      return {
        aba: aba,
        linha: i + 2,
        mapa: mapa,
        rg: rgLinha,
        nome: String(r[mapa.NOME] || "").trim(),
        pin: String(r[mapa.PIN] || "").trim(),
        pinHash: String(r[mapa.PIN_HASH] || "").trim(),
        perfil: String(r[mapa.PERFIL] || "").trim().toUpperCase(),
        ativo: String(r[mapa.ATIVO] || "").trim(),
        trocarSenha: mapa.TROCAR_SENHA !== undefined
          ? String(r[mapa.TROCAR_SENHA] || "").trim()
          : "",
        podeAtribuirConferencia: mapa.PODE_ATRIBUIR_CONFERENCIA !== undefined
          ? String(r[mapa.PODE_ATRIBUIR_CONFERENCIA] || "").trim()
          : ""
      };
    }
  }

  return null;
}

function migrarPinParaHash_(usuario, pinInformado) {
  var hash = gerarHashPin_(usuario.rg, pinInformado);
  var colHash = usuario.mapa.PIN_HASH + 1;
  var colPin = usuario.mapa.PIN + 1;

  usuario.aba.getRange(usuario.linha, colHash).setValue(hash);

  // O PIN deixa de ficar armazenado em texto puro.
  usuario.aba.getRange(usuario.linha, colPin).clearContent();

  return hash;
}

function registrarTentativaLogin_(rg, sucesso) {
  var cache = CacheService.getScriptCache();
  var chave = "LOGIN_TENTATIVAS_" + normalizarRgCadastro_(rg);

  if (sucesso) {
    cache.remove(chave);
    return;
  }

  var atual = parseInt(cache.get(chave) || "0", 10) || 0;
  cache.put(chave, String(atual + 1), 600);
}

function loginBloqueado_(rg) {
  var cache = CacheService.getScriptCache();
  var chave = "LOGIN_TENTATIVAS_" + normalizarRgCadastro_(rg);
  var tentativas = parseInt(cache.get(chave) || "0", 10) || 0;
  return tentativas >= 5;
}

function obterIdentificacaoLoginPorRg_(rg) {
  rg = normalizarRgCadastro_(rg);
  if (!rg) return "";

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("Cadastro") || ss.getSheetByName("DADOS");
  if (!aba || aba.getLastRow() < 2) return "";

  var ncols = aba.getLastColumn();
  var cab = aba.getRange(1,1,1,ncols).getDisplayValues()[0];

  var idxRg = -1;
  var idxNomeGuerra = -1;
  var idxPosto = -1;
  var idxIdMilitar = -1;

  cab.forEach(function(h, i) {
    var s = String(h || "").trim().toUpperCase();

    if (idxRg === -1 && (s === "RG" || s.indexOf("RG") !== -1)) {
      idxRg = i;
    }

    if (idxNomeGuerra === -1 && s.indexOf("GUERRA") !== -1) {
      idxNomeGuerra = i;
    }

    if (idxPosto === -1 &&
        (s.indexOf("POSTO") !== -1 || s.indexOf("GRAD") !== -1)) {
      idxPosto = i;
    }

    if (idxIdMilitar === -1 &&
        (s.indexOf("ID MILITAR") !== -1 || s.indexOf("ID_MILITAR") !== -1)) {
      idxIdMilitar = i;
    }
  });

  if (idxRg === -1) return "";

  var dados = aba.getRange(2,1,aba.getLastRow()-1,ncols).getDisplayValues();

  for (var i = 0; i < dados.length; i++) {
    if (normalizarRgCadastro_(dados[i][idxRg]) !== rg) continue;

    var nomeGuerra = idxNomeGuerra >= 0
      ? String(dados[i][idxNomeGuerra] || "").trim()
      : "";

    var posto = idxPosto >= 0
      ? String(dados[i][idxPosto] || "").trim()
      : "";

    var idMilitar = idxIdMilitar >= 0
      ? String(dados[i][idxIdMilitar] || "").trim()
      : "";

    // Se posto ou nome de guerra estiverem ausentes, tenta extrair do identificador militar.
    if (idMilitar && (!posto || !nomeGuerra)) {
      try {
        var parsed = extrairPostoENome(idMilitar);

        if (!posto && parsed && parsed.posto) {
          posto = String(parsed.posto).trim();
        }

        if (!nomeGuerra && parsed && parsed.nome) {
          nomeGuerra = String(parsed.nome).trim();
        }
      } catch (e) {}
    }

    var identificacao = [posto, nomeGuerra].filter(function(v) {
      return String(v || "").trim() !== "";
    }).join(" ").trim();

    if (identificacao) return identificacao;

    // Último fallback: usa o conteúdo bruto do identificador militar.
    if (idMilitar) return idMilitar;

    return "";
  }

  return "";
}




function criarSessaoAcesso_(usuario) {
  var token = Utilities.getUuid() + "-" + Utilities.getUuid();
  var identificacaoLogin = obterIdentificacaoLoginPorRg_(usuario.rg);

  var sessao = {
    rg: usuario.rg,
    nome: usuario.nome,
    nomeGuerra: identificacaoLogin || usuario.nome,
    perfil: usuario.perfil,
    podeAtribuirConferencia: usuario.podeAtribuirConferencia || "",
    criadoEm: new Date().getTime()
  };

  // Sessão de até 6 horas. O CacheService pode expirar antes em situações excepcionais.
  CacheService.getScriptCache().put(
    "SESSAO_APP_" + token,
    JSON.stringify(sessao),
    21600
  );

  return token;
}

function obterSessaoAcesso_(token) {
  token = String(token || "").trim();
  if (!token) return null;

  var cache = CacheService.getScriptCache();
  var json = cache.get("SESSAO_APP_" + token);
  if (!json) return null;

  try {
    var sessao = JSON.parse(json);

    // Renova a validade enquanto a sessão está sendo usada.
    cache.put("SESSAO_APP_" + token, JSON.stringify(sessao), 21600);

    return sessao;
  } catch (e) {
    return null;
  }
}

function permissaoIndividualAtiva_(valor) {
  var s = String(valor || "").trim().toUpperCase();
  return ["SIM","S","TRUE","1","ATIVO","AUTORIZADO"].indexOf(s) !== -1;
}

function permissoesDoPerfil_(perfil, podeAtribuirConferencia) {
  perfil = String(perfil || "").trim().toUpperCase();

  if (perfil === "GESTOR") {
    return {
      gestor: true,
      vistorias: true,
      conferencia: true,
      conferenciaAtribuir: true,
      consulta: true,
      atendimento: true,
      credenciamento: true,
      pessoal: true
    };
  }

  if (perfil === "CONFERENCIA") {
    return {
      gestor: false,
      vistorias: true,
      conferencia: true,
      conferenciaAtribuir: permissaoIndividualAtiva_(podeAtribuirConferencia),
      consulta: false,
      atendimento: true,
      credenciamento: true,
      pessoal: false
    };
  }

  if (perfil === "ATENDIMENTO") {
    return {
      gestor: false,
      vistorias: false,
      conferencia: false,
      conferenciaAtribuir: false,
      consulta: false,
      atendimento: true,
      credenciamento: false,
      pessoal: false
    };
  }

  // VISTORIADOR substitui o antigo perfil CONSULTA.
  // CONSULTA continua aceito apenas para compatibilidade com registros antigos.
  if (perfil === "VISTORIADOR" || perfil === "CONSULTA") {
    return {
      gestor: false,
      vistorias: true,
      conferencia: false,
      conferenciaAtribuir: false,
      consulta: true,
      atendimento: false,
      credenciamento: false,
      pessoal: false
    };
  }

  return {
    gestor: false,
    vistorias: false,
    conferencia: false,
    conferenciaAtribuir: false,
    consulta: false,
    atendimento: false,
    credenciamento: false,
    pessoal: false
  };
}

function loginAcesso(rg, pin) {
  rg = normalizarRgCadastro_(rg);
  pin = String(pin === null || pin === undefined ? "" : pin).trim();

  if (!rg) {
    return { sucesso: false, mensagem: "Informe o RG." };
  }

  var senhaNovaValida = /^[A-Za-z0-9]{6}$/.test(pin);
  var pinAntigoValido = /^\d{1,6}$/.test(pin);

  if (!senhaNovaValida && !pinAntigoValido) {
    return {
      sucesso: false,
      mensagem: "A senha deve conter 6 caracteres. No primeiro acesso, o PIN antigo ainda é aceito."
    };
  }

  if (loginBloqueado_(rg)) {
    return {
      sucesso: false,
      mensagem: "Muitas tentativas incorretas. Aguarde alguns minutos e tente novamente."
    };
  }

  var usuario = buscarUsuarioAcessoPorRg_(rg);

  if (!usuario) {
    registrarTentativaLogin_(rg, false);
    return { sucesso: false, mensagem: "RG ou PIN inválido." };
  }

  if (!estaAtivoAcesso_(usuario.ativo)) {
    return { sucesso: false, mensagem: "Este acesso está inativo. Procure o Gestor." };
  }

  if (!perfilPermitido_(usuario.perfil)) {
    return { sucesso: false, mensagem: "Perfil de acesso inválido na aba ACESSOS." };
  }

  var hashEsperado = usuario.pinHash;
  var pinValido = false;

  // Se houver PIN em texto na planilha, ele é tratado como novo PIN.
  // Após o primeiro login bem-sucedido, ele é convertido para PIN_HASH e apagado.
  if (usuario.pin !== "") {
    pinValido = (usuario.pin === pin);

    if (pinValido) {
      hashEsperado = migrarPinParaHash_(usuario, pin);
    }
  } else if (hashEsperado !== "") {
    pinValido = (hashEsperado === gerarHashPin_(usuario.rg, pin));
  }

  if (!pinValido) {
    registrarTentativaLogin_(rg, false);
    return { sucesso: false, mensagem: "RG ou PIN inválido." };
  }

  registrarTentativaLogin_(rg, true);

  if (deveTrocarSenhaAcesso_(usuario.trocarSenha)) {
    var tokenTroca = Utilities.getUuid() + "-" + Utilities.getUuid();

    CacheService.getScriptCache().put(
      "TROCA_SENHA_" + tokenTroca,
      JSON.stringify({
        rg: usuario.rg,
        criadoEm: new Date().getTime()
      }),
      600
    );

    return {
      sucesso: true,
      exigeTrocaSenha: true,
      tokenTroca: tokenTroca
    };
  }

  var token = criarSessaoAcesso_(usuario);

  return {
    sucesso: true,
    token: token,
    usuario: {
      rg: usuario.rg,
      nome: obterIdentificacaoLoginPorRg_(usuario.rg) || usuario.nome || ("RG " + usuario.rg),
      nomeCompleto: usuario.nome || "",
      perfil: usuario.perfil,
      permissoes: permissoesDoPerfil_(usuario.perfil, usuario.podeAtribuirConferencia)
    }
  };
}

function alterarSenhaPrimeiroAcesso(tokenTroca, novaSenha) {
  tokenTroca = String(tokenTroca || "").trim();
  novaSenha = String(novaSenha || "").trim();

  if (!tokenTroca) {
    return { sucesso:false, mensagem:"Solicitação de troca de senha inválida ou expirada." };
  }

  if (!/^[A-Za-z0-9]{6}$/.test(novaSenha)) {
    return {
      sucesso:false,
      mensagem:"A nova senha deve conter exatamente 6 caracteres, somente letras e números."
    };
  }

  var cache = CacheService.getScriptCache();
  var json = cache.get("TROCA_SENHA_" + tokenTroca);

  if (!json) {
    return { sucesso:false, mensagem:"A solicitação de troca expirou. Faça o login novamente." };
  }

  var temp;
  try {
    temp = JSON.parse(json);
  } catch (e) {
    return { sucesso:false, mensagem:"Solicitação de troca de senha inválida." };
  }

  var rg = normalizarRgCadastro_(temp.rg);
  var usuario = buscarUsuarioAcessoPorRg_(rg);

  if (!usuario) {
    cache.remove("TROCA_SENHA_" + tokenTroca);
    return { sucesso:false, mensagem:"Usuário não encontrado na aba ACESSOS." };
  }

  var novoHash = gerarHashPin_(usuario.rg, novaSenha);

  // Atualiza apenas os campos de senha; perfil, nome e status permanecem intactos.
  usuario.aba.getRange(usuario.linha, usuario.mapa.PIN_HASH + 1).setValue(novoHash);
  usuario.aba.getRange(usuario.linha, usuario.mapa.PIN + 1).clearContent();

  if (usuario.mapa.TROCAR_SENHA !== undefined) {
    usuario.aba.getRange(usuario.linha, usuario.mapa.TROCAR_SENHA + 1).setValue("NÃO");
  }

  cache.remove("TROCA_SENHA_" + tokenTroca);

  // Atualiza o objeto local antes de criar a sessão.
  usuario.pin = "";
  usuario.pinHash = novoHash;
  usuario.trocarSenha = "NÃO";

  var token = criarSessaoAcesso_(usuario);

  return {
    sucesso:true,
    token:token,
    usuario:{
      rg:usuario.rg,
      nome:obterIdentificacaoLoginPorRg_(usuario.rg) || usuario.nome || ("RG " + usuario.rg),
      nomeCompleto:usuario.nome || "",
      perfil:usuario.perfil,
      permissoes:permissoesDoPerfil_(
        usuario.perfil,
        usuario.podeAtribuirConferencia
      )
    }
  };
}


function marcarTrocaSenhaProximoLogin(rg, token) {
  exigirPerfil_(token, ["GESTOR"]);

  rg = normalizarRgCadastro_(rg);
  if (!rg) throw new Error("Informe o RG.");

  var usuario = buscarUsuarioAcessoPorRg_(rg);
  if (!usuario) throw new Error("RG não encontrado na aba ACESSOS.");

  if (usuario.mapa.TROCAR_SENHA === undefined) {
    garantirEstruturaAcessos_();
    usuario = buscarUsuarioAcessoPorRg_(rg);
  }

  usuario.aba.getRange(usuario.linha, usuario.mapa.TROCAR_SENHA + 1).setValue("SIM");

  return "Troca de senha marcada para o próximo login do RG " + rg + ".";
}


function validarSessaoAcesso(token) {
  var sessao = obterSessaoAcesso_(token);

  if (!sessao) {
    return { valido: false };
  }

  return {
    valido: true,
    usuario: {
      rg: sessao.rg,
      nome: sessao.nomeGuerra || obterIdentificacaoLoginPorRg_(sessao.rg) || sessao.nome || ("RG " + sessao.rg),
      nomeCompleto: sessao.nome || "",
      perfil: sessao.perfil,
      permissoes: permissoesDoPerfil_(sessao.perfil, sessao.podeAtribuirConferencia)
    }
  };
}

function logoutAcesso(token) {
  token = String(token || "").trim();

  if (token) {
    CacheService.getScriptCache().remove("SESSAO_APP_" + token);
  }

  return true;
}

function exigirPerfil_(token, perfisPermitidos) {
  var sessao = obterSessaoAcesso_(token);

  if (!sessao) {
    throw new Error("Sessão expirada ou inválida. Faça login novamente.");
  }

  var perfil = String(sessao.perfil || "").trim().toUpperCase();
  var permitidos = (perfisPermitidos || []).map(function(p) {
    return String(p || "").trim().toUpperCase();
  });

  if (perfil === "GESTOR") return sessao;

  if (permitidos.indexOf(perfil) === -1) {
    throw new Error("Você não possui permissão para executar esta operação.");
  }

  return sessao;
}




// ==========================================================
// MÓDULO PESSOAL / FUNÇÕES
// As funções operacionais são independentes do perfil de login.
// Um mesmo militar pode ter várias funções simultaneamente.
// ==========================================================
function normalizarFuncoesPessoal_(valor) {
  var lista = Array.isArray(valor) ? valor : String(valor || "").split(",");
  var permitidas = ["GESTOR","VISTORIADOR"];
  var saida = [];
  lista.forEach(function(v) {
    var f = String(v || "").trim().toUpperCase();
    if (permitidas.indexOf(f) !== -1 && saida.indexOf(f) === -1) saida.push(f);
  });
  return saida;
}

function obterMilitaresCadastroPessoal_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("Cadastro") || ss.getSheetByName("DADOS");
  var militares = [];
  if (!aba || aba.getLastRow() < 2) return militares;

  var ncols = aba.getLastColumn();
  var cab = aba.getRange(1,1,1,ncols).getDisplayValues()[0];
  var idxRg=-1, idxNome=-1, idxGuerra=-1, idxPosto=-1, idxId=-1;
  cab.forEach(function(h,i) {
    var s = String(h || "").trim().toUpperCase();
    if (idxRg < 0 && (s === "RG" || s.indexOf("RG") !== -1)) idxRg = i;
    if (idxGuerra < 0 && s.indexOf("GUERRA") !== -1) idxGuerra = i;
    if (idxPosto < 0 && (s.indexOf("POSTO") !== -1 || s.indexOf("GRAD") !== -1)) idxPosto = i;
    if (idxId < 0 && (s.indexOf("ID MILITAR") !== -1 || s.indexOf("ID_MILITAR") !== -1)) idxId = i;
    if (idxNome < 0 && (s === "NOME" || s.indexOf("NOME COMPLETO") !== -1)) idxNome = i;
  });

  var vals = aba.getRange(2,1,aba.getLastRow()-1,ncols).getDisplayValues();
  vals.forEach(function(r) {
    var rg = idxRg >= 0 ? String(r[idxRg] || "").trim() : "";
    var nomeCompleto = idxNome >= 0 ? String(r[idxNome] || "").trim() : "";
    var guerra = idxGuerra >= 0 ? String(r[idxGuerra] || "").trim() : "";
    var graduacao = idxPosto >= 0 ? String(r[idxPosto] || "").trim() : "";
    var idMilitar = idxId >= 0 ? String(r[idxId] || "").trim() : "";
    var nome = guerra || idMilitar || nomeCompleto;
    if (!nome && !rg) return;
    if (!graduacao && nome) {
      var parsed = extrairPostoENome(nome);
      graduacao = parsed.posto || "";
      nome = parsed.nome || nome;
    }
    militares.push({rg:rg,nome:nome || nomeCompleto || rg,nomeCompleto:nomeCompleto,graduacao:graduacao});
  });
  militares.sort(function(a,b) {
    return (String(a.graduacao||"")+" "+String(a.nome||"")).localeCompare(String(b.graduacao||"")+" "+String(b.nome||""),"pt-BR");
  });
  return militares;
}

function obterGestoresPorRg_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("ACESSOS");
  var mapa = {};
  if (!aba || aba.getLastRow() < 2) return mapa;
  var ncols = aba.getLastColumn();
  var cab = aba.getRange(1,1,1,ncols).getDisplayValues()[0];
  var idxRg=-1, idxPerfil=-1, idxAtivo=-1;
  cab.forEach(function(h,i) {
    var s = String(h || "").trim().toUpperCase();
    if (idxRg < 0 && s === "RG") idxRg = i;
    if (idxPerfil < 0 && s === "PERFIL") idxPerfil = i;
    if (idxAtivo < 0 && s === "ATIVO") idxAtivo = i;
  });
  if (idxRg < 0 || idxPerfil < 0) return mapa;
  var vals = aba.getRange(2,1,aba.getLastRow()-1,ncols).getDisplayValues();
  vals.forEach(function(r) {
    var rg=String(r[idxRg]||"").trim();
    var perfil=String(r[idxPerfil]||"").trim().toUpperCase();
    var ativo=idxAtivo>=0?String(r[idxAtivo]||"").trim().toUpperCase():"SIM";
    if(rg&&perfil==="GESTOR"&&["NÃO","NAO","FALSE","0","INATIVO"].indexOf(ativo)===-1) mapa[rg]=true;
  });
  return mapa;
}

function garantirEstruturaFuncoesPessoal_() {
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var aba=ss.getSheetByName("FUNCOES_PESSOAL");
  var cab=["RG","NOME","GRADUAÇÃO","FUNÇÕES","ATUALIZADO_EM","ATUALIZADO_POR"];
  if(!aba) aba=ss.insertSheet("FUNCOES_PESSOAL");
  prepararCabecalhoLeve_(aba,cab,{cor:"#4f2d7f",texto:"#ffffff"});

  var existentes={};
  if(aba.getLastRow()>=2){
    var vals=aba.getRange(2,1,aba.getLastRow()-1,6).getDisplayValues();
    vals.forEach(function(r,idx){var rg=String(r[0]||"").trim();if(rg) existentes[rg]={linha:idx+2,funcoes:normalizarFuncoesPessoal_(r[3]),nome:r[1],graduacao:r[2]};});
  }
  var militares=obterMilitaresCadastroPessoal_();
  var gestores=obterGestoresPorRg_();
  var novas=[];
  militares.forEach(function(m){
    if(!m.rg) return;
    if(existentes[m.rg]){
      if(existentes[m.rg].nome!==m.nome || existentes[m.rg].graduacao!==m.graduacao) {
        aba.getRange(existentes[m.rg].linha,2,1,2).setValues([[m.nome,m.graduacao]]);
      }
      return;
    }
    var funcoes=[];
    if(!nomeExcluidoDasVistorias_(m.nome,m.nomeCompleto)) funcoes.push("VISTORIADOR");
    if(gestores[m.rg]) funcoes.push("GESTOR");
    novas.push([m.rg,m.nome,m.graduacao,funcoes.join(", "),"","MIGRAÇÃO INICIAL"]);
  });
  if(novas.length) aba.getRange(aba.getLastRow()+1,1,novas.length,6).setValues(novas);
  return aba;
}

function obterMapaFuncoesPessoal_() {
  var aba=garantirEstruturaFuncoesPessoal_(),mapa={};
  if(aba.getLastRow()<2) return mapa;
  var vals=aba.getRange(2,1,aba.getLastRow()-1,6).getDisplayValues();
  vals.forEach(function(r){
    var rg=String(r[0]||"").trim(); if(!rg) return;
    mapa[rg]={rg:rg,nome:String(r[1]||"").trim(),graduacao:String(r[2]||"").trim(),funcoes:normalizarFuncoesPessoal_(r[3])};
  });
  return mapa;
}

function militarTemFuncao_(rg,funcao) {
  rg=String(rg||"").trim(); funcao=String(funcao||"").trim().toUpperCase();
  if(!rg||!funcao) return false;
  var mapa=obterMapaFuncoesPessoal_();
  return !!(mapa[rg]&&mapa[rg].funcoes.indexOf(funcao)!==-1);
}

function listarFuncoesPessoal(token) {
  exigirPerfil_(token,["GESTOR"]);
  var aba=garantirEstruturaFuncoesPessoal_(),registros=[];
  if(aba.getLastRow()>=2){
    var vals=aba.getRange(2,1,aba.getLastRow()-1,6).getDisplayValues();
    vals.forEach(function(r){
      var rg=String(r[0]||"").trim(),nome=String(r[1]||"").trim(); if(!rg&&!nome) return;
      registros.push({rg:rg,nome:nome,graduacao:String(r[2]||"").trim(),funcoes:normalizarFuncoesPessoal_(r[3]),atualizadoEm:String(r[4]||"").trim(),atualizadoPor:String(r[5]||"").trim()});
    });
  }
  registros.sort(function(a,b){return (String(a.graduacao||"")+" "+String(a.nome||"")).localeCompare(String(b.graduacao||"")+" "+String(b.nome||""),"pt-BR");});
  return {sucesso:true,registros:registros};
}

function salvarFuncoesPessoal(registros,token) {
  var sessao=exigirPerfil_(token,["GESTOR"]); registros=Array.isArray(registros)?registros:[];
  var aba=garantirEstruturaFuncoesPessoal_(),mapaLinha={};
  if(aba.getLastRow()>=2){
    var rgs=aba.getRange(2,1,aba.getLastRow()-1,1).getDisplayValues();
    rgs.forEach(function(r,idx){var rg=String(r[0]||"").trim();if(rg)mapaLinha[rg]=idx+2;});
  }
  var agora=dataHoraSaoPauloTexto_(),alterados=0;
  registros.forEach(function(item){
    var rg=String(item.rg||"").trim(),linha=mapaLinha[rg]; if(!rg||!linha) return;
    var funcoes=normalizarFuncoesPessoal_(item.funcoes);
    aba.getRange(linha,4,1,3).setValues([[funcoes.join(", "),agora,String(sessao.nome||sessao.rg||"").trim()]]);
    alterados++;
  });
  return {sucesso:true,alterados:alterados,mensagem:alterados+" militar(es) atualizado(s)."};
}


// ==========================================================
// PESSOAL / ACESSOS E FUNÇÕES - ADMINISTRAÇÃO PELO PROGRAMA
// As abas ACESSOS e FUNCOES_PESSOAL permanecem como banco de dados.
// A configuração operacional passa a ser feita pela interface do sistema.
// ==========================================================
function listarAcessosFuncoesPessoal(token) {
  exigirPerfil_(token, ["GESTOR"]);
  garantirEstruturaAcessos_();
  garantirEstruturaFuncoesPessoal_();

  var militares = obterMilitaresCadastroPessoal_();
  var funcoes = obterMapaFuncoesPessoal_();
  var abaA = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("ACESSOS");
  var acessos = {};

  if (abaA && abaA.getLastRow() >= 2) {
    var mapa = obterMapaCabecalhosAcessos_(abaA);
    var vals = abaA.getRange(2,1,abaA.getLastRow()-1,abaA.getLastColumn()).getDisplayValues();
    vals.forEach(function(r) {
      var rg = normalizarRgCadastro_(r[mapa.RG]);
      if (!rg) return;
      acessos[rg] = {
        existe:true,
        perfil:(function(){
          var p=String(r[mapa.PERFIL] || "").trim().toUpperCase();
          return p === "CONSULTA" ? "VISTORIADOR" : p;
        })(),
        ativo:estaAtivoAcesso_(r[mapa.ATIVO]),
        podeAtribuir:mapa.PODE_ATRIBUIR_CONFERENCIA !== undefined &&
          permissaoIndividualAtiva_(r[mapa.PODE_ATRIBUIR_CONFERENCIA]),
        trocarSenha:mapa.TROCAR_SENHA !== undefined ?
          deveTrocarSenhaAcesso_(r[mapa.TROCAR_SENHA]) : true
      };
    });
  }

  var registros = militares.map(function(m) {
    var a = acessos[normalizarRgCadastro_(m.rg)] || {
      existe:false, perfil:"", ativo:false, podeAtribuir:false, trocarSenha:true
    };
    var f = funcoes[String(m.rg || "").trim()];
    var listaF = f ? f.funcoes.slice() : [];

    return {
      rg:String(m.rg || "").trim(),
      nome:String(m.nome || m.nomeCompleto || "").trim(),
      graduacao:String(m.graduacao || "").trim(),
      perfil:a.perfil,
      ativo:!!a.ativo,
      podeAtribuirConferencia:!!a.podeAtribuir,
      trocarSenha:!!a.trocarSenha,
      vistoriador:listaF.indexOf("VISTORIADOR") !== -1,
      gestor:listaF.indexOf("GESTOR") !== -1 || a.perfil === "GESTOR",
      temAcesso:!!a.existe
    };
  });

  return {sucesso:true, registros:registros};
}

function salvarAcessosFuncoesPessoal(registros, token) {
  var sessao = exigirPerfil_(token, ["GESTOR"]);
  registros = Array.isArray(registros) ? registros : [];
  var abaA = garantirEstruturaAcessos_();
  var mapaA = obterMapaCabecalhosAcessos_(abaA);
  var abaF = garantirEstruturaFuncoesPessoal_();
  var mapaLinhaA = {};
  var mapaLinhaF = {};

  if (abaA.getLastRow() >= 2) {
    var valsA = abaA.getRange(2,1,abaA.getLastRow()-1,abaA.getLastColumn()).getDisplayValues();
    valsA.forEach(function(r,idx) {
      var rg = normalizarRgCadastro_(r[mapaA.RG]);
      if (rg) mapaLinhaA[rg] = idx + 2;
    });
  }

  if (abaF.getLastRow() >= 2) {
    var valsF = abaF.getRange(2,1,abaF.getLastRow()-1,6).getDisplayValues();
    valsF.forEach(function(r,idx) {
      var rg = String(r[0] || "").trim();
      if (rg) mapaLinhaF[rg] = idx + 2;
    });
  }

  var agora = dataHoraSaoPauloTexto_();
  var alterados = 0;
  var novosAcessos = 0;

  registros.forEach(function(item) {
    var rgOriginal = String(item.rg || "").trim();
    var rg = normalizarRgCadastro_(rgOriginal);
    if (!rg) return;

    var nome = String(item.nome || "").trim();
    var graduacao = String(item.graduacao || "").trim();
    var perfil = String(item.perfil || "").trim().toUpperCase();
    if (perfil === "CONSULTA") perfil = "VISTORIADOR";
    var ativo = item.ativo === true;
    var podeAtribuir = item.podeAtribuirConferencia === true;
    var vistoriador = item.vistoriador === true;
    var pinNovo = String(item.pinNovo || "").trim();

    if (perfil && !perfilPermitido_(perfil)) {
      throw new Error("Perfil inválido para " + (nome || rgOriginal) + ".");
    }

    // ACESSO: só cria uma linha nova quando um perfil foi escolhido.
    var linhaA = mapaLinhaA[rg];
    if (!linhaA && perfil) {
      if (!pinNovo || !/^[A-Za-z0-9]{6}$/.test(pinNovo)) {
        throw new Error(
          "Informe um PIN inicial de exatamente 6 caracteres alfanuméricos para " +
          (nome || rgOriginal) + "."
        );
      }

      var nova = new Array(abaA.getLastColumn()).fill("");
      nova[mapaA.RG] = rgOriginal;
      nova[mapaA.NOME] = nome;
      nova[mapaA.PERFIL] = perfil;
      nova[mapaA.ATIVO] = ativo ? "SIM" : "NÃO";
      nova[mapaA.PIN_HASH] = gerarHashPin_(rg, pinNovo);
      nova[mapaA.TROCAR_SENHA] = "SIM";
      nova[mapaA.PODE_ATRIBUIR_CONFERENCIA] = podeAtribuir ? "SIM" : "NÃO";
      if (mapaA.PIN !== undefined) nova[mapaA.PIN] = "";

      abaA.getRange(abaA.getLastRow()+1,1,1,nova.length).setValues([nova]);
      linhaA = abaA.getLastRow();
      mapaLinhaA[rg] = linhaA;
      novosAcessos++;
    } else if (linhaA) {
      if (perfil) abaA.getRange(linhaA, mapaA.PERFIL + 1).setValue(perfil);
      abaA.getRange(linhaA, mapaA.ATIVO + 1).setValue(ativo ? "SIM" : "NÃO");
      abaA.getRange(linhaA, mapaA.NOME + 1).setValue(nome);
      abaA.getRange(linhaA, mapaA.PODE_ATRIBUIR_CONFERENCIA + 1)
        .setValue(podeAtribuir ? "SIM" : "NÃO");

      if (pinNovo) {
        if (!/^[A-Za-z0-9]{6}$/.test(pinNovo)) {
          throw new Error(
            "O novo PIN de " + (nome || rgOriginal) +
            " deve possuir exatamente 6 caracteres alfanuméricos."
          );
        }
        abaA.getRange(linhaA, mapaA.PIN_HASH + 1).setValue(gerarHashPin_(rg, pinNovo));
        if (mapaA.PIN !== undefined) abaA.getRange(linhaA, mapaA.PIN + 1).clearContent();
        abaA.getRange(linhaA, mapaA.TROCAR_SENHA + 1).setValue("SIM");
      }
    }

    // FUNÇÕES OPERACIONAIS: GESTOR acompanha o perfil de acesso.
    var funcoes = [];
    if (perfil === "GESTOR") funcoes.push("GESTOR");
    if (vistoriador) funcoes.push("VISTORIADOR");

    var linhaF = mapaLinhaF[rgOriginal] || mapaLinhaF[rg];
    if (!linhaF) {
      abaF.appendRow([
        rgOriginal, nome, graduacao, funcoes.join(", "), agora,
        String(sessao.nome || sessao.rg || "").trim()
      ]);
      mapaLinhaF[rgOriginal] = abaF.getLastRow();
    } else {
      abaF.getRange(linhaF,2,1,5).setValues([[
        nome, graduacao, funcoes.join(", "), agora,
        String(sessao.nome || sessao.rg || "").trim()
      ]]);
    }

    alterados++;
  });

  return {
    sucesso:true,
    alterados:alterados,
    novosAcessos:novosAcessos,
    mensagem:alterados + " militar(es) atualizado(s)." +
      (novosAcessos ? " " + novosAcessos + " novo(s) acesso(s) criado(s)." : "")
  };
}


function salvarAcessoFuncaoIndividualPessoal(item, token) {
  exigirPerfil_(token, ["GESTOR"]);
  item = item || {};
  var rg = normalizarRgCadastro_(item.rg);
  if (!rg) throw new Error("Militar inválido.");

  var perfil = String(item.perfil || "").trim().toUpperCase();
  if (perfil === "CONSULTA") perfil = "VISTORIADOR";
  item.perfil = perfil;

  if (!perfil) {
    throw new Error("Selecione um perfil de acesso ou use Remover acesso.");
  }

  var r = salvarAcessosFuncoesPessoal([item], token);
  return {
    sucesso:true,
    mensagem:"Acesso de " + (item.nome || item.rg) + " atualizado com sucesso.",
    resultado:r
  };
}

function cadastrarAcessoPessoal(dados, token) {
  exigirPerfil_(token, ["GESTOR"]);
  dados = dados || {};

  var rg = normalizarRgCadastro_(dados.rg);
  if (!rg) throw new Error("Selecione um militar.");

  var existente = buscarUsuarioAcessoPorRg_(rg);
  if (existente) {
    throw new Error("Este militar já possui acesso cadastrado. Use a opção Salvar na própria linha.");
  }

  var perfil = String(dados.perfil || "").trim().toUpperCase();
  if (perfil === "CONSULTA") perfil = "VISTORIADOR";
  if (!perfil || !perfilPermitido_(perfil) || perfil === "CONSULTA") {
    throw new Error("Selecione um perfil válido.");
  }

  var pin = String(dados.pinNovo || "").trim();
  if (!/^[A-Za-z0-9]{6}$/.test(pin)) {
    throw new Error("Informe um PIN temporário com exatamente 6 caracteres alfanuméricos.");
  }

  dados.perfil = perfil;
  dados.ativo = dados.ativo !== false;
  dados.pinNovo = pin;

  var r = salvarAcessosFuncoesPessoal([dados], token);
  return {
    sucesso:true,
    mensagem:"Acesso cadastrado para " + (dados.nome || dados.rg) + ".",
    resultado:r
  };
}

function removerAcessoPessoal(rg, token) {
  var sessao = exigirPerfil_(token, ["GESTOR"]);
  rg = normalizarRgCadastro_(rg);
  if (!rg) throw new Error("RG inválido.");

  if (normalizarRgCadastro_(sessao.rg) === rg) {
    throw new Error("Você não pode remover o próprio acesso enquanto está logado.");
  }

  var usuario = buscarUsuarioAcessoPorRg_(rg);
  if (!usuario) throw new Error("Este militar não possui acesso cadastrado.");

  // Evita remover o último gestor ativo do sistema.
  if (String(usuario.perfil || "").toUpperCase() === "GESTOR" && estaAtivoAcesso_(usuario.ativo)) {
    var aba = garantirEstruturaAcessos_();
    var mapa = obterMapaCabecalhosAcessos_(aba);
    var vals = aba.getLastRow() >= 2 ? aba.getRange(2,1,aba.getLastRow()-1,aba.getLastColumn()).getDisplayValues() : [];
    var gestoresAtivos = 0;
    vals.forEach(function(r) {
      var p = String(r[mapa.PERFIL] || "").trim().toUpperCase();
      if (p === "GESTOR" && estaAtivoAcesso_(r[mapa.ATIVO])) gestoresAtivos++;
    });
    if (gestoresAtivos <= 1) throw new Error("Não é possível remover o último GESTOR ativo do sistema.");
  }

  usuario.aba.deleteRow(usuario.linha);
  return {sucesso:true, mensagem:"Acesso removido com sucesso. O cadastro do militar foi preservado."};
}


function obterIndicadoresGestor(token) {
  exigirPerfil_(token, ["GESTOR"]);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoje = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy");

  var ativos = 0;
  var abaA = garantirEstruturaAcessos_();
  if (abaA.getLastRow() >= 2) {
    var mapaA = obterMapaCabecalhosAcessos_(abaA);
    var valsA = abaA.getRange(2,1,abaA.getLastRow()-1,abaA.getLastColumn()).getDisplayValues();
    valsA.forEach(function(r) { if (estaAtivoAcesso_(r[mapaA.ATIVO])) ativos++; });
  }

  var vistoriadores = 0;
  var mapaF = obterMapaFuncoesPessoal_();
  Object.keys(mapaF).forEach(function(rg) {
    if (mapaF[rg].funcoes.indexOf("VISTORIADOR") !== -1) vistoriadores++;
  });

  var afastadosHoje = obterAfastamentosVistoriadoresNaData_(hoje).length;

  var pendentesVistoria = 0;
  var pend = ss.getSheetByName("PENDENCIAS_VISTORIAS");
  if (pend && pend.getLastRow() >= 2) {
    var pv = pend.getRange(2,5,pend.getLastRow()-1,1).getDisplayValues();
    pv.forEach(function(r) {
      if (String(r[0] || "").trim().toUpperCase() === "PENDENTE") pendentesVistoria++;
    });
  }

  var solicitacoesAtendimento = 0;
  var sol = ss.getSheetByName("SOLICITACOES_VISTORIA");
  if (sol && sol.getLastRow() >= 2) {
    var sv = sol.getRange(2,10,sol.getLastRow()-1,1).getDisplayValues();
    sv.forEach(function(r) {
      if (String(r[0] || "").trim().toUpperCase() === "PENDENTE") solicitacoesAtendimento++;
    });
  }

  var conferenciaDisponivel = 0;
  var conferenciaVerificacao = 0;
  var conf = ss.getSheetByName("CONFERENCIA_PROTOCOLOS");
  if (conf && conf.getLastRow() >= 2) {
    var cv = conf.getRange(2,10,conf.getLastRow()-1,1).getDisplayValues();
    cv.forEach(function(r) {
      var estado = String(r[0] || "").trim().toUpperCase();
      if (estado === "DISPONÍVEL" || estado === "DISPONIVEL") conferenciaDisponivel++;
      if (estado === "EM VERIFICAÇÃO" || estado === "EM VERIFICACAO") conferenciaVerificacao++;
    });
  }

  var docsPendentes=0, isencoesPendentes=0, tacsVigentes=0;
  var docs=garantirEstruturaDocsDespacho_();
  if(docs.getLastRow()>=2){docs.getRange(2,3,docs.getLastRow()-1,16).getDisplayValues().forEach(function(r){var st=String(r[0]||"").trim().toUpperCase(),tp=String(r[1]||"").trim().toUpperCase();if(st!=="CONCLUÍDO"&&st!=="ARQUIVADO")docsPendentes++;if(tp==="ISENÇÃO DE TAXA"&&!String(r[15]||"").trim())isencoesPendentes++;});}
  var tacs=garantirEstruturaTacs_();
  if(tacs.getLastRow()>=2)tacs.getRange(2,9,tacs.getLastRow()-1,1).getDisplayValues().forEach(function(r){if(String(r[0]||"").trim().toUpperCase()==="VIGENTE")tacsVigentes++;});

  return {
    sucesso:true,
    atualizadoEm:dataHoraSaoPauloTexto_(),
    indicadores:{
      usuariosAtivos:ativos,
      vistoriadores:vistoriadores,
      afastadosHoje:afastadosHoje,
      pendenciasVistorias:pendentesVistoria,
      solicitacoesAtendimento:solicitacoesAtendimento,
      conferenciaDisponivel:conferenciaDisponivel,
      conferenciaEmVerificacao:conferenciaVerificacao,
      docsPendentes:docsPendentes,
      isencoesPendentes:isencoesPendentes,
      tacsVigentes:tacsVigentes
    }
  };
}

// ==========================================================
// MÓDULO PESSOAL / AFASTAMENTOS
// ==========================================================
function garantirEstruturaAfastamentos_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("AFASTAMENTOS");
  var cab = [
    "ID","RG","MILITAR","DATA_INICIAL","DATA_FINAL","MOTIVO","OBSERVAÇÃO",
    "LANÇADO_POR_RG","LANÇADO_POR","CRIADO_EM","ATUALIZADO_EM","STATUS"
  ];
  if (!aba) aba = ss.insertSheet("AFASTAMENTOS");
  prepararCabecalhoLeve_(aba, cab, {cor:"#6f42c1",texto:"#ffffff"});
  return aba;
}

function podeVisualizarAfastamentos_(sessao) {
  if (!sessao) return false;
  var perfil = String(sessao.perfil || "").trim().toUpperCase();
  if (perfil === "GESTOR") return true;
  var p = permissoesDoPerfil_(perfil, sessao.podeAtribuirConferencia);
  return !!(p.vistorias || p.conferenciaAtribuir);
}

function podeEditarAfastamentos_(sessao) {
  if (!sessao) return false;
  var perfil = String(sessao.perfil || "").trim().toUpperCase();
  if (perfil === "GESTOR") return true;
  var p = permissoesDoPerfil_(perfil, sessao.podeAtribuirConferencia);
  // Todo usuário que possui acesso ao módulo Vistorias pode incluir e remover afastamentos.
  return !!p.vistorias;
}

function exigirVisualizacaoAfastamentos_(token) {
  var sessao = obterSessaoAcesso_(token);
  if (!sessao) throw new Error("Sessão expirada ou inválida. Faça login novamente.");
  if (!podeVisualizarAfastamentos_(sessao)) throw new Error("Você não possui permissão para visualizar Afastamentos.");
  return sessao;
}

function exigirEdicaoAfastamentos_(token) {
  var sessao = exigirVisualizacaoAfastamentos_(token);
  if (!podeEditarAfastamentos_(sessao)) throw new Error("Seu acesso aos Afastamentos é somente para visualização.");
  return sessao;
}

function obterMilitaresCadastradosAfastamentos_(token) {
  var sessao = exigirVisualizacaoAfastamentos_(token);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("Cadastro") || ss.getSheetByName("DADOS");
  var militares = [];
  if (!aba || aba.getLastRow() < 2) return {sucesso:true,militares:[],podeEditar:podeEditarAfastamentos_(sessao)};
  var ncols = aba.getLastColumn();
  var cab = aba.getRange(1,1,1,ncols).getDisplayValues()[0];
  var idxRg=-1, idxNome=-1, idxGuerra=-1, idxPosto=-1, idxId=-1;
  cab.forEach(function(h,i){
    var s=String(h||"").trim().toUpperCase();
    if(idxRg<0&&(s==="RG"||s.indexOf("RG")!==-1)) idxRg=i;
    if(idxGuerra<0&&s.indexOf("GUERRA")!==-1) idxGuerra=i;
    if(idxPosto<0&&(s.indexOf("POSTO")!==-1||s.indexOf("GRAD")!==-1)) idxPosto=i;
    if(idxId<0&&(s.indexOf("ID MILITAR")!==-1||s.indexOf("ID_MILITAR")!==-1)) idxId=i;
    if(idxNome<0&&(s==="NOME"||s.indexOf("NOME COMPLETO")!==-1)) idxNome=i;
  });
  var vals=aba.getRange(2,1,aba.getLastRow()-1,ncols).getDisplayValues();
  vals.forEach(function(r){
    var rg=idxRg>=0?String(r[idxRg]||"").trim():"";
    var nome=idxNome>=0?String(r[idxNome]||"").trim():"";
    var guerra=idxGuerra>=0?String(r[idxGuerra]||"").trim():"";
    var posto=idxPosto>=0?String(r[idxPosto]||"").trim():"";
    var id=idxId>=0?String(r[idxId]||"").trim():"";
    var base=guerra||id||nome;
    if(!base&&!rg) return;
    if(!posto&&base){var p=extrairPostoENome(base);posto=p.posto||"";base=p.nome||base;}
    var exibicao=((posto?posto+" ":"")+(base||nome||rg)).trim();
    militares.push({rg:rg,nome:base||nome||rg,nomeCompleto:nome,postoGrad:posto,exibicao:exibicao});
  });
  militares.sort(function(a,b){return String(a.exibicao||"").localeCompare(String(b.exibicao||""),"pt-BR");});
  return {sucesso:true,militares:militares,podeEditar:podeEditarAfastamentos_(sessao)};
}

function obterMilitaresCadastradosAfastamentos(token) {
  return obterMilitaresCadastradosAfastamentos_(token);
}

function listarAfastamentos(token) {
  var sessao=exigirVisualizacaoAfastamentos_(token);
  var aba=garantirEstruturaAfastamentos_();
  var registros=[];
  if(aba.getLastRow()>=2){
    var vals=aba.getRange(2,1,aba.getLastRow()-1,12).getDisplayValues();
    vals.forEach(function(r){
      if(String(r[11]||"ATIVO").trim().toUpperCase()==="EXCLUÍDO") return;
      registros.push({id:String(r[0]||"").trim(),rg:String(r[1]||"").trim(),militar:String(r[2]||"").trim(),dataInicial:String(r[3]||"").trim(),dataFinal:String(r[4]||"").trim(),motivo:String(r[5]||"").trim(),observacao:String(r[6]||"").trim(),lancadoPor:String(r[8]||"").trim(),criadoEm:String(r[9]||"").trim(),atualizadoEm:String(r[10]||"").trim()});
    });
  }
  registros.sort(function(a,b){var da=criarDataSegura(a.dataInicial),db=criarDataSegura(b.dataInicial);var ta=da?da.getTime():0,tb=db?db.getTime():0;if(ta!==tb)return tb-ta;return String(a.militar||"").localeCompare(String(b.militar||""),"pt-BR");});
  return {sucesso:true,registros:registros,podeEditar:podeEditarAfastamentos_(sessao)};
}

function salvarAfastamento(dados, token) {
  var sessao=exigirEdicaoAfastamentos_(token); dados=dados||{};
  var id=String(dados.id||"").trim(),rg=String(dados.rg||"").trim(),militar=String(dados.militar||"").trim();
  var motivo=String(dados.motivo||"").trim(),observacao=String(dados.observacao||"").trim();
  var di=criarDataSegura(dados.dataInicial),df=criarDataSegura(dados.dataFinal);
  var motivos=["Atestado","Férias","Licença","Operação","Outros"];
  if(!rg||!militar) throw new Error("Selecione o militar.");
  if(!di||!df) throw new Error("Informe a data inicial e a data final.");
  if(df.getTime()<di.getTime()) throw new Error("A data final não pode ser anterior à data inicial.");
  if(motivos.indexOf(motivo)===-1) throw new Error("Selecione um motivo válido.");
  var aba=garantirEstruturaAfastamentos_(),agora=dataHoraSaoPauloTexto_(),dini=formatarDataTexto(di),dfim=formatarDataTexto(df);
  if(id&&aba.getLastRow()>=2){
    var ids=aba.getRange(2,1,aba.getLastRow()-1,1).getDisplayValues(),linha=-1;
    for(var i=0;i<ids.length;i++){if(String(ids[i][0]||"").trim()===id){linha=i+2;break;}}
    if(linha>0){aba.getRange(linha,2,1,6).setValues([[rg,militar,dini,dfim,motivo,observacao]]);aba.getRange(linha,11).setValue(agora);aba.getRange(linha,12).setValue("ATIVO");return {sucesso:true,mensagem:"Afastamento atualizado com sucesso.",id:id};}
  }
  id=Utilities.getUuid();
  aba.appendRow([id,rg,militar,dini,dfim,motivo,observacao,String(sessao.rg||"").trim(),String(sessao.nome||"").trim(),agora,agora,"ATIVO"]);
  return {sucesso:true,mensagem:"Afastamento cadastrado com sucesso.",id:id};
}

function excluirAfastamento(id, token) {
  exigirEdicaoAfastamentos_(token); id=String(id||"").trim(); if(!id) throw new Error("Afastamento não informado.");
  var aba=garantirEstruturaAfastamentos_(); if(aba.getLastRow()<2) throw new Error("Afastamento não encontrado.");
  var ids=aba.getRange(2,1,aba.getLastRow()-1,1).getDisplayValues();
  for(var i=0;i<ids.length;i++){if(String(ids[i][0]||"").trim()===id){aba.getRange(i+2,12).setValue("EXCLUÍDO");aba.getRange(i+2,11).setValue(dataHoraSaoPauloTexto_());return {sucesso:true,mensagem:"Afastamento excluído."};}}
  throw new Error("Afastamento não encontrado.");
}

function dataDentroPeriodoAfastamento_(dataRef, ini, fim) {
  var d=criarDataSegura(dataRef),di=criarDataSegura(ini),df=criarDataSegura(fim); if(!d||!di||!df) return false;
  d.setHours(0,0,0,0);di.setHours(0,0,0,0);df.setHours(23,59,59,999);return d.getTime()>=di.getTime()&&d.getTime()<=df.getTime();
}

function ehVistoriadorElegivelAfastamento_(rg,nome) {
  rg=String(rg||"").trim();
  nome=String(nome||"").trim();
  if(!rg && !nome) return false;

  // Regra principal: função operacional VISTORIADOR cadastrada em FUNCOES_PESSOAL.
  if(rg && militarTemFuncao_(rg,"VISTORIADOR")) return true;

  // Compatibilidade: alguns militares já estavam no controle de afastamentos
  // antes da migração completa para FUNCOES_PESSOAL. Nesses casos, não os
  // oculta do Roteiro dos Vistoriadores se não estiverem na lista explícita
  // de nomes excluídos das vistorias.
  if(nome && !nomeExcluidoDasVistorias_(nome,nome)) return true;

  return false;
}

function obterAfastamentosVistoriadoresNaData_(dataRef) {
  var aba=garantirEstruturaAfastamentos_(),saida=[]; if(aba.getLastRow()<2) return saida;
  var vals=aba.getRange(2,1,aba.getLastRow()-1,12).getDisplayValues();
  vals.forEach(function(r){
    if(String(r[11]||"ATIVO").trim().toUpperCase()==="EXCLUÍDO") return;
    if(!dataDentroPeriodoAfastamento_(dataRef,r[3],r[4])) return;
    var rg=String(r[1]||"").trim(),militar=String(r[2]||"").trim();
    if(!ehVistoriadorElegivelAfastamento_(rg,militar)) return;
    saida.push({rg:rg,militar:militar,dataInicial:String(r[3]||"").trim(),dataFinal:String(r[4]||"").trim(),motivo:String(r[5]||"").trim(),observacao:String(r[6]||"").trim()});
  });
  saida.sort(function(a,b){return String(a.militar||"").localeCompare(String(b.militar||""),"pt-BR");}); return saida;
}

function militarAfastadoNaData_(rg,dataRef) {
  rg=String(rg||"").trim(); if(!rg) return null; var lista=obterAfastamentosVistoriadoresNaData_(dataRef);
  for(var i=0;i<lista.length;i++){if(String(lista[i].rg||"").trim()===rg) return lista[i];} return null;
}



// ==========================================================
// DOCS PARA DESPACHO / ISENÇÃO DE TAXAS / GESTÃO DE TACs
// ==========================================================
function garantirEstruturaDocsDespacho_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("DOCS_DESPACHO");
  var cab = [
    "ID","ORIGEM","STATUS","TIPO_DOCUMENTO","PROTOCOLO","VISTORIADOR_RG","VISTORIADOR",
    "DATA_DOCUMENTO","PREENCHIDO_POR_RG","PREENCHIDO_POR","RAZAO_SOCIAL","OBSERVACAO_ORIGEM",
    "RESPOSTA_OFICIAIS","ANDAMENTO","JUSTIFICATIVA_GESTAO","RESPONSAVEL_GESTAO_RG","RESPONSAVEL_GESTAO",
    "DECISAO_ISENCAO","JUSTIFICATIVA_ISENCAO","CADASTRADO_EM","ATUALIZADO_EM","CHAVE_IMPORTACAO","FONTE","EVENTO_TEMPORARIO"
  ];
  if (!aba) aba = ss.insertSheet("DOCS_DESPACHO");
  prepararCabecalhoLeve_(aba,cab,{cor:"#355a8a",texto:"#fff"});
  return aba;
}

function garantirHistoricoDocsDespacho_() {
  var ss=SpreadsheetApp.getActiveSpreadsheet(), aba=ss.getSheetByName("HISTORICO_DOCS_DESPACHO");
  var cab=["ID","DOC_ID","DATA_HORA","EVENTO","STATUS_ANTERIOR","STATUS_NOVO","ANDAMENTO","JUSTIFICATIVA","USUARIO_RG","USUARIO"];
  if(!aba) aba=ss.insertSheet("HISTORICO_DOCS_DESPACHO");
  if(aba.getLastRow()===0) aba.getRange(1,1,1,cab.length).setValues([cab]);
  aba.setFrozenRows(1); return aba;
}

function tiposDocsDespacho_() {
  return ["ANEXO C","ANEXO F","ANEXO H","ANEXO J","ISENÇÃO DE TAXA","PROTOCOLO SUSPENSO","PROTOCOLO EXPIRADO","CANCELAMENTO","DENÚNCIA","OUTROS","PRÉ HABITE-SE","HIDRANTE URBANO","FOTOS"];
}

function andamentosDocsDespacho_() {
  return [
    "AGUARDANDO ANÁLISE",
    "EM ANÁLISE",
    "ENCAMINHADO PARA DESPACHO",
    "AGUARDANDO RESPOSTA",
    "DEVOLVIDO PARA AJUSTE",
    "CONCLUÍDO",
    "ARQUIVADO"
  ];
}

function statusPorAndamentoDoc_(andamento) {
  var a=String(andamento||"").trim().toUpperCase();
  if(a==="AGUARDANDO ANÁLISE") return "PENDENTE";
  if(a==="AGUARDANDO RESPOSTA") return "AGUARDANDO RESPOSTA";
  if(a==="CONCLUÍDO") return "CONCLUÍDO";
  if(a==="ARQUIVADO") return "ARQUIVADO";
  return "EM ANDAMENTO";
}

function normalizarChaveDocDuplicado_(v) {
  var s=String(v||"").trim().toUpperCase();
  try{s=s.normalize("NFD").replace(/[\u0300-\u036f]/g,"");}catch(e){}
  return s.replace(/[^A-Z0-9]/g,"");
}

function normalizarDataChaveDoc_(v) {
  var d=criarDataSegura(v);
  if(d) return Utilities.formatDate(d, Session.getScriptTimeZone() || "America/Sao_Paulo", "yyyyMMdd");
  return normalizarChaveDocDuplicado_(v);
}

function chaveDuplicidadeDoc_(tipo,protocolo,data,razao) {
  return [
    normalizarChaveDocDuplicado_(tipo),
    normalizarChaveDocDuplicado_(protocolo),
    normalizarDataChaveDoc_(data),
    normalizarChaveDocDuplicado_(razao)
  ].join("|");
}

function linhaEhHistoricaDoc_(r) {
  var origem=String(r[1]||"").trim().toUpperCase();
  var fonte=String(r[22]||"").trim().toUpperCase();
  return origem==="HISTÓRICO" || origem==="HISTORICO" || fonte==="PLANILHA_HISTÓRICA" || fonte==="PLANILHA_HISTORICA";
}

// Consolida duplicidades históricas já existentes no banco.
// A mesma combinação Tipo + Protocolo + Data + Razão Social é tratada como um único DOC.
// Registros criados diretamente no sistema não são apagados por esta rotina.
function consolidarDuplicadosDocsHistoricos_() {
  var aba=garantirEstruturaDocsDespacho_();
  if(aba.getLastRow()<3) return 0;

  var lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try{
    var vals=aba.getRange(2,1,aba.getLastRow()-1,23).getDisplayValues();
    var grupos={}, remover=[];

    vals.forEach(function(r,idx){
      if(!linhaEhHistoricaDoc_(r)) return;
      if(!normalizarChaveDocDuplicado_(r[4])) return;
      var chave=chaveDuplicidadeDoc_(r[3],r[4],r[7],r[10]);
      if(!grupos[chave]) grupos[chave]=[];
      grupos[chave].push({linha:idx+2,valores:r});
    });

    Object.keys(grupos).forEach(function(chave){
      var grupo=grupos[chave];
      if(grupo.length<2) return;

      grupo.sort(function(a,b){
        function peso(x){
          var st=String(x.valores[2]||"").trim().toUpperCase();
          var p=(st==="CONCLUÍDO"||st==="ARQUIVADO")?10000:0;
          if(String(x.valores[12]||"").trim()) p+=500; // resposta dos oficiais
          if(String(x.valores[13]||"").trim()) p+=300; // andamento
          if(String(x.valores[14]||"").trim()) p+=200; // justificativa
          x.valores.forEach(function(v){if(String(v||"").trim())p++;});
          return p;
        }
        var pa=peso(a),pb=peso(b);
        if(pa!==pb) return pb-pa;
        return a.linha-b.linha;
      });

      var principal=grupo[0], consolidado=principal.valores.slice();
      grupo.slice(1).forEach(function(item){
        for(var c=0;c<consolidado.length;c++){
          if(!String(consolidado[c]||"").trim() && String(item.valores[c]||"").trim()) consolidado[c]=item.valores[c];
        }
        remover.push(item.linha);
      });
      aba.getRange(principal.linha,1,1,23).setValues([consolidado]);
    });

    remover.sort(function(a,b){return b-a;}).forEach(function(linha){aba.deleteRow(linha);});
    return remover.length;
  } finally {
    try{lock.releaseLock();}catch(e){}
  }
}

function normalizarTipoDoc_(v) {
  var s=String(v||"").replace(/&#x20;|&#32;|&nbsp;/gi," ").trim().toUpperCase();
  try{s=s.normalize("NFD").replace(/[\u0300-\u036f]/g,"");}catch(e){}
  var mapa={
    "ANEXO C":"ANEXO C","ANEXO F":"ANEXO F","ANEXO H":"ANEXO H","ANEXO J":"ANEXO J",
    "ISENCAO DE TAXA":"ISENÇÃO DE TAXA","PROTOCOLO SUSPENSO":"PROTOCOLO SUSPENSO","PROTOCOLO EXPIRADO":"PROTOCOLO EXPIRADO",
    "CANCELAMENTO":"CANCELAMENTO","DENUNCIA":"DENÚNCIA","OUTROS":"OUTROS","PRE HABITE-SE":"PRÉ HABITE-SE",
    "HIDRANTE URBANO":"HIDRANTE URBANO","FOTOS":"FOTOS"
  };
  return mapa[s] || String(v||"").trim().toUpperCase();
}

function diasDocumentoDoc_(dataTexto) {
  var d=criarDataSegura(dataTexto); if(!d) return null;
  var h=new Date(); h.setHours(0,0,0,0); d.setHours(0,0,0,0);
  return Math.floor((h.getTime()-d.getTime())/86400000);
}

function faixaPrazoDoc_(dias) {
  if(dias===null||dias===undefined||isNaN(dias)) return "SEM_DATA";
  if(dias<=8) return "VERDE";
  if(dias<=17) return "LARANJA";
  return "VERMELHO";
}

function chaveImportacaoDoc_(tipo, protocolo, data, preenchido, razao) {
  function n(v){var s=String(v||"").trim().toUpperCase();try{s=s.normalize("NFD").replace(/[\u0300-\u036f]/g,"");}catch(e){}return s.replace(/\s+/g," ");}
  return [n(tipo),n(protocolo),n(data),n(preenchido),n(razao)].join("|");
}

function obterVistoriadoresDocs(token) {
  exigirPerfil_(token,["GESTOR","CONFERENCIA","ATENDIMENTO","VISTORIADOR","CONSULTA"]);
  var militares=obterMilitaresCadastroPessoal_(), funcoes=obterMapaFuncoesPessoal_(), saida=[];
  militares.forEach(function(m){var f=funcoes[String(m.rg||"").trim()];if(f&&f.funcoes.indexOf("VISTORIADOR")!==-1)saida.push({rg:m.rg,nome:m.nome,graduacao:m.graduacao});});
  return {sucesso:true,militares:saida};
}

function cadastrarDocDespacho(dados, token) {
  var sessao=exigirPerfil_(token,["GESTOR","CONFERENCIA","ATENDIMENTO"]); dados=dados||{};
  var tipo=normalizarTipoDoc_(dados.tipoDocumento), protocolo=String(dados.protocolo||"").trim(), razao=String(dados.razaoSocial||"").trim();
  var data=criarDataSegura(dados.dataDocumento);
  if(!tipo||tiposDocsDespacho_().indexOf(tipo)===-1) throw new Error("Selecione um tipo de documento válido.");
  if(!protocolo) throw new Error("Informe o protocolo.");
  if(!data) throw new Error("Informe a Data do Documento.");
  if(!razao) throw new Error("Informe a Razão Social ou Nome Fantasia.");

  var perfil=String(sessao.perfil||"").toUpperCase();
  var origem=perfil==="ATENDIMENTO"?"ATENDIMENTO":(perfil==="CONFERENCIA"?"CONFERÊNCIA":"GESTÃO");
  var aba=garantirEstruturaDocsDespacho_(), agora=dataHoraSaoPauloTexto_(), id=Utilities.getUuid();
  var dataTxt=formatarDataTexto(data);
  var chaveNova=chaveDuplicidadeDoc_(tipo,protocolo,dataTxt,razao);

  if(aba.getLastRow()>=2){
    var atuais=aba.getRange(2,1,aba.getLastRow()-1,23).getDisplayValues();
    for(var i=0;i<atuais.length;i++){
      var ch=chaveDuplicidadeDoc_(atuais[i][3],atuais[i][4],atuais[i][7],atuais[i][10]);
      if(ch===chaveNova){
        throw new Error("Já existe um DOC com o mesmo tipo, protocolo, data e razão social.");
      }
    }
  }

  aba.appendRow([
    id,origem,"PENDENTE",tipo,String(protocolo),String(dados.vistoriadorRg||"").trim(),String(dados.vistoriador||"").trim(),
    dataTxt,String(sessao.rg||"").trim(),String(sessao.nome||"").trim(),razao,String(dados.observacao||"").trim(),
    "","AGUARDANDO ANÁLISE","","","","","",agora,agora,"","SISTEMA",dados.eventoTemporario===true?"SIM":"NÃO"
  ]);
  garantirHistoricoDocsDespacho_().appendRow([Utilities.getUuid(),id,agora,"CADASTRADO","","PENDENTE","AGUARDANDO ANÁLISE",String(dados.observacao||"").trim(),sessao.rg,sessao.nome]);
  return {sucesso:true,mensagem:"DOC para despacho cadastrado com sucesso."};
}

function listarDocsDespacho(filtros, token) {
  var sessao=exigirPerfil_(token,["GESTOR","CONFERENCIA","ATENDIMENTO"]); filtros=filtros||{};
  // Não executa limpeza física ao abrir a tela. Em bases grandes, apagar linhas
  // durante a listagem deixava o Web App carregando por muito tempo.
  // A desduplicação de visualização é feita em memória, sem alterar a planilha.
  var aba=garantirEstruturaDocsDespacho_(), registros=[];
  var resumo={abertos:0,aguardandoResposta:0,concluidos:0,total:0};
  if(aba.getLastRow()<2)return{sucesso:true,registros:[],resumo:resumo};

  var vals=aba.getRange(2,1,aba.getLastRow()-1,24).getDisplayValues();

  // Segurança adicional: nunca exibe duas linhas históricas idênticas.
  // Quando existem duplicados, mantém na visualização o registro mais recentemente
  // atualizado. Isso permite que uma correção/linha manual substitua visualmente
  // uma importação antiga, sem precisar apagar o histórico da planilha.
  var naoHistoricos=[], gruposHistoricos={};
  vals.forEach(function(r,idx){
    if(!linhaEhHistoricaDoc_(r)){
      naoHistoricos.push({r:r,idx:idx});
      return;
    }
    var k=chaveDuplicidadeDoc_(r[3],r[4],r[7],r[10]);
    if(!gruposHistoricos[k]) gruposHistoricos[k]=[];
    gruposHistoricos[k].push({r:r,idx:idx});
  });

  function dataHoraDocMs_(v){
    var s=String(v||"").trim();
    var m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if(m) return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),Number(m[4]),Number(m[5]),Number(m[6]||0)).getTime();
    var d=criarDataSegura(s);
    return d?d.getTime():0;
  }

  function pesoRegistroHistoricoDoc_(item){
    var r=item.r, p=0;
    // Atualização mais recente é o principal critério.
    p += dataHoraDocMs_(r[20]) * 1000;
    // Em empate, prefere cadastro mais recente.
    p += dataHoraDocMs_(r[19]);
    // Depois, prefere o registro com ID e maior completude.
    if(String(r[0]||"").trim()) p += 100;
    for(var c=0;c<r.length;c++) if(String(r[c]||"").trim()) p += 1;
    return p;
  }

  var selecionadosHistoricos=[];
  Object.keys(gruposHistoricos).forEach(function(k){
    var grupo=gruposHistoricos[k];
    grupo.sort(function(a,b){
      var pa=pesoRegistroHistoricoDoc_(a), pb=pesoRegistroHistoricoDoc_(b);
      if(pa!==pb) return pb-pa;
      return b.idx-a.idx; // última linha ganha em empate
    });
    selecionadosHistoricos.push(grupo[0]);
  });

  vals=naoHistoricos.concat(selecionadosHistoricos).sort(function(a,b){return a.idx-b.idx;}).map(function(x){return x.r;});

  var perfil=String(sessao.perfil||"").toUpperCase();
  // A fila de DOCs é compartilhada para consulta entre Gestão, Atendimento e Conferência.
  // As permissões de alteração continuam restritas ao Gestor.
  var situacao=String(filtros.situacao||filtros.status||"ABERTOS").trim().toUpperCase();

  vals.forEach(function(r){
    var tipo=normalizarTipoDoc_(r[3]), status=String(r[2]||"").trim().toUpperCase();
    if(filtros.tipo&&tipo!==String(filtros.tipo))return;

    resumo.total++;
    var finalizado=(status==="CONCLUÍDO"||status==="ARQUIVADO");
    if(finalizado) resumo.concluidos++;
    else {
      resumo.abertos++;
      if(status==="AGUARDANDO RESPOSTA") resumo.aguardandoResposta++;
    }

    if(situacao==="ABERTOS"&&finalizado) return;
    if(situacao==="CONCLUIDOS"&&!finalizado) return;
    if(["ABERTOS","CONCLUIDOS","TODOS"].indexOf(situacao)===-1&&situacao&&status!==situacao) return;

    var dias=finalizado?null:diasDocumentoDoc_(r[7]);
    registros.push({
      id:r[0],origem:r[1],status:r[2],tipoDocumento:tipo,protocolo:r[4],vistoriadorRg:r[5],vistoriador:r[6],dataDocumento:r[7],preenchidoPor:r[9],razaoSocial:r[10],
      observacao:r[11],respostaOficiais:r[12],andamento:r[13],justificativa:r[14],responsavelGestao:r[16],decisaoIsencao:r[17],justificativaIsencao:r[18],
      eventoTemporario:String(r[23]||'').trim().toUpperCase()==='SIM',cadastradoEm:r[19],atualizadoEm:r[20],diasDocumento:dias,faixaPrazo:finalizado?"FINALIZADO":faixaPrazoDoc_(dias)
    });
  });

  function dataHoraDocMs_(v){
    var s=String(v||"").trim();
    if(!s) return 0;
    var m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if(m) return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),Number(m[4]||0),Number(m[5]||0),Number(m[6]||0)).getTime();
    var d=criarDataSegura(s); return d?d.getTime():0;
  }

  registros.sort(function(a,b){
    var af=(String(a.status||"").toUpperCase()==="CONCLUÍDO"||String(a.status||"").toUpperCase()==="ARQUIVADO");
    var bf=(String(b.status||"").toUpperCase()==="CONCLUÍDO"||String(b.status||"").toUpperCase()==="ARQUIVADO");

    if(situacao==="TODOS"){
      if(af!==bf) return af?-1:1;
      if(af&&bf){
        var atuB=dataHoraDocMs_(b.atualizadoEm),atuA=dataHoraDocMs_(a.atualizadoEm);
        if(atuB!==atuA) return atuB-atuA;
      }
    } else if(situacao==="CONCLUIDOS"){
      var cb=dataHoraDocMs_(b.atualizadoEm),ca=dataHoraDocMs_(a.atualizadoEm);
      if(cb!==ca) return cb-ca;
    }

    var da=criarDataSegura(a.dataDocumento),db=criarDataSegura(b.dataDocumento);
    return (da&&db)?db.getTime()-da.getTime():0;
  });
  return {sucesso:true,registros:registros,resumo:resumo};
}

function obterHistoricoDocDespacho(docId, token) {
  exigirPerfil_(token,["GESTOR","CONFERENCIA","ATENDIMENTO"]);
  docId=String(docId||"").trim();
  if(!docId) throw new Error("DOC não informado.");

  var aba=garantirHistoricoDocsDespacho_(), eventos=[];
  if(aba.getLastRow()<2) return {sucesso:true,eventos:eventos};

  var linhasDoc=[];
  aba.getRange(2,2,aba.getLastRow()-1,1).getDisplayValues().forEach(function(r,i){
    if(String(r[0]||'').trim()===docId)linhasDoc.push(i+2);
  });
  var dadosDoc=lerLinhasProtocolosRoteiro_(aba,{doc:linhasDoc},10);
  var vals=linhasDoc.map(function(linha){return dadosDoc[linha];});
  vals.forEach(function(r){
    if(String(r[1]||"").trim()!==docId) return;
    eventos.push({
      id:String(r[0]||"").trim(),
      dataHora:String(r[2]||"").trim(),
      evento:String(r[3]||"").trim(),
      statusAnterior:String(r[4]||"").trim(),
      statusNovo:String(r[5]||"").trim(),
      andamento:String(r[6]||"").trim(),
      detalhes:String(r[7]||"").trim(),
      usuarioRg:String(r[8]||"").trim(),
      usuario:String(r[9]||"").trim()
    });
  });

  function dataHoraMs_(v){
    var s=String(v||"").trim(),m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if(!m) return 0;
    return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),Number(m[4]||0),Number(m[5]||0),Number(m[6]||0)).getTime();
  }
  eventos.sort(function(a,b){return dataHoraMs_(b.dataHora)-dataHoraMs_(a.dataHora);});
  return {sucesso:true,eventos:eventos};
}

function limparDuplicadosHistoricosDocsDespacho(token) {
  exigirPerfil_(token,["GESTOR"]);
  var removidos=consolidarDuplicadosDocsHistoricos_();
  return {sucesso:true,removidos:removidos,mensagem:removidos?removidos+" duplicado(s) histórico(s) removido(s).":"Nenhuma duplicidade histórica encontrada."};
}

function editarDadosDocDespachoGestao(dados, token) {
  var sessao=exigirPerfil_(token,["GESTOR"]);
  dados=dados||{};

  var id=String(dados.id||"").trim();
  if(!id) throw new Error("Documento não informado.");

  var tipo=normalizarTipoDoc_(dados.tipoDocumento);
  var protocolo=String(dados.protocolo||"").trim();
  var razao=String(dados.razaoSocial||"").trim();
  var data=criarDataSegura(dados.dataDocumento);

  if(!tipo||tiposDocsDespacho_().indexOf(tipo)===-1) throw new Error("Selecione um tipo de documento válido.");
  if(!protocolo) throw new Error("Informe o protocolo.");
  if(!data) throw new Error("Informe a Data do Documento.");
  if(!razao) throw new Error("Informe a Razão Social ou Nome Fantasia.");

  var aba=garantirEstruturaDocsDespacho_();
  if(aba.getLastRow()<2) throw new Error("Documento não encontrado.");

  var vals=aba.getRange(2,1,aba.getLastRow()-1,23).getDisplayValues();
  var linha=-1, antigo=null;
  for(var i=0;i<vals.length;i++){
    if(String(vals[i][0]||"").trim()===id){ linha=i+2; antigo=vals[i]; break; }
  }
  if(linha<0) throw new Error("Documento não encontrado.");

  var dataTxt=formatarDataTexto(data);
  var chaveNova=chaveDuplicidadeDoc_(tipo,protocolo,dataTxt,razao);
  for(var j=0;j<vals.length;j++){
    if(j+2===linha) continue;
    var ch=chaveDuplicidadeDoc_(vals[j][3],vals[j][4],vals[j][7],vals[j][10]);
    if(ch===chaveNova) throw new Error("Já existe outro DOC com o mesmo tipo, protocolo, data e razão social.");
  }

  aba.getRange(linha,4).setValue(tipo);
  aba.getRange(linha,5).setValue(protocolo);
  aba.getRange(linha,6).setValue(String(dados.vistoriadorRg||"").trim());
  aba.getRange(linha,7).setValue(String(dados.vistoriador||"").trim());
  aba.getRange(linha,8).setValue(dataTxt);
  aba.getRange(linha,11).setValue(razao);
  aba.getRange(linha,12).setValue(String(dados.observacao||"").trim());
  aba.getRange(linha,21).setValue(dataHoraSaoPauloTexto_());

  if(dados.eventoTemporario!==undefined)aba.getRange(linha,24).setValue(dados.eventoTemporario===true?'SIM':'NÃO');
  garantirHistoricoDocsDespacho_().appendRow([
    Utilities.getUuid(),id,dataHoraSaoPauloTexto_(),"EDIÇÃO DE DADOS",
    String(antigo[2]||""),String(antigo[2]||""),String(antigo[13]||""),
    "Dados cadastrais do DOC atualizados pelo Gestor.",sessao.rg,sessao.nome
  ]);
  return {sucesso:true,mensagem:"Dados do DOC atualizados com sucesso."};
}

function atualizarDocDespachoGestao(dados, token) {
  var sessao=exigirPerfil_(token,["GESTOR"]); dados=dados||{};
  var id=String(dados.id||"").trim(); if(!id)throw new Error("Documento não informado.");
  var aba=garantirEstruturaDocsDespacho_(), vals=aba.getLastRow()>=2?aba.getRange(2,1,aba.getLastRow()-1,23).getDisplayValues():[], linha=-1, anterior="";
  for(var i=0;i<vals.length;i++){
    if(String(vals[i][0]||"").trim()===id){linha=i+2;anterior=String(vals[i][2]||"").trim();break;}
  }
  if(linha<0)throw new Error("Documento não encontrado.");

  var andamento=String(dados.andamento||"").trim().toUpperCase();
  if(andamentosDocsDespacho_().indexOf(andamento)===-1) throw new Error("Selecione um andamento válido.");
  var status=statusPorAndamentoDoc_(andamento);

  aba.getRange(linha,3).setValue(status);
  aba.getRange(linha,13,1,5).setValues([[
    String(dados.respostaOficiais||"").trim(),andamento,String(dados.justificativa||"").trim(),sessao.rg,sessao.nome
  ]]);
  aba.getRange(linha,21).setValue(dataHoraSaoPauloTexto_());
  var detalheHistorico=[];
  var justificativaHistorico=String(dados.justificativa||"").trim();
  var respostaHistorico=String(dados.respostaOficiais||"").trim();
  if(justificativaHistorico) detalheHistorico.push("Justificativa: "+justificativaHistorico);
  if(respostaHistorico) detalheHistorico.push("Resposta dos Oficiais: "+respostaHistorico);
  garantirHistoricoDocsDespacho_().appendRow([
    Utilities.getUuid(),id,dataHoraSaoPauloTexto_(),"ATUALIZAÇÃO GESTÃO",anterior,status,andamento,detalheHistorico.join(" | "),sessao.rg,sessao.nome
  ]);
  return {sucesso:true,mensagem:"DOC atualizado com sucesso.",status:status,andamento:andamento};
}

function parseTsvDocs_(texto) {
  texto=String(texto||"").replace(/\r\n/g,"\n").replace(/\r/g,"\n"); var rows=[],row=[],cell="",q=false;
  for(var i=0;i<texto.length;i++){var c=texto[i];if(c==='"'){if(q&&texto[i+1]==='"'){cell+='"';i++;}else q=!q;}else if(c==='\t'&&!q){row.push(cell);cell="";}else if(c==='\n'&&!q){row.push(cell);rows.push(row);row=[];cell="";}else cell+=c;}
  row.push(cell); if(row.some(function(x){return String(x||"").trim();}))rows.push(row); return rows;
}

function importarDocsDespachoHistorico(texto, token) {
  exigirPerfil_(token,["GESTOR"]);
  var rows=parseTsvDocs_(texto); if(!rows.length)throw new Error("Cole os dados da planilha.");
  function norm(v){var s=String(v||"").trim().toUpperCase();try{s=s.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"");}catch(e){}return s.replace(/\\s+/g," ");}
  var header=rows[0].map(norm),temHeader=header.some(function(h){return h.indexOf("TIPO DE DOCUMENTO")!==-1||h==="PROTOCOLO"||h.indexOf("DATA DO DOCUMENTO")!==-1;});
  var idx={f:0,tipo:1,protocolo:2,vistoriador:3,data:4,preenchido:5,razao:6,resposta:7,andamento:8};
  if(temHeader){
    function achar(t){for(var j=0;j<header.length;j++)if(t.some(function(x){return header[j]===x||header[j].indexOf(x)!==-1;}))return j;return -1;}
    idx.f=achar(["F","STATUS","OK"]);idx.tipo=achar(["TIPO DE DOCUMENTO"]);idx.protocolo=achar(["PROTOCOLO"]);idx.vistoriador=achar(["VISTORIADOR"]);idx.data=achar(["DATA DO DOCUMENTO"]);idx.preenchido=achar(["PREENCHIDO POR"]);idx.razao=achar(["RAZAO SOCIAL OU NOME FANTASIA","RAZAO SOCIAL"]);idx.resposta=achar(["RESPOSTA DOS OFICIAIS"]);idx.andamento=achar(["ANDAMENTO"]);rows=rows.slice(1);
  }
  var aba=garantirEstruturaDocsDespacho_(),existentes={};
  if(aba.getLastRow()>=2){
    var ev=aba.getRange(2,1,aba.getLastRow()-1,23).getDisplayValues();
    ev.forEach(function(r,k){
      var ch=chaveDuplicidadeDoc_(r[3],r[4],r[7],r[10]);
      if(ch) existentes[ch]=k+2;
    });
  }
  var novos=[],atualizados=0,ignorados=0,agora=dataHoraSaoPauloTexto_();
  rows.forEach(function(r){
    var tipo=normalizarTipoDoc_(idx.tipo>=0?r[idx.tipo]:""),protocolo=String(idx.protocolo>=0?r[idx.protocolo]:"").trim(),dataRaw=String(idx.data>=0?r[idx.data]:"").trim();
    if(!tipo&&!protocolo&&!dataRaw)return;if(!protocolo||!tipo){ignorados++;return;}
    var d=criarDataSegura(dataRaw),data=d?formatarDataTexto(d):dataRaw,preenchido=String(idx.preenchido>=0?r[idx.preenchido]:"").trim(),razao=String(idx.razao>=0?r[idx.razao]:"").trim();
    var chave=chaveDuplicidadeDoc_(tipo,protocolo,data,razao),status=(idx.f>=0&&norm(r[idx.f])==="OK")?"CONCLUÍDO":"PENDENTE";
    var andamentoOriginal=String(idx.andamento>=0?r[idx.andamento]:"").trim();
    var andamentoPadrao=status==="CONCLUÍDO"?"CONCLUÍDO":"AGUARDANDO ANÁLISE";
    var valores=["","HISTÓRICO",status,tipo,protocolo,"",String(idx.vistoriador>=0?r[idx.vistoriador]:"").trim(),data,"",preenchido,razao,"",String(idx.resposta>=0?r[idx.resposta]:"").trim(),andamentoPadrao,andamentoOriginal,"","","","",agora,agora,chave,"PLANILHA_HISTÓRICA"];
    if(existentes[chave]){
      var lin=existentes[chave];valores[0]=aba.getRange(lin,1).getDisplayValue();valores[19]=aba.getRange(lin,20).getDisplayValue()||agora;
      aba.getRange(lin,1,1,23).setValues([valores]);atualizados++;
    }else{valores[0]=Utilities.getUuid();novos.push(valores);existentes[chave]=-1;}
  });
  if(novos.length)aba.getRange(aba.getLastRow()+1,1,novos.length,23).setValues(novos);
  var duplicados=consolidarDuplicadosDocsHistoricos_();
  return {sucesso:true,novos:novos.length,atualizados:atualizados,ignorados:ignorados,duplicadosRemovidos:duplicados,mensagem:"Importação concluída: "+novos.length+" novo(s), "+atualizados+" atualizado(s), "+ignorados+" ignorado(s) e "+duplicados+" duplicidade(s) removida(s)."};
}

function listarIsencoesTaxa(token) { exigirPerfil_(token,["GESTOR"]); return listarDocsDespacho({tipo:"ISENÇÃO DE TAXA"},token); }
function salvarIsencaoTaxa(dados,token){
  var sessao=exigirPerfil_(token,["GESTOR"]);dados=dados||{};var id=String(dados.id||"").trim(),aba=garantirEstruturaDocsDespacho_(),vals=aba.getLastRow()>=2?aba.getRange(2,1,aba.getLastRow()-1,23).getDisplayValues():[],linha=-1;
  for(var i=0;i<vals.length;i++)if(String(vals[i][0]||"").trim()===id){linha=i+2;break;} if(linha<0)throw new Error("Isenção não encontrada.");
  aba.getRange(linha,18,1,2).setValues([[String(dados.decisao||"").trim().toUpperCase(),String(dados.justificativa||"").trim()]]);aba.getRange(linha,16,1,2).setValues([[sessao.rg,sessao.nome]]);aba.getRange(linha,21).setValue(dataHoraSaoPauloTexto_());return{sucesso:true,mensagem:"Isenção atualizada."};
}

function garantirEstruturaTacs_(){var ss=SpreadsheetApp.getActiveSpreadsheet(),aba=ss.getSheetByName("GESTAO_TACS"),cab=["ID","NUMERO_TAC","PROTOCOLO","INTERESSADO","OBJETO","DATA_ASSINATURA","DATA_FINAL","RESPONSAVEL","SITUACAO","OBSERVACAO","CADASTRADO_EM","ATUALIZADO_EM"];
 if(!aba)aba=ss.insertSheet("GESTAO_TACS");if(aba.getLastRow()===0)aba.getRange(1,1,1,cab.length).setValues([cab]);aba.setFrozenRows(1);return aba;}
function listarTacsGestao(token){exigirPerfil_(token,["GESTOR"]);var a=garantirEstruturaTacs_(),r=[];if(a.getLastRow()>=2)a.getRange(2,1,a.getLastRow()-1,12).getDisplayValues().forEach(function(x){if(x[0])r.push({id:x[0],numero:x[1],protocolo:x[2],interessado:x[3],objeto:x[4],dataAssinatura:x[5],dataFinal:x[6],responsavel:x[7],situacao:x[8],observacao:x[9]});});return{sucesso:true,registros:r};}
function salvarTacGestao(dados,token){exigirPerfil_(token,["GESTOR"]);dados=dados||{};var a=garantirEstruturaTacs_(),id=String(dados.id||"").trim(),agora=dataHoraSaoPauloTexto_(),vals=a.getLastRow()>=2?a.getRange(2,1,a.getLastRow()-1,1).getDisplayValues():[],linha=-1;for(var i=0;i<vals.length;i++)if(String(vals[i][0])===id){linha=i+2;break;}var row=[id||Utilities.getUuid(),String(dados.numero||"").trim(),String(dados.protocolo||"").trim(),String(dados.interessado||"").trim(),String(dados.objeto||"").trim(),String(dados.dataAssinatura||"").trim(),String(dados.dataFinal||"").trim(),String(dados.responsavel||"").trim(),String(dados.situacao||"EM ELABORAÇÃO").trim().toUpperCase(),String(dados.observacao||"").trim(),agora,agora];if(!row[1])throw new Error("Informe o número do TAC.");if(linha>0){row[10]=a.getRange(linha,11).getDisplayValue()||agora;a.getRange(linha,1,1,12).setValues([row]);}else a.appendRow(row);return{sucesso:true,mensagem:"TAC salvo com sucesso."};}
function excluirTacGestao(id,token){exigirPerfil_(token,["GESTOR"]);var a=garantirEstruturaTacs_();if(a.getLastRow()<2)throw new Error("TAC não encontrado.");var v=a.getRange(2,1,a.getLastRow()-1,1).getDisplayValues();for(var i=0;i<v.length;i++)if(String(v[i][0])===String(id)){a.deleteRow(i+2);return{sucesso:true,mensagem:"TAC removido."};}throw new Error("TAC não encontrado.");}

// ==========================================================
// MÓDULO ATENDIMENTO — VERSÃO DE APLICAÇÃO
// ==========================================================
function garantirEstruturaAtendimentos_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("ATENDIMENTOS");
  var cabecalho = ["DATA/HORA","RG_ATENDENTE","ATENDENTE","TIPO_ATENDIMENTO","SOLICITANTE","PROTOCOLO","TELEFONE","MOTIVO_ATENDIMENTO","OBSERVAÇÃO"];
  if (!aba) aba = ss.insertSheet("ATENDIMENTOS");
  prepararCabecalhoLeve_(aba, cabecalho, {primeiroVazio:true,somenteInicial:true,cor:"#5C1D1D",centralizar:true,redimensionar:true});
  return aba;
}

function prepararVersaoAplicacao() {
  garantirEstruturaAcessos_();
  garantirEstruturaAtendimentos_();
  garantirEstruturaConferenciaProtocolos_();
  garantirEstruturaHistoricoConferencia_();
  garantirEstruturaCredenciamentoProcessos_();
  garantirEstruturaHistoricoCredenciamento_();
  return "Estruturas da aplicação prontas. Nenhum dado existente foi apagado.";
}

function normalizarTelefoneAtendimento_(valor) {
  var digitos = String(valor || "").replace(/\D/g, "");
  if (!digitos) return "";
  if (digitos.length < 10 || digitos.length > 11) throw new Error("Telefone inválido. Informe o DDD e o número, com 10 ou 11 dígitos.");
  if (digitos.length === 11) return "(" + digitos.substring(0,2) + ") " + digitos.substring(2,7) + "-" + digitos.substring(7);
  return "(" + digitos.substring(0,2) + ") " + digitos.substring(2,6) + "-" + digitos.substring(6);
}

function salvarAtendimento(dados, token) {
  var sessao = exigirPerfil_(token, ["ATENDIMENTO","CONFERENCIA"]);
  dados = dados || {};
  var tipo = String(dados.tipoAtendimento || "").trim().toUpperCase();
  var solicitante = String(dados.solicitante || "").trim();
  var protocolo = String(dados.protocolo || "").trim();
  var telefone = normalizarTelefoneAtendimento_(dados.telefone);
  var motivo = String(dados.motivoAtendimento || "").trim().toUpperCase();
  var observacao = String(dados.observacao || "").trim();
  if (["PRESENCIAL","WHATSAPP","TELEFONE"].indexOf(tipo) === -1) throw new Error("Selecione um tipo de atendimento válido.");
  if (!solicitante) throw new Error("O nome do solicitante é obrigatório.");
  if (["VISTORIA","PROJETOS","SIAPI (SISTEMA)","OUTROS"].indexOf(motivo) === -1) throw new Error("Selecione um motivo de atendimento válido.");
  var aba = garantirEstruturaAtendimentos_();
  aba.appendRow([new Date(), sessao.rg, sessao.nome || ("RG " + sessao.rg), tipo, solicitante, protocolo, telefone, motivo, observacao]);
  aba.getRange(aba.getLastRow(),1).setNumberFormat("dd/MM/yyyy HH:mm:ss");
  return { sucesso:true, mensagem:"Atendimento salvo com sucesso.", atendente:sessao.nome || ("RG " + sessao.rg) };
}

function obterResumoAtendimentoHoje(token) {
  var sessao = exigirPerfil_(token, ["ATENDIMENTO","CONFERENCIA"]);
  var aba = garantirEstruturaAtendimentos_();
  var totalHoje = 0, totalUsuarioHoje = 0;
  if (aba.getLastRow() >= 2) {
    var dados = aba.getRange(2,1,aba.getLastRow()-1,2).getValues();
    var hoje = new Date(); hoje.setHours(0,0,0,0);
    dados.forEach(function(r){
      var d = r[0] instanceof Date ? new Date(r[0].getTime()) : new Date(r[0]);
      if (isNaN(d.getTime())) return;
      d.setHours(0,0,0,0);
      if (d.getTime() === hoje.getTime()) {
        totalHoje++;
        if (normalizarRgCadastro_(r[1]) === normalizarRgCadastro_(sessao.rg)) totalUsuarioHoje++;
      }
    });
  }
  return { totalHoje:totalHoje, totalUsuarioHoje:totalUsuarioHoje };
}



// ==========================================================
// MÓDULO CREDENCIAMENTO
// ==========================================================
function garantirEstruturaCredenciamentoProcessos_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("CREDENCIAMENTO_PROCESSOS");
  if (!aba) aba = ss.insertSheet("CREDENCIAMENTO_PROCESSOS");

  var cab = [
    "PROTOCOLO",
    "DESPACHO",
    "TIPO_CREDENCIAMENTO",
    "CIDADE",
    "ESTADO",
    "RAZAO_SOCIAL",
    "CONFERENTE_RG",
    "CONFERENTE",
    "DATA_ULTIMA_MOVIMENTACAO",
    "MES",
    "AVISO",
    "ESTADO_INTERNO",
    "PRIMEIRA_IMPORTACAO",
    "ULTIMA_IMPORTACAO",
    "ATUALIZADO_EM"
  ];

  prepararCabecalhoLeve_(aba, cab, {primeiroVazio:true,cor:"#E8C9DB",texto:"#1F4E79",centralizar:true});
  return aba;
}

function garantirEstruturaHistoricoCredenciamento_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("HISTORICO_CREDENCIAMENTO");
  if (!aba) aba = ss.insertSheet("HISTORICO_CREDENCIAMENTO");

  var cab = [
    "DATA_HORA",
    "PROTOCOLO",
    "EVENTO",
    "DESPACHO",
    "TIPO_CREDENCIAMENTO",
    "CIDADE",
    "ESTADO",
    "RAZAO_SOCIAL",
    "RG_USUARIO",
    "USUARIO",
    "AVISO",
    "CHAVE_IMPORTACAO",
    "ORIGEM"
  ];

  prepararCabecalhoLeve_(aba, cab, {primeiroVazio:true,cor:"#5C1D1D",centralizar:true});
  return aba;
}

function prepararModuloCredenciamento(token) {
  exigirPerfil_(token, ["CONFERENCIA"]);
  garantirEstruturaCredenciamentoProcessos_();
  garantirEstruturaHistoricoCredenciamento_();
  return {sucesso:true};
}

function normalizarTextoCredenciamento_(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function mapaCredenciamentoProcessos_(aba) {
  var mapa = {};
  if (!aba || aba.getLastRow() < 2) return mapa;

  var vals = aba.getRange(2,1,aba.getLastRow()-1,15).getDisplayValues();
  vals.forEach(function(r, i) {
    var p = normalizarProtocoloRoteiro_(r[0]);
    if (p) mapa[p] = {linha:i+2, r:r};
  });
  return mapa;
}

function objetoCredenciamentoLinha_(r) {
  r = r || [];
  return {
    protocolo:String(r[0] || "").trim(),
    despacho:String(r[1] || "").trim(),
    tipoCredenciamento:String(r[2] || "").trim(),
    cidade:String(r[3] || "").trim(),
    estado:String(r[4] || "").trim(),
    razaoSocial:String(r[5] || "").trim(),
    conferenteRg:String(r[6] || "").trim(),
    conferente:String(r[7] || "").trim(),
    dataUltimaMovimentacao:String(r[8] || "").trim(),
    mes:String(r[9] || "").trim(),
    aviso:String(r[10] || "").trim(),
    estadoInterno:String(r[11] || "").trim(),
    primeiraImportacao:String(r[12] || "").trim(),
    ultimaImportacao:String(r[13] || "").trim(),
    atualizadoEm:String(r[14] || "").trim()
  };
}

function prepararAlimentacaoCredenciamento(itens, token) {
  exigirPerfil_(token, ["CONFERENCIA"]);
  itens = Array.isArray(itens) ? itens : [];
  var aba = garantirEstruturaCredenciamentoProcessos_();
  var mapa = mapaCredenciamentoProcessos_(aba);
  var saida = [];
  var vistos = {};

  itens.forEach(function(item) {
    var p = normalizarProtocoloRoteiro_(item && item.protocolo);
    if (!p || vistos[p]) return;
    vistos[p] = true;

    var atual = mapa[p] ? objetoCredenciamentoLinha_(mapa[p].r) : {};
    saida.push({
      protocolo:p,
      situacaoEntrada:mapa[p] ? "EXISTENTE" : "NOVO",
      tipoCredenciamento:String(item.tipoCredenciamento || atual.tipoCredenciamento || "").trim(),
      cidade:String(item.cidade || atual.cidade || "").trim(),
      estado:String(item.estado || atual.estado || "").trim().toUpperCase(),
      razaoSocial:String(item.razaoSocial || atual.razaoSocial || "").trim()
    });
  });

  return {sucesso:true, itens:saida};
}

function salvarAlimentacaoCredenciamento(itens, token) {
  var sessao = exigirPerfil_(token, ["CONFERENCIA"]);
  itens = Array.isArray(itens) ? itens : [];
  if (!itens.length) throw new Error("Nenhum protocolo para alimentar.");

  var novosFormatos=itens.filter(function(x){return !!x.entradaCredenciamento;});
  novosFormatos.forEach(function(x){
    if(['SIAPI','SEI'].indexOf(x.origem)<0||!/^\d{3,12}\/\d{2,4}$/.test(String(x.protocolo||'')))throw new Error('Entrada inválida. Confira a prévia.');
    validarNumeroSeiCredenciamento_(x.numeroSei);
  });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    var aba = garantirEstruturaCredenciamentoProcessos_();
    var mapa = mapaCredenciamentoProcessos_(aba);
    var complementosEntrada=novosFormatos.length?mapaComplementosCredenciamento_():null;
    var agora = dataHoraSaoPauloTexto_();
    var novos = 0;
    var existentes = 0;
    var alteradas = {};
    var proximaLinha = aba.getLastRow()+1;

    itens.forEach(function(item) {
      var p = normalizarProtocoloRoteiro_(item.protocolo);
      if (!p) return;

      var entrada = mapa[p];
      var atual = entrada ? objetoCredenciamentoLinha_(entrada.r) : {};
      var linha = [
        p,
        atual.despacho || "",
        String(item.tipoCredenciamento || atual.tipoCredenciamento || "").trim(),
        String(item.cidade || atual.cidade || "").trim(),
        String(item.estado || atual.estado || "").trim().toUpperCase(),
        String(item.razaoSocial || atual.razaoSocial || "").trim(),
        atual.conferenteRg || "",
        atual.conferente || "",
        atual.dataUltimaMovimentacao || "",
        atual.mes || "",
        atual.aviso || "",
        "AGUARDANDO",
        atual.primeiraImportacao || agora,
        agora,
        agora
      ];

      if (entrada) {
        alteradas[entrada.linha] = linha;
        existentes++;
      } else {
        alteradas[proximaLinha] = linha;
        mapa[p] = {linha:proximaLinha++, r:linha};
        novos++;
      }
    });

    gravarLinhasAlteradasLeve_(aba, alteradas, 15);
    if(novosFormatos.length)gravarComplementosCredenciamento_(novosFormatos,complementosEntrada);
    SpreadsheetApp.flush();
    return {
      sucesso:true,
      novos:novos,
      existentes:existentes,
      mensagem:novos + " protocolo(s) novo(s) e " + existentes + " já cadastrado(s) enviados à fila de análise."
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function dataCredenciamento_(valor) {
  var d = criarDataSegura(valor);
  if (d && !isNaN(d.getTime())) return d;

  var s = String(valor || "").trim();
  var br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return new Date(Number(br[3]), Number(br[2])-1, Number(br[1]));

  return null;
}

function formatarDataCredenciamento_(valor) {
  var d = dataCredenciamento_(valor);
  return d ? Utilities.formatDate(d, "America/Sao_Paulo", "dd/MM/yyyy") : String(valor || "").trim();
}

function mesCredenciamento_(valor) {
  var d = dataCredenciamento_(valor);
  if (!d) return "";
  var nomes = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
  return nomes[d.getMonth()];
}

function chaveHistoricoCredenciamento_(obj) {
  var base = [
    normalizarProtocoloRoteiro_(obj.protocolo),
    formatarDataCredenciamento_(obj.data),
    normalizarTextoCredenciamento_(obj.despacho),
    normalizarTextoCredenciamento_(obj.conferente),
    normalizarTextoCredenciamento_(obj.aviso),
    normalizarTextoCredenciamento_(obj.tipoCredenciamento),
    normalizarTextoCredenciamento_(obj.razaoSocial)
  ].join("|");

  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    base,
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "");
}

function localizarIndiceCabCredenciamento_(mapa, nomes) {
  for (var i=0; i<nomes.length; i++) {
    var chave = normalizarTextoCredenciamento_(nomes[i]);
    if (mapa[chave] !== undefined) return mapa[chave];
  }
  return -1;
}

function parseTsvCredenciamento_(texto) {
  texto = String(texto || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  var linhas = [];
  var linha = [];
  var campo = "";
  var emAspas = false;

  for (var i = 0; i < texto.length; i++) {
    var ch = texto.charAt(i);

    if (ch === '"') {
      if (emAspas && texto.charAt(i + 1) === '"') {
        campo += '"';
        i++;
      } else {
        emAspas = !emAspas;
      }
      continue;
    }

    if (ch === "\t" && !emAspas) {
      linha.push(campo);
      campo = "";
      continue;
    }

    if (ch === "\n" && !emAspas) {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
      continue;
    }

    campo += ch;
  }

  linha.push(campo);
  if (linha.some(function(c) { return String(c || "").trim(); })) linhas.push(linha);

  return linhas
    .filter(function(r) {
      return r.some(function(c) { return String(c || "").trim(); });
    })
    .map(function(r) {
      return r.map(function(c) {
        return String(c || "").replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
      });
    });
}

function limparCargaHistoricaCredenciamento_() {
  var hist = garantirEstruturaHistoricoCredenciamento_();
  if (hist.getLastRow() < 2) return 0;

  var largura = 13;
  var dados = hist.getRange(2, 1, hist.getLastRow() - 1, largura).getValues();
  var manter = [];
  var removidas = 0;

  dados.forEach(function(r) {
    if (normalizarTextoCredenciamento_(r[12]) === "PLANILHA_HISTORICA") {
      removidas++;
    } else {
      manter.push(r);
    }
  });

  if (hist.getLastRow() > 1) {
    hist.getRange(2, 1, hist.getLastRow() - 1, largura).clearContent();
  }
  if (manter.length) {
    hist.getRange(2, 1, manter.length, largura).setValues(manter);
  }
  var ultimaNecessaria = manter.length + 1;
  if (hist.getLastRow() > ultimaNecessaria) {
    hist.deleteRows(ultimaNecessaria + 1, hist.getLastRow() - ultimaNecessaria);
  }
  return removidas;
}

function importarHistoricoCredenciamento(texto, token, substituirCargaHistorica) {
  exigirPerfil_(token, ["CONFERENCIA"]);
  texto = String(texto || "").replace(/\r/g, "").trim();
  if (!texto) throw new Error("Nenhum conteúdo para importar.");

  var matriz = parseTsvCredenciamento_(texto);
  if (!matriz.length) throw new Error("Não foram encontradas linhas válidas.");

  var primeira = matriz[0] || [];
  var cabMapa = {};
  primeira.forEach(function(c, i) { cabMapa[normalizarTextoCredenciamento_(c)] = i; });
  var temCab = cabMapa["PROTOCOLO"] !== undefined;

  var idx = {};
  if (temCab) {
    idx.despacho = localizarIndiceCabCredenciamento_(cabMapa,["DESPACHO","STATUS"]);
    idx.protocolo = localizarIndiceCabCredenciamento_(cabMapa,["PROTOCOLO"]);
    idx.tipo = localizarIndiceCabCredenciamento_(cabMapa,["TIPO DE CREDENCIAMENTO","CREDENCIAMENTO","SERVIÇO","SERVICO","DATA DE ENVIO"]);
    idx.aviso = localizarIndiceCabCredenciamento_(cabMapa,["OBSERVAÇÕES","OBSERVACOES","AVISO"]);
    idx.cidade = localizarIndiceCabCredenciamento_(cabMapa,["CIDADE"]);
    idx.estado = localizarIndiceCabCredenciamento_(cabMapa,["ESTADO","UF"]);
    idx.razao = localizarIndiceCabCredenciamento_(cabMapa,["RAZÃO SOCIAL","RAZAO SOCIAL"]);
    idx.conferente = localizarIndiceCabCredenciamento_(cabMapa,["CONFERENTE"]);
    idx.data = localizarIndiceCabCredenciamento_(cabMapa,["DATA","DATA DA MOVIMENTAÇÃO","DATA DA MOVIMENTACAO"]);
  } else {
    // Layout da planilha histórica enviada pelo usuário:
    // DESPACHO | PROTOCOLO | TIPO | ENDEREÇO | OBS | CIDADE | RAZÃO | ÁREA | CONFERENTE | DATA | MÊS
    idx = {despacho:0, protocolo:1, tipo:2, aviso:4, cidade:5, estado:-1, razao:6, conferente:8, data:9};
  }

  var inicio = temCab ? 1 : 0;
  var movimentos = [];
  for (var i=inicio; i<matriz.length; i++) {
    var r = matriz[i];
    function v(pos) { return pos >= 0 ? String(r[pos] || "").trim() : ""; }
    var p = normalizarProtocoloRoteiro_(v(idx.protocolo));
    if (!p) continue;

    var data = formatarDataCredenciamento_(v(idx.data));
    movimentos.push({
      protocolo:p,
      despacho:normalizarTextoCredenciamento_(v(idx.despacho)),
      tipoCredenciamento:v(idx.tipo),
      cidade:v(idx.cidade),
      estado:v(idx.estado).toUpperCase(),
      razaoSocial:v(idx.razao),
      conferente:v(idx.conferente),
      aviso:v(idx.aviso),
      data:data
    });
  }

  if (!movimentos.length) throw new Error("Nenhum protocolo válido foi identificado no histórico.");

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var proc = garantirEstruturaCredenciamentoProcessos_();
    var hist = garantirEstruturaHistoricoCredenciamento_();
    var historicoRemovido = 0;
    if (substituirCargaHistorica === true) {
      historicoRemovido = limparCargaHistoricaCredenciamento_();
      hist = garantirEstruturaHistoricoCredenciamento_();
    }
    var mapaProc = mapaCredenciamentoProcessos_(proc);
    var chavesExistentes = {};

    if (hist.getLastRow() >= 2) {
      hist.getRange(2,12,hist.getLastRow()-1,1).getDisplayValues().forEach(function(r) {
        var k = String(r[0] || "").trim();
        if (k) chavesExistentes[k] = true;
      });
    }

    var novasHist = [];
    var porProtocolo = {};
    var ignoradas = 0;

    movimentos.forEach(function(m) {
      var chave = chaveHistoricoCredenciamento_(m);
      if (!chavesExistentes[chave]) {
        novasHist.push([
          m.data,
          m.protocolo,
          "MOVIMENTACAO_HISTORICA",
          m.despacho,
          m.tipoCredenciamento,
          m.cidade,
          m.estado,
          m.razaoSocial,
          "",
          m.conferente,
          m.aviso,
          chave,
          "PLANILHA_HISTORICA"
        ]);
        chavesExistentes[chave] = true;
      } else {
        ignoradas++;
      }

      if (!porProtocolo[m.protocolo]) porProtocolo[m.protocolo] = [];
      porProtocolo[m.protocolo].push(m);
    });

    if (novasHist.length) {
      hist.getRange(hist.getLastRow()+1,1,novasHist.length,13).setValues(novasHist);
    }

    var agora = dataHoraSaoPauloTexto_();
    var alteradas = {};
    var proximaLinha = proc.getLastRow()+1;
    Object.keys(porProtocolo).forEach(function(p) {
      var arr = porProtocolo[p];
      arr.sort(function(a,b) {
        var da = dataCredenciamento_(a.data);
        var db = dataCredenciamento_(b.data);
        return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
      });
      var ult = arr[arr.length-1];
      var atualEntrada = mapaProc[p];
      var atual = atualEntrada ? objetoCredenciamentoLinha_(atualEntrada.r) : {};
      var linha = [
        p,
        ult.despacho || atual.despacho || "",
        ult.tipoCredenciamento || atual.tipoCredenciamento || "",
        ult.cidade || atual.cidade || "",
        ult.estado || atual.estado || "",
        ult.razaoSocial || atual.razaoSocial || "",
        atual.conferenteRg || "",
        ult.conferente || atual.conferente || "",
        ult.data || atual.dataUltimaMovimentacao || "",
        mesCredenciamento_(ult.data) || atual.mes || "",
        ult.aviso || atual.aviso || "",
        "ANALISADO",
        atual.primeiraImportacao || agora,
        atual.ultimaImportacao || agora,
        agora
      ];

      if (atualEntrada) {
        alteradas[atualEntrada.linha] = linha;
      } else {
        alteradas[proximaLinha] = linha;
        mapaProc[p] = {linha:proximaLinha++, r:linha};
      }
    });

    gravarLinhasAlteradasLeve_(proc, alteradas, 15);
    SpreadsheetApp.flush();
    return {
      sucesso:true,
      movimentosImportados:novasHist.length,
      ignoradas:ignoradas,
      protocolos:Object.keys(porProtocolo).length,
      historicoRemovido:historicoRemovido,
      linhasProcessadas:movimentos.length,
      mensagem:
        movimentos.length + " linha(s) válida(s) processada(s). " +
        novasHist.length + " movimentação(ões) histórica(s) importada(s) em " +
        Object.keys(porProtocolo).length + " protocolo(s). " +
        ignoradas + " linha(s) já existente(s) foram ignoradas." +
        (historicoRemovido ? " Carga histórica anterior removida: " + historicoRemovido + "." : "")
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function listarFilaCredenciamento(token) {
  exigirPerfil_(token, ["CONFERENCIA"]);
  var aba = garantirEstruturaCredenciamentoProcessos_();
  var itens = [];
  var complementos=mapaComplementosCredenciamento_();

  if (aba.getLastRow() >= 2) {
    aba.getRange(2,1,aba.getLastRow()-1,15).getDisplayValues().forEach(function(r) {
      var x = complementarCredenciamento_(objetoCredenciamentoLinha_(r),complementos);
      if (normalizarTextoCredenciamento_(x.estadoInterno) === "AGUARDANDO") itens.push(x);
    });
  }

  itens.sort(function(a,b) {
    return String(a.protocolo || "").localeCompare(String(b.protocolo || ""), "pt-BR");
  });

  return {sucesso:true, itens:itens};
}

function registrarMovimentacaoCredenciamento(dados, token) {
  var sessao = exigirPerfil_(token, ["CONFERENCIA"]);
  dados = dados || {};

  var p = normalizarProtocoloRoteiro_(dados.protocolo);
  var despacho = normalizarTextoCredenciamento_(dados.despacho);
  if(despacho==='EXIGENCIA')despacho='EXIGÊNCIA';

  if (!p) throw new Error("Protocolo inválido.");

  if (["APROVADO","EXIGÊNCIA"].indexOf(despacho) === -1) {
    throw new Error("Selecione APROVADO ou EXIGÊNCIA.");
  }

  if(dados.numeroSei!==undefined)validarNumeroSeiCredenciamento_(dados.numeroSei);
  var lock = LockService.getScriptLock();

  if (!lock.tryLock(8000)) {
    throw new Error(
      "Outro processamento está em andamento. Tente novamente em alguns segundos."
    );
  }

  try {
    var proc = garantirEstruturaCredenciamentoProcessos_();
    var hist = garantirEstruturaHistoricoCredenciamento_();
    var complementos=mapaComplementosCredenciamento_();

    if (proc.getLastRow() < 2) {
      throw new Error("Protocolo não localizado no Credenciamento.");
    }

    // Busca somente o protocolo finalizado; não monta mais o mapa da base inteira.
    var achados = proc
      .getRange(2, 1, proc.getLastRow() - 1, 1)
      .createTextFinder(p)
      .matchEntireCell(true)
      .findAll();

    if (!achados.length) {
      throw new Error("Protocolo não localizado no Credenciamento.");
    }

    var linhaProc = achados[achados.length - 1].getRow();
    var atualLinha = proc
      .getRange(linhaProc, 1, 1, 15)
      .getDisplayValues()[0];

    var atual = objetoCredenciamentoLinha_(atualLinha);

    var agora = new Date();
    var dataMov =
      Utilities.formatDate(agora, "America/Sao_Paulo", "dd/MM/yyyy");
    var dataHora =
      Utilities.formatDate(
        agora,
        "America/Sao_Paulo",
        "dd/MM/yyyy HH:mm:ss"
      );

    var tipo =
      String(
        dados.tipoCredenciamento ||
        atual.tipoCredenciamento ||
        ""
      ).trim();

    var cidade =
      String(dados.cidade || atual.cidade || "").trim();

    var estado =
      String(dados.estado || atual.estado || "").trim().toUpperCase();

    var razao =
      String(dados.razaoSocial || atual.razaoSocial || "").trim();

    var aviso =
      String(dados.aviso || "").trim();

    var linha = [
      p,
      despacho,
      tipo,
      cidade,
      estado,
      razao,
      sessao.rg,
      sessao.nome || ("RG " + sessao.rg),
      dataMov,
      mesCredenciamento_(dataMov),
      aviso,
      "ANALISADO",
      atual.primeiraImportacao || dataHora,
      atual.ultimaImportacao || dataHora,
      dataHora
    ];

    proc
      .getRange(linhaProc, 1, 1, 15)
      .setValues([linha]);

    if(String(dados.numeroSei||'').trim())gravarComplementosCredenciamento_([{protocolo:p,numeroSei:dados.numeroSei}],complementos);
    hist.appendRow([
      dataHora,
      p,
      "MOVIMENTACAO",
      despacho,
      tipo,
      cidade,
      estado,
      razao,
      sessao.rg,
      sessao.nome || ("RG " + sessao.rg),
      aviso,
      "",
      "SISTEMA"
    ]);

    // Não força flush e não recarrega a fila no servidor.
    return {
      sucesso:true,
      mensagem:"Movimentação registrada com sucesso.",
      protocolo:p,
      despacho:despacho,
      item:complementarCredenciamento_(objetoCredenciamentoLinha_(linha),complementos)
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}


function consultarCredenciamento(filtros, token) {
  exigirPerfil_(token, ["CONFERENCIA"]);
  filtros = filtros || {};
  var despachoFiltro = normalizarTextoCredenciamento_(filtros.despacho);
  var aba = garantirEstruturaCredenciamentoProcessos_();
  var itens = [];
  var complementos=mapaComplementosCredenciamento_();

  if (aba.getLastRow() >= 2) {
    aba.getRange(2,1,aba.getLastRow()-1,15).getDisplayValues().forEach(function(r) {
      var x = complementarCredenciamento_(objetoCredenciamentoLinha_(r),complementos);
      if(normalizarTextoCredenciamento_(x.estadoInterno)==='AGUARDANDO')return;
      if (despachoFiltro && normalizarTextoCredenciamento_(x.despacho) !== despachoFiltro) return;
      itens.push(x);
    });
  }

  // Calcula as chaves uma vez por item, preservando dia, hora e minuto.
  itens=itens.map(function(item){
    return {item:item,atualizacao:timestampAtualizacaoCredenciamento_(item.atualizadoEm) ||
      timestampAtualizacaoCredenciamento_(item.dataUltimaMovimentacao) ||
      timestampAtualizacaoCredenciamento_(item.ultimaImportacao) ||
      timestampAtualizacaoCredenciamento_(item.primeiraImportacao)};
  }).sort(function(a,b){
    if(a.atualizacao!==b.atualizacao)return b.atualizacao-a.atualizacao;
    return String(a.item.protocolo||'').localeCompare(String(b.item.protocolo||''),'pt-BR',{numeric:true});
  }).map(function(registro){return registro.item;});

  return {sucesso:true, itens:itens};
}

function obterResumoCredenciamento(token) {
  var sessao = exigirPerfil_(token, ["CONFERENCIA"]);
  var proc = garantirEstruturaCredenciamentoProcessos_();
  var hist = garantirEstruturaHistoricoCredenciamento_();

  var aguardando = 0;
  var aprovados = 0;
  var exigencia = 0;

  if (proc.getLastRow() >= 2) {
    proc.getRange(2,1,proc.getLastRow()-1,12).getDisplayValues().forEach(function(r) {
      var x = objetoCredenciamentoLinha_(r);
      var estado = normalizarTextoCredenciamento_(x.estadoInterno);
      var despacho = normalizarTextoCredenciamento_(x.despacho);
      if (estado === "AGUARDANDO") aguardando++;
      if (despacho === "APROVADO") aprovados++;
      if (despacho === "EXIGENCIA") exigencia++;
    });
  }

  var hoje = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy");
  var analisadosHoje = 0;
  var meusHoje = 0;
  var meuRg = normalizarRgCadastro_(sessao.rg);
  var meuNome = normalizarTextoCredenciamento_(sessao.nome || sessao.nomeGuerra || "");

  if (hist.getLastRow() >= 2) {
    var linhasHoje=[];
    hist.getRange(2,1,hist.getLastRow()-1,1).getDisplayValues().forEach(function(r,i){
      if(String(r[0]||'').trim().indexOf(hoje)===0)linhasHoje.push(i+2);
    });
    var historicoHoje=lerLinhasProtocolosRoteiro_(hist,{hoje:linhasHoje},10);
    linhasHoje.forEach(function(linha) {
      var r=historicoHoje[linha];
      var dataHora = String(r[0] || "").trim();
      var evento = normalizarTextoCredenciamento_(r[2]);
      if (dataHora.indexOf(hoje) !== 0) return;
      if (["MOVIMENTACAO","MOVIMENTACAO_HISTORICA"].indexOf(evento) === -1) return;

      analisadosHoje++;
      var rg = normalizarRgCadastro_(r[8]);
      var nome = normalizarTextoCredenciamento_(r[9]);
      if ((rg && rg === meuRg) || (!rg && meuNome && nome === meuNome)) meusHoje++;
    });
  }

  return {
    sucesso:true,
    resumo:{
      aguardando:aguardando,
      aprovados:aprovados,
      exigencia:exigencia,
      analisadosHoje:analisadosHoje,
      meusHoje:meusHoje
    }
  };
}

// ==========================================================
// MÓDULO CONFERÊNCIA DE PROTOCOLOS
// ==========================================================

function statusOficiaisConferencia_() {
  return [
    "APROVADO",
    "EXIGÊNCIA",
    "AGUARDANDO VISTORIA",
    "ENCAMINHADO AO VISTORIADOR",
    "TRANSFORMADO EM PRÉVIA",
    "F-7",
    "ANEXO F",
    "EVENTO JÁ REALIZADO",
    "EXPIRADO",
    "DENÚNCIA",
    "CREDENCIAMENTO",
    "ANEXO T",
    "AGUARDA RETORNO",
    "HABITE-SE",
    "ANEXO J",
    "SUSPENSO",
    "AGUARDANDO PAGAMENTO",
    "ANEXO C"
  ];
}

function normalizarTextoConferencia_(valor) {
  return String(valor || "").trim().replace(/\s+/g, " ");
}

function normalizarMaiusculoConferencia_(valor) {
  return normalizarTextoConferencia_(valor).toUpperCase();
}

function garantirEstruturaConferenciaProtocolos_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("CONFERENCIA_PROTOCOLOS");
  if (!aba) aba = ss.insertSheet("CONFERENCIA_PROTOCOLOS");

  var cab = [
    "PROTOCOLO","MOVIMENTAÇÃO","LOGRADOURO","BAIRRO","CIDADE","RAZÃO_SOCIAL",
    "DIVISÃO","ÁREA","STATUS_SIAPI","ESTADO_INTERNO","RG_CONFERENTE","CONFERENTE",
    "ATRIBUIDO_POR_RG","ATRIBUIDO_POR","ATRIBUIDO_EM","ASSUMIDO_EM","CONCLUIDO_EM",
    "ATUALIZADO_EM","ULTIMA_CAPTURA_SIAPI","CICLO","OBSERVAÇÃO",
    "DATA_ULTIMA_MOVIMENTACAO","DATA_PRIMEIRA_IMPORTACAO",
    "MESMA_DATA_IMPORTACAO","NOVA_MOVIMENTACAO_APOS_CONCLUSAO",
    "MOVIMENTACAO_ANTERIOR","DATA_HORA_ULTIMA_MOVIMENTACAO"
  ];

  prepararCabecalhoLeve_(aba, cab, {primeiroVazio:true,cor:"#5C1D1D",centralizar:true});
  return aba;
}

function garantirEstruturaHistoricoConferencia_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("HISTORICO_CONFERENCIA");
  if (!aba) aba = ss.insertSheet("HISTORICO_CONFERENCIA");

  var cab = [
    "DATA_HORA","PROTOCOLO","CICLO","EVENTO","RG_USUARIO","USUARIO",
    "ESTADO_ANTERIOR","ESTADO_NOVO","STATUS_ANTERIOR","STATUS_NOVO",
    "ALTERACOES","SNAPSHOT"
  ];

  prepararCabecalhoLeve_(aba, cab, {primeiroVazio:true,somenteInicial:true,cor:"#5C1D1D",centralizar:true});
  return aba;
}

function obterPermissaoAtribuicaoConferencia_(sessao) {
  var perfil = String(sessao && sessao.perfil || "").trim().toUpperCase();
  if (perfil === "GESTOR") return true;
  if (perfil !== "CONFERENCIA") return false;

  var usuario = buscarUsuarioAcessoPorRg_(normalizarRgCadastro_(sessao.rg));
  return !!(usuario && permissaoIndividualAtiva_(usuario.podeAtribuirConferencia));
}

function exigirAtribuicaoConferencia_(token) {
  var sessao = exigirPerfil_(token, ["CONFERENCIA"]);
  if (!obterPermissaoAtribuicaoConferencia_(sessao)) {
    throw new Error("Você não possui permissão para atribuir protocolos à Conferência.");
  }
  return sessao;
}

function prepararModuloConferencia(token) {
  var sessao = exigirPerfil_(token, ["CONFERENCIA"]);
  garantirEstruturaConferenciaProtocolos_();
  garantirEstruturaHistoricoConferencia_();
  garantirEstruturaAcessos_();

  return {
    sucesso:true,
    podeAtribuir:obterPermissaoAtribuicaoConferencia_(sessao),
    status:statusOficiaisConferencia_()
  };
}

function mapaProtocolosConferencia_(aba) {
  var mapa = {};
  if (!aba || aba.getLastRow() < 2) return mapa;

  var vals = aba.getRange(2,1,aba.getLastRow()-1,27).getDisplayValues();
  vals.forEach(function(r, i) {
    var p = normalizarTextoConferencia_(r[0]).replace(/\u00A0/g, " ").trim();
    if (p) mapa[p] = {linha:i+2, r:r};
  });

  return mapa;
}

function objetoConferenciaDaLinha_(r) {
  r = r || [];
  return {
    protocolo:normalizarTextoConferencia_(r[0]),
    movimentacao:normalizarTextoConferencia_(r[1]),
    logradouro:normalizarTextoConferencia_(r[2]),
    bairro:normalizarTextoConferencia_(r[3]),
    cidade:normalizarTextoConferencia_(r[4]),
    razaoSocial:normalizarTextoConferencia_(r[5]),
    divisao:normalizarTextoConferencia_(r[6]),
    area:normalizarTextoConferencia_(r[7]),
    statusSiapi:normalizarTextoConferencia_(r[8]),
    estadoInterno:normalizarMaiusculoConferencia_(r[9]),
    rgConferente:normalizarRgCadastro_(r[10]),
    conferente:normalizarTextoConferencia_(r[11]),
    atribuidoPorRg:normalizarRgCadastro_(r[12]),
    atribuidoPor:normalizarTextoConferencia_(r[13]),
    atribuidoEm:normalizarTextoConferencia_(r[14]),
    assumidoEm:normalizarTextoConferencia_(r[15]),
    concluidoEm:normalizarTextoConferencia_(r[16]),
    atualizadoEm:normalizarTextoConferencia_(r[17]),
    ultimaCapturaSiapi:normalizarTextoConferencia_(r[18]),
    ciclo:parseInt(r[19] || "0",10) || 0,
    observacao:normalizarTextoConferencia_(r[20]),
    dataUltimaMovimentacao:normalizarTextoConferencia_(r[21]),
    dataPrimeiraImportacao:normalizarTextoConferencia_(r[22]),
    mesmaDataImportacao:normalizarMaiusculoConferencia_(r[23]),
    novaMovimentacaoAposConclusao:normalizarMaiusculoConferencia_(r[24]),
    movimentacaoAnterior:normalizarTextoConferencia_(r[25]),
    dataHoraUltimaMovimentacao:normalizarTextoConferencia_(r[26])
  };
}

function snapshotConferencia_(obj) {
  return JSON.stringify({
    protocolo:obj.protocolo || "",
    movimentacao:obj.movimentacao || "",
    logradouro:obj.logradouro || "",
    bairro:obj.bairro || "",
    cidade:obj.cidade || "",
    razaoSocial:obj.razaoSocial || "",
    divisao:obj.divisao || "",
    area:obj.area || "",
    statusSiapi:obj.statusSiapi || "",
    estadoInterno:obj.estadoInterno || "",
    conferente:obj.conferente || "",
    observacao:obj.observacao || "",
    dataUltimaMovimentacao:obj.dataUltimaMovimentacao || "",
    mesmaDataImportacao:obj.mesmaDataImportacao || "",
    novaMovimentacaoAposConclusao:obj.novaMovimentacaoAposConclusao || "",
    dataHoraUltimaMovimentacao:obj.dataHoraUltimaMovimentacao || ""
  });
}

function registrarHistoricoConferencia_(protocolo, ciclo, evento, sessao, anterior, novo, alteracoes) {
  var aba = garantirEstruturaHistoricoConferencia_();

  aba.appendRow([
    dataHoraSaoPauloTexto_(),
    protocolo,
    ciclo || 0,
    evento,
    sessao ? sessao.rg : "",
    sessao ? (sessao.nomeGuerra || sessao.nome || ("RG " + sessao.rg)) : "",
    anterior ? (anterior.estadoInterno || "") : "",
    novo ? (novo.estadoInterno || "") : "",
    anterior ? (anterior.statusSiapi || "") : "",
    novo ? (novo.statusSiapi || "") : "",
    alteracoes || "",
    snapshotConferencia_(novo || anterior || {})
  ]);
}

function extrairDataHoraMovimentacaoConferencia_(texto) {
  texto = normalizarTextoConferencia_(texto);
  if (!texto) return "";

  var m = texto.match(
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\b/
  );

  if (m) {
    return ("0"+m[1]).slice(-2) + "/" +
           ("0"+m[2]).slice(-2) + "/" +
           m[3] + " " +
           ("0"+m[4]).slice(-2) + ":" +
           ("0"+m[5]).slice(-2) + ":" +
           ("0"+(m[6] || "00")).slice(-2);
  }

  var m2 = texto.match(
    /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\b/
  );

  if (m2) {
    return ("0"+m2[3]).slice(-2) + "/" +
           ("0"+m2[2]).slice(-2) + "/" +
           m2[1] + " " +
           ("0"+m2[4]).slice(-2) + ":" +
           ("0"+m2[5]).slice(-2) + ":" +
           ("0"+(m2[6] || "00")).slice(-2);
  }

  var d = texto.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (d) {
    return ("0"+d[1]).slice(-2) + "/" +
           ("0"+d[2]).slice(-2) + "/" + d[3];
  }

  var d2 = texto.match(/\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/);
  if (d2) {
    return ("0"+d2[3]).slice(-2) + "/" +
           ("0"+d2[2]).slice(-2) + "/" + d2[1];
  }

  return "";
}

function extrairDataMovimentacaoConferencia_(texto) {
  var dataHora = extrairDataHoraMovimentacaoConferencia_(texto);
  if (!dataHora) return "";
  return dataHora.substring(0,10);
}

function movimentoConferenciaMudou_(anterior, atual) {
  var a = normalizarTextoConferencia_(anterior);
  var n = normalizarTextoConferencia_(atual);

  var dha = extrairDataHoraMovimentacaoConferencia_(a);
  var dhn = extrairDataHoraMovimentacaoConferencia_(n);

  if (dha && dhn) return dha !== dhn;

  return a !== n;
}


function dataHojeConferencia_() {
  return Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy");
}


function compararCapturaConferencia_(anterior, novo) {
  var campos = [
    ["Movimentação","movimentacao"],
    ["Logradouro","logradouro"],
    ["Bairro","bairro"],
    ["Cidade","cidade"],
    ["Razão Social","razaoSocial"],
    ["Divisão","divisao"],
    ["Área","area"]
  ];

  var mudancas = [];

  campos.forEach(function(c) {
    var a = normalizarTextoConferencia_(anterior && anterior[c[1]]);
    var n = normalizarTextoConferencia_(novo && novo[c[1]]);
    if (a !== n) {
      mudancas.push(c[0] + ": " + (a || "-") + " → " + (n || "-"));
    }
  });

  return mudancas.join(" | ");
}

function gravarBlocosAlteradosConferencia_(aba, matriz, indicesAlterados, totalColunas, lacunaMaxima) {
  lacunaMaxima = lacunaMaxima || 20;
  if (!indicesAlterados || !indicesAlterados.length) return;

  var unicos = {};
  var indices = [];

  indicesAlterados.forEach(function(i) {
    i = parseInt(i,10);
    if (isNaN(i) || unicos[i]) return;
    unicos[i] = true;
    indices.push(i);
  });

  indices.sort(function(a,b){ return a-b; });

  var blocos = [];
  var inicio = indices[0];
  var fim = indices[0];

  for (var k=1; k<indices.length; k++) {
    var atual = indices[k];

    // Regrava pequenos intervalos juntos para reduzir chamadas ao Sheets.
    if ((atual - fim) <= lacunaMaxima && (atual - inicio) < 500) {
      fim = atual;
    } else {
      blocos.push([inicio,fim]);
      inicio = atual;
      fim = atual;
    }
  }

  blocos.push([inicio,fim]);

  blocos.forEach(function(b) {
    var ini = b[0];
    var fimBloco = b[1];
    var valores = matriz.slice(ini, fimBloco + 1);

    aba.getRange(
      ini + 2,
      1,
      valores.length,
      totalColunas
    ).setValues(valores);
  });
}


function validarCapturasConferencia_(registros) {
  var campos = ['protocolo','movimentacao','logradouro','bairro','cidade','razaoSocial','divisao','area'];
  var recebidos = Object.create(null);
  return registros.map(function(item, i) {
    var captura = {};
    campos.forEach(function(campo) {
      if (!item || !Object.prototype.hasOwnProperty.call(item, campo) || item[campo] === undefined) {
        throw new Error('Registro ' + (i+1) + ': campo ' + campo + ' ausente. Copie novamente do SIAPI.');
      }
      captura[campo] = String(item[campo] === null ? '' : item[campo])
        .replace(/\s+/g, ' ').trim();
    });
    if (!/^\d{3,12}\/\d{2,4}$/.test(captura.protocolo) ||
        !extrairDataHoraMovimentacaoConferencia_(captura.movimentacao)) {
      throw new Error('Registro ' + (i+1) + ': protocolo ou data da movimentação inválidos. Nenhum registro foi importado.');
    }
    if (captura.area && !/^\d[\d., ]*$/.test(captura.area)) {
      throw new Error('Registro ' + (i+1) + ': área inválida. Confira o alinhamento das colunas.');
    }
    var dataHora = extrairDataHoraMovimentacaoConferencia_(captura.movimentacao);
    var partes = dataHora.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/);
    var dia = partes ? Number(partes[1]) : 0;
    var mes = partes ? Number(partes[2]) : 0;
    var ano = partes ? Number(partes[3]) : 0;
    var calendario = new Date(ano, mes-1, dia);
    if (!partes || calendario.getFullYear() !== ano || calendario.getMonth() !== mes-1 ||
        calendario.getDate() !== dia || Number(partes[4] || 0) > 23 ||
        Number(partes[5] || 0) > 59 || Number(partes[6] || 0) > 59) {
      throw new Error('Registro ' + (i+1) + ': data da movimentação inválida.');
    }
    var assinatura = JSON.stringify(captura);
    if (recebidos[captura.protocolo] && recebidos[captura.protocolo] !== assinatura) {
      throw new Error('Registro ' + (i+1) + ': protocolo repetido com dados diferentes. Confira o lote.');
    }
    recebidos[captura.protocolo] = assinatura;
    return captura;
  });
}

function salvarCapturasConferencia(registros, token) {
  var sessao = exigirAtribuicaoConferencia_(token);
  registros = Array.isArray(registros) ? registros : [];
  if (!registros.length) throw new Error("Nenhum protocolo foi informado.");

  // Valida o lote inteiro antes de inicializar abas ou gravar qualquer célula.
  registros = validarCapturasConferencia_(registros);

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var aba = garantirEstruturaConferenciaProtocolos_();
    var hist = garantirEstruturaHistoricoConferencia_();

    var agora = dataHoraSaoPauloTexto_();
    var hoje = dataHojeConferencia_();
    var totalColunas = 27;

    // Uma leitura da base para montar o índice por protocolo.
    var existentes = [];
    if (aba.getLastRow() >= 2) {
      existentes = aba.getRange(
        2,1,aba.getLastRow()-1,totalColunas
      ).getDisplayValues();
    }

    var mapa = {};
    existentes.forEach(function(r,i) {
      var p = normalizarTextoConferencia_(r[0])
        .replace(/\u00A0/g," ")
        .trim();
      if (p) mapa[p] = i;
    });

    var novos = 0;
    var atualizados = 0;
    var semAlteracao = 0;
    var duplicados = 0;
    var ultimasCapturas = [];
    var mesmaDataSim = [];
    var mesmaDataNao = [];
    var primeiraImportacaoAusente = [];
    var vistos = {};
    var historicos = [];
    var novasLinhas = [];
    var indicesAlterados = [];

    registros.forEach(function(item) {
      var protocolo = normalizarTextoConferencia_(item.protocolo)
        .replace(/\u00A0/g," ")
        .trim();

      if (vistos[protocolo]) { duplicados++; return; }
      vistos[protocolo] = true;

      var captura = item;

      var dataHoraMov =
        extrairDataHoraMovimentacaoConferencia_(captura.movimentacao);

      var dataMov = dataHoraMov
        ? dataHoraMov.substring(0,10)
        : "";

      var mesmaData =
        (dataMov && dataMov === hoje) ? "SIM" : "NÃO";

      var indice =
        mapa.hasOwnProperty(protocolo) ? mapa[protocolo] : -1;

      if (indice === -1) {
        var linhaNova = [
          captura.protocolo,
          captura.movimentacao,
          captura.logradouro,
          captura.bairro,
          captura.cidade,
          captura.razaoSocial,
          captura.divisao,
          captura.area,
          "",
          "CADASTRADO",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          agora,
          agora,
          0,
          "",
          dataMov,
          hoje,
          mesmaData,
          "NÃO",
          "",
          dataHoraMov
        ];

        novasLinhas.push(linhaNova);

        var novoObj = objetoConferenciaDaLinha_(linhaNova);

        historicos.push([
          agora,
          protocolo,
          0,
          "CADASTRADO",
          sessao.rg,
          sessao.nomeGuerra || sessao.nome || ("RG " + sessao.rg),
          "",
          "CADASTRADO",
          "",
          "",
          mesmaData === "SIM"
            ? "Primeira captura do SIAPI. Movimentação na mesma data da importação."
            : "Primeira captura do SIAPI.",
          snapshotConferencia_(novoObj)
        ]);

        novos++;
        return;
      }

      var linha = existentes[indice];
      var anterior = objetoConferenciaDaLinha_(linha);

      var camposCapturados = ['movimentacao','logradouro','bairro','cidade','razaoSocial','divisao','area'];
      var mudou = camposCapturados.some(function(campo) {
        return String(anterior[campo] || '').replace(/\s+/g,' ').trim() !== captura[campo];
      });
      if (!mudou) {
        // Recaptura não é movimentação: preserva estado, responsável, ciclo e ATUALIZADO_EM.
        semAlteracao++;
        linha[18] = agora;
        ultimasCapturas.push('S' + (indice+2));
        if (String(linha[23] || '') !== mesmaData) {
          linha[23] = mesmaData;
          (mesmaData === 'SIM' ? mesmaDataSim : mesmaDataNao).push('X' + (indice+2));
        }
        if (!linha[22]) {
          linha[22] = hoje;
          primeiraImportacaoAusente.push('W' + (indice+2));
        }
        // Repara metadados de bases antigas sem inventar uma alteração operacional.
        if (String(linha[21] || '') !== dataMov || String(linha[26] || '') !== dataHoraMov) {
          linha[21] = dataMov;
          linha[26] = dataHoraMov;
          indicesAlterados.push(indice);
        }
        return;
      }

      var anteriorComparacao =
        anterior.dataHoraUltimaMovimentacao ||
        anterior.movimentacao;

      var atualComparacao =
        dataHoraMov ||
        captura.movimentacao;

      var movMudou =
        movimentoConferenciaMudou_(
          anteriorComparacao,
          atualComparacao
        );

      var novaMovAposConclusao =
        (anterior.estadoInterno === "CONCLUÍDO" && movMudou)
          ? "SIM"
          : (anterior.novaMovimentacaoAposConclusao || "NÃO");

      linha[1] = captura.movimentacao;
      linha[2] = captura.logradouro;
      linha[3] = captura.bairro;
      linha[4] = captura.cidade;
      linha[5] = captura.razaoSocial;
      linha[6] = captura.divisao;
      linha[7] = captura.area;
      linha[17] = agora;
      linha[18] = agora;
      linha[21] = dataMov;
      linha[22] = anterior.dataPrimeiraImportacao || hoje;
      linha[23] = mesmaData;
      linha[24] = novaMovAposConclusao;

      if (movMudou) {
        linha[25] =
          anterior.dataHoraUltimaMovimentacao ||
          anterior.movimentacao;
      }

      linha[26] = dataHoraMov;

      indicesAlterados.push(indice);

      var novoObj = objetoConferenciaDaLinha_(linha);

      var detalhe =
        compararCapturaConferencia_(anterior, novoObj) ||
        "Nova captura sem alteração nos campos.";

      if (mesmaData === "SIM") {
        detalhe += " | MOVIMENTAÇÃO NA DATA DA IMPORTAÇÃO.";
      }

      if (
        novaMovAposConclusao === "SIM" &&
        anterior.novaMovimentacaoAposConclusao !== "SIM"
      ) {
        detalhe +=
          " | NOVA MOVIMENTAÇÃO APÓS ANÁLISE: " +
          (anterior.dataHoraUltimaMovimentacao ||
           anterior.movimentacao || "-") +
          " → " +
          (dataHoraMov || captura.movimentacao || "-") +
          ".";
      }

      historicos.push([
        agora,
        protocolo,
        anterior.ciclo,
        "CAPTURA SIAPI",
        sessao.rg,
        sessao.nomeGuerra || sessao.nome || ("RG " + sessao.rg),
        anterior.estadoInterno,
        novoObj.estadoInterno,
        anterior.statusSiapi,
        novoObj.statusSiapi,
        detalhe,
        snapshotConferencia_(novoObj)
      ]);

      atualizados++;
    });

    // Atualiza somente blocos atingidos, não a planilha inteira.
    gravarBlocosAlteradosConferencia_(
      aba,
      existentes,
      indicesAlterados,
      totalColunas,
      80 // Agrupa alterações esparsas do lote; mantém o limite de 500 linhas por faixa.
    );

    // Um valor comum por grupo, sem uma chamada remota por protocolo repetido.
    if (ultimasCapturas.length) aba.getRangeList(ultimasCapturas).setValue(agora);
    if (mesmaDataSim.length) aba.getRangeList(mesmaDataSim).setValue('SIM');
    if (mesmaDataNao.length) aba.getRangeList(mesmaDataNao).setValue('NÃO');
    if (primeiraImportacaoAusente.length) aba.getRangeList(primeiraImportacaoAusente).setValue(hoje);

    // Novos protocolos entram numa única gravação.
    if (novasLinhas.length) {
      aba.getRange(
        aba.getLastRow()+1,
        1,
        novasLinhas.length,
        totalColunas
      ).setValues(novasLinhas);
    }

    // Um recibo por lote, incluindo capturas idênticas, nas mesmas colunas do histórico.
    var resumoImportacao = {recebidos:registros.length,novos:novos,atualizados:atualizados,
      semAlteracao:semAlteracao,duplicados:duplicados};
    historicos.push([agora,'',0,'IMPORTAÇÃO SIAPI',sessao.rg,
      sessao.nomeGuerra || sessao.nome || ('RG ' + sessao.rg),'','','','',
      'Resumo da importação: ' + novos + ' novo(s), ' + atualizados +
      ' alterado(s), ' + semAlteracao + ' sem alteração, ' + duplicados + ' duplicado(s).',
      JSON.stringify(resumoImportacao)]);

    // Histórico também numa única gravação.
    if (historicos.length) {
      hist.getRange(
        hist.getLastRow()+1,
        1,
        historicos.length,
        12
      ).setValues(historicos);
    }

    SpreadsheetApp.flush();

    return {
      sucesso:true,
      novos:novos,
      atualizados:atualizados,
      semAlteracao:semAlteracao,
      duplicados:duplicados,
      totalProcessados:novos + atualizados + semAlteracao
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function filtroContemConferencia_(valor, filtro) {
  filtro = normalizarMaiusculoConferencia_(filtro);
  if (!filtro) return true;
  return normalizarMaiusculoConferencia_(valor).indexOf(filtro) !== -1;
}

function listarAtribuicaoConferencia(filtros, token) {
  exigirAtribuicaoConferencia_(token);
  filtros = filtros || {};

  var aba = garantirEstruturaConferenciaProtocolos_();
  if (aba.getLastRow() < 2) return {itens:[]};

  var vals = aba.getRange(2,1,aba.getLastRow()-1,27).getDisplayValues();
  var itens = [];

  vals.forEach(function(r) {
    var x = objetoConferenciaDaLinha_(r);

    var candidato =
      x.estadoInterno === "CADASTRADO" ||
      (x.estadoInterno === "CONCLUÍDO" &&
       x.novaMovimentacaoAposConclusao === "SIM");

    if (!candidato) return;
    if (!filtroContemConferencia_(x.protocolo, filtros.protocolo)) return;
    if (!filtroContemConferencia_(x.razaoSocial, filtros.razaoSocial)) return;
    if (!filtroContemConferencia_(x.divisao, filtros.divisao)) return;
    if (!filtroContemConferencia_(x.movimentacao, filtros.movimentacao)) return;

    itens.push(x);
  });

  itens.sort(function(a,b) {
    return String(a.protocolo).localeCompare(String(b.protocolo), "pt-BR");
  });

  return {itens:itens};
}

function atribuirProtocolosConferencia(protocolos, token) {
  var sessao = exigirAtribuicaoConferencia_(token);
  protocolos = Array.isArray(protocolos) ? protocolos : [];

  var unicos = [];
  var vistos = {};

  protocolos.forEach(function(p) {
    p = normalizarTextoConferencia_(p)
      .replace(/\u00A0/g, " ")
      .trim();

    if (!p || vistos[p]) return;
    vistos[p] = true;
    unicos.push(p);
  });

  if (!unicos.length) {
    throw new Error("Selecione pelo menos um protocolo.");
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var aba = garantirEstruturaConferenciaProtocolos_();
    var hist = garantirEstruturaHistoricoConferencia_();
    var agora = dataHoraSaoPauloTexto_();
    var nomeUsuario =
      sessao.nomeGuerra || sessao.nome || ("RG " + sessao.rg);

    var totalColunas = 27;
    var linhas = [];

    if (aba.getLastRow() >= 2) {
      linhas = aba.getRange(
        2, 1, aba.getLastRow() - 1, totalColunas
      ).getDisplayValues();
    }

    var mapa = {};
    linhas.forEach(function(r, i) {
      var p = normalizarTextoConferencia_(r[0])
        .replace(/\u00A0/g, " ")
        .trim();

      if (p) mapa[p] = i;
    });

    var atribuidos = 0;
    var ignorados = [];
    var historicos = [];
    var indicesAlterados = [];

    unicos.forEach(function(p) {
      if (!mapa.hasOwnProperty(p)) {
        ignorados.push(p + " (não encontrado na base)");
        return;
      }

      var idx = mapa[p];
      var linha = linhas[idx];
      var anterior = objetoConferenciaDaLinha_(linha);
      var estado =
        normalizarMaiusculoConferencia_(anterior.estadoInterno);

      if (estado === "DISPONÍVEL") {
        ignorados.push(p + " (já está aguardando conferência)");
        return;
      }

      if (estado === "EM VERIFICAÇÃO") {
        ignorados.push(p + " (já está em verificação)");
        return;
      }

      if (
        estado === "CONCLUÍDO" &&
        anterior.novaMovimentacaoAposConclusao !== "SIM"
      ) {
        ignorados.push(p + " (já concluído e sem nova movimentação)");
        return;
      }

      if (["CADASTRADO","CONCLUÍDO"].indexOf(estado) === -1) {
        ignorados.push(
          p + " (situação interna " +
          (estado || "não identificada") + ")"
        );
        return;
      }

      var ciclo = (anterior.ciclo || 0) + 1;

      linha[9]  = "DISPONÍVEL";
      linha[10] = "";
      linha[11] = "";
      linha[12] = sessao.rg;
      linha[13] = nomeUsuario;
      linha[14] = agora;
      linha[15] = "";
      linha[16] = "";
      linha[17] = agora;
      linha[18] = anterior.ultimaCapturaSiapi || agora;
      linha[19] = ciclo;
      linha[24] = "NÃO";

      indicesAlterados.push(idx);

      var novo = objetoConferenciaDaLinha_(linha);

      historicos.push([
        agora,
        p,
        ciclo,
        "ATRIBUÍDO À CONFERÊNCIA",
        sessao.rg,
        nomeUsuario,
        anterior.estadoInterno,
        novo.estadoInterno,
        anterior.statusSiapi,
        novo.statusSiapi,
        "Liberado para a fila comum.",
        snapshotConferencia_(novo)
      ]);

      atribuidos++;
    });

    // Grava somente os blocos alterados.
    gravarBlocosAlteradosConferencia_(
      aba,
      linhas,
      indicesAlterados,
      totalColunas
    );

    if (historicos.length) {
      hist.getRange(
        hist.getLastRow()+1,
        1,
        historicos.length,
        12
      ).setValues(historicos);
    }

    SpreadsheetApp.flush();

    var mensagem = atribuidos
      ? atribuidos + " protocolo(s) atribuído(s) com sucesso."
      : "Nenhum protocolo pôde ser atribuído.";

    if (ignorados.length) {
      mensagem += "\n\nNão atribuídos:\n- " +
        ignorados.slice(0,30).join("\n- ");

      if (ignorados.length > 30) {
        mensagem += "\n- ... e mais " +
          (ignorados.length - 30) + " protocolo(s).";
      }
    }

    return {
      sucesso:true,
      atribuidos:atribuidos,
      ignorados:ignorados,
      mensagem:mensagem
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function timestampConferenciaOrdenacao_(x) {
  var s = normalizarTextoConferencia_(
    x.dataHoraUltimaMovimentacao ||
    x.dataUltimaMovimentacao ||
    x.movimentacao ||
    x.atualizadoEm ||
    x.atribuidoEm || ""
  );
  if (!s) return 0;

  var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    return new Date(
      parseInt(m[3],10), parseInt(m[2],10)-1, parseInt(m[1],10),
      parseInt(m[4] || "0",10), parseInt(m[5] || "0",10), parseInt(m[6] || "0",10)
    ).getTime();
  }

  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(parseInt(m[1],10),parseInt(m[2],10)-1,parseInt(m[3],10)).getTime();
  return 0;
}

function chaveDataFilaConferenciaServidor_(x, agora) {
  var ts = timestampConferenciaOrdenacao_(x);
  if (!ts) return {grupo:99,mes:9999,ordem:Number.MAX_SAFE_INTEGER};

  var d = new Date(ts);
  var ano = agora.getFullYear();
  var mes = agora.getMonth();
  var dia = agora.getDate();
  var iniMesAtual = new Date(ano,mes,1).getTime();
  var iniMesAnterior = new Date(ano,mes-1,1).getTime();
  var iniMesPosterior = new Date(ano,mes+1,1).getTime();
  var fimMesAnterior = iniMesAtual - 1;

  if (dia <= 10 && ts >= iniMesAnterior && ts < iniMesPosterior) {
    return {grupo:0,mes:0,ordem:ts};
  }
  if (dia > 10 && ts >= iniMesAnterior && ts <= fimMesAnterior) {
    return {grupo:0,mes:0,ordem:ts};
  }
  if (dia > 10 && ts >= iniMesAtual && ts < iniMesPosterior) {
    return {grupo:1,mes:0,ordem:ts};
  }

  var difMes = (ano - d.getFullYear()) * 12 + (mes - d.getMonth());
  return {grupo:2,mes:difMes,ordem:-ts};
}

function listarFilaConferencia(token) {
  var sessao = exigirPerfil_(token, ["CONFERENCIA"]);
  var meuRg = normalizarRgCadastro_(sessao.rg);

  // Consulta somente leitura: não ocupa o bloqueio das gravações.
  var aba = garantirEstruturaConferenciaProtocolos_();
  var itens = [];
  var disponiveis = 0;
  var emVerificacao = 0;
  var concluidosHoje = 0;
  var meusConcluidosHoje = 0;
  var hoje = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy");

  var histConf = garantirEstruturaHistoricoConferencia_();

  // Para os contadores, procura somente os eventos de HOJE.
  // Não lê mais o histórico inteiro em toda atualização da fila.
  if (histConf.getLastRow() >= 2) {
    var achadosHoje = histConf
      .getRange(2, 1, histConf.getLastRow() - 1, 1)
      .createTextFinder(hoje)
      .matchEntireCell(false)
      .findAll();

    var linhasHoje = {hoje:achadosHoje.map(function(cel) { return cel.getRow(); })};
    var historicoHoje = lerLinhasProtocolosRoteiro_(histConf, linhasHoje, 5);
    achadosHoje.forEach(function(cel) {
      var lr = cel.getRow();
      var dadosHist = historicoHoje[lr].slice(3,5);

      var evento =
        normalizarMaiusculoConferencia_(dadosHist[0]);
      var rgHistorico =
        normalizarRgCadastro_(dadosHist[1]);

      if (evento === "CONCLUÍDO") {
        concluidosHoje++;
        if (rgHistorico === meuRg) {
          meusConcluidosHoje++;
        }
      }
    });
  }

  if (aba.getLastRow() >= 2) {
    var vals = aba.getRange(2,1,aba.getLastRow()-1,27).getDisplayValues();

    vals.forEach(function(r) {
      var estado = normalizarMaiusculoConferencia_(r[9]);
      if (estado !== 'DISPONÍVEL' && estado !== 'EM VERIFICAÇÃO') return;
      var x = objetoConferenciaDaLinha_(r);

      // Só contam registros operacionais válidos.
      if (estado === "DISPONÍVEL") {
        disponiveis++;
        itens.push(x);
      } else if (estado === "EM VERIFICAÇÃO") {
        emVerificacao++;
        itens.push(x);
      }


    });
  }

  var agoraOrdenacao = new Date();
  function prioridade(x) {
    var estado = normalizarMaiusculoConferencia_(x.estadoInterno);
    var rg = normalizarRgCadastro_(x.rgConferente);
    var divisao = normalizarMaiusculoConferencia_(x.divisao);

    if (divisao === "F-7") return 0;
    if (estado === "EM VERIFICAÇÃO" && rg === meuRg) return 1;
    if (estado === "EM VERIFICAÇÃO") return 2;
    if (estado === "DISPONÍVEL") return 3;
    return 4;
  }

  itens = itens.map(function(item) {
    return {item:item, prioridade:prioridade(item),
      data:chaveDataFilaConferenciaServidor_(item, agoraOrdenacao)};
  }).sort(function(a,b) {
    var pa = a.prioridade;
    var pb = b.prioridade;
    if (pa !== pb) return pa - pb;

    var ka = a.data;
    var kb = b.data;
    if (ka.grupo !== kb.grupo) return ka.grupo - kb.grupo;
    if (ka.mes !== kb.mes) return ka.mes - kb.mes;
    if (ka.ordem !== kb.ordem) return ka.ordem - kb.ordem;

    return String(a.item.protocolo || "").localeCompare(String(b.item.protocolo || ""));
  }).map(function(registro) { return registro.item; });

  return {
    itens:itens,
    resumo:{
      disponiveis:disponiveis,
      emVerificacao:emVerificacao,
      concluidosHoje:concluidosHoje,
      meusConcluidosHoje:meusConcluidosHoje,
      totalOperacional:disponiveis + emVerificacao
    }
  };
}


function assumirProtocolosSelecionadosConferencia(protocolos, token) {
  var sessao = exigirPerfil_(token, ["CONFERENCIA"]);
  protocolos = Array.isArray(protocolos) ? protocolos : [];

  var unicos = [];
  var vistos = {};

  protocolos.forEach(function(p) {
    p = normalizarTextoConferencia_(p).replace(/\u00A0/g, " ").trim();
    if (!p || vistos[p]) return;
    vistos[p] = true;
    unicos.push(p);
  });

  if (!unicos.length) {
    throw new Error("Selecione pelo menos um protocolo disponível.");
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    var aba = garantirEstruturaConferenciaProtocolos_();
    var mapa = mapaProtocolosConferencia_(aba);
    var meuRg = normalizarRgCadastro_(sessao.rg);
    var nome = sessao.nomeGuerra || sessao.nome || ("RG " + sessao.rg);
    var agora = dataHoraSaoPauloTexto_();

    var assumidos = 0;
    var conflitos = [];
    var alteradas = [];
    var historicos = [];
    var itens = [];

    unicos.forEach(function(protocolo) {
      var achado = mapa[protocolo];

      if (!achado) {
        conflitos.push(protocolo + " (não encontrado)");
        return;
      }

      var anterior = objetoConferenciaDaLinha_(achado.r);

      if (anterior.estadoInterno !== "DISPONÍVEL") {
        if (anterior.estadoInterno === "EM VERIFICAÇÃO") {
          conflitos.push(
            protocolo + " (já assumido por " +
            (anterior.conferente || "outro conferente") + ")"
          );
        } else {
          conflitos.push(
            protocolo + " (não está disponível)"
          );
        }
        return;
      }

      alteradas.push(achado.linha);

      var novo = JSON.parse(JSON.stringify(anterior));
      novo.estadoInterno = "EM VERIFICAÇÃO";
      novo.rgConferente = meuRg;
      novo.conferente = nome;
      novo.assumidoEm = agora;
      novo.atualizadoEm = agora;

      historicos.push([agora,protocolo,novo.ciclo||0,'ASSUMIDO',sessao.rg,nome,
        anterior.estadoInterno||'',novo.estadoInterno||'',anterior.statusSiapi||'',novo.statusSiapi||'',
        'Protocolo assumido em seleção múltipla.',snapshotConferencia_(novo)]);
      itens.push(novo);

      assumidos++;
    });

    if (alteradas.length) {
      aba.getRangeList(alteradas.map(function(l){return 'J'+l;})).setValue('EM VERIFICAÇÃO');
      aba.getRangeList(alteradas.map(function(l){return 'K'+l;})).setValue(meuRg);
      aba.getRangeList(alteradas.map(function(l){return 'L'+l;})).setValue(nome);
      aba.getRangeList(alteradas.map(function(l){return 'P'+l;})).setValue(agora);
      aba.getRangeList(alteradas.map(function(l){return 'R'+l;})).setValue(agora);
      var hist=garantirEstruturaHistoricoConferencia_();
      hist.getRange(hist.getLastRow()+1,1,historicos.length,12).setValues(historicos);
    }
    SpreadsheetApp.flush();

    return {
      sucesso:true,
      assumidos:assumidos,
      conflitos:conflitos,
      itens:itens
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}


function assumirProtocoloConferencia(protocolo, token) {
  var sessao = exigirPerfil_(token, ["CONFERENCIA"]);
  protocolo = normalizarTextoConferencia_(protocolo);
  if (!protocolo) throw new Error("Protocolo inválido.");

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var loc=localizarConferenciaPorProtocolo_(protocolo);
    var aba=loc.aba;
    var achado=loc.achado;
    if (!achado) throw new Error("Protocolo não encontrado.");

    var anterior = objetoConferenciaDaLinha_(achado.r);
    var meuRg = normalizarRgCadastro_(sessao.rg);

    if (anterior.estadoInterno === "EM VERIFICAÇÃO") {
      if (anterior.rgConferente !== meuRg) {
        throw new Error(
          "Este protocolo já está em verificação por " +
          (anterior.conferente || "outro usuário") +
          (anterior.assumidoEm ? " desde " + anterior.assumidoEm + "." : ".")
        );
      }
      return {sucesso:true,item:anterior};
    }

    if (anterior.estadoInterno !== "DISPONÍVEL") {
      throw new Error("Este protocolo não está disponível para ser assumido.");
    }

    var agora = dataHoraSaoPauloTexto_();
    var nome = sessao.nomeGuerra || sessao.nome || ("RG " + sessao.rg);

    aba.getRange(achado.linha,10,1,3).setValues([["EM VERIFICAÇÃO",meuRg,nome]]);
    aba.getRange(achado.linha,16).setValue(agora);
    aba.getRange(achado.linha,18).setValue(agora);

    var novo = JSON.parse(JSON.stringify(anterior));
    novo.estadoInterno = "EM VERIFICAÇÃO";
    novo.rgConferente = meuRg;
    novo.conferente = nome;
    novo.assumidoEm = agora;
    novo.atualizadoEm = agora;

    registrarHistoricoConferencia_(protocolo,novo.ciclo,"ASSUMIDO",sessao,anterior,novo,"Protocolo reservado para verificação.");

    SpreadsheetApp.flush();
    return {sucesso:true,item:novo};
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function localizarConferenciaPorProtocoloRapido_(protocolo) {
  protocolo = normalizarTextoConferencia_(protocolo);
  var aba = garantirEstruturaConferenciaProtocolos_();

  if (!protocolo || aba.getLastRow() < 2) {
    return {aba:aba, achado:null};
  }

  var achados = aba
    .getRange(2, 1, aba.getLastRow() - 1, 1)
    .createTextFinder(protocolo)
    .matchEntireCell(true)
    .findAll();

  if (!achados.length) {
    return {aba:aba, achado:null};
  }

  // Usa a ocorrência mais recente caso exista histórico duplicado antigo.
  var linha = achados[achados.length - 1].getRow();
  var r = aba.getRange(linha, 1, 1, 27).getDisplayValues()[0];

  return {
    aba:aba,
    achado:{
      linha:linha,
      r:r
    }
  };
}


function localizarConferenciaPorProtocolo_(protocolo) {
  var aba=garantirEstruturaConferenciaProtocolos_();
  var alvo=normalizarTextoConferencia_(protocolo),linha=0;
  if(alvo && aba.getLastRow()>=2) {
    aba.getRange(2,1,aba.getLastRow()-1,1).getDisplayValues().forEach(function(r,i){
      if(normalizarTextoConferencia_(r[0]).replace(/\u00A0/g,' ').trim()===alvo)linha=i+2;
    });
  }
  return {aba:aba,achado:linha?{linha:linha,r:aba.getRange(linha,1,1,27).getDisplayValues()[0]}:null};
}


function liberarProtocolosSelecionadosConferencia(protocolos, token) {
  var sessao = exigirPerfil_(token, ["CONFERENCIA"]);
  protocolos = Array.isArray(protocolos) ? protocolos : [];

  var unicos = [];
  var vistos = {};

  protocolos.forEach(function(p) {
    p = normalizarTextoConferencia_(p)
      .replace(/\u00A0/g, " ")
      .trim();

    if (!p || vistos[p]) return;

    vistos[p] = true;
    unicos.push(p);
  });

  if (!unicos.length) {
    throw new Error("Nenhum protocolo foi informado para liberação.");
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    var aba = garantirEstruturaConferenciaProtocolos_();
    var hist = garantirEstruturaHistoricoConferencia_();

    var linhas = [];
    if (aba.getLastRow() >= 2) {
      linhas = aba.getRange(
        2,1,aba.getLastRow()-1,27
      ).getDisplayValues();
    }

    var mapa = {};
    linhas.forEach(function(r,i) {
      var p = normalizarTextoConferencia_(r[0])
        .replace(/\u00A0/g, " ")
        .trim();

      if (p) mapa[p] = i;
    });

    var meuRg = normalizarRgCadastro_(sessao.rg);
    var perfil = String(sessao.perfil || "").toUpperCase();
    var nomeUsuario =
      sessao.nomeGuerra || sessao.nome || ("RG " + sessao.rg);

    var agora = dataHoraSaoPauloTexto_();
    var liberados = 0;
    var ignorados = [];
    var historicos = [];
    var indicesAlterados = [];

    unicos.forEach(function(protocolo) {
      if (!mapa.hasOwnProperty(protocolo)) {
        ignorados.push(protocolo + " (não encontrado)");
        return;
      }

      var idx = mapa[protocolo];
      var linha = linhas[idx];
      var anterior = objetoConferenciaDaLinha_(linha);

      if (anterior.estadoInterno !== "EM VERIFICAÇÃO") {
        ignorados.push(protocolo + " (não está em verificação)");
        return;
      }

      if (
        anterior.rgConferente !== meuRg &&
        perfil !== "GESTOR"
      ) {
        ignorados.push(
          protocolo + " (assumido por " +
          (anterior.conferente || "outro conferente") + ")"
        );
        return;
      }

      linha[9] = "DISPONÍVEL";
      linha[10] = "";
      linha[11] = "";
      linha[15] = "";
      linha[17] = agora;

      indicesAlterados.push(idx);

      var novo = objetoConferenciaDaLinha_(linha);

      historicos.push([
        agora,
        protocolo,
        novo.ciclo,
        "LIBERADO",
        sessao.rg,
        nomeUsuario,
        anterior.estadoInterno,
        novo.estadoInterno,
        anterior.statusSiapi,
        novo.statusSiapi,
        "Retornado para a fila comum em liberação múltipla.",
        snapshotConferencia_(novo)
      ]);

      liberados++;
    });

    gravarBlocosAlteradosConferencia_(
      aba,
      linhas,
      indicesAlterados,
      27
    );

    if (historicos.length) {
      hist.getRange(
        hist.getLastRow()+1,
        1,
        historicos.length,
        12
      ).setValues(historicos);
    }

    SpreadsheetApp.flush();

    return {
      sucesso:true,
      liberados:liberados,
      ignorados:ignorados
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}


function liberarProtocoloConferencia(protocolo, token) {
  var sessao = exigirPerfil_(token, ["CONFERENCIA"]);
  protocolo = normalizarTextoConferencia_(protocolo);

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var loc = localizarConferenciaPorProtocolo_(protocolo);
    if (!loc.achado) throw new Error("Protocolo não encontrado.");

    var anterior = objetoConferenciaDaLinha_(loc.achado.r);
    var meuRg = normalizarRgCadastro_(sessao.rg);

    if (anterior.estadoInterno !== "EM VERIFICAÇÃO") {
      throw new Error("O protocolo não está em verificação.");
    }

    if (anterior.rgConferente !== meuRg && String(sessao.perfil || "").toUpperCase() !== "GESTOR") {
      throw new Error("Somente o conferente responsável ou o GESTOR pode liberar este protocolo.");
    }

    var agora = dataHoraSaoPauloTexto_();

    loc.aba.getRange(loc.achado.linha,10,1,3).setValues([["DISPONÍVEL","",""]]);
    loc.aba.getRange(loc.achado.linha,16).clearContent();
    loc.aba.getRange(loc.achado.linha,18).setValue(agora);

    var novo = JSON.parse(JSON.stringify(anterior));
    novo.estadoInterno = "DISPONÍVEL";
    novo.rgConferente = "";
    novo.conferente = "";
    novo.assumidoEm = "";
    novo.atualizadoEm = agora;

    registrarHistoricoConferencia_(protocolo,novo.ciclo,"LIBERADO",sessao,anterior,novo,"Retornado para a fila comum.");

    SpreadsheetApp.flush();
    return {sucesso:true,item:novo};
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function concluirProtocoloConferencia(protocolo, statusSiapi, observacao, token) {
  var sessao = exigirPerfil_(token, ["CONFERENCIA"]);
  protocolo = normalizarTextoConferencia_(protocolo);
  statusSiapi = normalizarMaiusculoConferencia_(statusSiapi);
  observacao = normalizarTextoConferencia_(observacao);

  if (statusOficiaisConferencia_().indexOf(statusSiapi) === -1) {
    throw new Error("Selecione um status válido do SIAPI.");
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(8000);

  try {
    // Localiza somente o protocolo concluído.
    var loc = localizarConferenciaPorProtocoloRapido_(protocolo);
    if (!loc.achado) throw new Error("Protocolo não encontrado.");

    var anterior = objetoConferenciaDaLinha_(loc.achado.r);
    var meuRg = normalizarRgCadastro_(sessao.rg);

    if (
      anterior.estadoInterno !== "EM VERIFICAÇÃO" ||
      anterior.rgConferente !== meuRg
    ) {
      throw new Error(
        "Somente o conferente que assumiu o protocolo pode concluir a verificação."
      );
    }

    var agora = dataHoraSaoPauloTexto_();
    var ehDivisaoF7 =
      normalizarMaiusculoConferencia_(anterior.divisao) === "F-7";
    var aprovado = statusSiapi === "APROVADO";

    var estadoFinal =
      (ehDivisaoF7 && !aprovado)
        ? "DISPONÍVEL"
        : "CONCLUÍDO";

    // Lê uma única faixa e grava uma única vez.
    // Colunas 9 a 21 = STATUS_SIAPI até OBSERVAÇÃO.
    var faixa = loc.aba
      .getRange(loc.achado.linha, 9, 1, 13);

    var valores = faixa.getValues()[0];

    valores[0] = statusSiapi;   // col 9
    valores[1] = estadoFinal;   // col 10
    valores[8] = agora;         // col 17 - CONCLUIDO_EM
    valores[9] = agora;         // col 18 - ATUALIZADO_EM
    valores[12] = observacao;   // col 21 - OBSERVAÇÃO

    if (ehDivisaoF7 && !aprovado) {
      valores[2] = "";          // col 11 - RG_CONFERENTE
      valores[3] = "";          // col 12 - CONFERENTE
      valores[7] = "";          // col 16 - ASSUMIDO_EM
    }

    faixa.setValues([valores]);

    var novo = JSON.parse(JSON.stringify(anterior));
    novo.statusSiapi = statusSiapi;
    novo.estadoInterno = estadoFinal;
    novo.concluidoEm = agora;
    novo.atualizadoEm = agora;
    novo.observacao = observacao;

    if (ehDivisaoF7 && !aprovado) {
      novo.rgConferente = "";
      novo.conferente = "";
      novo.assumidoEm = "";
    }

    var detalheConclusao =
      "Status verificado no SIAPI: " + statusSiapi + ".";

    if (ehDivisaoF7 && !aprovado) {
      detalheConclusao +=
        " DIVISÃO F-7 permanece na fila de Conferência até nova verificação/aprovação.";
    }

    if (observacao) {
      detalheConclusao += " Observação: " + observacao;
    }

    registrarHistoricoConferencia_(
      protocolo,
      novo.ciclo,
      "CONCLUÍDO",
      sessao,
      anterior,
      novo,
      detalheConclusao
    );

    // Não força flush e não recarrega nenhuma fila no servidor.
    return {
      sucesso:true,
      item:novo,
      estadoAnterior:anterior.estadoInterno || "",
      rgAnterior:anterior.rgConferente || "",
      permaneceNaFila:(ehDivisaoF7 && !aprovado),
      mensagem:(ehDivisaoF7 && !aprovado)
        ? "DIVISÃO F-7: o protocolo permanecerá na fila até ser aprovado."
        : "Conferência concluída."
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}


function dataTextoConferencia_(valor) {
  var s = normalizarTextoConferencia_(valor);
  if (!s) return null;

  var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(parseInt(m[3],10),parseInt(m[2],10)-1,parseInt(m[1],10),12,0,0);

  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(parseInt(m[1],10),parseInt(m[2],10)-1,parseInt(m[3],10),12,0,0);

  return null;
}

function consultarProtocolosConferencia(filtros, token) {
  exigirPerfil_(token, ["CONFERENCIA"]);
  filtros = filtros || {};

  var aba = garantirEstruturaConferenciaProtocolos_();
  if (aba.getLastRow() < 2) return {itens:[]};

  var vals = aba.getRange(2,1,aba.getLastRow()-1,27).getDisplayValues();
  var modo = normalizarMaiusculoConferencia_(filtros.modo || "TODOS");
  var status = normalizarMaiusculoConferencia_(filtros.status);
  var dataIni = dataTextoConferencia_(filtros.dataIni);
  var dataFim = dataTextoConferencia_(filtros.dataFim);
  if (dataFim) dataFim.setHours(23,59,59,999);

  var itens = [];

  vals.forEach(function(r) {
    var x = objetoConferenciaDaLinha_(r);

    if (modo === "APROVADOS_F7") {
      var padrao = normalizarMaiusculoConferencia_(x.statusSiapi) === "APROVADO" ||
                   normalizarMaiusculoConferencia_(x.divisao) === "F-7";
      if (!padrao) return;
    }

    if (status && normalizarMaiusculoConferencia_(x.statusSiapi) !== status) return;
    if (!filtroContemConferencia_(x.divisao, filtros.divisao)) return;

    var filtroAtualizacao = normalizarMaiusculoConferencia_(filtros.atualizacao);
    if (filtroAtualizacao === "NOVA_MOVIMENTACAO" &&
        x.novaMovimentacaoAposConclusao !== "SIM") return;
    if (filtroAtualizacao === "MESMA_DATA" &&
        x.mesmaDataImportacao !== "SIM") return;

    if (!filtroContemConferencia_(x.protocolo, filtros.protocolo)) return;
    if (!filtroContemConferencia_(x.razaoSocial, filtros.razaoSocial)) return;
    if (!filtroContemConferencia_(x.movimentacao, filtros.movimentacao)) return;

    if (dataIni || dataFim) {
      var d = dataTextoConferencia_(x.concluidoEm || x.atualizadoEm);
      if (!d) return;
      if (dataIni && d < dataIni) return;
      if (dataFim && d > dataFim) return;
    }

    itens.push(x);
  });

  var ultimos=obterUltimosConferentesConsulta_(itens),nomes=Object.create(null);
  itens.forEach(function(x){
    var u=ultimos[x.protocolo];
    x.ultimoConferente=u?u.nome:((x.concluidoEm||x.estadoInterno==='CONCLUÍDO')?x.conferente:'');
    x.ultimoConferenteRg=u?u.rg:((x.concluidoEm||x.estadoInterno==='CONCLUÍDO')?x.rgConferente:'');
    if(x.ultimoConferente)nomes[x.ultimoConferente]=true;
  });
  var conferentes=Object.keys(nomes).sort(function(a,b){return a.localeCompare(b,'pt-BR');});
  var filtroConferente=normalizarChaveTextoRoteiro_(filtros.ultimoConferente);
  if(filtroConferente)itens=itens.filter(function(x){return normalizarChaveTextoRoteiro_(x.ultimoConferente).indexOf(filtroConferente)>=0 || (x.ultimoConferenteRg && String(x.ultimoConferenteRg)===String(filtros.ultimoConferente).trim());});
  itens.sort(function(a,b) {
    return String(b.atualizadoEm || "").localeCompare(String(a.atualizadoEm || ""));
  });

  return {itens:itens.slice(0,1000),conferentes:conferentes};
}

function obterHistoricoConferencia(protocolo, token) {
  exigirPerfil_(token, ["CONFERENCIA"]);
  protocolo = normalizarTextoConferencia_(protocolo);

  var aba = garantirEstruturaHistoricoConferencia_();
  if (aba.getLastRow() < 2) return {eventos:[]};

  var selecionadas=[];
  aba.getRange(2,2,aba.getLastRow()-1,1).getDisplayValues().forEach(function(r,i){
    if(normalizarTextoConferencia_(r[0])===protocolo)selecionadas.push(i+2);
  });
  var valores=lerLinhasProtocolosRoteiro_(aba,{protocolo:selecionadas},12);
  var vals=selecionadas.map(function(linha){return valores[linha];});
  var eventos = [];

  vals.forEach(function(r) {
    if (normalizarTextoConferencia_(r[1]) !== protocolo) return;

    eventos.push({
      dataHora:r[0],
      protocolo:r[1],
      ciclo:r[2],
      evento:r[3],
      rgUsuario:r[4],
      usuario:r[5],
      estadoAnterior:r[6],
      estadoNovo:r[7],
      statusAnterior:r[8],
      statusNovo:r[9],
      alteracoes:r[10]
    });
  });

  eventos.reverse();
  return {eventos:eventos};
}


// ==========================================================
// MÓDULO CONFERÊNCIA / ROTEIRO DE VISTORIAS
// ==========================================================

function inicializarEstruturaRoteiroVistorias(token) {
  exigirPerfil_(token, ["CONFERENCIA"]);

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var estruturas = [
    {
      nome: "PROTOCOLOS",
      cabecalho: ["PROTOCOLO","TIPO","PRIORIDADE","REGIÃO","SITUAÇÃO","DATA_ENTRADA","É_RETORNO","PROTOCOLO_ORIGEM","OBSERVAÇÃO","STATUS"]
    },
    {
      nome: "ROTEIRO_VISTORIAS",
      cabecalho: ["DATA","PROTOCOLO","RG_1","MILITAR_1","RG_2","MILITAR_2","REGIÃO","PERÍODO","VTR","TIPO_SERVIÇO","STATUS","OBSERVAÇÃO","PRIORIDADE","SITUAÇÃO_VTR","BAIRRO","RAZÃO_SOCIAL","DIVISÃO","ÁREA","ÚLTIMO_ANDAMENTO_SIAPI","DATA_ANDAMENTO_SIAPI","PERÍODO_2","ORIGEM_PENDENCIA_ID","ORIGEM_SOLICITACAO_ID","VISTORIADO_POR_SIAPI","DATA_COPIA_SIAPI","ANDAMENTO_MAIS_20_DIAS"]
    },
    {
      nome: "HISTORICO_VISTORIAS",
      cabecalho: ["DATA_REGISTRO","DATA_VISTORIA","PROTOCOLO","TIPO","PRIORIDADE","RG_1","MILITAR_1","RG_2","MILITAR_2","REGIÃO","PERÍODO","VTR","STATUS","RESULTADO","OBSERVAÇÃO","USUÁRIO_RG","USUÁRIO_NOME"]
    }
  ];

  var resultado = [];

  estruturas.forEach(function(item) {
    var aba = ss.getSheetByName(item.nome);
    var criada = false;

    if (!aba) {
      aba = ss.insertSheet(item.nome);
      criada = true;
    }

    if (aba.getLastRow() === 0 || !String(aba.getRange(1,1).getDisplayValue() || "").trim()) {
      aba.getRange(1, 1, 1, item.cabecalho.length).setValues([item.cabecalho]);
    } else if (item.nome === "ROTEIRO_VISTORIAS") {
      // Mantém os dados existentes e apenas completa as novas colunas.
      aba.getRange(1, 1, 1, item.cabecalho.length).setValues([item.cabecalho]);
    }

    aba.setFrozenRows(1);
    aba.getRange(1, 1, 1, item.cabecalho.length)
      .setFontWeight("bold")
      .setBackground("#5C1D1D")
      .setFontColor("#FFFFFF")
      .setHorizontalAlignment("center");

    aba.autoResizeColumns(1, item.cabecalho.length);

    resultado.push({nome:item.nome, criada:criada, colunas:item.cabecalho.length});
  });

  return {sucesso:true, mensagem:"Estrutura do Roteiro de Vistorias pronta.", abas:resultado};
}


function garantirEstruturaRascunhoRoteiro_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("RASCUNHO_ROTEIRO");
  if (!aba) aba = ss.insertSheet("RASCUNHO_ROTEIRO");

  var cab = [
    "DATA_ROTEIRO","PROTOCOLO","SERVIÇO","BAIRRO","DATA_ANDAMENTO",
    "ÚLTIMO_ANDAMENTO","RAZÃO_SOCIAL","DIVISÃO","VISTORIADO_POR","ÁREA",
    "REGIÃO","DIA_PREFERENCIAL","OBSERVAÇÃO","PRIORIDADE",
    "ORIGEM_PENDENCIA_ID","ORIGEM_SOLICITACAO_ID","ORIGEM_PENDENCIA",
    "USUÁRIO_RG","USUÁRIO_NOME","SALVO_EM","STATUS",
    "DATA_COPIA_SIAPI","ANDAMENTO_MAIS_20_DIAS"
  ];

  prepararCabecalhoLeve_(aba, cab, {substituir:true});
  return aba;
}


function dataHoraSaoPauloTexto_() {
  return Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
}



function itemRascunhoRoteiroDaLinha_(r) {
  r = r || [];
  return {
    protocolo:r[1] || "",
    servico:r[2] || "",
    bairro:r[3] || "",
    dataAndamento:r[4] || "",
    ultimoAndamento:r[5] || "",
    razaoSocial:r[6] || "",
    divisao:r[7] || "",
    vistoriadoPorSiapi:r[8] || "",
    area:r[9] || "",
    regiao:r[10] || "",
    diaPreferencial:r[11] || "",
    observacao:r[12] || "",
    prioridade:r[13] || "NORMAL",
    origemPendenciaId:r[14] || "",
    origemSolicitacaoId:r[15] || "",
    origemPendencia:r[16] || "",
    dataCopiaSiapi:r[21] || "",
    andamentoMais20Dias:
      String(r[22] || "").trim().toUpperCase() === "SIM"
  };
}


function localizarLinhasProtocolosRoteiro_(aba, colunaProtocolo, protocolos) {
  var mapa = {};
  var unicos = {};
  (Array.isArray(protocolos) ? protocolos : []).forEach(function(p) {
    p = normalizarProtocoloRoteiro_(p);
    if (p) unicos[p] = true;
  });
  var lista = Object.keys(unicos);
  if (!aba || !lista.length) return mapa;
  var ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return mapa;
  var faixa = aba.getRange(2, colunaProtocolo, ultimaLinha - 1, 1);
  lista.forEach(function(p) { mapa[p] = []; });

  // Uma busca pontual continua econômica para edição individual.
  if (lista.length === 1) {
    mapa[lista[0]] = faixa.createTextFinder(lista[0])
      .matchEntireCell(true).findAll().map(function(cel) { return cel.getRow(); });
    return mapa;
  }

  // Para lotes, lê a coluna uma vez em vez de fazer N chamadas ao Sheets.
  faixa.getDisplayValues().forEach(function(r, i) {
    var p = String(r[0] || "").toUpperCase();
    if (Object.prototype.hasOwnProperty.call(unicos, p)) mapa[p].push(i + 2);
  });
  return mapa;
}

function lerLinhasProtocolosRoteiro_(aba, mapa, totalColunas) {
  var linhas = {};
  Object.keys(mapa).forEach(function(p) {
    mapa[p].forEach(function(linha) { linhas[linha] = true; });
  });
  var numeros = Object.keys(linhas).map(Number).sort(function(a,b) { return a-b; });
  var resultado = {};
  var i = 0;
  while (i < numeros.length) {
    var inicio = numeros[i];
    var fim = inicio;
    var proximo = i + 1;
    // Agrupa linhas próximas, limitando tamanho e leitura de lacunas.
    while (proximo < numeros.length && numeros[proximo] - fim <= 20 &&
           numeros[proximo] - inicio < 500) {
      fim = numeros[proximo++];
    }
    var valores = aba.getRange(inicio, 1, fim - inicio + 1, totalColunas).getDisplayValues();
    for (; i < proximo; i++) resultado[numeros[i]] = valores[numeros[i] - inicio];
  }
  return resultado;
}


function salvarRascunhosRoteiro(itens, dataRoteiro, token) {
  var sessao = exigirPerfil_(token, ["CONFERENCIA"]);
  itens = Array.isArray(itens) ? itens : [];

  var dataObj = criarDataSegura(dataRoteiro);
  if (!dataObj) {
    throw new Error("Informe a data do roteiro antes de adicionar protocolos.");
  }

  if (!itens.length) {
    return {
      sucesso:true,
      total:0,
      salvos:0,
      novos:0,
      reativados:0,
      jaRascunho:0,
      distribuidosMesmoDia:0,
      avisosOutrasDatas:[],
      itensTela:[]
    };
  }

  var dataTxt = formatarDataTexto(dataObj);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = garantirEstruturaRascunhoRoteiro_();
  var roteiro = ss.getSheetByName("ROTEIRO_VISTORIAS");

  // Deduplica somente o lote recebido.
  var unicos = {};
  itens.forEach(function(item) {
    var p = normalizarProtocoloRoteiro_(item && item.protocolo);
    if (p) unicos[p] = item;
  });

  var protocolos = Object.keys(unicos);

  if (!protocolos.length) {
    return {
      sucesso:true,
      total:itens.length,
      salvos:0,
      novos:0,
      reativados:0,
      jaRascunho:0,
      distribuidosMesmoDia:0,
      avisosOutrasDatas:[],
      itensTela:[]
    };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    // Busca somente os protocolos do lote, em vez de varrer a base inteira.
    var linhasRoteiro =
      localizarLinhasProtocolosRoteiro_(roteiro, 2, protocolos);

    var linhasRascunho =
      localizarLinhasProtocolosRoteiro_(aba, 2, protocolos);

    var dadosRoteiro = lerLinhasProtocolosRoteiro_(roteiro, linhasRoteiro, 11);
    var dadosRascunho = lerLinhasProtocolosRoteiro_(aba, linhasRascunho, 23);
    var distribuidosMesmoDia = {};
    var distribuicoesOutrasDatas = {};

    protocolos.forEach(function(p) {
      (linhasRoteiro[p] || []).forEach(function(linha) {
        // Apenas as colunas DATA e STATUS são necessárias aqui.
        var dados = dadosRoteiro[linha];

        var status = String(dados[10] || "").trim().toUpperCase();
        if (status === "CANCELADO") return;

        var dataExistente = String(dados[0] || "").trim();

        if (dataExistente === dataTxt) {
          distribuidosMesmoDia[p] = true;
          return;
        }

        if (dataExistente) {
          if (!distribuicoesOutrasDatas[p]) {
            distribuicoesOutrasDatas[p] = [];
          }

          if (
            distribuicoesOutrasDatas[p].indexOf(dataExistente) === -1
          ) {
            distribuicoesOutrasDatas[p].push(dataExistente);
          }
        }
      });
    });

    var agora = dataHoraSaoPauloTexto_();
    var linhasNovas = [];
    var itensTela = [];
    var avisosOutrasDatas = [];

    var novos = 0;
    var reativados = 0;
    var jaRascunho = 0;
    var retomados = [];
    var bloqueadosMesmoDia = 0;

    protocolos.forEach(function(protocolo) {
      var item = unicos[protocolo] || {};

      // Se já está distribuído na mesma data, não entra novamente.
      if (distribuidosMesmoDia[protocolo]) {
        bloqueadosMesmoDia++;
        return;
      }

      var candidatos = linhasRascunho[protocolo] || [];

      var linhaAtiva = 0;
      var linhaRemovida = 0;
      var dadosAtivos = null;
      var dadosRemovidos = null;

      // Examina somente as linhas desse protocolo.
      for (var i = candidatos.length - 1; i >= 0; i--) {
        var lr = candidatos[i];

        var dadosLinha =
          dadosRascunho[lr];

        if (String(dadosLinha[0] || "").trim() !== dataTxt) {
          continue;
        }

        var statusRasc =
          String(dadosLinha[20] || "").trim().toUpperCase();

        if (!linhaAtiva && statusRasc === "RASCUNHO") {
          linhaAtiva = lr;
          dadosAtivos = dadosLinha;
        }

        if (!linhaRemovida && statusRasc === "REMOVIDO") {
          linhaRemovida = lr;
          dadosRemovidos = dadosLinha;
        }

        if (linhaAtiva && linhaRemovida) break;
      }

      // Já existe ativo no rascunho daquele dia:
      // não duplica, mas devolve para a tela e sinaliza.
      if (linhaAtiva) {
        jaRascunho++;
        retomados.push('T'+linhaAtiva);
        itensTela.push(itemRascunhoRoteiroDaLinha_(dadosAtivos));
        return;
      }

      // Se havia sido removido, preserva observação/prioridade e reativa
      // a própria linha histórica, em vez de criar outra.
      var anterior = dadosRemovidos;

      var observacaoPreservada = anterior
        ? String(anterior[12] || "").trim()
        : String(item.observacao || "").trim();

      var prioridadePreservada = anterior
        ? String(anterior[13] || "NORMAL").trim()
        : String(item.prioridade || "NORMAL").trim();

      if (!prioridadePreservada) prioridadePreservada = "NORMAL";

      var linhaNova = [
        dataTxt,
        protocolo,
        String(item.servico || "").trim(),
        String(item.bairro || "").trim(),
        String(item.dataAndamento || "").trim(),
        String(item.ultimoAndamento || "").trim(),
        String(item.razaoSocial || "").trim(),
        String(item.divisao || "").trim(),
        String(item.vistoriadoPorSiapi || "").trim(),
        String(item.area || "").trim(),
        String(item.regiao || "").trim(),
        String(item.diaPreferencial || "").trim(),
        observacaoPreservada,
        prioridadePreservada,
        String(item.origemPendenciaId || "").trim(),
        String(item.origemSolicitacaoId || "").trim(),
        String(item.origemPendencia || "").trim(),
        sessao.rg,
        sessao.nome,
        agora,
        "RASCUNHO",
        String(item.dataCopiaSiapi || "").trim(),
        item.andamentoMais20Dias ? "SIM" : "NÃO"
      ];

      if (linhaRemovida) {
        aba.getRange(linhaRemovida, 1, 1, 23).setValues([linhaNova]);
        reativados++;
      } else {
        linhasNovas.push(linhaNova);
        novos++;
      }

      itensTela.push(itemRascunhoRoteiroDaLinha_(linhaNova));

      var outrasDatas = distribuicoesOutrasDatas[protocolo] || [];

      if (outrasDatas.length) {
        avisosOutrasDatas.push({
          protocolo:protocolo,
          datas:outrasDatas
        });
      }
    });

    if (retomados.length) aba.getRangeList(retomados).setValue(agora);

    // Somente as linhas realmente novas são acrescentadas ao final.
    if (linhasNovas.length) {
      aba.getRange(
        aba.getLastRow() + 1,
        1,
        linhasNovas.length,
        23
      ).setValues(linhasNovas);
    }

    return {
      sucesso:true,
      total:itens.length,
      salvos:novos + reativados,
      novos:novos,
      reativados:reativados,
      jaRascunho:jaRascunho,
      distribuidosMesmoDia:bloqueadosMesmoDia,
      avisosOutrasDatas:avisosOutrasDatas,
      itensTela:itensTela
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}


function obterRascunhosRoteiro(dataRoteiro, token) {
  exigirPerfil_(token, ["CONFERENCIA"]);
  var lockArquivo = LockService.getScriptLock();
  lockArquivo.waitLock(15000);
  try {

  var dataObj = criarDataSegura(dataRoteiro);

  if (!dataObj) {
    return {
      sucesso:true,
      itens:[],
      dataExibicao:""
    };
  }

  var dataTxt = formatarDataTexto(dataObj);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = garantirEstruturaRascunhoRoteiro_();
  var itens = [];
  var retomados = [];

  // Protocolos já efetivamente distribuídos nesta data.
  // Esta proteção impede que um rascunho antigo/stale volte para a tela.
  var distribuidos = {};
  var roteiro = ss.getSheetByName("ROTEIRO_VISTORIAS");

  if (roteiro && roteiro.getLastRow() >= 2) {
    var rv = roteiro.getRange(
      2,
      1,
      roteiro.getLastRow() - 1,
      Math.max(26, roteiro.getLastColumn())
    ).getDisplayValues();

    rv.forEach(function(r) {
      var status = String(r[10] || "").trim().toUpperCase();

      if (status === "CANCELADO") return;
      if (String(r[0] || "").trim() !== dataTxt) return;

      var protocolo = normalizarProtocoloRoteiro_(r[1]);

      if (protocolo) {
        distribuidos[protocolo] = true;
      }
    });
  }

  if (aba.getLastRow() >= 2) {
    var qtd = aba.getLastRow() - 1;
    var vals = aba.getRange(2,1,qtd,23).getDisplayValues();
    var statusNovos = vals.map(function(r) {
      return [String(r[20] || "").trim()];
    });
    var corrigiuStatus = false;

    vals.forEach(function(r, idx) {
      if (String(r[0] || "").trim() !== dataTxt) return;

      var status = String(r[20] || "").trim().toUpperCase();
      if (status !== "RASCUNHO") return;

      var protocolo = normalizarProtocoloRoteiro_(r[1]);

      // Se já foi distribuído, cura o rascunho antigo e não o devolve à tela.
      if (protocolo && distribuidos[protocolo]) {
        statusNovos[idx][0] = "LANÇADO";
        corrigiuStatus = true;
        return;
      }

      retomados.push('T'+(idx+2));
      itens.push({
        protocolo:r[1],
        servico:r[2],
        bairro:r[3],
        dataAndamento:r[4],
        ultimoAndamento:r[5],
        razaoSocial:r[6],
        divisao:r[7],
        vistoriadoPorSiapi:r[8],
        area:r[9],
        regiao:r[10],
        diaPreferencial:r[11],
        observacao:r[12],
        prioridade:r[13] || "NORMAL",
        origemPendenciaId:r[14],
        origemSolicitacaoId:r[15],
        origemPendencia:r[16],
        dataCopiaSiapi:r[21],
        andamentoMais20Dias:
          String(r[22] || "").trim().toUpperCase() === "SIM"
      });
    });

    if (corrigiuStatus) {
      aba.getRange(2,21,qtd,1).setValues(statusNovos);
      SpreadsheetApp.flush();
    }
  }

  if (retomados.length) aba.getRangeList(retomados).setValue(dataHoraSaoPauloTexto_());

  return {
    sucesso:true,
    itens:itens,
    dataExibicao:
      Utilities.formatDate(
        dataObj,
        "America/Sao_Paulo",
        "dd/MM/yyyy"
      )
  };
  } finally { lockArquivo.releaseLock(); }
}


function removerRascunhosSelecionadosRoteiro(protocolos, dataRoteiro, token) {
  exigirPerfil_(token, ["CONFERENCIA"]);

  protocolos = Array.isArray(protocolos) ? protocolos : [];
  if (!protocolos.length) return {sucesso:true, removidos:0};

  var dataObj = criarDataSegura(dataRoteiro);
  if (!dataObj) throw new Error("Data do roteiro inválida.");

  var dataTxt = formatarDataTexto(dataObj);
  var mapaProtocolos = {};

  protocolos.forEach(function(p) {
    var pr = normalizarProtocoloRoteiro_(p);
    if (pr) mapaProtocolos[pr] = true;
  });

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var aba = garantirEstruturaRascunhoRoteiro_();
    var removidos = 0;

    if (aba.getLastRow() >= 2) {
      // STATUS continua na coluna 21.
      var vals = aba.getRange(2,1,aba.getLastRow()-1,23).getDisplayValues();

      for (var i=vals.length-1; i>=0; i--) {
        var protocolo = normalizarProtocoloRoteiro_(vals[i][1]);

        if (
          String(vals[i][0] || "").trim() === dataTxt &&
          mapaProtocolos[protocolo] &&
          String(vals[i][20] || "").trim().toUpperCase() === "RASCUNHO"
        ) {
          aba.getRange(i+2,20,1,2).setValues([[dataHoraSaoPauloTexto_(),"REMOVIDO"]]);
          removidos++;
        }
      }
    }

    return {sucesso:true, removidos:removidos};

  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}


function limparRascunhosRoteiroData(dataRoteiro, token) {
  exigirPerfil_(token, ["CONFERENCIA"]);
  var dataObj = criarDataSegura(dataRoteiro);
  if (!dataObj) throw new Error("Data do roteiro inválida.");
  var dataTxt = formatarDataTexto(dataObj);
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var aba = garantirEstruturaRascunhoRoteiro_();
    var removidos = 0;
    var tocados = [];
    if (aba.getLastRow() >= 2) {
      var qtd = aba.getLastRow() - 1;
      var vals = aba.getRange(2,1,qtd,23).getDisplayValues();
      var status = vals.map(function(r) { return [String(r[20] || "").trim()]; });
      vals.forEach(function(r, i) {
        if (String(r[0] || "").trim() === dataTxt && String(r[20] || "").trim().toUpperCase() === "RASCUNHO") {
          status[i][0] = "REMOVIDO";
          tocados.push("T"+(i+2));
          removidos++;
        }
      });
      if (removidos) {
        aba.getRange(2,21,qtd,1).setValues(status);
        aba.getRangeList(tocados).setValue(dataHoraSaoPauloTexto_());
        SpreadsheetApp.flush();
      }
    }
    return {sucesso:true, removidos:removidos, mensagem:removidos ? removidos + " protocolo(s) removido(s) da lista desta data." : "Não havia protocolos em rascunho para remover nesta data."};
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}


function removerRascunhoRoteiro(protocolo, dataRoteiro, token) {
  exigirPerfil_(token, ["CONFERENCIA"]);
  var lockArquivo = LockService.getScriptLock();
  lockArquivo.waitLock(15000);
  try {

  protocolo = normalizarProtocoloRoteiro_(protocolo);
  var dataObj = criarDataSegura(dataRoteiro);
  if (!protocolo || !dataObj) return {sucesso:true};

  var dataTxt = formatarDataTexto(dataObj);
  var aba = garantirEstruturaRascunhoRoteiro_();

  if (aba.getLastRow() >= 2) {
    var vals = aba.getRange(2,1,aba.getLastRow()-1,23).getDisplayValues();
    for (var i=vals.length-1; i>=0; i--) {
      if (
        String(vals[i][0] || "").trim() === dataTxt &&
        normalizarProtocoloRoteiro_(vals[i][1]) === protocolo &&
        String(vals[i][20] || "").trim().toUpperCase() === "RASCUNHO"
      ) {
        aba.getRange(i+2,20,1,2).setValues([[dataHoraSaoPauloTexto_(),"REMOVIDO"]]);
      }
    }
  }

  return {sucesso:true};
  } finally { lockArquivo.releaseLock(); }
}


function finalizarRascunhosRoteiro_(itens) {
  itens = Array.isArray(itens) ? itens : [];
  if (!itens.length) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("RASCUNHO_ROTEIRO");
  if (!aba || aba.getLastRow() < 2) return;

  var qtd = aba.getLastRow() - 1;
  var vals = aba.getRange(2,1,qtd,23).getDisplayValues();

  var alvos = {};

  itens.forEach(function(item) {
    var d = criarDataSegura(item.dataRoteiro);
    if (!d) return;

    var dataTxt = formatarDataTexto(d);
    var protocolo =
      normalizarProtocoloRoteiro_(item.protocolo);

    if (protocolo) {
      alvos[dataTxt + "|" + protocolo] = true;
    }
  });

  var status = vals.map(function(r) {
    return [String(r[20] || "").trim()];
  });

  var alterou = false;

  for (var i=0; i<vals.length; i++) {
    var chave =
      String(vals[i][0] || "").trim() + "|" +
      normalizarProtocoloRoteiro_(vals[i][1]);

    if (
      alvos[chave] &&
      String(vals[i][20] || "").trim().toUpperCase() === "RASCUNHO"
    ) {
      status[i][0] = "LANÇADO";
      alterou = true;
    }
  }

  if (alterou) {
    aba.getRange(2,21,qtd,1).setValues(status);
    SpreadsheetApp.flush();
  }
}


function normalizarProtocoloRoteiro_(valor) {
  return String(valor || "").trim().toUpperCase().replace(/\s+/g, " ");
}

function corPrioridadeRoteiro_(prioridade) {
  var p = String(prioridade || "").trim().toUpperCase();
  if (p === "CORONEL") return "#F4B183";
  if (p === "ATRASADA") return "#FF6B6B";
  if (p === "EVENTO TEMPORÁRIO" || p === "EVENTO TEMPORARIO") return "#F062B0";
  return "#FFFFFF";
}

function cadastrarProtocoloRoteiro(dados, token) {
  exigirPerfil_(token, ["CONFERENCIA"]);
  dados = dados || {};

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("PROTOCOLOS");
  if (!aba) {
    inicializarEstruturaRoteiroVistorias(token);
    aba = ss.getSheetByName("PROTOCOLOS");
  }

  var protocolo = normalizarProtocoloRoteiro_(dados.protocolo);
  var tipo = String(dados.tipo || "").trim().toUpperCase();
  var prioridade = String(dados.prioridade || "NORMAL").trim().toUpperCase();
  var regiao = String(dados.regiao || "").trim().toUpperCase();
  var situacao = String(dados.situacao || "PENDENTE").trim().toUpperCase();
  var dataEntrada = criarDataSegura(dados.dataEntrada);
  var ehRetorno = String(dados.ehRetorno || "NÃO").trim().toUpperCase();
  var protocoloOrigem = normalizarProtocoloRoteiro_(dados.protocoloOrigem);
  var observacao = String(dados.observacao || "").trim();

  if (!protocolo) throw new Error("Informe o número do protocolo.");
  if (!tipo) throw new Error("Informe o tipo do protocolo/vistoria.");
  if (!dataEntrada) throw new Error("Informe uma data de entrada válida.");

  if (prioridade === "EVENTO TEMPORARIO") prioridade = "EVENTO TEMPORÁRIO";
  if (["NORMAL","CORONEL","ATRASADA","EVENTO TEMPORÁRIO"].indexOf(prioridade) === -1) {
    throw new Error("Prioridade inválida.");
  }

  if (ehRetorno !== "SIM") {
    ehRetorno = "NÃO";
    protocoloOrigem = "";
  } else if (!protocoloOrigem) {
    throw new Error("Para retorno, informe o protocolo de origem.");
  }

  if (aba.getLastRow() >= 2) {
    var existentes = aba.getRange(2,1,aba.getLastRow()-1,1).getDisplayValues();
    for (var i=0; i<existentes.length; i++) {
      if (normalizarProtocoloRoteiro_(existentes[i][0]) === protocolo) {
        throw new Error("O protocolo " + protocolo + " já está cadastrado na aba PROTOCOLOS (linha " + (i+2) + ").");
      }
    }
  }

  var linha = aba.getLastRow()+1;
  aba.getRange(linha,1,1,10).setValues([[
    protocolo,tipo,prioridade,regiao,situacao,
    Utilities.formatDate(dataEntrada, "America/Sao_Paulo", "dd/MM/yyyy"),
    ehRetorno,protocoloOrigem,observacao,"PENDENTE"
  ]]);
  aba.getRange(linha,1).setBackground(corPrioridadeRoteiro_(prioridade)).setFontWeight("bold");

  return {sucesso:true, mensagem:"Protocolo " + protocolo + " cadastrado com sucesso.", linha:linha};
}

function obterProtocolosRoteiro(token, statusFiltro) {
  exigirPerfil_(token, ["CONFERENCIA"]);

  var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PROTOCOLOS");
  if (!aba || aba.getLastRow() < 2) return {sucesso:true, registros:[], total:0};

  var dados = aba.getRange(2,1,aba.getLastRow()-1,10).getDisplayValues();
  var filtro = String(statusFiltro || "PENDENTE").trim().toUpperCase();
  var registros = [];

  dados.forEach(function(r, idx) {
    var status = String(r[9] || "PENDENTE").trim().toUpperCase();
    if (filtro !== "TODOS" && status !== filtro) return;
    registros.push({
      linha:idx+2,
      protocolo:String(r[0]||"").trim(),
      tipo:String(r[1]||"").trim(),
      prioridade:String(r[2]||"NORMAL").trim().toUpperCase(),
      regiao:String(r[3]||"").trim(),
      situacao:String(r[4]||"").trim(),
      dataEntrada:String(r[5]||"").trim(),
      ehRetorno:String(r[6]||"").trim(),
      protocoloOrigem:String(r[7]||"").trim(),
      observacao:String(r[8]||"").trim(),
      status:status
    });
  });

  var ordem = {"CORONEL":1,"ATRASADA":2,"EVENTO TEMPORÁRIO":3,"EVENTO TEMPORARIO":3,"NORMAL":4};
  registros.sort(function(a,b){
    var pa = ordem[a.prioridade] || 9, pb = ordem[b.prioridade] || 9;
    if (pa !== pb) return pa-pb;
    return String(a.protocolo).localeCompare(String(b.protocolo),"pt-BR");
  });

  return {sucesso:true, registros:registros, total:registros.length};
}


// ==========================================================
// ROTEIRO DE VISTORIAS — IMPORTAÇÃO SIAPI / DISTRIBUIÇÃO
// ==========================================================

function obterDadosMapaSetoresPadrao_() {
  return [["BALNEÁRIO GRAN VIENA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["CAMPUS UNIVERSITÁRIO DA UFG (CAMPUS SAMAMBAIA)","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["CHÁCARA SHANGRI-LÁ","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["CHÁCARAS BOM RETIRO","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["CHÁCARAS CALIFÓRNIA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["CHÁCARAS DE RECREIO SAMAMBAIA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["CHÁCARAS NOSSA SENHORA DA PIEDADE","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["CHÁCARAS RETIRO (PRÓXIMO À UNILEVER)","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["CHÁCARAS RIO BRANCO","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["CONDOMÍNIO BOUGAINVILLE","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["CONDOMÍNIO CIDADE UNIVERSITÁRIA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["CONDOMÍNIO PARQUE DOS CISNES","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["CONDOMÍNIO SAMAMBAIA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["CONDOMÍNIO SHANGRI-LÁ","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["CONDOMÍNIO VENEZA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["CONJUNTO PARQUE DOS EUCALIPTOS","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["CONJUNTO RESIDENCIAL CAMPUS","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["CONJUNTO RESIDENCIAL SÃO GERALDO","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["DISTRITO DE VILA RICA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["FAZENDA CAVEIRAS","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["FAZENDA CRIMÉIA CAVEIRAS","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["FAZENDA RETIRO","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["JARDIM BALNEÁRIO MEIA PONTE","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["JARDIM BOM JESUS","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["JARDIM DIAMANTINA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["JARDIM IPÊ","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["LOTEAMENTO ESTÂNCIAS VISTA ALEGRE","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["LOTEAMENTO GRANJAS BRASIL","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["LOTEAMENTO MANSÕES GOIANAS","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["LOTEAMENTO MORADA DOS SONHOS","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["LOTEAMENTO RESIDENCIAL VILLAGIO TOSCANA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["LOTEAMENTO SHANGRY-LÁ","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["PANORAMA PARQUE","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["PARQUE BALNEÁRIO","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["PARQUE DAS FLORES","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["PARQUE DAS FLORES COMPLEMENTO","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["PARQUE DAS NAÇÕES","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["PRIVÊ RESIDENCIAL ITANHANGÁ","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL ALICE BARBOSA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL ALICE BARBOSA EXTENSÃO","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL ALICE BARBOSA I","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL ANTÔNIO BARBOSA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL ANTÔNIO CARLOS PIRES","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL ATALAIA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL BALNEÁRIO","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL BELA GOIÂNIA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL DAS ACÁCIAS","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL DOS IPÊS","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL FELICIDADE","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL FLORES DO PARQUE","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL FREI GALVÃO","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL HUMAITÁ","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL ITÁLIA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL JOSÉ VIANDELI","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL LICARDINO NEY","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL MORADA DO BOSQUE","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL MORADA DO IPÊ","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL NOSSA MORADA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL ORLANDO MORAIS","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL PORTAL DA MATA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL PRIVÊ ELZA FRONZA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL PRIVÊ ELZA FRONZA 2ª ETAPA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["RESIDENCIAL VALE DA SERRA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["SETOR ASA BRANCA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["SETOR GOIÂNIA 2","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["SETOR URIAS MAGALHÃES","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["SETOR URIAS MAGALHÃES II","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["SÍTIO DE RECREIO MANSÕES BERNARDO SAYÃO","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["SÍTIO RECREIO PARAÍSO TROPICAL","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["SÍTIO RECREIO PINDORAMA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["SÍTIOS DE RECREIO CARAÍBAS","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["SÍTIOS DE RECREIO MANSÕES DO CAMPUS","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["VILA ITATIAIA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["VILA JARDIM POMPEIA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["VILA JARDIM SÃO JUDAS TADEU","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["VILA MARIA ROSA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["VILA RORIZ","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["VILA SANTA CRUZ","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["VILLAGE ATALAIA","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["VILLAGE CASA GRANDE","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["ZONA RURAL DA 2ª AISP (ÁREA NOROESTE DE GOIÂNIA)","BALNEÁRIO","QUARTA","CAT - 1º BBM/BALNEÁRIO ATÉ SÃO JUDAS"],
    ["SETOR AEROPORTO","CENTRO","SEGUNDA/QUINTA","CAT - 1º BBM/CENTRO"],
    ["SETOR CENTRAL","CENTRO","SEGUNDA/QUINTA","CAT - 1º BBM/CENTRO"],
    ["SETOR OESTE","CENTRO","SEGUNDA/QUINTA","CAT - 1º BBM/CENTRO"],
    ["ALTO DA GLÓRIA","MARISTA","SEGUNDA/QUINTA","CAT - 1º BBM/MARISTA ATÉ JARDIM GOIÁS"],
    ["CONJUNTO VILA ISABEL","MARISTA","SEGUNDA/QUINTA","CAT - 1º BBM/MARISTA ATÉ JARDIM GOIÁS"],
    ["JARDIM GOIÁS","MARISTA","SEGUNDA/QUINTA","CAT - 1º BBM/MARISTA ATÉ JARDIM GOIÁS"],
    ["LOTEAMENTO AREIÃO I","MARISTA","SEGUNDA/QUINTA","CAT - 1º BBM/MARISTA ATÉ JARDIM GOIÁS"],
    ["SETOR AREIÃO II","MARISTA","SEGUNDA/QUINTA","CAT - 1º BBM/MARISTA ATÉ JARDIM GOIÁS"],
    ["SETOR MARISTA","MARISTA","SEGUNDA/QUINTA","CAT - 1º BBM/MARISTA ATÉ JARDIM GOIÁS"],
    ["VILA MARIA JOSÉ","MARISTA","SEGUNDA/QUINTA","CAT - 1º BBM/MARISTA ATÉ JARDIM GOIÁS"],
    ["VILA SÃO JOÃO","MARISTA","SEGUNDA/QUINTA","CAT - 1º BBM/MARISTA ATÉ JARDIM GOIÁS"],
    ["CHÁCARAS RETIRO (PRÓXIMO AO CLUBE JAÓ)","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["CONDOMÍNIO PARQUE IPÊ","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["DISTRITO AEROPORTUÁRIO DE GOIÂNIA (AEROPORTO INTERNACIONAL SANTA GENOVEVA)","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["FAZENDA COLINA","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["JARDIM GUANABARA","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["JARDIM GUANABARA II","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["JARDIM GUANABARA III","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["JARDIM GUANABARA IV","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["LOTEAMENTO MANSÕES PEREIRA","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["RESIDENCIAL ALDEIA DO VALE","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["RESIDENCIAL ELIZENE SANTANA","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["RESIDENCIAL JOÃO PAULO II","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["RESIDENCIAL VALE DOS SONHOS","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["RESIDENCIAL VALE DOS SONHOS II","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["SANTA GENOVEVA","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["SANTA GENOVEVA II","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["SETOR JAÓ","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["SETOR NEGRÃO DE LIMA","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["SETOR RASMUSSEM","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["VILA DOS OFICIAIS","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["VILA MILITAR","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["VILA YATE","GUANABARA","QUARTA","CAT - 1º BBM/NEGRÃO DE LIMA ATÉ GUANABARA"],
    ["ÁGUA BRANCA","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["ARUANÃ PARK","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["CHÁCARAS BOA SORTE","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["CHÁCARAS BOTAFOGO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["CHÁCARAS JARDIM CALIFÓRNIA","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["CHÁCARAS SANTA BÁRBARA","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["CHÁCARAS SÃO FRANCISCO DE ASSIS","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["CHÁCARAS SÃO SILVESTRE","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["COLÔNIA SANTA MARTA","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["CONJUNTO CAIÇARA","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["CONJUNTO RESIDENCIAL ARUANÃ I","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["CONJUNTO RESIDENCIAL ARUANÃ II","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["CONJUNTO RESIDENCIAL ARUANÃ III","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["CONJUNTO RESIDENCIAL PALMARES","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["CONJUNTO RIVIERA","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["FAZENDA PLANÍCIE PETRÓPOLIS","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["JARDIM ABAPORU","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["JARDIM BRASIL","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["JARDIM CALIFÓRNIA","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["JARDIM CALIFÓRNIA INDUSTRIAL","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["JARDIM CALIFÓRNIA PARQUE INDUSTRIAL","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["JARDIM CONQUISTA","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["JARDIM DAS AROEIRAS","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["JARDIM DOM FERNANDO I","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["JARDIM DOM FERNANDO II","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["JARDIM INGÁ","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["JARDIM LAGEADO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["JARDIM MARIA HELENA","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["JARDIM NOVO MUNDO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["JARDIM NOVO MUNDO EXTENSÃO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["JARDIM NOVO MUNDO II","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["LOTEAMENTO GRANDE RETIRO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["LOTEAMENTO TUPYNAMBÁ DOS REIS","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["PARK LOZANDES","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["PARQUE DAS AMENDOEIRAS","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["PARQUE DAS AMENDOEIRAS I","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["PARQUE DAS AMENDOEIRAS II","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RECANTO DAS MINAS GERAIS","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL ARUANÃ","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL ARUANÃ COMPLEMENTO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL BELO HORIZONTE","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL BELO HORIZONTE COMPLEMENTO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL CARLOS DE FREITAS","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL CLÉA BORGES","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL COSTA PARANHOS","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL HAVAÍ EXTENSÃO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL HAWAÍ","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL LAJEADO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL LUCY PINHEIRO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL MAR DEL PLATA","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL OLINDA","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL OURO PRETO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL PARQUE IMPERIAL","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL PAULO ESTRELA","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL PORTAL PETRÓPOLIS","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL PORTUGUÊS","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL RIO JORDÃO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL SÃO LEOPOLDO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL SÃO LEOPOLDO COMPLEMENTO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL SENADOR PARANHOS","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL SONHO DOURADO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL VALE DO ARAGUAIA","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["RESIDENCIAL VILLAGE CAMPOS VERDES","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["SANTO HILÁRIO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["SANTO HILÁRIO EXPANSÃO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["SANTO HILÁRIO II","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["SETOR MORAIS","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["SÍTIO DE RECREIO IPÊ","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["VILA ÁGUA BRANCA","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["VILA BANDEIRANTES","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["VILA CONCÓRDIA","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["VILA MARIA LUÍZA","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["VILA MARTINS","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["VILA MARTINS EXTENSÃO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["VILA MATILDE","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["VILA PARQUE SANTA MARIA","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["VILA PEDROSO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["VILA PEDROSO EXTENSÃO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["VILA ROMANA","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["VILA SANTA MARIA","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["VILA SANTA MARIA EXTENSÃO","NOVO MUNDO","QUARTA","CAT - 1º BBM/NOVO MUNDO E REGIÃO"],
    ["CONJUNTO RESIDENCIAL YARA","RODOVIÁRIA","QUARTA","CAT - 1º BBM/RODOVIÁRIA"],
    ["GRANJA AGRÍCOLA JACIREMA","RODOVIÁRIA","QUARTA","CAT - 1º BBM/RODOVIÁRIA"],
    ["SETOR CRIMÉIA LESTE","RODOVIÁRIA","QUARTA","CAT - 1º BBM/RODOVIÁRIA"],
    ["SETOR CRIMÉIA OESTE","RODOVIÁRIA","QUARTA","CAT - 1º BBM/RODOVIÁRIA"],
    ["SETOR MARECHAL RONDON (FAMA)","RODOVIÁRIA","QUARTA","CAT - 1º BBM/RODOVIÁRIA"],
    ["SETOR NORTE FERROVIÁRIO","RODOVIÁRIA","QUARTA","CAT - 1º BBM/RODOVIÁRIA"],
    ["SETOR NORTE FERROVIÁRIO II","RODOVIÁRIA","QUARTA","CAT - 1º BBM/RODOVIÁRIA"],
    ["SETOR NOVA VILA","RODOVIÁRIA","QUARTA","CAT - 1º BBM/RODOVIÁRIA"],
    ["VILA FRÓES","RODOVIÁRIA","QUARTA","CAT - 1º BBM/RODOVIÁRIA"],
    ["VILA JARAGUÁ","RODOVIÁRIA","QUARTA","CAT - 1º BBM/RODOVIÁRIA"],
    ["VILA MEGALE","RODOVIÁRIA","QUARTA","CAT - 1º BBM/RODOVIÁRIA"],
    ["VILA MONTICELLI","RODOVIÁRIA","QUARTA","CAT - 1º BBM/RODOVIÁRIA"],
    ["VILA SÃO LUÍZ","RODOVIÁRIA","QUARTA","CAT - 1º BBM/RODOVIÁRIA"],
    ["BAIRRO NAO IDENTIFICADO","RURAL/NÃO IDENTIFICADO","","CAT - 1º BBM/RURAL E NÃO IDENTIFICADO"],
    ["ZONA RURAL DA 3ª AISP (ÁREA NORTE DE GOIÂNIA)","RURAL/NÃO IDENTIFICADO","","CAT - 1º BBM/RURAL E NÃO IDENTIFICADO"],
    ["ZONA RURAL DA 5ª AISP (ÁREA OESTE DE GOIÂNIA)","RURAL/NÃO IDENTIFICADO","","CAT - 1º BBM/RURAL E NÃO IDENTIFICADO"],
    ["ZONA RURAL DA 7ª AISP (ÁREA LESTE DE GOIÂNIA)","RURAL/NÃO IDENTIFICADO","","CAT - 1º BBM/RURAL E NÃO IDENTIFICADO"],
    ["ELÍSIOS CAMPOS","UNIV/SUL","SEGUNDA/QUINTA","CAT - 1º BBM/UNIVERSITÁRIO ATÉ ST. SUL"],
    ["FELIZ","UNIV/SUL","SEGUNDA/QUINTA","CAT - 1º BBM/UNIVERSITÁRIO ATÉ ST. SUL"],
    ["JARDIM MOEMA","UNIV/SUL","SEGUNDA/QUINTA","CAT - 1º BBM/UNIVERSITÁRIO ATÉ ST. SUL"],
    ["PARQUE INDUSTRIAL DE GOIÂNIA","UNIV/SUL","SEGUNDA/QUINTA","CAT - 1º BBM/UNIVERSITÁRIO ATÉ ST. SUL"],
    ["SETOR LESTE UNIVERSITÁRIO","UNIV/SUL","SEGUNDA/QUINTA","CAT - 1º BBM/UNIVERSITÁRIO ATÉ ST. SUL"],
    ["SETOR LESTE VILA NOVA","UNIV/SUL","SEGUNDA/QUINTA","CAT - 1º BBM/UNIVERSITÁRIO ATÉ ST. SUL"],
    ["SETOR SUL","UNIV/SUL","SEGUNDA/QUINTA","CAT - 1º BBM/UNIVERSITÁRIO ATÉ ST. SUL"],
    ["VILA COLEMAR NATAL E SILVA","UNIV/SUL","SEGUNDA/QUINTA","CAT - 1º BBM/UNIVERSITÁRIO ATÉ ST. SUL"],
    ["VILA MORAIS","UNIV/SUL","SEGUNDA/QUINTA","CAT - 1º BBM/UNIVERSITÁRIO ATÉ ST. SUL"],
    ["VILA OSWALDO ROSA","UNIV/SUL","SEGUNDA/QUINTA","CAT - 1º BBM/UNIVERSITÁRIO ATÉ ST. SUL"],
    ["VILA SANTA ISABEL","UNIV/SUL","SEGUNDA/QUINTA","CAT - 1º BBM/UNIVERSITÁRIO ATÉ ST. SUL"],
    ["VILA VIANA","UNIV/SUL","SEGUNDA/QUINTA","CAT - 1º BBM/UNIVERSITÁRIO ATÉ ST. SUL"],
    ["ANDREIA CRISTINA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["CELINA PARK","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["CONDOMÍNIO DAS ESMERALDAS","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["CONDOMÍNIO DOS DOURADOS","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["CONDOMÍNIO ELDORADO","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["CONDOMÍNIO MARLENE","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["CONDOMÍNIO PRIVÊ DAS OLIVEIRAS","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["CONJUNTO BALIZA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["CONJUNTO HABITACIONAL MADRE GERMANA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["CONJUNTO HABITACIONAL MADRE GERMANA II","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["CONJUNTO RESIDENCIAL MONTE CARLO","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["FAZENDA DOURADOS","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["GARAVELO","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["GARAVELO B","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["JARDIM CARAVELAS","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["JARDIM ELI FORTE","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["JARDIM ELI FORTE COMPLEMENTO","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["JARDIM GARDÊNIA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["JARDIM IPANEMA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["JARDIM ITAIPÚ","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["JARDIM PRESIDENTE EXTENSÃO","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["JARDIM PRESIDENTE EXTENSÃO I","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["JARDIM SÔNIA MARIA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["JARDIM TANCREDO NEVES","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["JARDINS LISBOA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["JARDINS MADRI","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["JARDINS MADRI COMPLEMENTO","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["LOTEAMENTO ALPHAVILLE RESIDENCIAL","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["MADRE GERMANA II - EXTENSÃO","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["MOINHO DOS VENTOS","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["QUINTA DO RIO DOURADOS","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL ACRÓPOLE","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL ACRÓPOLE II","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL ALPHAVILLE","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL ANA CLARA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL AQUÁRIOS","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL AQUÁRIOS II","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL BARCELONA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL CAMPOS DOURADOS","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL CANADÁ","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL CARIBE","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL CENTER VILLE","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL DOM RAFAEL","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL ELDORADO","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL ELDORADO EXPANSÃO","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL ELI FORTE","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL ELI FORTE EXTENSÃO","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL ESPANHA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL FIDÉLIS","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL FLÓRIDA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL FORTEVILLE","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL FORTEVILLE EXTENSÃO","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL GRANVILLE","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL ITAIPÚ","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL ITAIPÚ I","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL KATIA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL PONTA NEGRA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL PORTAL DO ORIENTE","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL PORTAL SANTA RITA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL PORTO DOURADO","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL PORTO SEGURO","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL REAL CONQUISTA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL RECANTO DAS EMAS","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL RIO VERDE","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL SANTA FÉ","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL SANTA FÉ I","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL SEVILHA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL SOLAR BOUGAINVILLE","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL TALISMÃ","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL TALISMÃ I","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RESIDENCIAL VEREDA DOS BURITIS","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["RIO FORMOSO","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SANTA RITA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR AMIM CAMARGO","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR ANDREIA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR CRISTINA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR DOS DOURADOS","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR GRAJAÚ","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR INDUSTRIAL II","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR MARIA CELESTE","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR ORIENTVILLE","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR QUINTA DOS SONHOS","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR SANTA RITA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR SANTA RITA II","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR SANTA RITA III","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR SANTA RITA IV","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR SANTA RITA V","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR SANTA RITA VI","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR SANTA RITA VII","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR SANTA RITA VIII","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR TANCREDO NEVES","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR TRÊS MARIAS","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR TRÊS MARIAS I","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR ULISSES GUIMARÃES","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["VILA LUCIANA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["VILA SANTA RITA ACRÉSCIMO","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["VILA SANTA RITA 5ª ETAPA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["VILLAGE VENEZA","ANEL VIÁRIO","TERÇA","CAT - 2º BBM/ANEL VIÁRIO"],
    ["SETOR CAMPINAS","CAMPINAS","TERÇA","CAT - 2º BBM/CAMPINAS"],
    ["SETOR COIMBRA","CAMPINAS","TERÇA","CAT - 2º BBM/CAMPINAS"],
    ["SETOR DOS FUNCIONÁRIOS","CAMPINAS","TERÇA","CAT - 2º BBM/CAMPINAS"],
    ["AEROVIÁRIO","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["CHÁCARAS MARIA DILCE","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["CONJUNTO RESIDENCIAL PADRE PELÁGIO","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["ESPLANADA DO ANICUNS","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["GRANJA CRUZEIRO DO SUL","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["ITAMARACÁ EXTENSÃO","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["JARDIM GRAMADO","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["JARDIM GRAMADO I","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["JARDIM GRAMADO II","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["JARDIM SANTA CECÍLIA","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["JARDIM XAVIER","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["RESIDENCIAL BETHEL","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["RESIDENCIAL GUAREMA","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["RESIDENCIAL HUGO DE MORAES","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["RESIDENCIAL HUGO DE MORAES 1ª ETAPA","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["RESIDENCIAL HUGO DE MORAES 2ª ETAPA","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["RESIDENCIAL HUGO DE MORAES 3ª ETAPA","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["RESIDENCIAL ITAMARACÁ","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["RESIDENCIAL ITAMARACÁ I","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["RESIDENCIAL MIRANTE","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["RESIDENCIAL MORUMBI","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["RESIDENCIAL PERIM","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["SETOR CENTRO OESTE","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["SETOR GENTIL MEIRELLES","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["SETOR PERIM","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["SETOR PERIM CONTINUAÇÃO","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["SETOR PROGRESSO","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["SETOR SÃO JOSÉ","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["SETOR SEVENE","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA ABAJÁ","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA CLEMENTE","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA CRISTINA","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA CRISTINA CONTINUAÇÃO","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA CRISTINA EXTENSÃO","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA FERNANDES","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA IRANY","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA ISAURA","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA ISAURA EXTENSÃO","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA JACARÉ","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA MARIA DILCE","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA NOSSA SENHORA APARECIDA","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA OFUGI","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA PARAÍSO","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA PERDIZ","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA SANTA HELENA","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA SANTANA","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA SÃO FRANCISCO","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA SÃO JOSÉ COMPLEMENTO","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA SÃO JOSÉ EXTENSÃO","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA SÃO PAULO","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA VERA CRUZ","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA VIANDELI","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["VILA XAVIER","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["ZONA INDUSTRIAL PEDRO ABRÃO","CAMPINAS PERIFERIA","TERÇA","CAT - 2º BBM/CAMPINAS PERIFERIA"],
    ["CIDADE JARDIM","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["CONJUNTO GUADALAJARA","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["CONJUNTO MORADA NOVA","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["CONJUNTO RESIDENCIAL RODOVIÁRIO","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["CONJUNTO ROMILDO FERREIRA DO AMARAL","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["GRANJA SANTOS DUMONT","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["INDUSTRIAL MOOCA","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["JARDIM ANA LÚCIA","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["LOTEAMENTO SANTA TEREZINHA","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["NOSSA SENHORA DE FÁTIMA","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["RESIDENCIAL MANHATTAN","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["RODOVIÁRIO","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["SETOR CASTELO BRANCO","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["SETOR SOL NASCENTE","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["SETOR SUDOESTE","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA ADÉLIA","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA ADÉLIA I E III","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA ADÉLIA II","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA AGUIAR","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA ALPES","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA ALVORADA","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA AMERICANO DO BRASIL","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA ANCHIETA","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA AURORA","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA AURORA OESTE","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA BELA","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA BETHEL","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA BOA SORTE","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA CANAÃ","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA LUCY","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA MAUÁ","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA MOOCA","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA MOOCA COMPLEMENTO","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA NOVA CANAÃ","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA SANTA EFIGÊNIA","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA SANTA RITA","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA SANTA TEREZA","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA SANTO AFONSO","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["VILA TEÓFILO NETO","CIDADE JARDIM","TERÇA","CAT - 2º BBM/CIDADE JARDIM"],
    ["BOA VISTA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["CAPUAVA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["CAPUAVA RESIDENCIAL PRIVÊ","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["CHÁCARAS DE RECREIO SÃO JOAQUIM","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["CHÁCARAS HELOU","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["CHÁCARAS MANSÕES ROSA DE OURO","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["CHÁCARAS PARQUE TREMENDÃO","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["CONDOMÍNIO AERÓDROMO ZEZÉ ALVES FERREIRA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["CONDOMÍNIO RESIDENCIAL ALTO DA BOA VISTA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["CONJUNTO PRIMAVERA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["CONJUNTO PRIMAVERA EXTENSÃO","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["CONJUNTO RESIDENCIAL CAMPO BELO","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["CONJUNTO RESIDENCIAL TERRA NOVA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["DA VITÓRIA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["DA VITÓRIA ÁREA III","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["FAZENDA CAVEIRAS AERÓDROMO","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["FAZENDA JOÃO VAZ","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["FAZENDA SÃO DOMINGOS","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["FLORESTA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["JARDIM COLORADO","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["JARDIM COLORADO EXTENSÃO","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["JARDIM COLORADO I","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["JARDIM COLORADO II","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["JARDIM COLORADO SUL","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["JARDIM CURITIBA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["JARDIM CURITIBA II","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["JARDIM CURITIBA III","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["JARDIM CURITIBA IV","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["JARDIM DAS HORTÊNCIAS","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["JARDIM FONTE NOVA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["JARDIM FONTE NOVA I","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["JARDIM LAGO AZUL","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["JARDIM LIBERDADE","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["JARDIM NOVA ESPERANÇA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["JARDIM PRIMAVERA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["JARDIM PRIMAVERA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["JARDIM VISTA BELA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["PARQUE AERONÁUTICO ANTÔNIO SEBBA FILHO (AEROCLUBE DE GOIÂNIA)","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["PARQUE MARACANÃ","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RECREIO MORADA DO SOL","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RECREIO PANORAMA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL ALFA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL ANGLO","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL BARRAVENTO","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL BARRAVENTO COMPLEMENTO","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL BRISAS DA MATA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL CARLA CRISTINA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL FLORES DO CERRADO","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL FONTE DAS ÁGUAS","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL FORTALEZA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL GREEN PARK","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL JARDIM BELVEDERE","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL JARDIM BELVEDERE EXTENSÃO","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL JARDIM HELOU","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL MANSÕES PARAÍSO","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL MARINGÁ","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL PARK SOLAR","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL PAULO PACHECO","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL PRIVÊ NORTE","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL RECANTO DO BOSQUE","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL RECREIO PANORAMA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL RECREIO PANORAMA EXTENSÃO","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL SOLAR VILLE","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["RESIDENCIAL TERRA NOVA II","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["SÃO CARLOS","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["SÃO DOMINGOS","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["SETOR ALTO DO VALE","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["SETOR CÂNDIDA DE MORAIS","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["SETOR EMPRESARIAL","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["SETOR ESTRELA DALVA","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["SETOR MARABÁ","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["SETOR MARABÁ EXTENSÃO","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["SETOR MORADA DO SOL","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["SETOR NOROESTE","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["SETOR NOVO PLANALTO","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["SETOR PARQUE TREMENDÃO","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["SETOR PARQUE TREMENDÃO II","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["SETOR PARQUE TREMENDÃO III","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["SETOR SÃO JOAQUIM","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["SÍTIOS DE RECREIO DOS BANDEIRANTES","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["SÍTIOS SÃO DOMINGOS","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["VILA FINSOCIAL","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["VILA JOÃO VAZ","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["VILA MUTIRÃO I","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["VILA MUTIRÃO II","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["VILA MUTIRÃO III","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["VILA MUTIRÃO IV","N. INHUMAS","SEXTA","CAT - 2º BBM/NOROESTE INHUMAS"],
    ["CHÁCARAS COIMBRA","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["CHÁCARAS MARINGÁ","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["CONDOMÍNIO DO LAGO","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["CONDOMÍNIO DO LAGO 2ª ETAPA","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["CONDOMÍNIO DO LAGO 3ª ETAPA","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["CONJUNTO VERA CRUZ","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["CONJUNTO VERA CRUZ II","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["CONJUNTO VERA CRUZ III","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["CONJUNTO VERA CRUZ IV","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["CONJUNTO VERA CRUZ V","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["CONJUNTO VERA CRUZ VI","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["CONJUNTO VERA CRUZ VII","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["FAZENDA SÃO JOSÉ","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["IPIRANGA","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["JARDIM BONANZA","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["JARDIM CLARISSA","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["JARDIM IMPERIAL","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["JARDIM LEBLON","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["JARDIM LEBLON II","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["JARDIM NOVO PETRÓPOLIS","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["JARDIM PAMPULHA","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["JARDIM PETRÓPOLIS","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["JARDIM REAL","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["JARDIM REAL EXTENSÃO","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["JARDIM SÃO JOSÉ","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["LOTEAMENTO ÁGUA AZUL","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["LOTEAMENTO TROPICAL VILLE","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["PARQUE BOM JESUS","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["PARQUE BURITI","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["PARQUE ELDORADO OESTE","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["PARQUE ELDORADO OESTE EXTENSÃO","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["PARQUE INDUSTRIAL PAULISTA","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL ANA MORAES","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL ANICUNS","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL BERTIM BELCHIOR","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL BERTIM BELCHIOR II","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL CIDADE VERDE","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL DEZOPI","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL JARDIM LEBLON","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL JARDINS DO CERRADO 1","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL JARDINS DO CERRADO 10","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL JARDINS DO CERRADO 11","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL JARDINS DO CERRADO 2","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL JARDINS DO CERRADO 3","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL JARDINS DO CERRADO 4","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL JARDINS DO CERRADO 5","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL JARDINS DO CERRADO 6","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL JARDINS DO CERRADO 7","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL JARDINS DO CERRADO 8","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL JARDINS DO CERRADO 9","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL JUNQUEIRA","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL LÍRIOS DO CAMPO","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL LONDON PARK","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL MENDANHA","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL MONTE PASCOAL","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL MONTE PASCOAL II","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL MUNDO NOVO 3","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL NOVA AURORA","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL PARQUE MENDANHA","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL PARQUE MENDANHA - CONDOMÍNIO PORTAL DO SOL MENDANHA","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL PETRÓPOLIS","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL PILAR DOS SONHOS","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL PORTINARI","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL PRIMAVERA","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL RECANTO DAS GARÇAS","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL SAN MARINO","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL SANTA EFIGÊNIA","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL SÃO BERNARDO","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL SERRA AZUL I","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL SERRA AZUL II","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL TEMPO NOVO","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL YTAPUÃ","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL 14 BIS","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["RESIDENCIAL 14 BIS EXTENSÃO","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["SÃO FRANCISCO","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["SETOR BARRA DA TIJUCA","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["SETOR DAS NAÇÕES","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["SETOR DAS NAÇÕES EXTENSÃO","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["SETOR MAYSA","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["SETOR MAYSA EXTENSÃO","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["SETOR SANTOS DUMONT","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["VILA REGINA","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["VILLAGE MARINGÁ","N. TRINDADE","SEXTA","CAT - 2º BBM/NOROESTE TRINDADE"],
    ["ARAGUAIA PARK","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CAROLINA PARQUE","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CAROLINA PARQUE COMPLEMENTO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CAROLINA PARQUE EXTENSÃO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CENTRO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CHÁCARA SOLANGE PARQUE","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CHÁCARA SOLANGE PARQUE II","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CHÁCARAS ANHANGUERA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CHÁCARAS BURITIS","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CHÁCARAS CIDADE POMPEU","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CHÁCARAS SALINOS","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CHÁCARAS SANTA RITA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CHÁCARAS SÃO JOSÉ","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CONDOMÍNIO ANHANGUERA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CONDOMÍNIO JARDIM DAS OLIVEIRAS","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CONDOMÍNIO JARDIM DAS OLIVEIRAS II","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CONDOMÍNIO RESIDENCIAL SANTA RITA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CONDOMÍNIO RIO BRANCO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CONDOMÍNIO SANTA RITA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CONDOMÍNIO SANTA RITA 2ª ETAPA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CONDOMÍNIO SANTA RITA 3ª ETAPA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CONDOMÍNIO SANTA RITA 4ª ETAPA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CONDOMÍNIO SANTA RITA 5ª ETAPA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CONDOMÍNIO SANTA RITA 6ª ETAPA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CONDOMÍNIO SANTA RITA 7ª ETAPA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CONDOMÍNIO SANTA RITA 8ª ETAPA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CONDOMÍNIO SANTA RITA 9ª ETAPA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CONJUNTO ARCO-ÍRIS","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CONJUNTO CIDADE NOVA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CONJUNTO JOSÉ MENDONÇA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CONJUNTO PABLO DE VASCONCELOS","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["CONJUNTO SÃO CUSTÓDIO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["DANIELLA PARK","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["DESMEMBRAMENTO BOA VISTA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["DISTRITO DE POSSELÂNDIA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["DISTRITO DE POSSELÂNDIA - ZONA RURAL","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["FAZENDA SALINOS","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["FAZENDA SANTA RITA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["GOIÁ","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["GOIÁ II","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["GOIÁ II COMPLEMENTO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["GOIÁ III","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["GOIÁ IV","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["JARDIM ALPHAVILLE","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["JARDIM ARITANA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["JARDIM BOTÂNICO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["JARDIM DAS ROSAS","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["JARDIM IMPERIAL","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["JARDIM ITARUMÃ","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["JARDIM MARQUES DE ABREU","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["JARDIM MIRABEL","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["JARDIM NOVA ABADIA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["LORENA PARK","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["LORENA PARK EXTENSÃO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["LOTEAMENTO CAMPOS ELÍSEOS","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["LOTEAMENTO SOLANGE PARK","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["LOTEAMENTO SOLANGE PARQUE COMPLEMENTO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["LOTEAMENTO SOLANGE PARQUE EXTENSÃO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["LOTEAMENTO SOLANGE PARQUE II","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["LOTEAMENTO SOLANGE PARQUE III","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["LOTEAMENTO TROPICAL VERDE","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["PARQUE DAS PAINEIRAS I","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["PARQUE DAS PAINEIRAS II ETAPA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["PARQUE DAS PAINEIRAS III ETAPA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["PARQUE DAS PAINEIRAS IV ETAPA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["PARQUE GOIÁ CONDOMÍNIO CLUBE","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["PARQUE INDUSTRIAL JOÃO BRÁZ","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["PARQUE INDUSTRIAL JOÃO BRÁZ 2","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["PARQUE IZABEL","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["PARQUE OESTE INDUSTRIAL","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["PARQUE OESTE INDUSTRIAL EXTENSÃO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["PARQUE OESTE INDUSTRIAL PROLONGAMENTO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["PARQUE PARAÍSO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["PARQUE SANTA RITA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["PARQUE SOLAR SANTA RITA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RECREIO DO FUNCIONÁRIO PÚBLICO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL BEATRIZ NASCIMENTO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL BRASIL CENTRAL","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL BUENA VISTA I","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL BUENA VISTA II","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL BUENA VISTA III","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL BUENA VISTA IV","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL DELLA PENNA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL DELLA PENNA EXTENSÃO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL DORI","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL GOIÂNIA SUL","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL GOIÂNIA VIVA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL GOYAZ PARK","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL JARDIM FLORITA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL LUANA PARK","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL LUANA PARK CONTINUAÇÃO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL NUNES DE MORAIS 1ª ETAPA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL NUNES DE MORAIS 2ª ETAPA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL NUNES DE MORAIS 3ª ETAPA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL ORTEGAL","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL PARQUE OESTE","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL PORTO SEGURO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL SANTA RITA 4ª ETAPA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL SÃO MARCOS","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL VALE DO SOL","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL VILLAGE SANTA RITA I","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL VILLAGE SANTA RITA II","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL VILLAGE SANTA RITA III","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL VILLAGE SANTA RITA IV","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["RESIDENCIAL VITÓRIA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["SETOR CENTRAL","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["SETOR DELTA VILLAGE","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["SETOR DOM FELIPE","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["SETOR SANTA BÁRBARA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["SETOR SOLAR SANTA RITA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["SÍTIO DE RECREIO GARAVELO - RESIDENCIAL MARATÁ","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["SOLANGE PARK II","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["SOLANGE PARK III","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["SOLANGE PARQUE I","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["VILA ABADIA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["VILA BOA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["VILA GOIANY","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["VILA JOÃO PEDRO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["VILA NOSSA SENHORA DA GUIA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["VILA NOSSA SENHORA DO PERPÉTUO SOCORRO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["VILA RIZZO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["VILA SOCORRO","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["VILLAGE SANTA RITA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["VILLAR BAVIERA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["ZONA INDUSTRIAL E DE SERVIÇO III","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["ZONA INDUSTRIAL EXPANSÃO URBANA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["ZONA RURAL","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["ZONA RURAL","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["ZONA RURAL DA 4ª AISP (ÁREA SUDOESTE DE GOIÂNIA)","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["ZONA URBANA","PARQUE INDUSTRIAL","TERÇA","CAT - 2º BBM/PARQUE OESTE INDUSTRIAL"],
    ["JARDIM AMÉRICA","JARDIM AMÉRICA","SEXTA","CAT - 8º BBM/JARDIM AMÉRICA"],
    ["NOVA SUÍÇA","BUENO","SEGUNDA/QUINTA","CAT - 8º BBM/NOVA SUÍÇA E BUENO"],
    ["SETOR BUENO","BUENO","SEGUNDA/QUINTA","CAT - 8º BBM/NOVA SUÍÇA E BUENO"],
    ["ALTO DA GLÓRIA III","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["ANHANGUERA","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["CAPUAVA RESIDENCIAL PRIVÊ","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["CAROLINA PARQUE","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["CONJUNTO RESIDENCIAL CACHOEIRA DOURADA","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["JARDIM ATLÂNTICO","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["JARDIM EUROPA","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["JARDIM FLORENÇA","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["JARDIM GOIÁS ÁREA I","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["JARDIM PLANALTO","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["JARDIM PRESIDENTE","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["JARDIM VILA BOA","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["PARQUE ANHANGUERA","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["PARQUE ANHANGUERA II","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["PRIVÊ ATLÂNTICO","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["RESIDENCIAL FLAMINGO","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["SETOR DOS AFONSOS","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["SETOR FAIÇALVILLE","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["SETOR NOVO HORIZONTE","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["SETOR UNIÃO","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["VILA DIVINO PAI ETERNO","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["VILA REZENDE","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["VILA ROSA","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["VILA SÃO TOMÁZ","NOVO HORIZONTE","TERÇA","CAT - 8º BBM/NOVO HORIZONTE E REGIÃO"],
    ["GOIÁ SETOR VELOSO","P. AMAZÔNIA","SEXTA","CAT - 8º BBM/PARQUE AMAZÔNIA E SERRINHA"],
    ["PARQUE AMAZÔNIA","P. AMAZÔNIA","SEXTA","CAT - 8º BBM/PARQUE AMAZÔNIA E SERRINHA"],
    ["SETOR SERRINHA","P. AMAZÔNIA","SEXTA","CAT - 8º BBM/PARQUE AMAZÔNIA E SERRINHA"],
    ["SETOR BELA VISTA","PEDRO LUD","QUARTA","CAT - 8º BBM/PEDRO LUDOVICO E BELA VISTA"],
    ["SETOR PEDRO LUDOVICO","PEDRO LUD","QUARTA","CAT - 8º BBM/PEDRO LUDOVICO E BELA VISTA"],
    ["CAMPUS II DA PUC/GO","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["CHÁCARA DO GOVERNADOR","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["CHÁCARAS ALTO DA GLÓRIA","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["CHÁCARAS VAU DAS POMBAS","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["CONDOMÍNIO ALPHAVILLE FLAMBOYANT","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["CONDOMÍNIO ALPHAVILLE FLAMBOYANT RESIDENCIAL ARAGUAIA","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["CONJUNTO ANHANGUERA","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["CONJUNTO FABIANA","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["FAZENDA BOTAFOGO","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["FAZENDA GAMELEIRA","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["FAZENDA SANTA CRUZ","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["FAZENDA VAU DAS POMBAS","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["HOUSING FLAMBOYANT","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["JARDIM BELA VISTA","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["JARDIM DA LUZ","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["JARDIM DAS ESMERALDAS","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["JARDIM MARILIZA","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["JARDIM SANTO ANTÔNIO","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["JARDINS AMSTERDÃ","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["JARDINS ATENAS","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["JARDINS FRANÇA (CONDOMÍNIO PARK HENEDINA JUNGMANN)","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["JARDINS ITÁLIA","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["JARDINS MILÃO","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["JARDINS MUNIQUE","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["JARDINS PARIS","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["JARDINS VALÊNCIA","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["JARDINS VERONA","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["LOTEAMENTO PORTAL DO SOL I","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["LOTEAMENTO PORTAL DO SOL II","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["PARQUE ACALANTO","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["PARQUE ATHENEU","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["PARQUE CIDADE","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["PARQUE DAS LARANJEIRAS","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["PARQUE DAS LARANJEIRAS ACRÉSCIMO","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["PARQUE FLAMBOYANT","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["PARQUE SANTA CRUZ","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["RESIDENCIAL ARCO VERDE","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["RESIDENCIAL BRISAS DO CERRADO","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["RESIDENCIAL GOIÂNIA GOLFE CLUBE","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["RESIDENCIAL PRIVÊ DOS GIRASSÓIS","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["RESIDENCIAL RECANTO DOS BURITIS","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["RESIDENCIAL VALE DAS BRISAS","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["RESIDENCIAL VILLE DE FRANCE","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["SETOR NOSSA SENHORA DA SAÚDE - PROLONGAMENTO","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["SETOR VALE DAS POMBAS","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["VILA ALTO DA GLÓRIA","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["VILA JARDIM VITÓRIA","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["VILA JARDIM VITÓRIA II","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["VILA LEGIONÁRIAS","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"],
    ["VILA REDENÇÃO","ATHENEU","QUARTA","CAT - 8º BBM/PQ. ATHENEU E REGIÃO"]];
}

function obterRegioesRoteiro_() {
  return [
    "BALNEÁRIO ATÉ SÃO JUDAS",
    "CENTRO",
    "MARISTA ATÉ JARDIM GOIÁS",
    "NEGRÃO DE LIMA ATÉ GUANABARA",
    "NOVO MUNDO",
    "RODOVIÁRIA",
    "RURAL/NÃO IDENTIFICADO",
    "UNIV/SUL",
    "ANEL VIÁRIO",
    "CAMPINAS",
    "CAMPINAS PERIFERIA",
    "CIDADE JARDIM",
    "N. INHUMAS",
    "N. TRINDADE",
    "PQ. Oeste Industrial",
    "JARDIM AMÉRICA",
    "NOVA SUIÇA E BUENO",
    "NOVO HORIZONTE",
    "P. AMAZÔNIA E SERRINHA",
    "PEDRO LUD E BELA VISTA",
    "ATHENEU"
  ];
}

function normalizarRegiaoOficial_(valor) {
  var s = String(valor || "").trim().toUpperCase();
  var aliases = {
    "BALNEÁRIO":"BALNEÁRIO ATÉ SÃO JUDAS",
    "BALNEARIO":"BALNEÁRIO ATÉ SÃO JUDAS",
    "MARISTA":"MARISTA ATÉ JARDIM GOIÁS",
    "GUANABARA":"NEGRÃO DE LIMA ATÉ GUANABARA",
    "NEGRÃO DE LIMA":"NEGRÃO DE LIMA ATÉ GUANABARA",
    "NEGRAO DE LIMA":"NEGRÃO DE LIMA ATÉ GUANABARA",
    "BUENO":"NOVA SUIÇA E BUENO",
    "NOVA SUIÇA":"NOVA SUIÇA E BUENO",
    "NOVA SUICA":"NOVA SUIÇA E BUENO",
    "P. AMAZÔNIA":"P. AMAZÔNIA E SERRINHA",
    "P. AMAZONIA":"P. AMAZÔNIA E SERRINHA",
    "PEDRO LUD":"PEDRO LUD E BELA VISTA",
    "PARQUE INDUSTRIAL":"PQ. Oeste Industrial",
    "PARQUE OESTE INDUSTRIAL":"PQ. Oeste Industrial",
    "PQ. OESTE INDUSTRIAL":"PQ. Oeste Industrial",
    "PQ OESTE INDUSTRIAL":"PQ. Oeste Industrial"
  };
  return aliases[s] || String(valor || "").trim().toUpperCase();
}

function garantirMapaSetoresRoteiro_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("MAPA_SETORES");

  if (!aba) aba = ss.insertSheet("MAPA_SETORES");

  var cab = ["BAIRRO/SETOR", "REGIÃO", "DIA_PREFERENCIAL", "OBSERVAÇÃO"];

  prepararCabecalhoLeve_(aba,cab,{primeiroVazio:true,somenteInicial:true,cor:"#5C1D1D",centralizar:true,redimensionar:true});

  // A versão anterior criava a aba vazia. Se ela ainda estiver vazia,
  // carrega automaticamente toda a relação oficial enviada do SIAPI.
  if (aba.getLastRow() <= 1) {
    var dados = obterDadosMapaSetoresPadrao_();
    if (dados.length) aba.getRange(2,1,dados.length,4).setValues(dados);
  }

  return aba;
}


// Militares que permanecem no cadastro geral, mas não devem aparecer
// como opções de vistoriador nas telas de Vistorias.
var NOMES_EXCLUIDOS_VISTORIAS_ = [
  "ALESSANDRA",
  "ALINE",
  "CARVALHO",
  "DE CASTRO",
  "EVANGELINA",
  "FABRICIO",
  "FERNANDES",
  "FLAVIA",
  "IARA",
  "JANICE",
  "JULIO",
  "LEIDIANE",
  "LUCIENE",
  "MARCELLA",
  "MARIA",
  "NERI",
  "SABOYA",
  "SAVIA",
  "SOLANGE"
];

function normalizarNomeFiltroVistorias_(valor) {
  var s = String(valor || "");
  // Trata entidades que podem ter vindo de colagens/HTML, inclusive &#x20;.
  s = s.replace(/&#x20;|&#32;|&nbsp;/gi, " ");
  try {
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch (e) {}
  return s
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function nomeExcluidoDasVistorias_(nomeBase, nomeCompleto) {
  var candidatos = [nomeBase, nomeCompleto]
    .map(normalizarNomeFiltroVistorias_)
    .filter(Boolean);

  return candidatos.some(function(nome) {
    return NOMES_EXCLUIDOS_VISTORIAS_.some(function(excluido) {
      var alvo = normalizarNomeFiltroVistorias_(excluido);
      // O nome de guerra costuma vir sozinho, mas esta comparação também
      // protege casos em que posto/graduação venha junto no texto.
      return nome === alvo || nome.split(" ").slice(-1)[0] === alvo;
    });
  });
}

function prepararRoteiroSiapi(token) {
  exigirPerfil_(token, ["CONFERENCIA"]);
  inicializarEstruturaRoteiroVistorias(token);
  garantirMapaSetoresRoteiro_();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("Cadastro") || ss.getSheetByName("DADOS");
  var militares = [];
  var mapaFuncoesPessoal = obterMapaFuncoesPessoal_();

  if (aba && aba.getLastRow() >= 2) {
    var numCols = aba.getLastColumn();
    var headers = aba.getRange(1, 1, 1, numCols).getDisplayValues()[0];
    var idxRg = -1, idxNome = -1, idxNomeGuerra = -1, idxPosto = -1, idxId = -1;

    headers.forEach(function(h, i) {
      var s = String(h || "").trim().toUpperCase();

      if (idxRg === -1 && (s === "RG" || s.indexOf("RG") !== -1)) idxRg = i;
      if (idxNomeGuerra === -1 && s.indexOf("GUERRA") !== -1) idxNomeGuerra = i;
      if (idxPosto === -1 && (s.indexOf("POSTO") !== -1 || s.indexOf("GRAD") !== -1)) idxPosto = i;
      if (idxId === -1 && (s.indexOf("ID MILITAR") !== -1 || s.indexOf("ID_MILITAR") !== -1)) idxId = i;
      if (idxNome === -1 && (s === "NOME" || s.indexOf("NOME COMPLETO") !== -1)) idxNome = i;
    });

    var valores = aba.getRange(2, 1, aba.getLastRow() - 1, numCols).getDisplayValues();

    valores.forEach(function(r) {
      var rg = idxRg >= 0 ? String(r[idxRg] || "").trim() : "";
      var nomeGuerra = idxNomeGuerra >= 0 ? String(r[idxNomeGuerra] || "").trim() : "";
      var nomeCompleto = idxNome >= 0 ? String(r[idxNome] || "").trim() : "";
      var posto = idxPosto >= 0 ? String(r[idxPosto] || "").trim() : "";
      var idMilitar = idxId >= 0 ? String(r[idxId] || "").trim() : "";

      var nomeBase = nomeGuerra || idMilitar || nomeCompleto;

      if (!nomeBase && !rg) return;

      // Se posto não estiver em coluna própria, tenta extrair do identificador.
      if (!posto && nomeBase) {
        var parsed = extrairPostoENome(nomeBase);
        posto = parsed.posto || "";
        nomeBase = parsed.nome || nomeBase;
      }

      // A partir da V65, a fonte oficial dos vistoriadores é
      // Pessoal > Funções. Um GESTOR também pode ser VISTORIADOR.
      var funcoesMilitar = mapaFuncoesPessoal[rg] ? mapaFuncoesPessoal[rg].funcoes : [];
      if (funcoesMilitar.indexOf("VISTORIADOR") === -1) return;

      militares.push({
        rg: rg,
        nome: nomeBase,
        nomeCompleto: nomeCompleto,
        postoGrad: posto
      });
    });
  }

  militares.sort(function(a, b) {
    return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
  });

  return {
    sucesso: true,
    militares: militares,
    regioes: obterRegioesRoteiro_()
  };
}
function normalizarChaveTextoRoteiro_(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function obterMapaSetoresRoteiro_() {
  var aba = garantirMapaSetoresRoteiro_();
  var mapa = {};

  if (aba.getLastRow() < 2) return mapa;

  var dados = aba.getRange(2,1,aba.getLastRow()-1,4).getDisplayValues();
  dados.forEach(function(r) {
    var bairro = normalizarChaveTextoRoteiro_(r[0]);
    if (!bairro) return;

    var item = {
      regiao: normalizarRegiaoOficial_(r[1]),
      diaPreferencial: String(r[2] || "").trim(),
      observacao: String(r[3] || "").trim()
    };

    if (!mapa[bairro]) mapa[bairro] = [];
    mapa[bairro].push(item);
  });

  return mapa;
}


function obterHistoricoPorProtocoloRoteiro_(protocolos) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var mapa = {};

  function add(protocolo, reg) {
    var chave = normalizarProtocoloRoteiro_(protocolo);
    if (!chave) return;

    if (!mapa[chave]) mapa[chave] = [];
    mapa[chave].push(reg);
  }

  var unicos = {};

  (Array.isArray(protocolos) ? protocolos : []).forEach(function(p) {
    p = normalizarProtocoloRoteiro_(p);
    if (p) unicos[p] = true;
  });

  var lista = Object.keys(unicos);
  if (!lista.length) return mapa;

  var hist = ss.getSheetByName("HISTORICO_VISTORIAS");
  var linhasHist =
    localizarLinhasProtocolosRoteiro_(hist, 3, lista);

  var dadosHist = lerLinhasProtocolosRoteiro_(hist, linhasHist, 17);
  lista.forEach(function(p) {
    (linhasHist[p] || []).forEach(function(linha) {
      var r =
        dadosHist[linha];

      add(r[2], {
        data:r[1] || r[0] || "",
        militar1:r[6] || "",
        militar2:r[8] || "",
        status:r[12] || "",
        resultado:r[13] || ""
      });
    });
  });

  var roteiro = ss.getSheetByName("ROTEIRO_VISTORIAS");
  var linhasRoteiro =
    localizarLinhasProtocolosRoteiro_(roteiro, 2, lista);

  var dadosRoteiro = lerLinhasProtocolosRoteiro_(roteiro, linhasRoteiro, 12);
  lista.forEach(function(p) {
    (linhasRoteiro[p] || []).forEach(function(linha) {
      var r =
        dadosRoteiro[linha];

      add(r[1], {
        data:r[0] || "",
        militar1:r[3] || "",
        militar2:r[5] || "",
        status:r[10] || "",
        resultado:""
      });
    });
  });

  return mapa;
}


function interpretarDataAndamentoSiapi_(valor) {
  var s = String(valor || "").trim();
  if (!s) return null;

  var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) {
    var d1 = new Date(parseInt(m[3],10), parseInt(m[2],10)-1, parseInt(m[1],10), 12, 0, 0);
    return isNaN(d1.getTime()) ? null : d1;
  }

  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) {
    var d2 = new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10), 12, 0, 0);
    return isNaN(d2.getTime()) ? null : d2;
  }

  return null;
}

function andamentoMaisDe20DiasNaCopia_(dataAndamento, dataCopia) {
  var dAnd = interpretarDataAndamentoSiapi_(dataAndamento);
  var dCop = interpretarDataAndamentoSiapi_(dataCopia);

  if (!dAnd || !dCop) return false;

  var diff = Math.floor((dCop.getTime() - dAnd.getTime()) / 86400000);
  return diff > 20;
}


function analisarDadosSiapiRoteiro(registros, token) {
  exigirPerfil_(token, ["CONFERENCIA"]);

  registros = Array.isArray(registros) ? registros : [];
  var mapaSetores = obterMapaSetoresRoteiro_();

  var protocolosConsulta = registros.map(function(item) {
    return normalizarProtocoloRoteiro_(item && item.protocolo);
  }).filter(function(p) {
    return !!p;
  });

  var mapaHist =
    obterHistoricoPorProtocoloRoteiro_(protocolosConsulta);

  var dataCopiaSiapi = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy");

  var saida = registros.map(function(item) {
    var protocolo = normalizarProtocoloRoteiro_(item.protocolo);
    var bairro = String(item.bairro || "").trim();
    var setores = mapaSetores[normalizarChaveTextoRoteiro_(bairro)] || [];
    var setor = setores.length ? setores[0] : {};
    var hist = mapaHist[protocolo] || [];
    var ultimo = hist.length ? hist[hist.length - 1] : null;

    var andamento = normalizarChaveTextoRoteiro_(item.ultimoAndamento);
    var vistoriado = String(item.vistoriadoPorSiapi || "").trim();
    var classificacao = "PRIMEIRA / A VERIFICAR";

    if (
      andamento.indexOf("BAIXA AUTOMATICA") !== -1 ||
      andamento.indexOf("DOCUMENT") !== -1 ||
      andamento.indexOf("ARQUIV") !== -1
    ) {
      classificacao = "DOCUMENTAÇÃO / BAIXA";
    } else if (
      andamento.indexOf("SOLICITOU RETORNO") !== -1 ||
      andamento.indexOf("RETORNO") !== -1 ||
      hist.length > 0 ||
      vistoriado !== ""
    ) {
      classificacao = "RETORNO PROVÁVEL";
    }

    var equipeAnterior = "";
    if (ultimo) {
      equipeAnterior = [ultimo.militar1, ultimo.militar2]
        .filter(function(x){ return String(x || "").trim() !== ""; })
        .join(" / ");
    }
    if (!equipeAnterior && vistoriado) equipeAnterior = vistoriado;

    return {
      protocolo: protocolo,
      servico: String(item.servico || "").trim(),
      bairro: bairro,
      dataAndamento: String(item.dataAndamento || "").trim(),
      dataCopiaSiapi: dataCopiaSiapi,
      andamentoMais20Dias: andamentoMaisDe20DiasNaCopia_(item.dataAndamento, dataCopiaSiapi),
      ultimoAndamento: String(item.ultimoAndamento || "").trim(),
      razaoSocial: String(item.razaoSocial || "").trim(),
      divisao: String(item.divisao || "").trim(),
      vistoriadoPorSiapi: vistoriado,
      area: String(item.area || "").trim(),
      regiao: String(setor.regiao || "").trim(),
      diaPreferencial: String(setor.diaPreferencial || "").trim(),
      regioesPossiveis: setores.map(function(s){ return s.regiao; }).filter(function(v,i,a){ return v && a.indexOf(v) === i; }),
      classificacao: classificacao,
      historicoQuantidade: hist.length,
      equipeAnterior: equipeAnterior
    };
  });

  return {sucesso:true, registros:saida};
}

function analisarESalvarDadosSiapiRoteiro(registros, dataRoteiro, token) {
  var analisado = analisarDadosSiapiRoteiro(registros, token);

  var lista =
    analisado && Array.isArray(analisado.registros)
      ? analisado.registros
      : [];

  var salvo =
    salvarRascunhosRoteiro(lista, dataRoteiro, token);

  return {
    sucesso:true,
    registros:lista,
    registrosTela:(salvo && salvo.itensTela) || [],
    salvos:(salvo && salvo.salvos) || 0,
    novos:(salvo && salvo.novos) || 0,
    reativados:(salvo && salvo.reativados) || 0,
    jaRascunho:(salvo && salvo.jaRascunho) || 0,
    distribuidosMesmoDia:
      (salvo && salvo.distribuidosMesmoDia) || 0,
    avisosOutrasDatas:
      (salvo && salvo.avisosOutrasDatas) || []
  };
}



function garantirAbasEssenciaisRoteiroRapido_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var roteiro = ss.getSheetByName("ROTEIRO_VISTORIAS");
  if (!roteiro) {
    roteiro = ss.insertSheet("ROTEIRO_VISTORIAS");
    roteiro.getRange(1,1,1,26).setValues([[
      "DATA","PROTOCOLO","RG_1","MILITAR_1","RG_2","MILITAR_2","REGIÃO","PERÍODO","VTR","TIPO_SERVIÇO","STATUS","OBSERVAÇÃO","PRIORIDADE","SITUAÇÃO_VTR","BAIRRO","RAZÃO_SOCIAL","DIVISÃO","ÁREA","ÚLTIMO_ANDAMENTO_SIAPI","DATA_ANDAMENTO_SIAPI","PERÍODO_2","ORIGEM_PENDENCIA_ID","ORIGEM_SOLICITACAO_ID","VISTORIADO_POR_SIAPI","DATA_COPIA_SIAPI","ANDAMENTO_MAIS_20_DIAS"
    ]]);
  }

  var hist = ss.getSheetByName("HISTORICO_VISTORIAS");
  if (!hist) {
    hist = ss.insertSheet("HISTORICO_VISTORIAS");
    hist.getRange(1,1,1,17).setValues([[
      "DATA_REGISTRO","DATA_VISTORIA","PROTOCOLO","TIPO","PRIORIDADE","RG_1","MILITAR_1","RG_2","MILITAR_2","REGIÃO","PERÍODO","VTR","STATUS","RESULTADO","OBSERVAÇÃO","USUÁRIO_RG","USUÁRIO_NOME"
    ]]);
  }

  return {roteiro:roteiro, hist:hist};
}

function mapaAfastamentosPorDataRoteiro_(itens) {
  var porData = {};
  (itens || []).forEach(function(item) {
    var d = criarDataSegura(item.dataRoteiro);
    if (!d) return;
    var dataTexto = formatarDataTexto(d);
    if (porData[dataTexto]) return;

    var mapa = {};
    obterAfastamentosVistoriadoresNaData_(dataTexto).forEach(function(a) {
      var rg = String(a.rg || "").trim();
      if (rg) mapa[rg] = a;
    });
    porData[dataTexto] = mapa;
  });
  return porData;
}

function finalizarRascunhosRoteiroRapido_(itens) {
  itens = Array.isArray(itens) ? itens : [];
  if (!itens.length) return;

  var aba = garantirEstruturaRascunhoRoteiro_();
  if (aba.getLastRow() < 2) return;

  var protocolos = [];
  var alvos = {};
  itens.forEach(function(item) {
    var d = criarDataSegura(item.dataRoteiro);
    var p = normalizarProtocoloRoteiro_(item.protocolo);
    if (!d || !p) return;
    var dataTxt = formatarDataTexto(d);
    alvos[dataTxt + "|" + p] = true;
    if (protocolos.indexOf(p) === -1) protocolos.push(p);
  });

  var linhas = localizarLinhasProtocolosRoteiro_(aba, 2, protocolos);
  var dados = lerLinhasProtocolosRoteiro_(aba, linhas, 21);
  var enderecos = [];
  protocolos.forEach(function(p) {
    (linhas[p] || []).forEach(function(linha) {
      var r = dados[linha];
      var dataTxt = String(r[0] || "").trim();
      if (alvos[dataTxt + "|" + p] &&
          String(r[20] || "").trim().toUpperCase() === "RASCUNHO") {
        enderecos.push("U" + linha);
      }
    });
  });
  if (enderecos.length) aba.getRangeList(enderecos).setValue("LANÇADO");
}

function atualizarStatusOrigemRoteiroRapido_(itens) {
  itens = Array.isArray(itens) ? itens : [];
  if (!itens.length) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pend = ss.getSheetByName("PENDENCIAS_VISTORIAS");
  var sol = ss.getSheetByName("SOLICITACOES_VISTORIA");

  itens.forEach(function(item) {
    var pendId = String(item.origemPendenciaId || "").trim();
    if (pendId && pend && pend.getLastRow() >= 2) {
      var achadosP = pend.getRange(2,1,pend.getLastRow()-1,1)
        .createTextFinder(pendId).matchEntireCell(true).findAll();

      if (achadosP.length) {
        var linhaP = achadosP[0].getRow();
        pend.getRange(linhaP,5).setValue("REDISTRIBUÍDA");

        var origemAtual = String(pend.getRange(linhaP,4).getDisplayValue() || "").trim().toUpperCase();
        if (origemAtual === "CADASTRO MANUAL") {
          pend.getRange(linhaP,11).setValue(String(item.regiao || "").trim());
          pend.getRange(linhaP,13).setValue(String(item.observacao || "").trim());
          pend.getRange(linhaP,16).setValue(String(item.tipoServico || "").trim());
          pend.getRange(linhaP,17).setValue(String(item.bairro || "").trim());
          pend.getRange(linhaP,18).setValue(String(item.ultimoAndamentoSiapi || "").trim());
          pend.getRange(linhaP,19).setValue(String(item.razaoSocial || "").trim());
          pend.getRange(linhaP,20).setValue(String(item.divisao || "").trim());
          pend.getRange(linhaP,22).setValue(String(item.area || "").trim());
        }
      }
    }

    var solId = String(item.origemSolicitacaoId || "").trim();
    if (solId && sol && sol.getLastRow() >= 2) {
      var achadosS = sol.getRange(2,1,sol.getLastRow()-1,1)
        .createTextFinder(solId).matchEntireCell(true).findAll();
      if (achadosS.length) sol.getRange(achadosS[0].getRow(),10).setValue("DISTRIBUÍDA");
    }
  });
}

function marcarSincronizacaoRoteiroPendente_() {
  PropertiesService.getScriptProperties().setProperty(
    "ROTEIRO_SYNC_PENDENTE",
    String(Date.now())
  );
}

function sincronizarRoteiroPendente(token) {
  exigirPerfil_(token, ["CONFERENCIA","ATENDIMENTO","VISTORIADOR","CONSULTA"]);

  var props = PropertiesService.getScriptProperties();
  var pendente = props.getProperty("ROTEIRO_SYNC_PENDENTE");
  if (!pendente) return {sucesso:true, sincronizado:false};

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return {sucesso:true, sincronizado:false, ocupado:true};

  try {
    pendente = props.getProperty("ROTEIRO_SYNC_PENDENTE");
    if (!pendente) return {sucesso:true, sincronizado:false};

    gerarPlanilhaDiariaVistoriadores_();
    props.deleteProperty("ROTEIRO_SYNC_PENDENTE");
    return {sucesso:true, sincronizado:true};
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function lancarDistribuicaoRoteiroSiapi(itens, token) {
  var sessao = exigirPerfil_(token, ["CONFERENCIA"]);
  itens = Array.isArray(itens) ? itens : [];
  if (!itens.length) throw new Error("Nenhum protocolo selecionado.");

  var abas = garantirAbasEssenciaisRoteiroRapido_();
  var roteiro = abas.roteiro;
  var hist = abas.hist;

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var protocolos = [];
    itens.forEach(function(item) {
      var p = normalizarProtocoloRoteiro_(item.protocolo);
      if (p && protocolos.indexOf(p) === -1) protocolos.push(p);
    });

    // Procura somente os protocolos selecionados, não a planilha inteira.
    var linhasPorProtocolo = localizarLinhasProtocolosRoteiro_(roteiro, 2, protocolos);
    var existentes = {};
    var dadosExistentes = lerLinhasProtocolosRoteiro_(roteiro, linhasPorProtocolo, 11);

    protocolos.forEach(function(p) {
      (linhasPorProtocolo[p] || []).forEach(function(linha) {
        var r = dadosExistentes[linha];
        if (String(r[10] || "").trim().toUpperCase() === "CANCELADO") return;
        existentes[String(r[0] || "").trim() + "|" + p] = true;
      });
    });

    // Afastamentos são carregados uma única vez por data do lote.
    var afastamentosPorData = mapaAfastamentosPorDataRoteiro_(itens);

    var linhasRoteiro = [];
    var linhasHist = [];
    var notas = [];
    var itensLancados = [];
    var itensFinalizarRascunho = [];
    var ignorados = [];
    var protocolosProcessados = [];
    var agora = dataHoraSaoPauloTexto_();

    itens.forEach(function(item) {
      var d = criarDataSegura(item.dataRoteiro);
      if (!d) throw new Error("Data do roteiro inválida.");

      var dataTexto = formatarDataTexto(d);
      var protocolo = normalizarProtocoloRoteiro_(item.protocolo);
      var chave = dataTexto + "|" + protocolo;

      var mapaAfastados = afastamentosPorData[dataTexto] || {};
      var rg1 = String(item.rg1 || "").trim();
      var rg2 = String(item.rg2 || "").trim();

      if (rg1 && mapaAfastados[rg1]) {
        var a1 = mapaAfastados[rg1];
        throw new Error((a1.militar || item.militar1 || rg1) + " está afastado em " + dataTexto + " (" + a1.motivo + ").");
      }
      if (rg2 && mapaAfastados[rg2]) {
        var a2 = mapaAfastados[rg2];
        throw new Error((a2.militar || item.militar2 || rg2) + " está afastado em " + dataTexto + " (" + a2.motivo + ").");
      }

      // Mesmo se já estiver distribuído, limpa eventual rascunho residual.
      if (existentes[chave]) {
        ignorados.push(protocolo + " já lançado em " + dataTexto);
        itensFinalizarRascunho.push(item);
        protocolosProcessados.push(protocolo);
        return;
      }

      var observacaoUsuario = String(item.observacao || "").trim();

      linhasRoteiro.push([
        dataTexto,
        protocolo,
        rg1,
        String(item.militar1 || "").trim(),
        rg2,
        String(item.militar2 || "").trim(),
        normalizarRegiaoOficial_(item.regiao),
        String(item.periodo || "").trim(),
        String(item.vtr || "").trim(),
        String(item.tipoServico || "").trim(),
        "DISTRIBUÍDO",
        observacaoUsuario,
        String(item.prioridade || "NORMAL").trim(),
        String(item.situacaoVtr || "").trim(),
        String(item.bairro || "").trim(),
        String(item.razaoSocial || "").trim(),
        String(item.divisao || "").trim(),
        String(item.area || "").trim(),
        String(item.ultimoAndamentoSiapi || "").trim(),
        String(item.dataAndamento || "").trim(),
        String(item.periodo2 || "").trim(),
        String(item.origemPendenciaId || "").trim(),
        String(item.origemSolicitacaoId || "").trim(),
        String(item.vistoriadoPorSiapi || "").trim(),
        String(item.dataCopiaSiapi || "").trim(),
        item.andamentoMais20Dias ? "SIM" : "NÃO"
      ]);

      notas.push([observacaoUsuario || ""]);

      linhasHist.push([
        agora,
        dataTexto,
        protocolo,
        String(item.tipoServico || "").trim(),
        "",
        rg1,
        String(item.militar1 || "").trim(),
        rg2,
        String(item.militar2 || "").trim(),
        normalizarRegiaoOficial_(item.regiao),
        String(item.periodo || "").trim(),
        String(item.vtr || "").trim(),
        "DISTRIBUÍDO",
        "",
        observacaoUsuario,
        sessao.rg,
        sessao.nome
      ]);

      existentes[chave] = true;
      itensLancados.push(item);
      itensFinalizarRascunho.push(item);
      protocolosProcessados.push(protocolo);
    });

    if (linhasRoteiro.length) {
      var inicioRoteiro = roteiro.getLastRow() + 1;
      roteiro.getRange(inicioRoteiro,1,linhasRoteiro.length,26).setValues(linhasRoteiro);
      roteiro.getRange(inicioRoteiro,2,notas.length,1).setNotes(notas);

      var inicioHist = hist.getLastRow() + 1;
      hist.getRange(inicioHist,1,linhasHist.length,17).setValues(linhasHist);

      // Mantém consistência entre módulos, mas só nas linhas realmente envolvidas.
      atualizarStatusOrigemRoteiroRapido_(itensLancados);
    }

    // Atualiza somente os rascunhos dos protocolos processados.
    finalizarRascunhosRoteiroRapido_(itensFinalizarRascunho);

    if (linhasRoteiro.length || ignorados.length) {
      marcarSincronizacaoRoteiroPendente_();
    }

    var lancados = linhasRoteiro.length;
    var msg = lancados + " protocolo(s) lançado(s) no roteiro.";
    msg += "\nAs planilhas derivadas serão sincronizadas em segundo plano nas próximas ações.";
    if (ignorados.length) msg += "\n\nNão duplicados:\n- " + ignorados.join("\n- ");

    return {
      sucesso:true,
      mensagem:msg,
      lancados:lancados,
      ignorados:ignorados,
      protocolosProcessados:protocolosProcessados,
      sincronizacaoPendente:(linhasRoteiro.length || ignorados.length) ? true : false
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}


function atualizarPlanilhasRoteiroAposLancamento(token) {
  return sincronizarRoteiroPendente(token);
}

// ==========================================================
// PENDÊNCIAS / NÃO REALIZADAS / SOLICITAÇÕES DO ATENDIMENTO
// ==========================================================

function garantirEstruturaPendenciasRoteiro_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var pend = ss.getSheetByName("PENDENCIAS_VISTORIAS");
  if (!pend) pend = ss.insertSheet("PENDENCIAS_VISTORIAS");

  var hp = [
    "ID","DATA_REGISTRO","PROTOCOLO","ORIGEM","STATUS",
    "DATA_DISTRIBUICAO_ANTERIOR","RG_1","MILITAR_1","RG_2","MILITAR_2",
    "REGIÃO","MOTIVO","OBSERVAÇÃO","USUÁRIO_RG","USUÁRIO_NOME",
    "SERVIÇO","BAIRRO","ANDAMENTO","RAZÃO_SOCIAL","DIVISÃO","VISTORIADO_POR","ÁREA"
  ];
  prepararCabecalhoLeve_(pend,hp,{substituir:true,cor:"#B91C1C"});

  var sol = ss.getSheetByName("SOLICITACOES_VISTORIA");
  if (!sol) sol = ss.insertSheet("SOLICITACOES_VISTORIA");

  var hs = [
    "ID","DATA/HORA","PROTOCOLO","MOTIVO","DATA_LIMITE",
    "SETOR/REGIÃO","OBSERVAÇÃO","RG_ATENDENTE","ATENDENTE","STATUS","RAZÃO_SOCIAL","EVENTO_TEMPORÁRIO"
  ];
  prepararCabecalhoLeve_(sol,hs,{substituir:true,cor:"#1565C0"});

  return {pendencias:pend, solicitacoes:sol};
}


function gerarIdRoteiro_(prefixo) {
  return String(prefixo || "ID") + "-" + Utilities.getUuid();
}


function listarRegioesRoteiro(token) {
  // Usado tanto por Atendimento quanto por Conferência.
  var sessao = obterSessaoAcesso_(token);
  if (!sessao) throw new Error("Sessão expirada. Entre novamente.");
  garantirMapaSetoresRoteiro_();
  return {sucesso:true, regioes:obterRegioesRoteiro_()};
}


function salvarSolicitacaoVistoriaAtendimento(dados, token) {
  var sessao = exigirPerfil_(token, ["ATENDIMENTO","CONFERENCIA"]);
  dados = dados || {};

  var protocolo = normalizarProtocoloRoteiro_(dados.protocolo);
  var motivo = String(dados.motivo || "").trim().toUpperCase();
  var setor = normalizarRegiaoOficial_(dados.setor);
  var razaoSocial = String(dados.razaoSocial || "").trim();
  var eventoTemporario = dados.eventoTemporario === true;
  var observacao = String(dados.observacao || "").trim();

  if (!protocolo) throw new Error("Informe o protocolo.");
  if (["20 DIAS","A PEDIDO"].indexOf(motivo) === -1) {
    throw new Error("Selecione o motivo: +20 DIAS ou A PEDIDO.");
  }
  if (!setor) throw new Error("Selecione o setor/região.");
  if (!razaoSocial) throw new Error("Informe a Razão Social.");

  var estruturas = garantirEstruturaPendenciasRoteiro_();
  var sol = estruturas.solicitacoes;

  // Evita duas solicitações pendentes para o mesmo protocolo e informa
  // quando, em que horário e por quem a solicitação anterior foi cadastrada.
  if (sol.getLastRow() >= 2) {
    var atuais = sol.getRange(2,1,sol.getLastRow()-1,12).getDisplayValues();

    for (var i=0; i<atuais.length; i++) {
      if (
        normalizarProtocoloRoteiro_(atuais[i][2]) === protocolo &&
        String(atuais[i][9] || "").trim().toUpperCase() === "PENDENTE"
      ) {
        var dataHoraAnterior = String(atuais[i][1] || "").trim() || "data/hora não informada";
        var atendenteAnterior = String(atuais[i][8] || "").trim() || "atendente não identificado";

        throw new Error(
          "Este protocolo já foi cadastrado pelo Atendimento.\n\n" +
          "Protocolo: " + protocolo + "\n" +
          "Cadastrado em: " + dataHoraAnterior + "\n" +
          "Por: " + atendenteAnterior
        );
      }
    }
  }

  var agoraTexto = dataHoraSaoPauloTexto_();
  var id = gerarIdRoteiro_("ATD");

  // "20 DIAS" significa que a solicitação já está atrasada há mais de 20 dias.
  // Não é calculado um novo prazo futuro.
  sol.appendRow([
    id, agoraTexto, protocolo, motivo, "", setor, observacao,
    sessao.rg, sessao.nome, "PENDENTE", razaoSocial,
    eventoTemporario ? "SIM" : "NÃO"
  ]);

  return {
    sucesso:true,
    mensagem:"Solicitação de vistoria registrada e enviada para as pendências do Roteiro.",
    id:id
  };
}



function salvarPendenciaManualRoteiro(dados, token) {
  var sessao = exigirPerfil_(token, ["CONFERENCIA"]);
  dados = dados || {};

  var protocolo = normalizarProtocoloRoteiro_(dados.protocolo);
  var regiao = String(dados.regiao || "").trim().toUpperCase();
  var observacao = String(dados.observacao || "").trim();

  if (!protocolo) throw new Error("Informe o protocolo.");

  var est = garantirEstruturaPendenciasRoteiro_();
  var pend = est.pendencias;

  // Não permite duplicar uma pendência ativa do mesmo protocolo.
  if (pend.getLastRow() >= 2) {
    var atuais = pend.getRange(2,1,pend.getLastRow()-1,15).getDisplayValues();

    for (var i=0; i<atuais.length; i++) {
      if (
        normalizarProtocoloRoteiro_(atuais[i][2]) === protocolo &&
        String(atuais[i][4] || "").trim().toUpperCase() === "PENDENTE"
      ) {
        throw new Error("Este protocolo já está na lista de pendências.");
      }
    }
  }

  var id = gerarIdRoteiro_("MANUAL");

  pend.appendRow([
    id,
    dataHoraSaoPauloTexto_(),
    protocolo,
    "CADASTRO MANUAL",
    "PENDENTE",
    "",
    "",
    "",
    "",
    "",
    regiao,
    "CADASTRO MANUAL",
    observacao,
    sessao.rg,
    sessao.nome,
    "",
    "",
    "",
    "",
    "",
    "",
    ""
  ]);

  return {
    sucesso:true,
    mensagem:protocolo + " cadastrado manualmente na lista de pendências.",
    id:id
  };
}



function atualizarPendenciaManualRoteiro(dados, token) {
  exigirPerfil_(token, ["CONFERENCIA"]);
  dados = dados || {};

  var id = String(dados.id || "").trim();
  if (!id) throw new Error("Pendência inválida.");

  var est = garantirEstruturaPendenciasRoteiro_();
  var pend = est.pendencias;

  if (pend.getLastRow() < 2) throw new Error("Pendência não localizada.");

  var vals = pend.getRange(2,1,pend.getLastRow()-1,22).getDisplayValues();

  for (var i=0; i<vals.length; i++) {
    if (String(vals[i][0] || "").trim() !== id) continue;

    var linha = i + 2;
    var origem = String(vals[i][3] || "").trim().toUpperCase();
    var status = String(vals[i][4] || "").trim().toUpperCase();

    if (origem !== "CADASTRO MANUAL") {
      throw new Error("Somente pendências de cadastro manual podem ser editadas por esta função.");
    }
    if (status !== "PENDENTE") {
      throw new Error("Esta pendência não está mais ativa.");
    }

    pend.getRange(linha, 11).setValue(String(dados.regiao || "").trim().toUpperCase());
    pend.getRange(linha, 13).setValue(String(dados.observacao || "").trim());
    pend.getRange(linha, 16).setValue(String(dados.servico || "").trim());
    pend.getRange(linha, 17).setValue(String(dados.bairro || "").trim());
    pend.getRange(linha, 18).setValue(String(dados.andamento || "").trim());
    pend.getRange(linha, 19).setValue(String(dados.razaoSocial || "").trim());
    pend.getRange(linha, 20).setValue(String(dados.divisao || "").trim());
    pend.getRange(linha, 21).setValue(String(dados.vistoriadoPor || "").trim());
    pend.getRange(linha, 22).setValue(String(dados.area || "").trim());

    return {sucesso:true, mensagem:"Dados da pendência atualizados."};
  }

  throw new Error("Pendência não localizada.");
}


function finalizarPendenciaRoteiro(tipo, id, token) {
  exigirPerfil_(token, ["CONFERENCIA"]);

  tipo = String(tipo || "").trim().toLowerCase();
  id = String(id || "").trim();

  if (!id) throw new Error("Registro inválido.");

  var est = garantirEstruturaPendenciasRoteiro_();
  var aba = tipo === "atendimento" ? est.solicitacoes : est.pendencias;
  var colStatus = tipo === "atendimento" ? 10 : 5;

  if (!aba || aba.getLastRow() < 2) {
    throw new Error("Registro não localizado.");
  }

  var qtdCols = tipo === "atendimento" ? 12 : 22;
  var vals = aba.getRange(2,1,aba.getLastRow()-1,qtdCols).getDisplayValues();

  for (var i=0; i<vals.length; i++) {
    if (String(vals[i][0] || "").trim() !== id) continue;

    var statusAtual = String(vals[i][colStatus-1] || "").trim().toUpperCase();

    if (statusAtual === "FINALIZADO") {
      return {sucesso:true, mensagem:"Este protocolo já estava finalizado."};
    }

    aba.getRange(i+2, colStatus).setValue("FINALIZADO");

    return {
      sucesso:true,
      mensagem:"Protocolo finalizado. Ele não aparecerá mais na lista de pendências."
    };
  }

  throw new Error("Registro não localizado.");
}


function buscarProtocolosDistribuidosRoteiro(termo, token) {
  exigirPerfil_(token, ["CONFERENCIA"]);

  termo = normalizarProtocoloRoteiro_(termo);
  if (termo.length < 2) return {sucesso:true, resultados:[]};

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("ROTEIRO_VISTORIAS");
  if (!aba || aba.getLastRow() < 2) return {sucesso:true, resultados:[]};

  var dados = aba.getRange(2,1,aba.getLastRow()-1,Math.max(19,aba.getLastColumn())).getDisplayValues();
  var mapa = {};

  dados.forEach(function(r) {
    var protocolo = normalizarProtocoloRoteiro_(r[1]);
    var status = String(r[10] || "").trim().toUpperCase();
    if (!protocolo || status === "CANCELADO" || protocolo.indexOf(termo) === -1) return;

    // Como percorremos em ordem, sobrescrever mantém a distribuição mais recente.
    mapa[protocolo] = {
      protocolo:protocolo,
      data:r[0] || "",
      militar1:r[3] || "",
      militar2:r[5] || "",
      regiao:r[6] || "",
      periodo:r[7] || "",
      vtr:r[8] || "",
      tipoServico:r[9] || "",
      observacao:r[11] || "",
      prioridade:r[12] || "NORMAL",
      situacaoVtr:r[13] || "",
      bairro:r[14] || ""
    };
  });

  var resultados = Object.keys(mapa).map(function(k){ return mapa[k]; });

  resultados.sort(function(a,b) {
    var ap = a.protocolo.indexOf(termo) === 0 ? 0 : 1;
    var bp = b.protocolo.indexOf(termo) === 0 ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.protocolo.localeCompare(b.protocolo);
  });

  return {sucesso:true, resultados:resultados.slice(0,12)};
}


function registrarVistoriaNaoRealizada(protocolo, token) {
  var sessao = exigirPerfil_(token, ["CONFERENCIA"]);
  protocolo = normalizarProtocoloRoteiro_(protocolo);
  if (!protocolo) throw new Error("Selecione um protocolo.");

  var estruturas = garantirEstruturaPendenciasRoteiro_();
  var pend = estruturas.pendencias;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var roteiro = ss.getSheetByName("ROTEIRO_VISTORIAS");

  if (!roteiro || roteiro.getLastRow() < 2) {
    throw new Error("Não há vistorias distribuídas na base.");
  }

  // Não duplica pendência ativa.
  if (pend.getLastRow() >= 2) {
    var pd = pend.getRange(2,1,pend.getLastRow()-1,15).getDisplayValues();
    for (var p=0; p<pd.length; p++) {
      if (normalizarProtocoloRoteiro_(pd[p][2]) === protocolo &&
          String(pd[p][4] || "").trim().toUpperCase() === "PENDENTE") {
        throw new Error("Este protocolo já está na lista de pendências.");
      }
    }
  }

  var dados = roteiro.getRange(2,1,roteiro.getLastRow()-1,Math.max(19,roteiro.getLastColumn())).getDisplayValues();
  var encontrado = null;

  for (var i=dados.length-1; i>=0; i--) {
    if (normalizarProtocoloRoteiro_(dados[i][1]) === protocolo &&
        String(dados[i][10] || "").trim().toUpperCase() !== "CANCELADO") {
      encontrado = dados[i];
      break;
    }
  }

  if (!encontrado) throw new Error("Protocolo não localizado entre as vistorias distribuídas.");

  var id = gerarIdRoteiro_("NR");
  pend.appendRow([
    id,
    dataHoraSaoPauloTexto_(),
    protocolo,
    "NÃO REALIZADA",
    "PENDENTE",
    encontrado[0] || "",
    encontrado[2] || "",
    encontrado[3] || "",
    encontrado[4] || "",
    encontrado[5] || "",
    encontrado[6] || "",
    "NÃO REALIZADA",
    encontrado[11] || "",
    sessao.rg,
    sessao.nome,
    encontrado[9] || "",
    encontrado[14] || "",
    encontrado[18] || "",
    encontrado[15] || "",
    encontrado[16] || "",
    "",
    encontrado[17] || ""
  ]);


  // Registra o resultado também no histórico, sem apagar a distribuição original.
  var hist = ss.getSheetByName("HISTORICO_VISTORIAS");
  if (hist && hist.getLastRow() >= 2) {
    var hv = hist.getRange(2,1,hist.getLastRow()-1,17).getDisplayValues();
    for (var h=hv.length-1; h>=0; h--) {
      if (normalizarProtocoloRoteiro_(hv[h][2]) === protocolo) {
        hist.getRange(h+2,14).setValue("NÃO REALIZADA");
        break;
      }
    }
  }

  return {
    sucesso:true,
    mensagem:protocolo + " incluído nas pendências para redistribuição.",
    id:id
  };
}


function obterPendenciasRoteiro(token) {
  exigirPerfil_(token, ["CONFERENCIA"]);

  var est = garantirEstruturaPendenciasRoteiro_();
  var vermelhas = [];
  var azuis = [];

  /*
   * IMPORTANTE:
   * Uma vistoria marcada como NÃO REALIZADA continua existindo na
   * ROTEIRO_VISTORIAS como a distribuição original. Isso NÃO significa
   * que a nova pendência já foi redistribuída.
   *
   * Por isso não filtramos mais por PROTOCOLO.
   * Só consideramos consumida a pendência/solicitação cujo ID específico
   * já aparece em uma nova linha ativa de ROTEIRO_VISTORIAS.
   */
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var roteiro = ss.getSheetByName("ROTEIRO_VISTORIAS");
  var pendenciasJaRedistribuidas = {};
  var solicitacoesJaDistribuidas = {};

  if (roteiro && roteiro.getLastRow() >= 2) {
    var rv = roteiro.getRange(
      2,
      1,
      roteiro.getLastRow() - 1,
      Math.max(26, roteiro.getLastColumn())
    ).getDisplayValues();

    rv.forEach(function(r) {
      var status = String(r[10] || "").trim().toUpperCase();
      if (status === "CANCELADO") return;

      // Coluna 22 = ORIGEM_PENDENCIA_ID
      var origemPendenciaId = String(r[21] || "").trim();
      if (origemPendenciaId) {
        pendenciasJaRedistribuidas[origemPendenciaId] = true;
      }

      // Coluna 23 = ORIGEM_SOLICITACAO_ID
      var origemSolicitacaoId = String(r[22] || "").trim();
      if (origemSolicitacaoId) {
        solicitacoesJaDistribuidas[origemSolicitacaoId] = true;
      }
    });
  }

  if (est.pendencias.getLastRow() >= 2) {
    var pd = est.pendencias.getRange(
      2,
      1,
      est.pendencias.getLastRow() - 1,
      22
    ).getDisplayValues();

    pd.forEach(function(r) {
      if (String(r[4] || "").trim().toUpperCase() !== "PENDENTE") return;

      var idPendencia = String(r[0] || "").trim();

      // Só some quando ESTA pendência específica já tiver sido usada
      // em uma nova distribuição.
      if (idPendencia && pendenciasJaRedistribuidas[idPendencia]) return;

      vermelhas.push({
        id:r[0],
        protocolo:r[2],
        origem:r[3],
        status:r[4],
        dataAnterior:r[5],
        militar1:r[7],
        militar2:r[9],
        regiao:r[10],
        motivo:r[11],
        observacao:r[12],
        servico:r[15],
        bairro:r[16],
        andamento:r[17],
        razaoSocial:r[18],
        divisao:r[19],
        vistoriadoPor:r[20],
        area:r[21]
      });
    });
  }

  if (est.solicitacoes.getLastRow() >= 2) {
    var sd = est.solicitacoes.getRange(
      2,
      1,
      est.solicitacoes.getLastRow() - 1,
      12
    ).getDisplayValues();

    sd.forEach(function(r) {
      if (String(r[9] || "").trim().toUpperCase() !== "PENDENTE") return;

      var idSolicitacao = String(r[0] || "").trim();

      // Mesma regra: só desaparece quando a solicitação específica
      // já foi efetivamente distribuída.
      if (idSolicitacao && solicitacoesJaDistribuidas[idSolicitacao]) return;

      azuis.push({
        id:r[0],
        protocolo:r[2],
        motivo:r[3],
        regiao:normalizarRegiaoOficial_(r[5]),
        observacao:r[6],
        atendente:r[8],
        dataCadastro:r[1],
        razaoSocial:r[10],
        eventoTemporario:String(r[11] || "").trim().toUpperCase() === "SIM",
        origem:"ATENDIMENTO"
      });
    });
  }

  return {
    sucesso:true,
    naoRealizadas:vermelhas,
    atendimento:azuis
  };
}


function atualizarStatusOrigemRoteiroEmLote_(itens) {
  itens = Array.isArray(itens) ? itens : [];
  if (!itens.length) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pendIds = {};
  var solIds = {};

  itens.forEach(function(item) {
    if (item.origemPendenciaId) pendIds[String(item.origemPendenciaId)] = item;
    if (item.origemSolicitacaoId) solIds[String(item.origemSolicitacaoId)] = item;
  });

  var pend = ss.getSheetByName("PENDENCIAS_VISTORIAS");
  if (pend && Object.keys(pendIds).length && pend.getLastRow() >= 2) {
    var pCols = Math.max(22, pend.getLastColumn());
    var pVals = pend.getRange(2,1,pend.getLastRow()-1,pCols).getValues();
    var mudouP = false;

    pVals.forEach(function(r) {
      var id = String(r[0] || "");
      var item = pendIds[id];
      if (!item) return;

      r[4] = "REDISTRIBUÍDA";
      var origemAtual = String(r[3] || "").trim().toUpperCase();
      if (origemAtual === "CADASTRO MANUAL") {
        r[10] = String(item.regiao || "").trim();
        r[12] = String(item.observacao || "").trim();
        r[15] = String(item.tipoServico || "").trim();
        r[16] = String(item.bairro || "").trim();
        r[17] = String(item.ultimoAndamentoSiapi || "").trim();
        r[18] = String(item.razaoSocial || "").trim();
        r[19] = String(item.divisao || "").trim();
        r[21] = String(item.area || "").trim();
      }
      mudouP = true;
    });

    if (mudouP) pend.getRange(2,1,pVals.length,pCols).setValues(pVals);
  }

  var sol = ss.getSheetByName("SOLICITACOES_VISTORIA");
  if (sol && Object.keys(solIds).length && sol.getLastRow() >= 2) {
    var sCols = Math.max(12, sol.getLastColumn());
    var sVals = sol.getRange(2,1,sol.getLastRow()-1,sCols).getValues();
    var mudouS = false;

    sVals.forEach(function(r) {
      var id = String(r[0] || "");
      if (!solIds[id]) return;
      r[9] = "DISTRIBUÍDA";
      mudouS = true;
    });

    if (mudouS) sol.getRange(2,1,sVals.length,sCols).setValues(sVals);
  }
}

function atualizarStatusOrigemRoteiro_(item) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (item.origemPendenciaId) {
    var p = ss.getSheetByName("PENDENCIAS_VISTORIAS");
    if (p && p.getLastRow() >= 2) {
      var pv = p.getRange(2,1,p.getLastRow()-1,5).getDisplayValues();
      for (var i=0; i<pv.length; i++) {
        if (String(pv[i][0] || "") === String(item.origemPendenciaId)) {
          var linhaPend = i + 2;

          p.getRange(linhaPend,5).setValue("REDISTRIBUÍDA");

          // Se veio de cadastro manual, guarda também as informações
          // que foram completadas na tela Vistorias do Dia.
          var origemAtual = String(p.getRange(linhaPend,4).getDisplayValue() || "").trim().toUpperCase();
          if (origemAtual === "CADASTRO MANUAL") {
            p.getRange(linhaPend,11).setValue(String(item.regiao || "").trim());
            p.getRange(linhaPend,13).setValue(String(item.observacao || "").trim());
            p.getRange(linhaPend,16).setValue(String(item.tipoServico || "").trim());
            p.getRange(linhaPend,17).setValue(String(item.bairro || "").trim());
            p.getRange(linhaPend,18).setValue(String(item.ultimoAndamentoSiapi || "").trim());
            p.getRange(linhaPend,19).setValue(String(item.razaoSocial || "").trim());
            p.getRange(linhaPend,20).setValue(String(item.divisao || "").trim());
            p.getRange(linhaPend,22).setValue(String(item.area || "").trim());
          }

          break;
        }
      }
    }
  }

  if (item.origemSolicitacaoId) {
    var s = ss.getSheetByName("SOLICITACOES_VISTORIA");
    if (s && s.getLastRow() >= 2) {
      var sv = s.getRange(2,1,s.getLastRow()-1,10).getDisplayValues();
      for (var j=0; j<sv.length; j++) {
        if (String(sv[j][0] || "") === String(item.origemSolicitacaoId)) {
          s.getRange(j+2,10).setValue("DISTRIBUÍDA");
          break;
        }
      }
    }
  }
}


// ==========================================================
// PLANILHA DIÁRIA DOS VISTORIADORES
// A aba ROTEIRO é gerada automaticamente a partir da
// ROTEIRO_VISTORIAS. As datas ficam uma abaixo da outra.
// ==========================================================

function corPrioridadePlanilhaRoteiro_(prioridade, temObservacao) {
  var p = String(prioridade || "").trim().toUpperCase();

  // Evento temporário permanece rosa mesmo quando há observação.
  if (p === "EVENTO TEMPORÁRIO" || p === "EVENTO TEMPORARIO") return "#F062B0";
  if (p === "PEDIDO CEL" || p === "PEDIDO DO CEL" || p === "CORONEL") return "#F4B183";
  if (temObservacao) return "#FF6B6B";
  if (p === "ATRASADA") return "#FF6B6B";

  return "#FFFFFF";
}


function normalizarIdentidadeMilitarRoteiro_(rg, nome) {
  var rgTxt = String(rg || "").trim();
  var soDigitos = rgTxt.replace(/\D/g, "");

  if (soDigitos) {
    return "RG:" + soDigitos;
  }

  return "NOME:" + String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}


function chaveEquipeRoteiroPlanilha_(r) {
  /*
   * EXCLUSIVO DA PLANILHA FÍSICA ROTEIRO:
   * uma única coluna por vistoriador principal no mesmo dia.
   */
  return normalizarIdentidadeMilitarRoteiro_(
    r.rg1,
    r.militar1
  );
}


function chaveEquipeRoteiro_(r) {
  /*
   * Agrupamento operacional da visualização web.
   * Mantém militares + condições operacionais, como na V50.
   */
  return [
    String(r.rg1 || "").trim(),
    String(r.rg2 || "").trim(),
    String(r.periodo || "").trim(),
    String(r.periodo2 || "").trim(),
    String(r.vtr || "").trim(),
    String(r.situacaoVtr || "").trim()
  ].join("|");
}


function adicionarValorUnicoRoteiro_(mapa, valor) {
  valor = String(valor || "").trim();
  if (!valor) return;

  var chave = valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  if (!mapa[chave]) {
    mapa[chave] = valor;
  }
}


function juntarValoresUnicosRoteiro_(mapa) {
  return Object.keys(mapa || {})
    .map(function(k) { return mapa[k]; })
    .filter(Boolean)
    .sort(function(a,b) {
      return String(a).localeCompare(String(b), "pt-BR");
    })
    .join(" / ");
}


var cacheMilitaresRoteiroExecucao_ = null;

function chaveDataRoteiro_(valor) {
  if (valor == null || valor === "") return "";

  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return Utilities.formatDate(valor, "America/Sao_Paulo", "yyyy-MM-dd");
  }

  var s = String(valor || "").trim();

  var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];

  var br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return br[3] + "-" + br[2] + "-" + br[1];

  var d = criarDataSegura(valor);
  return d ? Utilities.formatDate(d, "America/Sao_Paulo", "yyyy-MM-dd") : "";
}

function exibirDataRoteiro_(valor) {
  var chave = chaveDataRoteiro_(valor);
  if (!chave) return "";
  var p = chave.split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
}

function obterMapaMilitaresRoteiro_() {
  if (cacheMilitaresRoteiroExecucao_) return cacheMilitaresRoteiroExecucao_;

  var mapa = {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("Cadastro") || ss.getSheetByName("DADOS");

  if (!aba || aba.getLastRow() < 2) {
    cacheMilitaresRoteiroExecucao_ = mapa;
    return mapa;
  }

  var ncols = aba.getLastColumn();
  var cab = aba.getRange(1,1,1,ncols).getDisplayValues()[0];
  var idxRg = -1, idxPosto = -1, idxNomeGuerra = -1, idxNome = -1, idxId = -1;

  cab.forEach(function(h, i) {
    var s = String(h || "").trim().toUpperCase();
    if (idxRg < 0 && (s === "RG" || s.indexOf("RG") !== -1)) idxRg = i;
    if (idxPosto < 0 && (s.indexOf("POSTO") !== -1 || s.indexOf("GRAD") !== -1)) idxPosto = i;
    if (idxNomeGuerra < 0 && s.indexOf("GUERRA") !== -1) idxNomeGuerra = i;
    if (idxId < 0 && (s.indexOf("ID MILITAR") !== -1 || s.indexOf("ID_MILITAR") !== -1)) idxId = i;
    if (idxNome < 0 && (s === "NOME" || s.indexOf("NOME COMPLETO") !== -1)) idxNome = i;
  });

  var vals = aba.getRange(2,1,aba.getLastRow()-1,ncols).getDisplayValues();

  vals.forEach(function(r) {
    var rg = idxRg >= 0 ? String(r[idxRg] || "").trim() : "";
    if (!rg) return;

    var posto = idxPosto >= 0 ? String(r[idxPosto] || "").trim() : "";
    var guerra = idxNomeGuerra >= 0 ? String(r[idxNomeGuerra] || "").trim() : "";
    var nome = idxNome >= 0 ? String(r[idxNome] || "").trim() : "";
    var idMilitar = idxId >= 0 ? String(r[idxId] || "").trim() : "";

    if (!guerra && idMilitar) {
      var parsed = extrairPostoENome(idMilitar);
      if (!posto) posto = parsed.posto || "";
      guerra = parsed.nome || idMilitar;
    }

    if (!guerra) guerra = nome;

    mapa[rg] = {
      posto:posto,
      guerra:guerra,
      nomeCompleto:nome
    };
  });

  cacheMilitaresRoteiroExecucao_ = mapa;
  return mapa;
}

function montarNomeMilitarRoteiro_(rg, nome) {
  rg = String(rg || "").trim();
  nome = String(nome || "").trim();

  var mapa = obterMapaMilitaresRoteiro_();
  var m = mapa[rg];

  if (m) {
    var guerra = String(m.guerra || nome || rg).trim();
    var posto = String(m.posto || "").trim();
    return posto ? (posto + " " + guerra).trim() : guerra;
  }

  return nome || rg;
}

function gerarPlanilhaDiariaVistoriadores_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var origem = ss.getSheetByName("ROTEIRO_VISTORIAS");
  if (!origem) return;

  var destino = ss.getSheetByName("ROTEIRO");
  if (!destino) destino = ss.insertSheet("ROTEIRO");

  destino.clear();
  destino.clearNotes();
  destino.setHiddenGridlines(true);

  if (origem.getLastRow() < 2) {
    destino.getRange("A1").setValue("Nenhum roteiro lançado.");
    gerarPlanilhaModeloVistoriadores_();
    return;
  }

  var ncols = Math.max(origem.getLastColumn(), 26);
  var vals = origem.getRange(2,1,origem.getLastRow()-1,ncols).getDisplayValues();
  var gruposData = {};

  vals.forEach(function(r) {
    var dataTxt = String(r[0] || "").trim();
    var protocolo = String(r[1] || "").trim();
    var status = String(r[10] || "").trim().toUpperCase();

    if (!dataTxt || !protocolo || status === "CANCELADO") return;

    var chaveData = chaveDataRoteiro_(dataTxt);
    if (!chaveData) return;

    if (!gruposData[chaveData]) {
      gruposData[chaveData] = {data:exibirDataRoteiro_(dataTxt), itens:[]};
    }

    gruposData[chaveData].itens.push({
      protocolo: protocolo,
      rg1: String(r[2] || "").trim(),
      militar1: String(r[3] || "").trim(),
      rg2: String(r[4] || "").trim(),
      militar2: String(r[5] || "").trim(),
      regiao: normalizarRegiaoOficial_(r[6]),
      periodo: String(r[7] || "").trim(),
      periodo2: String(r[20] || "").trim(),
      vtr: String(r[8] || "").trim(),
      tipoServicoOriginal: String(r[9] || "").trim(),
      observacao: String(r[11] || "").trim(),
      prioridade: String(r[12] || "NORMAL").trim(),
      situacaoVtr: String(r[13] || "").trim(),
      bairro: String(r[14] || "").trim(),
      razaoSocial: String(r[15] || "").trim(),
      divisao: String(r[16] || "").trim(),
      area: String(r[17] || "").trim(),
      andamento: String(r[18] || "").trim()
    });
  });

  var datas = Object.keys(gruposData).sort();
  var linha = 1;

  datas.forEach(function(chaveData, idxData) {
    var grupo = gruposData[chaveData];
    var equipesMap = {};
    var ordemEquipes = [];

    grupo.itens.forEach(function(item) {
      var chaveEq = chaveEquipeRoteiroPlanilha_(item);

      if (!equipesMap[chaveEq]) {
        equipesMap[chaveEq] = {
          rg1:item.rg1,
          militar1:item.militar1,
          rg2:"",
          militar2:"",
          periodo:"",
          periodo2:"",
          vtr:"",
          situacaoVtr:"",
          regiao:"",
          _regioes:{},
          setores:"",
          _setores:{},
          _cangas:{},
          _periodos:{},
          _periodos2:{},
          _vtrs:{},
          _situacoesVtr:{},
          protocolos:[]
        };
        ordemEquipes.push(chaveEq);
      }

      var nomeCanga = item.rg2
        ? montarNomeMilitarRoteiro_(item.rg2, item.militar2)
        : "";

      adicionarValorUnicoRoteiro_(
        equipesMap[chaveEq]._cangas,
        nomeCanga
      );

      adicionarValorUnicoRoteiro_(
        equipesMap[chaveEq]._periodos,
        item.periodo || "DIA TODO"
      );

      adicionarValorUnicoRoteiro_(
        equipesMap[chaveEq]._periodos2,
        item.periodo2 || ""
      );

      adicionarValorUnicoRoteiro_(
        equipesMap[chaveEq]._vtrs,
        item.vtr || ""
      );

      adicionarValorUnicoRoteiro_(
        equipesMap[chaveEq]._situacoesVtr,
        item.situacaoVtr || ""
      );

      equipesMap[chaveEq].militar2 =
        juntarValoresUnicosRoteiro_(equipesMap[chaveEq]._cangas);

      equipesMap[chaveEq].periodo =
        juntarValoresUnicosRoteiro_(equipesMap[chaveEq]._periodos);

      equipesMap[chaveEq].periodo2 =
        juntarValoresUnicosRoteiro_(equipesMap[chaveEq]._periodos2);

      equipesMap[chaveEq].vtr =
        juntarValoresUnicosRoteiro_(equipesMap[chaveEq]._vtrs);

      equipesMap[chaveEq].situacaoVtr =
        juntarValoresUnicosRoteiro_(equipesMap[chaveEq]._situacoesVtr);

      var regiaoEquipe = String(item.regiao || "").trim();
      if (regiaoEquipe) equipesMap[chaveEq]._regioes[regiaoEquipe] = true;
      equipesMap[chaveEq].regiao = Object.keys(equipesMap[chaveEq]._regioes)
        .sort(function(a,b) { return a.localeCompare(b, "pt-BR"); })
        .join(" / ");

      var bairroEquipe = String(item.bairro || "").trim();
      if (bairroEquipe) equipesMap[chaveEq]._setores[bairroEquipe] = true;
      equipesMap[chaveEq].setores = Object.keys(equipesMap[chaveEq]._setores)
        .sort(function(a,b) { return a.localeCompare(b, "pt-BR"); })
        .join(" / ");

      equipesMap[chaveEq].protocolos.push(item);
    });

    ordemEquipes.forEach(function(chaveEq) {
      delete equipesMap[chaveEq]._regioes;
      delete equipesMap[chaveEq]._setores;
      delete equipesMap[chaveEq]._cangas;
      delete equipesMap[chaveEq]._periodos;
      delete equipesMap[chaveEq]._periodos2;
      delete equipesMap[chaveEq]._vtrs;
      delete equipesMap[chaveEq]._situacoesVtr;
    });

    var qtdEquipes = ordemEquipes.length;
    if (!qtdEquipes) return;

    var primeiraColEquipe = 2; // B
    var ultimaCol = primeiraColEquipe + qtdEquipes - 1;
    var tituloData = "ROTEIRO DE VISTORIAS — " + grupo.data;

    // Título da data
    destino.getRange(linha, 1, 1, ultimaCol).merge()
      .setValue(tituloData)
      .setFontWeight("bold")
      .setFontSize(14)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle")
      .setBackground("#D9EAF7");
    destino.setRowHeight(linha, 28);
    linha++;

    var linhaCabInicio = linha;
    var rotulos = [
      "MILITAR",
      "TIPO DE SERVIÇO",
      "VTR",
      "SITUAÇÃO DA VTR",
      "CANGA",
      "PERÍODO DE TRABALHO",
      "REGIÃO",
      "SETOR / BAIRRO"
    ];

    rotulos.forEach(function(rotulo, i) {
      destino.getRange(linhaCabInicio + i, 1)
        .setValue(rotulo)
        .setFontWeight("bold")
        .setBackground("#E7E6E6")
        .setHorizontalAlignment("center")
        .setVerticalAlignment("middle");
    });

    var maxProtocolos = 0;

    ordemEquipes.forEach(function(chaveEq, idx) {
      var eq = equipesMap[chaveEq];
      var col = primeiraColEquipe + idx;

      var nome1 = montarNomeMilitarRoteiro_(eq.rg1, eq.militar1);
      var nome2 = String(eq.militar2 || "").trim();
      var tipoEquipe = nome2 ? "EM DUPLA" : "SOZINHO";

      destino.getRange(linhaCabInicio, col).setValue(nome1).setFontWeight("bold");
      destino.getRange(linhaCabInicio + 1, col).setValue(tipoEquipe);
      destino.getRange(linhaCabInicio + 2, col).setValue(eq.vtr);
      destino.getRange(linhaCabInicio + 3, col).setValue(eq.situacaoVtr);
      destino.getRange(linhaCabInicio + 4, col).setValue(nome2);
      var periodoExibir = (nome2 && eq.periodo2 && eq.periodo2 !== eq.periodo)
        ? ("V1: " + (eq.periodo || "DIA TODO") + " / V2: " + eq.periodo2)
        : (eq.periodo || "DIA TODO");
      destino.getRange(linhaCabInicio + 5, col).setValue(periodoExibir);
      destino.getRange(linhaCabInicio + 6, col).setValue(eq.regiao);
      destino.getRange(linhaCabInicio + 7, col).setValue(eq.setores || "");

      destino.getRange(linhaCabInicio, col, 8, 1)
        .setHorizontalAlignment("center")
        .setVerticalAlignment("middle")
        .setWrap(true);

      eq.protocolos.sort(function(a, b) {
        var ba = String(a.bairro || "").trim();
        var bb = String(b.bairro || "").trim();

        var cmpBairro = ba.localeCompare(bb, "pt-BR");
        if (cmpBairro !== 0) return cmpBairro;

        return String(a.protocolo || "").localeCompare(
          String(b.protocolo || ""),
          "pt-BR"
        );
      });

      maxProtocolos = Math.max(maxProtocolos, eq.protocolos.length);

      eq.protocolos.forEach(function(item, pidx) {
        var cel = destino.getRange(linhaCabInicio + 8 + pidx, col);
        var temObs = !!String(item.observacao || "").trim();
        var cor = corPrioridadePlanilhaRoteiro_(item.prioridade, temObs);

        cel.setValue(item.protocolo)
          .setHorizontalAlignment("center")
          .setVerticalAlignment("middle")
          .setFontWeight("bold")
          .setFontSize(11)
          .setBackground(cor);

        if (cor === "#FF6B6B") {
          cel.setFontColor("#000000");
        } else {
          cel.setFontColor("#000000");
        }

        if (temObs) {
          cel.setNote(item.observacao);
        } else {
          cel.clearNote();
        }
      });
    });

    var alturaBloco = 8 + Math.max(maxProtocolos, 1);
    destino.getRange(linhaCabInicio, 1, alturaBloco, ultimaCol)
      .setBorder(true, true, true, true, true, true, "#808080", SpreadsheetApp.BorderStyle.SOLID)
      .setWrap(true);

    // Faixa dos protocolos em A fica vazia, apenas para manter o desenho.
    if (maxProtocolos > 0) {
      destino.getRange(linhaCabInicio + 8, 1, maxProtocolos, 1).clearContent();
    }

    // Espaço entre datas
    linha = linhaCabInicio + alturaBloco + 2;
  });

  // Ajustes visuais gerais.
  destino.setColumnWidth(1, 155);

  var lastCol = destino.getLastColumn();
  for (var c = 2; c <= lastCol; c++) {
    destino.setColumnWidth(c, 160);
  }

  destino.getDataRange()
    .setFontFamily("Arial")
    .setVerticalAlignment("middle");

  // Não congela a primeira coluna porque o layout possui células mescladas
  // atravessando essa divisão; o Google Sheets lança exceção nesse caso.
  // O desenho/arquitetura da aba ROTEIRO permanece inalterado.
  try { destino.setFrozenColumns(0); } catch (e) {}

  // Aba tabular para consulta direta dos vistoriadores no Google Sheets.
  gerarPlanilhaModeloVistoriadores_();
}



function gerarPlanilhaModeloVistoriadores_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var origem = ss.getSheetByName("ROTEIRO_VISTORIAS");
  var nomeAba = "ROTEIRO_VISTORIADORES";

  var destino = ss.getSheetByName(nomeAba);
  if (!destino) destino = ss.insertSheet(nomeAba);

  var filtro = destino.getFilter();
  if (filtro) filtro.remove();

  destino.clear();
  destino.clearNotes();
  destino.setHiddenGridlines(false);

  var cab = [
    "VISTORIADOR",
    "PROTOCOLO",
    "SERVIÇO",
    "BAIRRO",
    "CADASTRO",
    "ANDAMENTO",
    "RAZÃO SOCIAL",
    "DIVISÃO",
    "VISTORIADOR",
    "ÁREA"
  ];

  destino.getRange(1,1,1,10)
    .setValues([cab])
    .setFontWeight("bold")
    .setFontColor("#0000FF")
    .setBackground("#E8C9DB")
    .setVerticalAlignment("middle");

  destino.setFrozenRows(1);

  if (!origem || origem.getLastRow() < 2) {
    destino.getRange(2,1).setValue("Nenhum roteiro lançado.");
    return;
  }

  obterMapaMilitaresRoteiro_();

  var ncols = Math.max(origem.getLastColumn(), 26);
  var vals = origem.getRange(
    2,1,origem.getLastRow()-1,ncols
  ).getDisplayValues();

  var grupos = {};

  vals.forEach(function(r) {
    var dataTxt = String(r[0] || "").trim();
    var protocolo = String(r[1] || "").trim();
    var status = String(r[10] || "").trim().toUpperCase();

    if (!dataTxt || !protocolo || status === "CANCELADO") return;

    var chaveData = chaveDataRoteiro_(dataTxt);
    if (!chaveData) return;

    if (!grupos[chaveData]) {
      grupos[chaveData] = {
        data:exibirDataRoteiro_(dataTxt),
        itens:[]
      };
    }

    grupos[chaveData].itens.push({
      vistoriador:montarNomeMilitarRoteiro_(
        String(r[2] || "").trim(),
        String(r[3] || "").trim()
      ),
      protocolo:protocolo,
      servico:String(r[9] || "").trim(),
      bairro:String(r[14] || "").trim(),
      cadastro:String(r[19] || "").trim(),
      andamento:String(r[18] || "").trim(),
      razaoSocial:String(r[15] || "").trim(),
      divisao:String(r[16] || "").trim(),
      vistoriadoPor:String(r[23] || "").trim(),
      area:String(r[17] || "").trim(),
      observacao:String(r[11] || "").trim()
    });
  });

  var datas = Object.keys(grupos).sort();
  var linhas = [];
  var notas = [];
  var linhasData = [];
  var linhasSeparadoras = [];

  datas.forEach(function(chaveData) {
    var grupo = grupos[chaveData];
    var partes = String(grupo.data || "").split("/");
    var diaMes = partes.length >= 2
      ? partes[0] + "/" + partes[1]
      : grupo.data;
    var ano = partes.length >= 3 ? partes[2] : "";

    linhasData.push(linhas.length);

    linhas.push([
      "",
      diaMes,
      "",
      "",
      ano,
      "",
      "",
      "",
      "",
      ""
    ]);

    notas.push(["","","","","","","","","",""]);

    grupo.itens.sort(function(a,b) {
      var c1 = String(a.vistoriador || "")
        .localeCompare(String(b.vistoriador || ""), "pt-BR");
      if (c1 !== 0) return c1;

      var c2 = String(a.bairro || "")
        .localeCompare(String(b.bairro || ""), "pt-BR");
      if (c2 !== 0) return c2;

      return String(a.protocolo || "")
        .localeCompare(String(b.protocolo || ""), "pt-BR");
    });

    var ultimo = null;

    grupo.itens.forEach(function(item) {
      if (ultimo !== null && ultimo !== item.vistoriador) {
        linhasSeparadoras.push(linhas.length);
        linhas.push(["","","","","","","","","",""]);
        notas.push(["","","","","","","","","",""]);
      }

      ultimo = item.vistoriador;

      linhas.push([
        item.vistoriador,
        item.protocolo,
        item.servico,
        item.bairro,
        item.cadastro,
        item.andamento,
        item.razaoSocial,
        item.divisao,
        item.vistoriadoPor,
        item.area
      ]);

      notas.push([
        "",
        item.observacao || "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        ""
      ]);
    });

    linhasSeparadoras.push(linhas.length);
    linhas.push(["","","","","","","","","",""]);
    notas.push(["","","","","","","","","",""]);
  });

  if (!linhas.length) {
    destino.getRange(2,1).setValue("Nenhum roteiro lançado.");
    return;
  }

  destino.getRange(2,1,linhas.length,10).setValues(linhas);
  destino.getRange(2,1,notas.length,10).setNotes(notas);

  var ultimaLinha = destino.getLastRow();

  destino.getRange(1,1,ultimaLinha,10)
    .setFontFamily("Arial")
    .setFontSize(10)
    .setVerticalAlignment("middle");

  destino.getRange(2,1,linhas.length,10)
    .setBorder(
      true,true,true,true,true,true,
      "#A6A6A6",
      SpreadsheetApp.BorderStyle.SOLID
    );

  linhasData.forEach(function(i) {
    var r = i + 2;

    destino.getRange(r,1,1,10)
      .setBackground("#00FF00")
      .setFontWeight("bold");

    destino.getRange(r,2).setHorizontalAlignment("center");
    destino.getRange(r,5).setHorizontalAlignment("center");
  });

  linhasSeparadoras.forEach(function(i) {
    var r = i + 2;
    destino.getRange(r,1,1,10).setBackground("#FFFFFF");
    destino.setRowHeight(r,8);
  });

  // Protocolos destacados como no modelo.
  var protocolos = destino.getRange(
    2,2,Math.max(ultimaLinha-1,1),1
  ).getDisplayValues();

  protocolos.forEach(function(v,i) {
    var p = String(v[0] || "").trim();
    if (/^\d{3,12}\/\d{2,4}$/.test(p)) {
      destino.getRange(i+2,2)
        .setFontColor("#0000FF")
        .setFontLine("underline")
        .setFontWeight("bold");
    }
  });

  destino.setColumnWidth(1,110);
  destino.setColumnWidth(2,85);
  destino.setColumnWidth(3,105);
  destino.setColumnWidth(4,120);
  destino.setColumnWidth(5,115);
  destino.setColumnWidth(6,135);
  destino.setColumnWidth(7,250);
  destino.setColumnWidth(8,70);
  destino.setColumnWidth(9,120);
  destino.setColumnWidth(10,90);

  destino.getRange(1,1,ultimaLinha,10).setWrap(false);

  if (ultimaLinha >= 2) {
    destino.getRange(1,1,ultimaLinha,10).createFilter();
  }
}


function obterRoteiroVistoriadoresWeb(dataFiltro, token) {
  // Todos os perfis que possuem acesso ao módulo Vistorias podem consultar
  // o Roteiro dos Vistoriadores, inclusive a faixa de AFASTAMENTOS.
  exigirPerfil_(token, ["CONFERENCIA","ATENDIMENTO","VISTORIADOR","CONSULTA"]);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("ROTEIRO_VISTORIAS");

  if (!aba || aba.getLastRow() < 2) {
    return {sucesso:true, blocos:[], dataExibicao:""};
  }

  // Carrega a base de militares uma única vez nesta execução.
  obterMapaMilitaresRoteiro_();

  var vals = aba.getRange(2, 1, aba.getLastRow() - 1, 27).getDisplayValues();
  var filtroChave = chaveDataRoteiro_(dataFiltro);
  var gruposData = {};

  vals.forEach(function(r) {
    var dataTxt = String(r[0] || "").trim();
    var protocolo = String(r[1] || "").trim();
    var status = String(r[10] || "").trim().toUpperCase();

    if (!dataTxt || !protocolo || status === "CANCELADO") return;

    var chaveData = chaveDataRoteiro_(dataTxt);
    if (!chaveData) return;
    if (filtroChave && chaveData !== filtroChave) return;

    if (!gruposData[chaveData]) {
      gruposData[chaveData] = {
        data:exibirDataRoteiro_(dataTxt),
        itens:[]
      };
    }

    gruposData[chaveData].itens.push({
      protocolo:protocolo,
      rg1:String(r[2] || "").trim(),
      militar1:String(r[3] || "").trim(),
      rg2:String(r[4] || "").trim(),
      militar2:String(r[5] || "").trim(),
      regiao:normalizarRegiaoOficial_(r[6]),
      periodo:String(r[7] || "").trim(),
      periodo2:String(r[20] || "").trim(),
      vtr:String(r[8] || "").trim(),
      tipoServicoOriginal:String(r[9] || "").trim(),
      observacao:String(r[11] || "").trim(),
      prioridade:String(r[12] || "NORMAL").trim(),
      situacaoVtr:String(r[13] || "").trim(),
      bairro:String(r[14] || "").trim()
    });
  });

  // Se foi escolhida uma data específica e ainda não existe protocolo lançado
  // nela, cria um bloco vazio para permitir exibir os afastamentos do dia.
  if (filtroChave && !gruposData[filtroChave]) {
    var afastamentosSemRoteiro = obterAfastamentosVistoriadoresNaData_(dataFiltro);
    if (afastamentosSemRoteiro.length) {
      gruposData[filtroChave] = {
        data:exibirDataRoteiro_(dataFiltro),
        itens:[]
      };
    }
  }

  var chavesDatas = Object.keys(gruposData).sort();
  var blocos = [];


  chavesDatas.forEach(function(chaveData) {
    var grupo = gruposData[chaveData];
    var equipesMap = {};
    var ordemEquipes = [];

    grupo.itens.forEach(function(item) {
      // Uma única coluna por vistoriador principal no mesmo dia.
      var chaveEq = normalizarIdentidadeMilitarRoteiro_(
        item.rg1,
        item.militar1
      );

      if (!equipesMap[chaveEq]) {
        equipesMap[chaveEq] = {
          rg1:item.rg1,
          militar1:montarNomeMilitarRoteiro_(item.rg1, item.militar1),
          rg2:"",
          militar2:"",
          tipoEquipe:"SOZINHO",
          periodo:"",
          periodo2:"",
          vtr:"",
          situacaoVtr:"",
          regiao:"",
          _regioes:{},
          setores:"",
          _setores:{},
          _cangas:{},
          _periodos:{},
          _periodos2:{},
          _vtrs:{},
          _situacoesVtr:{},
          protocolos:[]
        };
        ordemEquipes.push(chaveEq);
      }

      var eq = equipesMap[chaveEq];

      var nomeCanga = item.rg2
        ? montarNomeMilitarRoteiro_(item.rg2, item.militar2)
        : "";

      adicionarValorUnicoRoteiro_(eq._cangas, nomeCanga);
      adicionarValorUnicoRoteiro_(eq._periodos, item.periodo || "DIA TODO");
      adicionarValorUnicoRoteiro_(eq._periodos2, item.periodo2 || "");
      adicionarValorUnicoRoteiro_(eq._vtrs, item.vtr || "");
      adicionarValorUnicoRoteiro_(eq._situacoesVtr, item.situacaoVtr || "");

      eq.militar2 = juntarValoresUnicosRoteiro_(eq._cangas);
      eq.tipoEquipe = eq.militar2 ? "EM DUPLA" : "SOZINHO";
      eq.periodo = juntarValoresUnicosRoteiro_(eq._periodos);
      eq.periodo2 = juntarValoresUnicosRoteiro_(eq._periodos2);
      eq.vtr = juntarValoresUnicosRoteiro_(eq._vtrs);
      eq.situacaoVtr = juntarValoresUnicosRoteiro_(eq._situacoesVtr);

      var regiao = String(item.regiao || "").trim();
      if (regiao) eq._regioes[regiao] = true;
      eq.regiao = Object.keys(eq._regioes)
        .sort(function(a,b) { return a.localeCompare(b, "pt-BR"); })
        .join(" / ");

      var bairro = String(item.bairro || "").trim();
      if (bairro) eq._setores[bairro] = true;
      eq.setores = Object.keys(eq._setores)
        .sort(function(a,b) { return a.localeCompare(b, "pt-BR"); })
        .join(" / ");

      var temObs = !!String(item.observacao || "").trim();

      eq.protocolos.push({
        protocolo:item.protocolo,
        bairro:item.bairro,
        observacao:item.observacao,
        prioridade:item.prioridade,
        cor:corPrioridadePlanilhaRoteiro_(item.prioridade, temObs)
      });
    });

    var equipes = ordemEquipes.map(function(chaveEq) {
      var eq = equipesMap[chaveEq];

      delete eq._regioes;
      delete eq._setores;
      delete eq._cangas;
      delete eq._periodos;
      delete eq._periodos2;
      delete eq._vtrs;
      delete eq._situacoesVtr;

      eq.protocolos.sort(function(a, b) {
        var ba = String(a.bairro || "").trim();
        var bb = String(b.bairro || "").trim();

        var cmpBairro = ba.localeCompare(bb, "pt-BR");
        if (cmpBairro !== 0) return cmpBairro;

        return String(a.protocolo || "").localeCompare(
          String(b.protocolo || ""),
          "pt-BR"
        );
      });

      return eq;
    });

    var afastamentosDoDia = obterAfastamentosVistoriadoresNaData_(grupo.data);
    if (equipes.length || afastamentosDoDia.length) {
      blocos.push({
        data:grupo.data,
        equipes:equipes,
        afastamentos:afastamentosDoDia
      });
    }
  });

  return {
    sucesso:true,
    blocos:blocos,
    dataExibicao:filtroChave ? exibirDataRoteiro_(filtroChave) : ""
  };
}

function obterVistoriasDoDiaWeb(dataFiltro, razaoSocialFiltro, token) {
  exigirPerfil_(token, ["CONFERENCIA"]);

  var razaoBusca = normalizarChaveTextoRoteiro_(razaoSocialFiltro);
  var dataChave = chaveDataRoteiro_(dataFiltro);

  if (!razaoBusca && !dataChave) {
    throw new Error("Informe uma data ou uma Razão Social para pesquisar.");
  }

  var dataExibicao = dataChave ? exibirDataRoteiro_(dataChave) : "";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var roteiro = ss.getSheetByName("ROTEIRO_VISTORIAS");

  if (!roteiro || roteiro.getLastRow() < 2) {
    return {
      sucesso:true,
      dataExibicao:dataExibicao,
      itens:[],
      resumo:{protocolos:0,equipes:0,regioes:0,naoRealizadas:0,comResultado:0}
    };
  }

  // 1) Primeiro lê e filtra a base principal.
  //    Também impede protocolo duplicado na mesma data.
  //    Se houver mais de um ativo, mantém a ocorrência mais recente (última linha).
  var vals = roteiro.getRange(
    2,1,roteiro.getLastRow()-1,26
  ).getDisplayValues();

  var candidatos = {};
  var ordem = [];

  vals.forEach(function(r, idxLinha) {
    var chaveData = chaveDataRoteiro_(r[0]);
    if (!chaveData) return;
    if (dataChave && chaveData !== dataChave) return;

    var statusRoteiro = String(r[10] || "").trim().toUpperCase();
    if (statusRoteiro === "CANCELADO") return;

    var protocolo = normalizarProtocoloRoteiro_(r[1]);
    if (!protocolo) return;

    var razaoSocial = String(r[15] || "").trim();
    if (
      razaoBusca &&
      normalizarChaveTextoRoteiro_(razaoSocial).indexOf(razaoBusca) === -1
    ) return;

    var chave = chaveData + "|" + protocolo;

    if (!Object.prototype.hasOwnProperty.call(candidatos, chave)) {
      ordem.push(chave);
    }

    // Sobrescreve a anterior: a última ocorrência ativa é a que aparece.
    candidatos[chave] = {
      r:r,
      chaveData:chaveData,
      protocolo:protocolo,
      linhaRoteiro:idxLinha + 2
    };
  });

  if (!ordem.length) {
    return {
      sucesso:true,
      dataExibicao:dataExibicao,
      itens:[],
      resumo:{protocolos:0,equipes:0,regioes:0,naoRealizadas:0,comResultado:0}
    };
  }

  // 2) Carrega o mapa de militares somente depois de confirmar que há resultados.
  obterMapaMilitaresRoteiro_();

  // 3) Histórico: considera apenas data+protocolo que realmente serão exibidos.
  var resultados = {};
  var hist = ss.getSheetByName("HISTORICO_VISTORIAS");

  if (hist && hist.getLastRow() >= 2) {
    var hv = hist.getRange(
      2,1,hist.getLastRow()-1,17
    ).getDisplayValues();

    hv.forEach(function(r) {
      var chaveDataHist = chaveDataRoteiro_(r[1] || r[0]);
      if (!chaveDataHist) return;

      var protocoloHist = normalizarProtocoloRoteiro_(r[2]);
      if (!protocoloHist) return;

      var chaveHist = chaveDataHist + "|" + protocoloHist;

      // Ignora todo histórico que não pertence ao conjunto atual.
      if (!Object.prototype.hasOwnProperty.call(candidatos, chaveHist)) return;

      // Percorrendo em ordem, a última ocorrência do histórico vence.
      resultados[chaveHist] = {
        resultado:String(r[13] || "").trim(),
        status:String(r[12] || "").trim()
      };
    });
  }

  // 4) Para saber se veio de Pendência/Solicitação precisamos apenas
  //    do número do protocolo. Evita ler colunas que não são utilizadas aqui.
  var protocolosDePendencia = {};

  var abaPendOrig = ss.getSheetByName("PENDENCIAS_VISTORIAS");
  if (abaPendOrig && abaPendOrig.getLastRow() >= 2) {
    abaPendOrig.getRange(
      2,3,abaPendOrig.getLastRow()-1,1
    ).getDisplayValues().forEach(function(p) {
      var pr = normalizarProtocoloRoteiro_(p[0]);
      if (pr) protocolosDePendencia[pr] = true;
    });
  }

  var abaSolOrig = ss.getSheetByName("SOLICITACOES_VISTORIA");
  if (abaSolOrig && abaSolOrig.getLastRow() >= 2) {
    abaSolOrig.getRange(
      2,3,abaSolOrig.getLastRow()-1,1
    ).getDisplayValues().forEach(function(p) {
      var pr = normalizarProtocoloRoteiro_(p[0]);
      if (pr) protocolosDePendencia[pr] = true;
    });
  }

  var itens = [];
  var equipes = {};
  var regioes = {};
  var naoRealizadas = 0;
  var comResultado = 0;

  ordem.forEach(function(chave) {
    var candidato = candidatos[chave];
    if (!candidato) return;

    var r = candidato.r;
    var chaveData = candidato.chaveData;
    var protocolo = candidato.protocolo;
    var razaoSocial = String(r[15] || "").trim();

    var histItem = resultados[chave] || {};
    var resultado = String(histItem.resultado || "").trim();

    var situacao =
      resultado ||
      String(histItem.status || "").trim() ||
      String(r[10] || "DISTRIBUÍDO").trim();

    var sNorm = situacao.toUpperCase();
    if (sNorm === "NÃO REALIZADA" || sNorm === "NAO REALIZADA") {
      naoRealizadas++;
    }
    if (resultado) comResultado++;

    var rg1 = String(r[2] || "").trim();
    var rg2 = String(r[4] || "").trim();

    var equipeChave = [
      chaveData,
      rg1,
      rg2,
      String(r[7] || "").trim(),
      String(r[20] || "").trim(),
      String(r[8] || "").trim()
    ].join("|");

    equipes[equipeChave] = true;

    var regiao = normalizarRegiaoOficial_(r[6]);
    if (regiao) regioes[regiao] = true;

    itens.push({
      protocolo:protocolo,
      linhaRoteiro:candidato.linhaRoteiro,
      data:exibirDataRoteiro_(chaveData),
      dataIso:chaveData,
      rg1:rg1,
      militar1Base:String(r[3] || "").trim(),
      militar1:montarNomeMilitarRoteiro_(rg1, String(r[3] || "").trim()),
      rg2:rg2,
      militar2Base:String(r[5] || "").trim(),
      militar2:rg2
        ? montarNomeMilitarRoteiro_(rg2, String(r[5] || "").trim())
        : "",
      regiao:regiao,
      periodo:String(r[7] || "").trim(),
      periodo2:String(r[20] || "").trim(),
      vtr:String(r[8] || "").trim(),
      servico:String(r[9] || "").trim(),
      situacao:situacao,
      observacao:String(r[11] || "").trim(),
      prioridade:String(r[12] || "").trim(),
      situacaoVtr:String(r[13] || "").trim(),
      bairro:String(r[14] || "").trim(),
      razaoSocial:razaoSocial,
      divisao:String(r[16] || "").trim(),
      area:String(r[17] || "").trim(),
      ultimoAndamento:String(r[18] || "").trim(),
      dataAndamento:String(r[19] || "").trim(),
      origemPendenciaId:String(r[21] || "").trim(),
      origemSolicitacaoId:String(r[22] || "").trim(),
      vistoriadoPorSiapi:String(r[23] || "").trim(),
      dataCopiaSiapi:String(r[24] || "").trim(),
      andamentoMais20Dias:
        String(r[25] || "").trim().toUpperCase() === "SIM",
      origemPendencia:!!(
        String(r[21] || "").trim() ||
        String(r[22] || "").trim() ||
        protocolosDePendencia[protocolo]
      )
    });
  });

  itens.sort(function(a,b) {
    var ba = String(a.bairro || "");
    var bb = String(b.bairro || "");

    if (ba !== bb) return ba.localeCompare(bb, "pt-BR");

    if (a.dataIso !== b.dataIso) {
      return String(a.dataIso).localeCompare(String(b.dataIso));
    }

    return String(a.protocolo).localeCompare(
      String(b.protocolo),
      "pt-BR"
    );
  });

  return {
    sucesso:true,
    dataExibicao:dataExibicao,
    itens:itens,
    resumo:{
      protocolos:itens.length,
      equipes:Object.keys(equipes).length,
      regioes:Object.keys(regioes).length,
      naoRealizadas:naoRealizadas,
      comResultado:comResultado
    }
  };
}

function editarDadosSiapiVistoriaDia(dados, token) {
  exigirPerfil_(token, ["CONFERENCIA"]);
  dados = dados || {};

  var dataChave = chaveDataRoteiro_(dados.dataRoteiro);
  var protocolo = normalizarProtocoloRoteiro_(dados.protocolo);

  if (!dataChave) throw new Error("Data do roteiro inválida.");
  if (!protocolo) throw new Error("Protocolo inválido.");

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var roteiro = ss.getSheetByName("ROTEIRO_VISTORIAS");

  if (!roteiro || roteiro.getLastRow() < 2) {
    throw new Error("Não há lançamentos para editar.");
  }

  var linhasProtocolo = localizarLinhasProtocolosRoteiro_(roteiro, 2, [protocolo]);
  var dadosLinhas = lerLinhasProtocolosRoteiro_(roteiro, linhasProtocolo, 26);
  var candidatos = linhasProtocolo[protocolo] || [];
  var linha = -1;
  for (var i = candidatos.length - 1; i >= 0; i--) {
    var atual = dadosLinhas[candidatos[i]];
    if (chaveDataRoteiro_(atual[0]) === dataChave &&
        String(atual[10] || "").trim().toUpperCase() !== "CANCELADO") {
      linha = candidatos[i];
      break;
    }
  }

  if (linha < 0) throw new Error("Lançamento não localizado.");

  var dataCopia = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy");
  var mais20 = andamentoMaisDe20DiasNaCopia_(dados.dataAndamento, dataCopia);

  roteiro.getRange(linha,10).setValue(String(dados.servico || "").trim());
  roteiro.getRange(linha,15,1,6).setValues([[
    String(dados.bairro || "").trim(), String(dados.razaoSocial || "").trim(),
    String(dados.divisao || "").trim(), String(dados.area || "").trim(),
    String(dados.ultimoAndamento || "").trim(), String(dados.dataAndamento || "").trim()
  ]]);
  roteiro.getRange(linha,24,1,3).setValues([[
    String(dados.vistoriadoPorSiapi || "").trim(), dataCopia, mais20 ? "SIM" : "NÃO"
  ]]);

  // Se veio de PENDENCIAS_VISTORIAS, reflete também os dados compatíveis nela.
  var origemPendenciaId = String(dadosLinhas[linha][21] || "").trim();
  if (origemPendenciaId) {
    var pend = ss.getSheetByName("PENDENCIAS_VISTORIAS");
    if (pend && pend.getLastRow() >= 2) {
      var pv = pend.getRange(2,1,pend.getLastRow()-1,22).getDisplayValues();
      for (var p=0; p<pv.length; p++) {
        if (String(pv[p][0] || "").trim() !== origemPendenciaId) continue;
        var lr = p + 2;
        pend.getRange(lr,16,1,7).setValues([[
          String(dados.servico || "").trim(), String(dados.bairro || "").trim(),
          String(dados.ultimoAndamento || "").trim(), String(dados.razaoSocial || "").trim(),
          String(dados.divisao || "").trim(), String(dados.vistoriadoPorSiapi || "").trim(),
          String(dados.area || "").trim()
        ]]);
        break;
      }
    }
  }

  gerarPlanilhaDiariaVistoriadores_();

  return {
    sucesso:true,
    mensagem:"Dados do SIAPI atualizados para o protocolo " + protocolo + "."
  };
}


function restaurarOrigemAoApagarVistoria_(linhaRoteiro, roteiro) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var origemPendenciaId = String(roteiro.getRange(linhaRoteiro,22).getDisplayValue() || "").trim();
  var origemSolicitacaoId = String(roteiro.getRange(linhaRoteiro,23).getDisplayValue() || "").trim();

  if (origemPendenciaId) {
    var p = ss.getSheetByName("PENDENCIAS_VISTORIAS");
    if (p && p.getLastRow() >= 2) {
      var pv = p.getRange(2,1,p.getLastRow()-1,5).getDisplayValues();
      for (var i=0; i<pv.length; i++) {
        if (String(pv[i][0] || "").trim() === origemPendenciaId) {
          p.getRange(i+2,5).setValue("PENDENTE");
          break;
        }
      }
    }
  }

  if (origemSolicitacaoId) {
    var s = ss.getSheetByName("SOLICITACOES_VISTORIA");
    if (s && s.getLastRow() >= 2) {
      var sv = s.getRange(2,1,s.getLastRow()-1,10).getDisplayValues();
      for (var j=0; j<sv.length; j++) {
        if (String(sv[j][0] || "").trim() === origemSolicitacaoId) {
          s.getRange(j+2,10).setValue("PENDENTE");
          break;
        }
      }
    }
  }
}


function apagarVistoriaDia(dataRoteiro, protocolo, token) {
  var sessao = exigirPerfil_(token, ["CONFERENCIA"]);

  var dataChave = chaveDataRoteiro_(dataRoteiro);
  protocolo = normalizarProtocoloRoteiro_(protocolo);

  if (!dataChave || !protocolo) throw new Error("Vistoria inválida.");

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var roteiro = ss.getSheetByName("ROTEIRO_VISTORIAS");

    if (!roteiro || roteiro.getLastRow() < 2) {
      throw new Error("Lançamento não localizado.");
    }

    var ncols = Math.max(26, roteiro.getLastColumn());
    var vals = roteiro.getRange(2,1,roteiro.getLastRow()-1,ncols).getDisplayValues();
    var linha = -1;

    for (var i=vals.length-1; i>=0; i--) {
      if (
        chaveDataRoteiro_(vals[i][0]) === dataChave &&
        normalizarProtocoloRoteiro_(vals[i][1]) === protocolo &&
        String(vals[i][10] || "").trim().toUpperCase() !== "CANCELADO"
      ) {
        linha = i + 2;
        break;
      }
    }

    if (linha < 0) throw new Error("Lançamento não localizado.");

    restaurarOrigemAoApagarVistoria_(linha, roteiro);
    roteiro.getRange(linha,11).setValue("CANCELADO");

    var hist = ss.getSheetByName("HISTORICO_VISTORIAS");
    if (hist) {
      hist.appendRow([
        dataHoraSaoPauloTexto_(),
        exibirDataRoteiro_(dataChave),
        protocolo,
        String(roteiro.getRange(linha,10).getDisplayValue() || ""),
        String(roteiro.getRange(linha,13).getDisplayValue() || ""),
        String(roteiro.getRange(linha,3).getDisplayValue() || ""),
        String(roteiro.getRange(linha,4).getDisplayValue() || ""),
        String(roteiro.getRange(linha,5).getDisplayValue() || ""),
        String(roteiro.getRange(linha,6).getDisplayValue() || ""),
        String(roteiro.getRange(linha,7).getDisplayValue() || ""),
        String(roteiro.getRange(linha,8).getDisplayValue() || ""),
        String(roteiro.getRange(linha,9).getDisplayValue() || ""),
        "CANCELADO",
        "",
        "Vistoria apagada pelo usuário.",
        sessao.rg,
        sessao.nome
      ]);
    }

    gerarPlanilhaDiariaVistoriadores_();

    return {
      sucesso:true,
      mensagem:"Vistoria do protocolo " + protocolo + " apagada com sucesso."
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}


function editarLancamentoVistoriaDia(dados, token) {
  var sessao = exigirPerfil_(token, ["CONFERENCIA"]);
  dados = dados || {};

  var dataOriginalChave = chaveDataRoteiro_(
    dados.dataRoteiroOriginal || dados.dataRoteiro
  );

  var novaDataChave = chaveDataRoteiro_(dados.dataRoteiro);
  var protocolo = normalizarProtocoloRoteiro_(dados.protocolo);

  if (!dataOriginalChave) {
    throw new Error("Data original do roteiro inválida.");
  }

  if (!novaDataChave) {
    throw new Error("Nova data do roteiro inválida.");
  }

  if (!protocolo) {
    throw new Error("Protocolo inválido.");
  }

  if (!String(dados.rg1 || "").trim()) {
    throw new Error("Selecione o Vistoriador 1.");
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var roteiro = ss.getSheetByName("ROTEIRO_VISTORIAS");

  if (!roteiro || roteiro.getLastRow() < 2) {
    throw new Error("Não há lançamentos para editar.");
  }

  // Caminho rápido: a tela já informa a linha física do lançamento.
  // Antes de gravar, valida protocolo + data + status daquela linha.
  var linha = Number(dados.linhaRoteiro || 0);
  var encontrados = [];

  if (linha >= 2 && linha <= roteiro.getLastRow()) {
    var validacaoLinha = roteiro
      .getRange(linha, 1, 1, 11)
      .getDisplayValues()[0];

    var protocoloLinha =
      normalizarProtocoloRoteiro_(validacaoLinha[1]);

    var dataLinha =
      chaveDataRoteiro_(validacaoLinha[0]);

    var statusLinha =
      String(validacaoLinha[10] || "").trim().toUpperCase();

    if (
      protocoloLinha !== protocolo ||
      dataLinha !== dataOriginalChave ||
      statusLinha === "CANCELADO"
    ) {
      linha = -1;
    }
  } else {
    linha = -1;
  }

  // Fallback seguro para registros carregados antes da V94 ou
  // caso a linha tenha mudado desde que a tela foi carregada.
  if (linha < 0) {
    encontrados = roteiro
      .getRange(2, 2, roteiro.getLastRow() - 1, 1)
      .createTextFinder(protocolo)
      .matchEntireCell(true)
      .findAll();

    for (var i = encontrados.length - 1; i >= 0; i--) {
      var lr = encontrados[i].getRow();

      var cab = roteiro
        .getRange(lr, 1, 1, 11)
        .getDisplayValues()[0];

      if (
        chaveDataRoteiro_(cab[0]) === dataOriginalChave &&
        String(cab[10] || "").trim().toUpperCase() !== "CANCELADO"
      ) {
        linha = lr;
        break;
      }
    }
  }

  if (linha < 0) {
    throw new Error(
      "Lançamento do protocolo " + protocolo +
      " não localizado na data original."
    );
  }

  // Só pesquisa outras ocorrências se a DATA for realmente alterada.
  if (novaDataChave !== dataOriginalChave) {
    if (!encontrados.length) {
      encontrados = roteiro
        .getRange(2, 2, roteiro.getLastRow() - 1, 1)
        .createTextFinder(protocolo)
        .matchEntireCell(true)
        .findAll();
    }

    for (var j = 0; j < encontrados.length; j++) {
      var lr2 = encontrados[j].getRow();

      if (lr2 === linha) continue;

      var cab2 = roteiro
        .getRange(lr2, 1, 1, 11)
        .getDisplayValues()[0];

      if (
        chaveDataRoteiro_(cab2[0]) === novaDataChave &&
        String(cab2[10] || "").trim().toUpperCase() !== "CANCELADO"
      ) {
        throw new Error(
          "O protocolo " + protocolo +
          " já possui lançamento ativo na nova data."
        );
      }
    }
  }

  var novaDataTexto = exibirDataRoteiro_(novaDataChave);

  // Atualiza a linha principal em UMA gravação.
  // Preserva todas as colunas que não fazem parte da edição.
  var linhaAtual = roteiro
    .getRange(linha, 1, 1, 15)
    .getValues()[0];

  linhaAtual[0] = novaDataTexto;
  linhaAtual[2] = String(dados.rg1 || "").trim();
  linhaAtual[3] = String(dados.militar1 || "").trim();
  linhaAtual[4] = String(dados.rg2 || "").trim();
  linhaAtual[5] = String(dados.militar2 || "").trim();
  linhaAtual[6] = normalizarRegiaoOficial_(dados.regiao);
  linhaAtual[7] = String(dados.periodo || "DIA TODO").trim();
  linhaAtual[9] = String(dados.servico || "").trim();
  linhaAtual[11] = String(dados.observacao || "").trim();
  linhaAtual[12] = String(dados.prioridade || "NORMAL").trim();
  linhaAtual[14] = String(dados.bairro || "").trim();

  roteiro
    .getRange(linha, 1, 1, 15)
    .setValues([linhaAtual]);

  var obs = String(dados.observacao || "").trim();

  if (obs) {
    roteiro.getRange(linha, 2).setNote(obs);
  } else {
    roteiro.getRange(linha, 2).clearNote();
  }

  // Atualiza somente o histórico deste protocolo.
  var hist = ss.getSheetByName("HISTORICO_VISTORIAS");

  if (hist && hist.getLastRow() >= 2) {
    var achadosHist = hist
      .getRange(2, 3, hist.getLastRow() - 1, 1)
      .createTextFinder(protocolo)
      .matchEntireCell(true)
      .findAll();

    for (var h = achadosHist.length - 1; h >= 0; h--) {
      var linhaHist = achadosHist[h].getRow();

      var hData = hist
        .getRange(linhaHist, 1, 1, 3)
        .getDisplayValues()[0];

      var hChave = chaveDataRoteiro_(hData[1] || hData[0]);

      if (hChave !== dataOriginalChave) continue;

      // Atualiza as colunas 2 a 15 em UMA gravação,
      // preservando as demais informações do histórico.
      var hAtual = hist
        .getRange(linhaHist, 2, 1, 14)
        .getValues()[0];

      hAtual[0] = novaDataTexto; // col 2
      hAtual[2] = String(dados.servico || "").trim(); // col 4
      hAtual[4] = String(dados.rg1 || "").trim(); // col 6
      hAtual[5] = String(dados.militar1 || "").trim(); // col 7
      hAtual[6] = String(dados.rg2 || "").trim(); // col 8
      hAtual[7] = String(dados.militar2 || "").trim(); // col 9
      hAtual[8] = normalizarRegiaoOficial_(dados.regiao); // col 10
      hAtual[9] = String(dados.periodo || "DIA TODO").trim(); // col 11
      hAtual[13] = String(dados.observacao || "").trim(); // col 15

      hist
        .getRange(linhaHist, 2, 1, 14)
        .setValues([hAtual]);

      break;
    }
  }

  // Não reconstrói ROTEIRO/ROTEIRO_VISTORIADORES agora.
  // Marca a sincronização para acontecer depois, sem segurar o usuário.
  marcarSincronizacaoRoteiroPendente_();

  return {
    sucesso:true,
    mensagem:
      "Lançamento do protocolo " + protocolo +
      " atualizado para " + novaDataTexto + ".",
    atualizadoPor:sessao.nome,
    novaData:novaDataChave,
    linhaRoteiro:linha,
    sincronizacaoPendente:true
  };
}


function atualizarVistoriadoresVistoriasDiaEmLote(itens, equipe, token) {
  var sessao = exigirPerfil_(token, ["CONFERENCIA"]);
  itens = Array.isArray(itens) ? itens : [];
  equipe = equipe || {};

  if (!itens.length) {
    throw new Error("Selecione pelo menos um protocolo.");
  }

  var rg1 = String(equipe.rg1 || "").trim();
  var militar1 = String(equipe.militar1 || "").trim();
  var rg2 = String(equipe.rg2 || "").trim();
  var militar2 = String(equipe.militar2 || "").trim();

  if (!rg1) {
    throw new Error("Selecione o Vistoriador 1.");
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var roteiro = ss.getSheetByName("ROTEIRO_VISTORIAS");

  if (!roteiro || roteiro.getLastRow() < 2) {
    throw new Error("Não há lançamentos para atualizar.");
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    throw new Error(
      "Outro lançamento está sendo processado. Tente novamente em alguns segundos."
    );
  }

  try {
    var atualizados = [];
    var ignorados = [];
    var hist = ss.getSheetByName("HISTORICO_VISTORIAS");

    itens.forEach(function(item) {
      var protocolo =
        normalizarProtocoloRoteiro_(item && item.protocolo);

      var dataChave =
        chaveDataRoteiro_(item && item.dataRoteiroOriginal);

      var linha = Number(item && item.linhaRoteiro || 0);

      if (!protocolo || !dataChave || linha < 2 || linha > roteiro.getLastRow()) {
        ignorados.push(protocolo || "PROTOCOLO INVÁLIDO");
        return;
      }

      // Validação direta da linha informada pela tela.
      var cab = roteiro
        .getRange(linha, 1, 1, 11)
        .getDisplayValues()[0];

      if (
        normalizarProtocoloRoteiro_(cab[1]) !== protocolo ||
        chaveDataRoteiro_(cab[0]) !== dataChave ||
        String(cab[10] || "").trim().toUpperCase() === "CANCELADO"
      ) {
        ignorados.push(protocolo);
        return;
      }

      // Atualiza somente RG/NOME dos dois vistoriadores.
      roteiro
        .getRange(linha, 3, 1, 4)
        .setValues([[rg1, militar1, rg2, militar2]]);

      // Mantém o histórico operacional coerente, procurando somente
      // este protocolo e esta data.
      if (hist && hist.getLastRow() >= 2) {
        var achadosHist = hist
          .getRange(2, 3, hist.getLastRow() - 1, 1)
          .createTextFinder(protocolo)
          .matchEntireCell(true)
          .findAll();

        for (var h = achadosHist.length - 1; h >= 0; h--) {
          var linhaHist = achadosHist[h].getRow();
          var datasHist = hist
            .getRange(linhaHist, 1, 1, 3)
            .getDisplayValues()[0];

          if (chaveDataRoteiro_(datasHist[1] || datasHist[0]) !== dataChave) {
            continue;
          }

          hist
            .getRange(linhaHist, 6, 1, 4)
            .setValues([[rg1, militar1, rg2, militar2]]);

          break;
        }
      }

      atualizados.push({
        protocolo:protocolo,
        linhaRoteiro:linha
      });
    });

    if (atualizados.length) {
      marcarSincronizacaoRoteiroPendente_();
    }

    return {
      sucesso:true,
      atualizados:atualizados,
      ignorados:ignorados,
      rg1:rg1,
      militar1:militar1,
      rg2:rg2,
      militar2:militar2,
      atualizadoPor:sessao.nome
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}


function atualizarPlanilhaDiariaVistoriadores(token) {
  exigirPerfil_(token, ["CONFERENCIA"]);
  gerarPlanilhaDiariaVistoriadores_();
  return {sucesso:true, mensagem:"Planilha ROTEIRO atualizada."};
}



function garantirConfigPSE_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("CONFIG");

  if (!aba) {
    aba = ss.insertSheet("CONFIG");
  }

  var headers = [
    "DATA_INICIO", "DATA_FIM", "ULTIMA_OS", "ULTIMO_SEI", "ULTIMO_RAI",
    "COTA_UNIDADE", "SUP_DIC", "SUP_DAP", "SUP_GUARDA", "SUP_DEFAU", "SUP_DND",
    "DATA_REF", "V_DIURNO_AZUL", "V_DIURNO_VERM", "V_NOTURNO_AZUL", "V_NOTURNO_VERM"
  ];

  prepararCabecalhoLeve_(aba, headers, {substituir:true});
  return aba;
}


function salvarUltimosOSEI_(os, sei, rai) {
  var aba = garantirConfigPSE_();

  if (String(os || "").trim()) aba.getRange("C2").setValue(String(os).trim());
  if (String(sei || "").trim()) aba.getRange("D2").setValue(String(sei).trim());
  if (String(rai || "").trim()) aba.getRange("E2").setValue(String(rai).trim());
}


function obterUltimosOSEI(token) {
  exigirPerfil_(token, ["GESTOR"]);
  var aba = garantirConfigPSE_();

  return {
    sucesso:true,
    os:String(aba.getRange("C2").getDisplayValue() || "").trim(),
    sei:String(aba.getRange("D2").getDisplayValue() || "").trim()
  };
}


function gerarPdfEscalaSEI(dataInicio, dataFim, token) {
  exigirPerfil_(token, ["GESTOR"]);

  var dados = obterVisualizacaoEscalaSEI_(dataInicio, dataFim);
  if (dados.erro) throw new Error(dados.erro);
  if (!dados.registros || !dados.registros.length) {
    throw new Error("Não há militares escalados no período selecionado.");
  }

  var doc = DocumentApp.create("TEMP_ESCALA_PSE_SEI_" + new Date().getTime());
  var body = doc.getBody();

  var titulo = body.appendParagraph("ESCALA PSE");
  titulo.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  titulo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  var periodo = body.appendParagraph(dados.periodo || "");
  periodo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  periodo.setBold(true);

  body.appendParagraph("");

  var grupos = {};
  var ordem = [];

  dados.registros.forEach(function(r) {
    var chave = String(r.data || "") + "|" + String(r.turno || "");
    if (!grupos[chave]) {
      grupos[chave] = {
        data:r.data || "",
        turno:r.turno || "",
        registros:[]
      };
      ordem.push(chave);
    }
    grupos[chave].registros.push(r);
  });

  ordem.forEach(function(chave, idxGrupo) {
    var g = grupos[chave];

    var subtitulo = body.appendParagraph((g.data || "") + " - " + String(g.turno || "").toUpperCase());
    subtitulo.setBold(true);

    var tabelaDados = [["Ord", "Posto/Graduação", "RG", "Nome", "Função", "Horário"]];

    g.registros.forEach(function(r) {
      tabelaDados.push([
        String(r.ord || ""),
        String(r.postoGrad || ""),
        String(r.rg || ""),
        String(r.nome || ""),
        String(r.funcao || ""),
        String(r.horario || "")
      ]);
    });

    var tabela = body.appendTable(tabelaDados);
    tabela.getRow(0).editAsText().setBold(true);

    if (idxGrupo < ordem.length - 1) {
      body.appendParagraph("");
    }
  });

  doc.saveAndClose();

  var arquivo = DriveApp.getFileById(doc.getId());
  var pdf = arquivo.getBlob().getAs(MimeType.PDF);
  var nome = "Escala_PSE_SEI_" +
    String(dataInicio || "").replace(/-/g, "") +
    "_" +
    String(dataFim || "").replace(/-/g, "") +
    ".pdf";
  pdf.setName(nome);

  arquivo.setTrashed(true);

  return {
    sucesso:true,
    nomeArquivo:nome,
    mimeType:"application/pdf",
    base64:Utilities.base64Encode(pdf.getBytes())
  };
}


function obterResumoEscalaExtraMensal(mesFiltro, token) {
  exigirPerfil_(token, ["GESTOR"]);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("CONTROLE_ESCALAS");
  var config = obterConfiguracaoPeriodo();

  if (!mesFiltro) {
    var h = new Date();
    mesFiltro = h.getFullYear() + "-" + String(h.getMonth() + 1).padStart(2, "0");
  }

  var totalEscalas = 0;
  var valorTotal = 0;
  var militares = {};

  if (aba && aba.getLastRow() >= 2) {
    var dados = aba.getRange(2,1,aba.getLastRow()-1,13).getDisplayValues();

    dados.forEach(function(r) {
      var d = criarDataSegura(r[0]);
      if (!d) return;

      var mes = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      if (mes !== mesFiltro) return;

      var status = String(r[6] || "").trim().toUpperCase();
      var obs = String(r[11] || "").trim().toUpperCase();
      var origem = String(r[12] || "").trim().toUpperCase();

      if (status !== "ESCALADO") return;
      if (origem !== "EXTRA" && obs.indexOf("EXTRA") === -1) return;

      totalEscalas++;

      var rg = normalizarRgCadastro_(r[1]);
      var nome = String(r[2] || "").trim();
      militares[rg || nome] = true;

      var calc = calcularHorasEValoresAC4(
        formatarDataTexto(d),
        r[7] || "07:00",
        r[8] || "13:00",
        config
      );
      valorTotal += calc.valorTotal;
    });
  }

  return {
    sucesso:true,
    mes:mesFiltro,
    totalEscalas:totalEscalas,
    totalMilitares:Object.keys(militares).length,
    valorTotal:formatarMoedaBR(valorTotal)
  };
}


function obterControleMensalPagamentosPSE(token) {
  exigirPerfil_(token, ["GESTOR"]);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("CONTROLE_ESCALAS");
  var config = obterConfiguracaoPeriodo();
  var mapa = {};

  if (aba && aba.getLastRow() >= 2) {
    var dados = aba.getRange(2,1,aba.getLastRow()-1,13).getDisplayValues();

    dados.forEach(function(r) {
      var status = String(r[6] || "").trim().toUpperCase();
      var d = criarDataSegura(r[0]);
      if (status !== "ESCALADO" || !d) return;

      var mes = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      if (!mapa[mes]) {
        mapa[mes] = {
          mes:mes,
          quantidade:0,
          DIC:0,
          DAP:0,
          GUARDA:0,
          DEFAU:0,
          DND:0,
          total:0
        };
      }

      var servico = String(r[9] || "DIC").trim().toUpperCase();
      if (["DIC","DAP","GUARDA","DEFAU","DND"].indexOf(servico) === -1) servico = "DIC";

      var calc = calcularHorasEValoresAC4(
        formatarDataTexto(d),
        r[7] || "07:00",
        r[8] || "13:00",
        config
      );

      mapa[mes].quantidade++;
      mapa[mes][servico] += calc.valorTotal;
      mapa[mes].total += calc.valorTotal;
    });
  }

  var meses = Object.keys(mapa).sort().reverse().map(function(mes) {
    var x = mapa[mes];
    return {
      mes:mes,
      mesExibicao:mes.split("-").reverse().join("/"),
      quantidade:x.quantidade,
      DIC:formatarMoedaBR(x.DIC),
      DAP:formatarMoedaBR(x.DAP),
      GUARDA:formatarMoedaBR(x.GUARDA),
      DEFAU:formatarMoedaBR(x.DEFAU),
      DND:formatarMoedaBR(x.DND),
      total:formatarMoedaBR(x.total)
    };
  });

  return {sucesso:true, meses:meses};
}


// ----------------------------------------------------------
// WRAPPERS PROTEGIDOS DO MÓDULO GESTOR
// As funções privadas terminadas em "_" não ficam disponíveis
// diretamente para chamadas do navegador via google.script.run.
// ----------------------------------------------------------

function obterDiasDoPeriodoAtivo(token) {
  exigirPerfil_(token, ["GESTOR"]);
  return obterDiasDoPeriodoAtivo_();
}

function obterListaMilitares(token) {
  exigirPerfil_(token, ["GESTOR"]);
  return obterListaMilitares_();
}

function salvarOSeiRaiParaDataEspecifica(dataRef, turnoRef, os, sei, rai, token) {
  exigirPerfil_(token, ["GESTOR"]);
  return salvarOSeiRaiParaDataEspecifica_(dataRef, turnoRef, os, sei, rai);
}

function obterVisualizacaoEscalaSEI(dataInicio, dataFim, token) {
  exigirPerfil_(token, ["GESTOR"]);
  return obterVisualizacaoEscalaSEI_(dataInicio, dataFim);
}

function lancarEscalaSEI(dataInicio, dataFim, token) {
  exigirPerfil_(token, ["GESTOR"]);
  return lancarEscalaSEI_(dataInicio, dataFim);
}

function salvarConfiguracaoPeriodo(dataInicioStr, dataFimStr, token) {
  exigirPerfil_(token, ["GESTOR"]);
  return salvarConfiguracaoPeriodo_(dataInicioStr, dataFimStr);
}

function salvarConfiguracaoFinanceira(cotaUnidadeStr, supDicStr, supDapStr, supGuardaStr, supDefauStr, supDndStr, mesRef, token) {
  exigirPerfil_(token, ["GESTOR"]);
  return salvarConfiguracaoFinanceiraMensal_(
    mesRef,
    cotaUnidadeStr,
    supDicStr,
    supDapStr,
    supGuardaStr,
    supDefauStr,
    supDndStr
  );
}

function obterInscricoesVoluntarios(dataFiltro, turnoFiltro, token) {
  exigirPerfil_(token, ["GESTOR"]);
  return obterInscricoesVoluntarios_(dataFiltro, turnoFiltro);
}

function lancarVoluntariosSelecionadosWeb(listaSelecionados, token) {
  exigirPerfil_(token, ["GESTOR"]);
  return lancarVoluntariosSelecionadosWeb_(listaSelecionados);
}

function lancarOrdemServicoWeb(dadosOS, token) {
  exigirPerfil_(token, ["GESTOR"]);
  return lancarOrdemServicoWeb_(dadosOS);
}

function removerMilitarDaEscala(dataStr, rg, turno, nome, token) {
  exigirPerfil_(token, ["GESTOR"]);
  return removerMilitarDaEscala_(dataStr, rg, turno, nome);
}

function obterDadosRelatorioAC4(mesFiltro, token) {
  exigirPerfil_(token, ["GESTOR"]);
  return obterDadosRelatorioAC4_(mesFiltro);
}

function salvarInscricoesVoluntario(inscricoes, token) {
  exigirPerfil_(token, ["GESTOR"]);
  return salvarInscricoesVoluntario_(inscricoes);
}

function obterDadosRanking(tipoOrdenacao, mesFiltro, token) {
  exigirPerfil_(token, ["GESTOR"]);
  return obterDadosRanking_(tipoOrdenacao, mesFiltro);
}

function obterDadosEscala(dataInicio, dataFim, token) {
  exigirPerfil_(token, ["GESTOR"]);
  return obterDadosEscala_(dataInicio, dataFim);
}





function onEdit(e) {

  try {

    var range = e.range;

    var sheetName = range.getSheet().getName();

    if (sheetName === "CONTROLE_ESCALAS" || sheetName === "Cadastro" || sheetName === "DADOS" || sheetName === "Lista de Voluntários") {

      recalcularRankingGeral("TOTAL", "");

    }

  } catch(err) {}

}



// ----------------------------------------------------------

// FUNÇÕES AUXILIARES DE DATA, TEXTO E FUNÇÕES MILITARES

// ----------------------------------------------------------



function criarDataSegura(dataStr) {

  if (!dataStr || dataStr === "undefined" || dataStr === "null") return null;

  if (dataStr instanceof Date) {

    if (isNaN(dataStr.getTime())) return null;

    var dCopy = new Date(dataStr.getTime());

    dCopy.setHours(0, 0, 0, 0);

    return dCopy;

  }

  var str = String(dataStr).trim().split("T")[0].split(" ")[0];

  var p;



  if (str.indexOf("-") !== -1) {

    p = str.split("-");

    if (p.length === 3 && p[0].length === 4) {

      return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 0, 0, 0);

    }

  } else if (str.indexOf("/") !== -1) {

    p = str.split("/");

    if (p.length === 3) {

      return new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10), 0, 0, 0);

    }

  }



  var d = new Date(dataStr);

  if (!isNaN(d.getTime())) {

    d.setHours(0, 0, 0, 0);

    return d;

  }

  return null;

}



function formatarDataTexto(d) {

  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return "";

  var diaNum = d.getDate();

  var mesNum = d.getMonth() + 1;

  var anoNum = d.getFullYear();

  return (diaNum < 10 ? "0" + diaNum : diaNum) + "/" + (mesNum < 10 ? "0" + mesNum : mesNum) + "/" + anoNum;

}



function parseMoedaBR(val) {

  if (typeof val === 'number') return val;

  if (!val) return 0;

  var limpo = String(val).replace("R$", "").replace(/\./g, "").replace(",", ".").trim();

  return parseFloat(limpo) || 0;

}



function formatarMoedaBR(val) {

  var n = parseFloat(val) || 0;

  return "R$ " + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

}



function normalizarFuncaoMilitar(funcaoStr) {

  var s = String(funcaoStr || "").trim();

  var sUpper = s.toUpperCase();

  if (sUpper.indexOf("VISTOR") !== -1) return "Vistoriador";

  if (sUpper.indexOf("CONFER") !== -1) return "Conferencista";

  if (sUpper.indexOf("ATEND") !== -1) return "Atendente";

  return s || "Vistoriador";

}



function extrairPostoENome(nomeCompletoOuID) {
  var str = String(nomeCompletoOuID || "").trim().toUpperCase();
  var regex = /^(SD\s*1ª\s*CLASSE|SD\s*1A\s*CLASSE|ST|1º\s*SGT|2º\s*SGT|3º\s*SGT|1º\s*TEN|2º\s*TEN|ASP|CAP|MAJ|TC|CEL|CB|SD)\s*(BM)?\s*(.*)$/i;
  var match = str.match(regex);
  if (match) {
    var postoBase = match[1].toUpperCase();
    if (postoBase === "SD 1A CLASSE") postoBase = "SD 1ª CLASSE";
    var restante = String(match[3] || "").replace(/^BM\s*/i, "").trim();
    var posto = postoBase;
    var nomeMilitar = restante;
    var quadroMatch = restante.match(/^(QOC|QP\s*\/\s*ESP)\s+(.*)$/i);
    if (quadroMatch) {
      var quadro = quadroMatch[1].toUpperCase().replace(/\s*\/\s*/g, "/");
      posto = postoBase + " " + quadro;
      nomeMilitar = String(quadroMatch[2] || "").trim();
    }
    return { posto: posto, nome: nomeMilitar || str };
  }
  return { posto: "SGT/CB/SD", nome: str };
}


// ----------------------------------------------------------

// CONTROLO DE PERMISSÕES E IDENTIFICAÇÃO DE UTILIZADOR

// ----------------------------------------------------------



function obterDadosUsuario() {

  var email = "";

  try {
    email = Session.getActiveUser().getEmail();
  } catch (e) {}

  if (!email) {
    try {
      email = Session.getEffectiveUser().getEmail();
    } catch (e2) {}
  }

  email = String(email || "").trim().toLowerCase();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaPerms = ss.getSheetByName("PERMISSOES");
  var ehAdmin = false;

  // A identificação do gestor é independente do Cadastro.
  // Assim, um problema em CPF/RG/Cadastro nunca faz a aba Painel do Gestor desaparecer.
  if (!abaPerms) {
    abaPerms = ss.insertSheet("PERMISSOES");
    abaPerms.appendRow(["EMAILS_AUTORIZADOS_GESTOR"]);
    if (email) abaPerms.appendRow([email]);
    ehAdmin = true;
  } else if (abaPerms.getLastRow() >= 2) {
    var listaEmails = abaPerms.getRange(2, 1, abaPerms.getLastRow() - 1, 1).getDisplayValues();

    for (var i = 0; i < listaEmails.length; i++) {
      var emailCad = String(listaEmails[i][0] || "").trim().toLowerCase();
      if (emailCad && emailCad === email) {
        ehAdmin = true;
        break;
      }
    }
  }

  var militarEncontrado = null;

  // O Cadastro serve apenas para mostrar RG/nome no topo.
  // Se houver qualquer erro nele, a permissão do gestor continua funcionando.
  try {
    var militares = obterListaMilitares_();
    for (var j = 0; j < militares.length; j++) {
      if (militares[j].email && String(militares[j].email).toLowerCase() === email) {
        militarEncontrado = militares[j];
        break;
      }
    }
  } catch (erroCadastro) {
    console.error("Falha ao consultar Cadastro em obterDadosUsuario: " + erroCadastro.message);
  }

  return {
    email: email || "militar.identificado@cbm.go.gov.br",
    rg: militarEncontrado ? militarEncontrado.rg : "S/RG",
    nome: militarEncontrado ? militarEncontrado.nome : (email ? email.split("@")[0].toUpperCase() : "MILITAR"),
    ehAdmin: ehAdmin
  };
}



// ----------------------------------------------------------

// 1. CONFIGURAÇÕES E PARÂMETROS

// ----------------------------------------------------------



function obterConfiguracaoPeriodo() {

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var abaConfig = ss.getSheetByName("CONFIG");



  if (!abaConfig || abaConfig.getLastRow() < 2) {

    return { 

      inicio: "2026-09-01", fim: "2026-09-30", cota: 90000, 

      supDic: 0, supDap: 0, supGuarda: 0, supDefau: 0, supDnd: 0,

      vDiurnoAzul: 30.00, vDiurnoVermelho: 40.00, vNoturnoAzul: 33.00, vNoturnoVermelho: 45.00

    };

  }



  var configValores = abaConfig.getRange(2,1,1,16).getValues()[0];
  var configExibidos = abaConfig.getRange(2,1,1,2).getDisplayValues()[0];

  return { 

    inicio: configExibidos[0] || "2026-09-01",

    fim: configExibidos[1] || "2026-09-30",

    cota: parseFloat(configValores[5]) || 90000,

    supDic: parseFloat(configValores[6]) || 0,

    supDap: parseFloat(configValores[7]) || 0,

    supGuarda: parseFloat(configValores[8]) || 0,

    supDefau: parseFloat(configValores[9]) || 0,

    supDnd: parseFloat(configValores[10]) || 0,

    vDiurnoAzul: parseFloat(configValores[12]) || 30.00,

    vDiurnoVermelho: parseFloat(configValores[13]) || 40.00,

    vNoturnoAzul: parseFloat(configValores[14]) || 33.00,

    vNoturnoVermelho: parseFloat(configValores[15]) || 45.00

  };

}



function salvarConfiguracaoPeriodo_(dataInicioStr, dataFimStr) {

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var abaConfig = ss.getSheetByName("CONFIG");

  if (!abaConfig) {

    abaConfig = ss.insertSheet("CONFIG");

    abaConfig.appendRow(["DATA_INICIO", "DATA_FIM", "ULTIMA_OS", "ULTIMO_SEI", "ULTIMO_RAI", "COTA_UNIDADE", "SUP_DIC", "SUP_DAP", "SUP_GUARDA", "SUP_DEFAU", "SUP_DND", "DATA_REF", "V_DIURNO_AZUL", "V_DIURNO_VERM", "V_NOTURNO_AZUL", "V_NOTURNO_VERM"]);

  }

  abaConfig.getRange(2,1,1,2).setValues([[dataInicioStr,dataFimStr]]);

  return "Período mensal atualizado: " + dataInicioStr + " até " + dataFimStr;

}



function garantirConfigFinanceiroMensal_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("CONFIG_FINANCEIRO_MENSAL");

  if (!aba) {
    aba = ss.insertSheet("CONFIG_FINANCEIRO_MENSAL");
  }

  var cab = [
    "MES_REF",
    "COTA_UNIDADE",
    "SUP_DIC",
    "SUP_DAP",
    "SUP_GUARDA",
    "SUP_DEFAU",
    "SUP_DND",
    "ATUALIZADO_EM"
  ];

  prepararCabecalhoLeve_(aba, cab, {substituir:true});
  return aba;
}


function obterConfiguracaoFinanceiraMensal_(mesRef) {
  var configBase = obterConfiguracaoPeriodo();

  if (!mesRef) {
    var h = new Date();
    mesRef = h.getFullYear() + "-" + String(h.getMonth() + 1).padStart(2, "0");
  }

  var retorno = {
    mesRef:mesRef,
    cota:parseFloat(configBase.cota) || 90000,
    supDic:parseFloat(configBase.supDic) || 0,
    supDap:parseFloat(configBase.supDap) || 0,
    supGuarda:parseFloat(configBase.supGuarda) || 0,
    supDefau:parseFloat(configBase.supDefau) || 0,
    supDnd:parseFloat(configBase.supDnd) || 0,
    vDiurnoAzul:parseFloat(configBase.vDiurnoAzul) || 30,
    vDiurnoVermelho:parseFloat(configBase.vDiurnoVermelho) || 40,
    vNoturnoAzul:parseFloat(configBase.vNoturnoAzul) || 33,
    vNoturnoVermelho:parseFloat(configBase.vNoturnoVermelho) || 45
  };

  var aba = garantirConfigFinanceiroMensal_();
  if (aba.getLastRow() < 2) return retorno;

  var vals = aba.getRange(2,1,aba.getLastRow()-1,8).getValues();

  for (var i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][0] || "").trim() !== mesRef) continue;

    retorno.cota = parseFloat(vals[i][1]) || 0;
    retorno.supDic = parseFloat(vals[i][2]) || 0;
    retorno.supDap = parseFloat(vals[i][3]) || 0;
    retorno.supGuarda = parseFloat(vals[i][4]) || 0;
    retorno.supDefau = parseFloat(vals[i][5]) || 0;
    retorno.supDnd = parseFloat(vals[i][6]) || 0;
    break;
  }

  return retorno;
}


function salvarConfiguracaoFinanceiraMensal_(mesRef, cotaUnidadeStr, supDicStr, supDapStr, supGuardaStr, supDefauStr, supDndStr) {
  if (!mesRef || !/^\d{4}-\d{2}$/.test(String(mesRef))) {
    throw new Error("Selecione o mês do pagamento antes de salvar a cota e as suplementações.");
  }

  var aba = garantirConfigFinanceiroMensal_();
  var vals = aba.getLastRow() >= 2
    ? aba.getRange(2,1,aba.getLastRow()-1,8).getDisplayValues()
    : [];

  var linha = -1;
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0] || "").trim() === mesRef) {
      linha = i + 2;
      break;
    }
  }

  var registro = [
    mesRef,
    parseMoedaBR(cotaUnidadeStr),
    parseMoedaBR(supDicStr),
    parseMoedaBR(supDapStr),
    parseMoedaBR(supGuardaStr),
    parseMoedaBR(supDefauStr),
    parseMoedaBR(supDndStr),
    dataHoraSaoPauloTexto_()
  ];

  if (linha > 0) {
    aba.getRange(linha,1,1,registro.length).setValues([registro]);
  } else {
    aba.appendRow(registro);
  }

  return "Cota Inicial e Suplementações de " + mesRef.split("-").reverse().join("/") + " salvas com sucesso!";
}


function salvarConfiguracaoFinanceira_(cotaUnidadeStr, supDicStr, supDapStr, supGuardaStr, supDefauStr, supDndStr) {

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var abaConfig = ss.getSheetByName("CONFIG");

  if (!abaConfig) {

    abaConfig = ss.insertSheet("CONFIG");

    abaConfig.appendRow(["DATA_INICIO", "DATA_FIM", "ULTIMA_OS", "ULTIMO_SEI", "ULTIMO_RAI", "COTA_UNIDADE", "SUP_DIC", "SUP_DAP", "SUP_GUARDA", "SUP_DEFAU", "SUP_DND", "DATA_REF"]);

  }

  abaConfig.getRange(2,6,1,6).setValues([[
    parseMoedaBR(cotaUnidadeStr), parseMoedaBR(supDicStr), parseMoedaBR(supDapStr),
    parseMoedaBR(supGuardaStr), parseMoedaBR(supDefauStr), parseMoedaBR(supDndStr)
  ]]);

  return "Cota Inicial e Suplementações do mês salvas com sucesso!";

}



function salvarOSeiRaiParaDataEspecifica_(dataRef, turnoRef, os, sei, rai) {
  // Retrocompatibilidade com a chamada antiga:
  // salvarOSeiRaiParaDataEspecifica_(dataRef, os, sei, rai)
  if (arguments.length === 4) {
    rai = sei;
    sei = os;
    os = turnoRef;
    turnoRef = "Todos";
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaControle = ss.getSheetByName("CONTROLE_ESCALAS");

  if (!abaControle || abaControle.getLastRow() < 2) {
    return "Nenhum registro encontrado em CONTROLE_ESCALAS para atualizar.";
  }

  var dObj = criarDataSegura(dataRef);
  if (!dObj) return "Erro: Data de referência inválida.";

  var dataRefNorm = formatarDataTexto(dObj);
  var turnoBusca = String(turnoRef || "Todos").trim().toLowerCase();

  var dados = abaControle.getRange(2, 1, abaControle.getLastRow() - 1, 13).getValues();
  var atualizados = 0;

  var obsNova =
    "OS: " + (os || "N/A") +
    " | SEI: " + (sei || "N/A") +
    " | RAI: " + (rai || "N/A");

  for (var i = 0; i < dados.length; i++) {
    var dReg = formatarDataTexto(criarDataSegura(dados[i][0]));
    var status = String(dados[i][6] || "").trim().toUpperCase();
    var turnoReg = String(dados[i][3] || "").trim().toLowerCase();

    var mesmoTurno =
      turnoBusca === "todos" ||
      turnoBusca === "" ||
      turnoReg === turnoBusca;

    if (
      dReg === dataRefNorm &&
      status === "ESCALADO" &&
      mesmoTurno
    ) {
      abaControle.getRange(i + 2, 12).setValue(obsNova);
      atualizados++;
    }
  }

  salvarUltimosOSEI_(os, sei, rai);
  sincronizarEscalaPSE();

  var turnoTexto = turnoBusca === "todos"
    ? "todos os turnos"
    : String(turnoRef || "").toUpperCase();

  return (
    "OS/SEI/RAI atualizados com sucesso para " +
    turnoTexto +
    " do dia " +
    dataRefNorm +
    " (" +
    atualizados +
    " registro(s))."
  );
}





function obterDiasDoPeriodoAtivo_() {

  var config = obterConfiguracaoPeriodo();

  var dias = [];

  var diasDaSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];



  var dInicio = criarDataSegura(config.inicio);

  var dFim = criarDataSegura(config.fim);

  if (!dInicio || !dFim) return { config: config, dias: [] };



  var atual = new Date(dInicio.getTime());

  while (atual <= dFim) {

    var diaSemana = diasDaSemana[atual.getDay()];

    var dataFormatada = formatarDataTexto(atual);

    dias.push({ dataFormatada: dataFormatada, diaSemana: diaSemana });

    atual.setDate(atual.getDate() + 1);

  }

  return { config: config, dias: dias };

}



// ----------------------------------------------------------

// 2. RANKING MENSAL

// ----------------------------------------------------------



function recalcularRankingGeral(tipoOrdenacao, mesFiltro) {

  tipoOrdenacao = tipoOrdenacao || "TOTAL";

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var abaControle = ss.getSheetByName("CONTROLE_ESCALAS");

  var abaRanking = ss.getSheetByName("RANKING");



  if (!abaRanking) { abaRanking = ss.insertSheet("RANKING"); }



  var config = obterConfiguracaoPeriodo();

  if (!mesFiltro && config.inicio) {

    var dIniCfg = criarDataSegura(config.inicio);

    if (dIniCfg) {

      var mCfg = dIniCfg.getMonth() + 1;

      mesFiltro = dIniCfg.getFullYear() + "-" + (mCfg < 10 ? "0" + mCfg : mCfg);

    }

  }



  var militares = obterListaMilitares_();

  var mapaContagem = {};



  militares.forEach(function(m) {

    var rgLimpo = String(m.rg || "").trim().replace(/\.0$/, '');

    var nomeLimpo = String(m.nome || "").trim();

    var chave = (rgLimpo && rgLimpo !== "S/RG") ? rgLimpo : nomeLimpo;

    if (chave) mapaContagem[chave] = { rg: rgLimpo || "S/RG", nome: m.nome, azul: 0, vermelho: 0, total: 0 };

  });



  if (abaControle && abaControle.getLastRow() >= 2) {

    var ultLinhaC = abaControle.getLastRow();

    var dadosControle = abaControle.getRange(2, 1, ultLinhaC - 1, 13).getDisplayValues();



    dadosControle.forEach(function(r) {

      var dataVal = r[0];

      var rg = normalizarRgCadastro_(r[1]);

      var nome = String(r[2] || "").trim();

      var status = String(r[6] || "").toUpperCase();

      var obs = String(r[11] || "").toUpperCase();



      if (status === "ESCALADO" && obs.indexOf("EXTRA") === -1) {

        var dObj = criarDataSegura(dataVal);

        if (dObj) {

          if (mesFiltro && mesFiltro !== "TODOS") {

            var mObj = dObj.getMonth() + 1;

            var mesAnoData = dObj.getFullYear() + "-" + (mObj < 10 ? "0" + mObj : mObj);

            if (mesAnoData !== mesFiltro) return;

          }

          var chave = (rg !== "" && rg !== "S/RG") ? rg : nome;

          if (!chave) return;

          if (!mapaContagem[chave]) mapaContagem[chave] = { rg: rg || "S/RG", nome: nome || "MILITAR", azul: 0, vermelho: 0, total: 0 };



          var diaSemana = dObj.getDay();

          if (diaSemana >= 1 && diaSemana <= 4) mapaContagem[chave].azul++;

          else mapaContagem[chave].vermelho++;



          mapaContagem[chave].total++;

        }

      }

    });

  }



  var lista = [];

  for (var k in mapaContagem) lista.push(mapaContagem[k]);



  lista.sort(function(a, b) {

    if (tipoOrdenacao === "AZUL") {

      if (b.azul !== a.azul) return b.azul - a.azul;

      if (b.total !== a.total) return b.total - a.total;

      return b.vermelho - a.vermelho;

    } else if (tipoOrdenacao === "VERMELHO") {

      if (b.vermelho !== a.vermelho) return b.vermelho - a.vermelho;

      if (b.total !== a.total) return b.total - a.total;

      return b.azul - a.azul;

    } else {

      if (b.total !== a.total) return b.total - a.total;

      if (b.vermelho !== a.vermelho) return b.vermelho - a.vermelho;

      return b.azul - a.azul;

    }

  });



  var mesTextoHeader = (mesFiltro && mesFiltro !== "TODOS") ? ("Mês " + mesFiltro.split("-").reverse().join("/")) : "Geral (Todos os Meses)";

  var matrizWeb = [ ["Posição (" + mesTextoHeader + ")", "RG", "ID Militar / Nome", "Escalas AZUL (Seg-Qui)", "Escalas VERMELHO (Sex-Dom)", "TOTAL ESCALAS", "Status"] ];

  var novasLinhasPlanilha = [];



  lista.forEach(function(m, idx) {

    matrizWeb.push([ (idx + 1) + "º", m.rg, m.nome, m.azul + " esc. azul", m.vermelho + " esc. vermelha", m.total + " escala(s)", "ATIVO" ]);

    novasLinhasPlanilha.push([ (idx + 1), m.rg, m.nome, m.azul, m.vermelho, m.total, "S", "ATUALIZADO (" + mesTextoHeader + ")" ]);

  });



  if (abaRanking) {

    abaRanking.clear();

    abaRanking.appendRow(["POSIÇÃO", "RG", "NOME_GUERRA", "ESCALAS_AZUL", "ESCALAS_VERMELHO", "TOTAL_ESCALAS", "REGENCIA", "STATUS"]);

    if (novasLinhasPlanilha.length > 0) abaRanking.getRange(2, 1, novasLinhasPlanilha.length, 8).setValues(novasLinhasPlanilha);

  }

  return matrizWeb;

}



function obterMapaRanking(mesFiltro) {

  recalcularRankingGeral("TOTAL", mesFiltro);

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var abaRanking = ss.getSheetByName("RANKING");

  var mapa = {};

  if (!abaRanking || abaRanking.getLastRow() < 2) return mapa;



  var dados = abaRanking.getRange(2, 1, abaRanking.getLastRow() - 1, 8).getDisplayValues();

  dados.forEach(function(r) {

    var rg = normalizarRgCadastro_(r[1]);

    var nome = String(r[2] || "").trim();

    var chaveRk = (rg && rg !== "S/RG") ? rg : nome;

    if (chaveRk) mapa[chaveRk] = { posicao: r[0], azul: parseInt(r[3],10)||0, vermelho: parseInt(r[4],10)||0, total: parseInt(r[5],10)||0, nome: nome };

  });

  return mapa;

}



function obterDadosRanking_(tipoOrdenacao, mesFiltro) {

  return { matriz: recalcularRankingGeral(tipoOrdenacao || "TOTAL", mesFiltro || "") };

}



// ----------------------------------------------------------

// 3. DEDUPLICAÇÃO E LANÇAMENTO DE ESCALAS (CONTROLE E ESCALA PSE)

// ----------------------------------------------------------



function verificarMilitarJaEscalado(dataServicoStr, rg, nome, turno) {

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var abaControle = ss.getSheetByName("CONTROLE_ESCALAS");

  if (!abaControle || abaControle.getLastRow() < 2) return false;



  var dNorm = formatarDataTexto(criarDataSegura(dataServicoStr));

  if (!dNorm) return false;



  var rgBusca = String(rg || "").trim().replace(/\.0$/, '');

  var nomeBusca = String(nome || "").trim().toLowerCase();

  var turnoBusca = String(turno || "").trim().toLowerCase();



  var dados = abaControle.getRange(2, 1, abaControle.getLastRow() - 1, 13).getDisplayValues();

  for (var i = 0; i < dados.length; i++) {

    var dReg = formatarDataTexto(criarDataSegura(dados[i][0]));

    var rgReg = String(dados[i][1] || "").trim().replace(/\.0$/, '');

    var nomeReg = String(dados[i][2] || "").trim().toLowerCase();

    var turnoReg = String(dados[i][3] || "").trim().toLowerCase();

    var statusReg = String(dados[i][6] || "").trim().toUpperCase();



    if (statusReg === "ESCALADO" && dReg === dNorm) {

      var mesmoMilitar = (rgBusca !== "S/RG" && rgBusca !== "" && rgReg === rgBusca) || (nomeBusca !== "" && nomeReg === nomeBusca);

      var mesmoTurno = (turnoBusca === "ambos" || turnoReg === "ambos" || turnoReg === turnoBusca);

      if (mesmoMilitar && mesmoTurno) return true;

    }

  }

  return false;

}



function lancarVoluntariosSelecionadosWeb_(listaSelecionados) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaControle = ss.getSheetByName("CONTROLE_ESCALAS");

  if (!abaControle) return "Erro: Aba 'CONTROLE_ESCALAS' não encontrada.";
  if (!listaSelecionados || listaSelecionados.length === 0) return "Nenhum militar selecionado.";

  // Evita que dois lançamentos concorrentes passem pela checagem ao mesmo tempo.
  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000);
  } catch (e) {
    return "Não foi possível concluir agora porque outro lançamento está sendo processado. Tente novamente em alguns segundos.";
  }

  try {
    var lancados = 0;
    var novasEscalas = [];
    var bloqueados = [];

    // Chaves de militares já escalados na planilha:
    // DATA|RG ou, se não houver RG válido, DATA|NOME.
    var ocupadosNoDia = {};

    if (abaControle.getLastRow() >= 2) {
      var existentes = abaControle
        .getRange(2, 1, abaControle.getLastRow() - 1, 13)
        .getDisplayValues();

      existentes.forEach(function(r) {
        var status = String(r[6] || "").trim().toUpperCase();
        if (status !== "ESCALADO") return;

        var dObjExistente = criarDataSegura(r[0]);
        if (!dObjExistente) return;

        var dataExistente = formatarDataTexto(dObjExistente);
        var rgExistente = normalizarRgCadastro_(r[1]);
        var nomeExistente = String(r[2] || "").trim().toUpperCase();

        if (rgExistente && rgExistente !== "S/RG") {
          ocupadosNoDia[dataExistente + "|RG|" + rgExistente] = true;
        }

        if (nomeExistente) {
          ocupadosNoDia[dataExistente + "|NOME|" + nomeExistente] = true;
        }
      });
    }

    // Também impede duplicidade dentro da própria seleção enviada pelo navegador.
    var processadosNestaSelecao = {};

    listaSelecionados.forEach(function(item) {
      var dObj = criarDataSegura(item.dataServico);

      if (!dObj) {
        bloqueados.push("Data inválida para " + (item.nome || "Militar"));
        return;
      }

      var dataFormatadaLimpa = formatarDataTexto(dObj);
      var diaSemana = dObj.getDay();
      var grupo = (diaSemana >= 1 && diaSemana <= 4) ? "AZUL" : "VERMELHO";

      var rgNormalizado = normalizarRgCadastro_(item.rg);
      var nomeNormalizado = String(item.nome || "").trim().toUpperCase();

      var chaveRg = (rgNormalizado && rgNormalizado !== "S/RG")
        ? dataFormatadaLimpa + "|RG|" + rgNormalizado
        : "";

      var chaveNome = nomeNormalizado
        ? dataFormatadaLimpa + "|NOME|" + nomeNormalizado
        : "";

      var jaNaPlanilha =
        (chaveRg && ocupadosNoDia[chaveRg]) ||
        (chaveNome && ocupadosNoDia[chaveNome]);

      var duplicadoNaSelecao =
        (chaveRg && processadosNestaSelecao[chaveRg]) ||
        (chaveNome && processadosNestaSelecao[chaveNome]);

      if (jaNaPlanilha || duplicadoNaSelecao) {
        bloqueados.push(
          (item.nome || "Militar") +
          " já possui escala no dia " +
          dataFormatadaLimpa +
          ". O mesmo militar não pode ser lançado duas vezes no mesmo dia."
        );
        return;
      }

      var turnoEfetivo = item.turnoEscalar || item.turno || "Matutino";

      // A FUNÇÃO deve ser a mesma informada pelo militar no Forms.
      var funcaoEfetiva = normalizarFuncaoMilitar(item.funcao || "Vistoriador");

      // O serviço financeiro/operacional é campo separado da função.
      var servicoEfetivo = String(item.servico || "DIC").trim().toUpperCase();

      var obsInicial = "OS: N/A | SEI: N/A | RAI: N/A";

      var hIni =
        item.horaIni ||
        (
          turnoEfetivo === "Vespertino"
            ? "13:00"
            : (
                turnoEfetivo === "Noturno"
                  ? "19:00"
                  : "07:00"
              )
        );

      var hFim =
        item.horaFim ||
        (
          turnoEfetivo === "Vespertino"
            ? "19:00"
            : (
                turnoEfetivo === "Noturno"
                  ? "01:00"
                  : "13:00"
              )
        );

      novasEscalas.push([
        dataFormatadaLimpa,                                      // A Data
        String(item.rg || ""),                                  // B RG
        item.nome || "MILITAR",                                 // C Nome
        turnoEfetivo,                                           // D Turno
        funcaoEfetiva,                                          // E Função do Forms
        grupo,                                                   // F Azul/Vermelho
        "ESCALADO",                                             // G Status
        hIni,                                                    // H Início
        hFim,                                                    // I Fim
        servicoEfetivo,                                         // J Serviço
        dataFormatadaLimpa + "|" + item.rg + "|" + turnoEfetivo,// K Chave
        obsInicial,                                              // L OS/SEI/RAI
        "SIM"                                                    // M Controle
      ]);

      // Marca imediatamente em memória para que outro item da mesma seleção
      // ou outro item subsequente não consiga repetir o militar nesse dia.
      if (chaveRg) {
        ocupadosNoDia[chaveRg] = true;
        processadosNestaSelecao[chaveRg] = true;
      }

      if (chaveNome) {
        ocupadosNoDia[chaveNome] = true;
        processadosNestaSelecao[chaveNome] = true;
      }

      lancados++;
    });
    if (novasEscalas.length) {
      abaControle.getRange(abaControle.getLastRow()+1,1,novasEscalas.length,13).setValues(novasEscalas);
    }


    sincronizarEscalaPSE();

    var mObj = listaSelecionados[0]
      ? criarDataSegura(listaSelecionados[0].dataServico)
      : null;

    var mesFiltroRk = mObj
      ? (
          mObj.getFullYear() +
          "-" +
          (
            mObj.getMonth() + 1 < 10
              ? "0" + (mObj.getMonth() + 1)
              : mObj.getMonth() + 1
          )
        )
      : "";

    recalcularRankingGeral("TOTAL", mesFiltroRk);

    var msg =
      "Sucesso: " +
      lancados +
      " militar(es) escalado(s) com sucesso!";

    if (bloqueados.length > 0) {
      msg += "\n\n⚠️ BLOQUEIOS:\n- " + bloqueados.join("\n- ");
    }

    return msg;

  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}





function lancarOrdemServicoWeb_(dadosOS) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaControle = ss.getSheetByName("CONTROLE_ESCALAS");
  if (!abaControle) return "Aba 'CONTROLE_ESCALAS' não encontrada.";

  var dObj = criarDataSegura(dadosOS.data);
  if (!dObj) return "Erro: Data de serviço inválida.";

  var dataFormatadaLimpa = formatarDataTexto(dObj);
  var grupo = (dObj.getDay() >= 1 && dObj.getDay() <= 4) ? "AZUL" : "VERMELHO";
  var turnoNome = dadosOS.turno || "Matutino";
  var funcaoNome = normalizarFuncaoMilitar(dadosOS.funcao || "Vistoriador");

  if (verificarMilitarJaEscalado(dataFormatadaLimpa, dadosOS.rg, dadosOS.nome, turnoNome)) {
    return "⚠️ ATENÇÃO: O militar " + dadosOS.nome + " já está escalado no dia " + dataFormatadaLimpa + " no turno " + turnoNome + ".";
  }

  var obsTexto = "EXTRA | OS: " + (dadosOS.os || "N/A") + " | SEI: " + (dadosOS.sei || "N/A") + " | RAI: " + (dadosOS.rai || "N/A");
  var hIni = dadosOS.horaIni || (turnoNome === "Vespertino" ? "13:00" : (turnoNome === "Noturno" ? "19:00" : "07:00"));
  var hFim = dadosOS.horaFim || (turnoNome === "Vespertino" ? "19:00" : (turnoNome === "Noturno" ? "01:00" : "13:00"));

  abaControle.appendRow([
    dataFormatadaLimpa,
    String(dadosOS.rg || ""),
    dadosOS.nome || "MILITAR",
    turnoNome,
    funcaoNome,
    grupo,
    "ESCALADO",
    hIni,
    hFim,
    funcaoNome,
    dataFormatadaLimpa + "|" + dadosOS.rg + "|" + turnoNome,
    obsTexto,
    "EXTRA"
  ]);

  salvarUltimosOSEI_(dadosOS.os, dadosOS.sei, dadosOS.rai);
  sincronizarEscalaPSE();

  var mVal = dObj.getMonth() + 1;
  recalcularRankingGeral("TOTAL", dObj.getFullYear() + "-" + (mVal < 10 ? "0" + mVal : mVal));
  return "Ordem de Serviço Extra lançada com sucesso para " + dadosOS.nome + "!";
}





// ----------------------------------------------------------

// 4. CÁLCULO FINANCEIRO EXATO (MINUTO A MINUTO / 22H ÀS 05H)

// ----------------------------------------------------------



function calcularHorasEValoresAC4(dataStr, horaIniStr, horaFimStr, config) {

  var dObj = criarDataSegura(dataStr);

  if (!dObj) return { valorTotal: 0, valorDiurno: 0, valorNoturno: 0, horasDiurnas: 0, horasNoturnas: 0 };



  var hIni = parseInt(horaIniStr.split(":")[0], 10) || 7;

  var mIni = parseInt(horaIniStr.split(":")[1], 10) || 0;

  var hFim = parseInt(horaFimStr.split(":")[0], 10) || 13;

  var mFim = parseInt(horaFimStr.split(":")[1], 10) || 0;



  var totalMinutos = (hFim * 60 + mFim) - (hIni * 60 + mIni);

  if (totalMinutos <= 0) totalMinutos += 24 * 60;



  var minutosDiurnosAzul = 0, minutosNoturnosAzul = 0;

  var minutosDiurnosVermelho = 0, minutosNoturnosVermelho = 0;



  var dtInicio = new Date(dObj.getFullYear(), dObj.getMonth(), dObj.getDate(), hIni, mIni, 0);

  var minutoAtualEmDt = dtInicio.getTime();



  for (var m = 0; m < totalMinutos; m++) {

    var dtMinuto = new Date(minutoAtualEmDt);

    var diaSemana = dtMinuto.getDay();

    var horaDoDia = dtMinuto.getHours();



    var ehVermelho = (diaSemana === 0 || diaSemana === 5 || diaSemana === 6);

    var ehNoturno = (horaDoDia >= 22 || horaDoDia < 5);



    if (ehVermelho) {

      if (ehNoturno) minutosNoturnosVermelho++;

      else minutosDiurnosVermelho++;

    } else {

      if (ehNoturno) minutosNoturnosAzul++;

      else minutosDiurnosAzul++;

    }



    minutoAtualEmDt += 60000;

  }



  var vDiurnoAzul = (config && !isNaN(config.vDiurnoAzul)) ? config.vDiurnoAzul : 30.00;

  var vDiurnoVermelho = (config && !isNaN(config.vDiurnoVermelho)) ? config.vDiurnoVermelho : 40.00;

  var vNoturnoAzul = (config && !isNaN(config.vNoturnoAzul)) ? config.vNoturnoAzul : 33.00;

  var vNoturnoVermelho = (config && !isNaN(config.vNoturnoVermelho)) ? config.vNoturnoVermelho : 45.00;



  var totalDiurno = (minutosDiurnosAzul / 60) * vDiurnoAzul + (minutosDiurnosVermelho / 60) * vDiurnoVermelho;

  var totalNoturno = (minutosNoturnosAzul / 60) * vNoturnoAzul + (minutosNoturnosVermelho / 60) * vNoturnoVermelho;



  return {

    valorTotal: totalDiurno + totalNoturno,

    valorDiurno: totalDiurno,

    valorNoturno: totalNoturno,

    horasDiurnas: (minutosDiurnosAzul + minutosDiurnosVermelho) / 60,

    horasNoturnas: (minutosNoturnosAzul + minutosNoturnosVermelho) / 60

  };

}




// ----------------------------------------------------------
// DADOS OFICIAIS PARA O RELATÓRIO AC-4
// ----------------------------------------------------------
// O Relatório AC-4 usa EXCLUSIVAMENTE a aba "DADOS" para
// CPF e NOME COMPLETO, fazendo o cruzamento pelo RG.
// Isso NÃO altera ranking, voluntários, Escala PSE ou SEI.
// ----------------------------------------------------------

function normalizarRgChaveDados_(valor) {
  var texto = String(valor === null || valor === undefined ? "" : valor).trim();
  texto = texto.replace(/\.0$/, "");
  return texto.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}


function formatarCpfAC4_(valor) {
  var texto = String(valor === null || valor === undefined ? "" : valor).trim();

  if (!texto) return "";

  var digitos = texto.replace(/\D/g, "");

  if (digitos.length > 0 && digitos.length < 11) {
    digitos = ("00000000000" + digitos).slice(-11);
  }

  if (digitos.length !== 11) {
    return texto;
  }

  return digitos.substring(0, 3) + "." +
         digitos.substring(3, 6) + "." +
         digitos.substring(6, 9) + "-" +
         digitos.substring(9, 11);
}


function obterMapaDadosOficiaisAC4_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaDados = ss.getSheetByName("DADOS");
  var mapa = {};

  if (!abaDados || abaDados.getLastRow() < 2 || abaDados.getLastColumn() < 1) {
    return mapa;
  }

  var numCols = abaDados.getLastColumn();

  // DisplayValues preserva máscaras e zeros à esquerda.
  var cabecalhos = abaDados.getRange(1, 1, 1, numCols).getDisplayValues()[0];
  var valores = abaDados.getRange(2, 1, abaDados.getLastRow() - 1, numCols).getDisplayValues();

  var idxRg = -1;
  var idxCpf = -1;
  var idxNomeCompleto = -1;
  var idxNomeGenerico = -1;

  cabecalhos.forEach(function(h, i) {
    var header = String(h || "").trim().toUpperCase();
    var normalizado = header.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (
      idxRg === -1 &&
      (normalizado === "RG" ||
       normalizado.indexOf("RG ") === 0 ||
       normalizado.indexOf(" RG") !== -1)
    ) {
      idxRg = i;
    }

    if (idxCpf === -1 && normalizado.indexOf("CPF") !== -1) {
      idxCpf = i;
    }

    // Prioriza explicitamente NOME COMPLETO.
    if (idxNomeCompleto === -1 && normalizado.indexOf("NOME COMPLETO") !== -1) {
      idxNomeCompleto = i;
    }

    // Fallback somente se a planilha usar o cabeçalho simples NOME.
    if (idxNomeGenerico === -1 && normalizado === "NOME") {
      idxNomeGenerico = i;
    }
  });

  if (idxRg === -1) {
    throw new Error('Na aba "DADOS" não foi encontrada a coluna de RG.');
  }

  if (idxCpf === -1) {
    throw new Error('Na aba "DADOS" não foi encontrada a coluna de CPF.');
  }

  var idxNomeUsado = idxNomeCompleto !== -1 ? idxNomeCompleto : idxNomeGenerico;

  if (idxNomeUsado === -1) {
    throw new Error('Na aba "DADOS" não foi encontrada a coluna "NOME COMPLETO" nem uma coluna "NOME".');
  }

  valores.forEach(function(linha) {
    var rgOriginal = String(linha[idxRg] || "").trim();
    var chaveRg = normalizarRgChaveDados_(rgOriginal);

    if (!chaveRg) return;

    mapa[chaveRg] = {
      rg: rgOriginal,
      cpf: formatarCpfAC4_(linha[idxCpf]),
      nomeCompleto: String(linha[idxNomeUsado] || "").trim()
    };
  });

  return mapa;
}



// ----------------------------------------------------------
// DATA FINAL DO SERVIÇO NO AC-4
// ----------------------------------------------------------
// A data inicial é sempre a DATA DO SERVIÇO.
// Se o horário final for menor ou igual ao horário inicial,
// significa que o serviço terminou no dia seguinte.
// Ex.: 16/09/2026 - 21:00 às 04:00
// Início: 16/09/2026
// Final:  17/09/2026
// ----------------------------------------------------------

function calcularDataFinalAC4_(dataInicioStr, horaInicioStr, horaFimStr) {

  var dataInicio = criarDataSegura(dataInicioStr);

  if (!dataInicio) {
    return dataInicioStr || "";
  }

  var inicioPartes = String(horaInicioStr || "07:00").split(":");
  var fimPartes = String(horaFimStr || "13:00").split(":");

  var horaInicio = parseInt(inicioPartes[0], 10) || 0;
  var minutoInicio = parseInt(inicioPartes[1], 10) || 0;

  var horaFim = parseInt(fimPartes[0], 10) || 0;
  var minutoFim = parseInt(fimPartes[1], 10) || 0;

  var totalInicio = (horaInicio * 60) + minutoInicio;
  var totalFim = (horaFim * 60) + minutoFim;

  var dataFinal = new Date(dataInicio.getTime());

  // Quando termina depois da meia-noite, avança um dia.
  if (totalFim <= totalInicio) {
    dataFinal.setDate(dataFinal.getDate() + 1);
  }

  return formatarDataTexto(dataFinal);
}


function obterDadosRelatorioAC4_(mesFiltro) {

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var abaControle = ss.getSheetByName("CONTROLE_ESCALAS");

  if (!mesFiltro) {
    var agoraMes = new Date();
    mesFiltro = agoraMes.getFullYear() + "-" + String(agoraMes.getMonth() + 1).padStart(2, "0");
  }

  // Cota e suplementações são mensais. Ao trocar o filtro de mês,
  // todo o AC-4 passa a usar a configuração financeira daquele mês.
  var config = obterConfiguracaoFinanceiraMensal_(mesFiltro);

  var cotaInicial = parseFloat(config.cota) || 0;

  var totalSuplementacao = (config.supDic + config.supDap + config.supGuarda + config.supDefau + config.supDnd);

  var cotaTotal = cotaInicial + totalSuplementacao;



  // CPF e NOME COMPLETO do AC-4 vêm EXCLUSIVAMENTE da aba DADOS.
  // O vínculo é feito pelo RG.
  var mapaDadosAC4 = obterMapaDadosOficiaisAC4_();



  var servicosTotais = { DIC: 0, DAP: 0, GUARDA: 0, DEFAU: 0, DND: 0 };

  var totalExecutado = 0, linhasTabela = [];



  if (abaControle && abaControle.getLastRow() >= 2) {

    var ultLinha = abaControle.getLastRow();

    var dados = abaControle.getRange(2, 1, ultLinha - 1, 13).getDisplayValues();


    dados.forEach(function(r) {

      var dataObjLinha = criarDataSegura(r[0]);
      var dataStr = formatarDataTexto(dataObjLinha);

      if (dataObjLinha && mesFiltro) {
        var chaveMesLinha = dataObjLinha.getFullYear() + "-" + String(dataObjLinha.getMonth() + 1).padStart(2, "0");
        if (chaveMesLinha !== mesFiltro) return;
      }

      var rgExibicao = String(r[1] || "").trim().replace(/\.0$/, "");

      var chaveRg = normalizarRgChaveDados_(rgExibicao);

      var status = String(r[6] || "").toUpperCase();

      var servico = String(r[9] || "DIC").toUpperCase();

      var obsGravada = String(r[11] || "").trim();



      if (!obsGravada || obsGravada === "SIM" || obsGravada === "FORMULÁRIO" || obsGravada.indexOf("OS:") === -1) {

        obsGravada = "OS: N/A | SEI: N/A | RAI: N/A";

      } else if (obsGravada.indexOf("DATA REF:") !== -1 && obsGravada.indexOf("OS:") !== -1) {

        obsGravada = obsGravada.substring(obsGravada.indexOf("OS:"));

      }



      if (status === "ESCALADO" && chaveRg !== "") {

        var calc = calcularHorasEValoresAC4(
          dataStr,
          r[7] || "07:00",
          r[8] || "13:00",
          config
        );



        if (servicosTotais[servico] !== undefined) {

          servicosTotais[servico] += calc.valorTotal;

        } else {

          servicosTotais["DIC"] += calc.valorTotal;

        }



        totalExecutado += calc.valorTotal;



        var dadosOficiais = mapaDadosAC4[chaveRg] || null;



        var cpfAC4 = (
          dadosOficiais &&
          dadosOficiais.cpf
        )
          ? dadosOficiais.cpf
          : "CPF NÃO LOCALIZADO";



        var nomeCompletoAC4 = (
          dadosOficiais &&
          dadosOficiais.nomeCompleto
        )
          ? dadosOficiais.nomeCompleto.toUpperCase()
          : "NOME NÃO LOCALIZADO NA ABA DADOS";



        linhasTabela.push({

          // A numeração será aplicada somente depois da ordenação cronológica.
          num: 0,

          // Campos internos usados apenas para ordenar o relatório.
          _timestampData: criarDataSegura(dataStr)
            ? criarDataSegura(dataStr).getTime()
            : 0,

          _minutoInicio: (function() {
            var partesHora = String(r[7] || "07:00").split(":");
            var h = parseInt(partesHora[0], 10) || 0;
            var m = parseInt(partesHora[1], 10) || 0;
            return (h * 60) + m;
          })(),

          rg: rgExibicao,

          cpf: cpfAC4,

          nome: nomeCompletoAC4,

          servico: servico,

          inicioData: dataStr,

          inicioHora: r[7] || "07:00",

          // A data final acompanha o horário real do serviço.
          // Se ultrapassar a meia-noite, passa para o dia seguinte.
          finalData: calcularDataFinalAC4_(
            dataStr,
            r[7] || "07:00",
            r[8] || "13:00"
          ),

          finalHora: r[8] || "13:00",

          diurno: formatarMoedaBR(calc.valorDiurno),

          noturno: formatarMoedaBR(calc.valorNoturno),

          total: formatarMoedaBR(calc.valorTotal),

          obs: obsGravada

        });

      }

    });

  }



  // --------------------------------------------------------
  // ORDEM DO AC-4
  // --------------------------------------------------------
  // A exibição deve seguir a DATA REAL DO SERVIÇO,
  // independentemente da ordem em que a escala foi lançada.
  // Em uma mesma data, ordena pelo horário de início.
  linhasTabela.sort(function(a, b) {
    if (a._timestampData !== b._timestampData) {
      return a._timestampData - b._timestampData;
    }

    if (a._minutoInicio !== b._minutoInicio) {
      return a._minutoInicio - b._minutoInicio;
    }

    return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
  });

  // Renumera após a ordenação e remove os campos internos.
  linhasTabela.forEach(function(item, idx) {
    item.num = idx + 1;
    delete item._timestampData;
    delete item._minutoInicio;
  });


  return {

    mes: mesFiltro,

    cotaInicial: formatarMoedaBR(cotaInicial),

    totalSuplementacao: formatarMoedaBR(totalSuplementacao),

    cotaTotal: formatarMoedaBR(cotaTotal),

    totalExecutado: formatarMoedaBR(totalExecutado),

    saldoDisponivel: formatarMoedaBR(cotaTotal - totalExecutado),

    suplementacoes: {

      DIC: formatarMoedaBR(config.supDic),

      DAP: formatarMoedaBR(config.supDap),

      GUARDA: formatarMoedaBR(config.supGuarda),

      DEFAU: formatarMoedaBR(config.supDefau),

      DND: formatarMoedaBR(config.supDnd)

    },

    servicos: {

      DIC: formatarMoedaBR(servicosTotais.DIC),

      DAP: formatarMoedaBR(servicosTotais.DAP),

      GUARDA: formatarMoedaBR(servicosTotais.GUARDA),

      DEFAU: formatarMoedaBR(servicosTotais.DEFAU),

      DND: formatarMoedaBR(servicosTotais.DND)

    },

    linhas: linhasTabela

  };

}



// ----------------------------------------------------------

// 5. CONVERSOR AUTOMÁTICO DE DADOS DO GOOGLE FORMS E OBTENÇÃO

// ----------------------------------------------------------



function converterRespostasFormsParaListaVoluntarios() {

  var ss = SpreadsheetApp.getActiveSpreadsheet();



  var abaForms = ss.getSheetByName("Respostas ao formulário 1") || ss.getSheetByName("Respostas formulario 1") || ss.getSheets()[0];

  var abaDestino = ss.getSheetByName("Lista de Voluntários");



  if (!abaDestino) {

    abaDestino = ss.insertSheet("Lista de Voluntários");

  }



  if (!abaForms || abaForms.getLastRow() < 2) {

    return "Nenhuma resposta encontrada na aba do formulário.";

  }



  var listaCadastrados = obterListaMilitares_();

  var mapaPorRg = {};

  var mapaPorEmail = {};



  listaCadastrados.forEach(function(m) {

    if (m.rg) mapaPorRg[String(m.rg).trim().replace(/\.0$/, '')] = m;

    if (m.email) mapaPorEmail[String(m.email).trim().toLowerCase()] = m;

  });



  var ultLinha = abaForms.getLastRow();

  var ultColuna = abaForms.getLastColumn();

  var cabecalhos = abaForms.getRange(1, 1, 1, ultColuna).getValues()[0];

  var dados = abaForms.getRange(2, 1, ultLinha - 1, ultColuna).getValues();



  var idxEmail = 1;      // Coluna B: Endereço de e-mail

  var idxNomeGuerra = 3; // Coluna D: Nome de Guerra

  var idxRg = 4;         // Coluna E: RG

  var idxFuncao = 5;     // Coluna F: Função (Vistoria, Conferência, Atendimento)

  var idxMes = 6;        // Coluna G: Mês (ex: Agosto 2026)



  cabecalhos.forEach(function(h, i) {

    var headerStr = String(h || "").trim().toUpperCase();

    if (headerStr.indexOf("E-MAIL") !== -1 || headerStr.indexOf("EMAIL") !== -1) idxEmail = i;

    else if (headerStr.indexOf("GUERRA") !== -1) idxNomeGuerra = i;

    else if (headerStr === "RG" || headerStr.indexOf("RG") !== -1) idxRg = i;

    else if (headerStr.indexOf("FUNÇÃO") !== -1 || headerStr.indexOf("FUNCAO") !== -1) idxFuncao = i;

    else if (headerStr.indexOf("MÊS") !== -1 || headerStr.indexOf("MES") !== -1) idxMes = i;

  });



  var mesesMap = {

    'JANEIRO': 0, 'FEVEREIRO': 1, 'MARÇO': 2, 'MARCO': 2, 'ABRIL': 3, 'MAIO': 4,

    'JUNHO': 5, 'JULHO': 6, 'AGOSTO': 7, 'SETEMBRO': 8, 'OUTUBRO': 9, 'NOVEMBRO': 10, 'DEZEMBRO': 11

  };



  var diasDaSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

  var novosLancamentos = [];



  dados.forEach(function(linha) {

    var carimbo = linha[0];

    var emailForm = String(linha[idxEmail] || "").trim().toLowerCase();

    var nomeGuerraForm = String(linha[idxNomeGuerra] || "").trim().toUpperCase();

    var rgForm = String(linha[idxRg] || "").trim().replace(/\.0$/, '');

    var funcaoForm = normalizarFuncaoMilitar(linha[idxFuncao]);

    var mesAnoStr = String(linha[idxMes] || "").trim().toUpperCase();



    if (!mesAnoStr) return;



    var militarEncontrado = mapaPorRg[rgForm] || mapaPorEmail[emailForm];

    var emailFinal = emailForm;

    if (militarEncontrado && militarEncontrado.email) {

      emailFinal = militarEncontrado.email.toLowerCase();

    }



    if (!emailFinal) emailFinal = rgForm ? ("rg\_" + rgForm) : "militar_anonimo";



    var partesMes = mesAnoStr.split(" ");

    var mesNome = partesMes[0];

    var anoNum = parseInt(partesMes[1] || new Date().getFullYear(), 10);

    var mesNum = mesesMap[mesNome] !== undefined ? mesesMap[mesNome] : new Date().getMonth();



    for (var col = Math.max(idxMes + 1, 7); col < cabecalhos.length; col++) {

      var cabec = String(cabecalhos[col] || "");

      var matchDia = cabec.match(/\d+/);



      if (matchDia) {

        var diaNum = parseInt(matchDia[0], 10);

        var valorTurno = String(linha[col] || "").trim();



        if (valorTurno && valorTurno !== "" && valorTurno.toLowerCase() !== "nenhum") {

          var dObj = new Date(anoNum, mesNum, diaNum, 0, 0, 0);

          var dataFormatada = formatarDataTexto(dObj);

          var diaSemana = diasDaSemana[dObj.getDay()];



          var listaTurnos = valorTurno.split(",");

          listaTurnos.forEach(function(t) {

            var tLimpo = t.trim();

            if (tLimpo !== "") {

              novosLancamentos.push([carimbo, emailFinal, dataFormatada, diaSemana, tLimpo, rgForm, nomeGuerraForm, funcaoForm]);

            }

          });

        }

      }

    }

  });



  abaDestino.clear();

  abaDestino.appendRow(["Registro Data/Hora", "Email / ID", "Data Serviço", "Dia da Semana", "Turno", "RG Form", "Nome Form", "Função Form"]);



  if (novosLancamentos.length > 0) {

    abaDestino.getRange(2, 1, novosLancamentos.length, 8).setValues(novosLancamentos);

  }



  return "Sucesso! Convertidos " + novosLancamentos.length + " registro(s) com cruzamento de RG e Função.";

}



function obterInscricoesVoluntarios_(dataFiltro, turnoFiltro) {

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var abaInsc = ss.getSheetByName("Lista de Voluntários") || ss.getSheetByName("Livro de Voluntários");

  if (!abaInsc || abaInsc.getLastRow() < 2) return [];



  var militares = obterListaMilitares_();

  var mapaEmail = {};

  var mapaRg = {};



  militares.forEach(function(m) { 

    if (m.email) mapaEmail[m.email.toLowerCase()] = m; 

    if (m.rg) mapaRg[String(m.rg).replace(/\.0$/, '').trim()] = m;

  });



  var dFiltroObj = criarDataSegura(dataFiltro);

  var mesFiltroRk = dFiltroObj ? (dFiltroObj.getFullYear() + "-" + (dFiltroObj.getMonth() + 1 < 10 ? "0" + (dFiltroObj.getMonth() + 1) : dFiltroObj.getMonth() + 1)) : "";

  var mapaRanking = obterMapaRanking(mesFiltroRk);

  var dados = abaInsc.getRange(2, 1, abaInsc.getLastRow() - 1, Math.max(abaInsc.getLastColumn(), 1)).getDisplayValues();

  var resultado = [], dataFiltroNorm = dFiltroObj ? formatarDataTexto(dFiltroObj) : "";



  dados.forEach(function(r, idx) {

    var chaveIdentificacao = String(r[1] || "").trim().toLowerCase();

    var dataServicoRaw = String(r[2] || "").trim();

    var turno = String(r[4] || "").trim();

    var rgExtraidoForm = String(r[5] || "").trim().replace(/\.0$/, '');

    var nomeExtraidoForm = String(r[6] || "").trim();

    var funcaoExtraidaForm = normalizarFuncaoMilitar(r[7] || "Vistoriador");



    if (!dataServicoRaw || turno === "" || turno === "Nenhum") return;



    var dObj = criarDataSegura(dataServicoRaw);

    if (!dObj) return;

    if (dataFiltroNorm !== "" && formatarDataTexto(dObj) !== dataFiltroNorm) return;

    if (turnoFiltro && turnoFiltro !== "Todos" && turno !== "Ambos" && turno.toLowerCase() !== turnoFiltro.toLowerCase()) return;



    var ehVermelho = (dObj.getDay() === 0 || dObj.getDay() === 5 || dObj.getDay() === 6);



    var militarInfo = mapaEmail[chaveIdentificacao] || mapaRg[chaveIdentificacao] || mapaRg[rgExtraidoForm];



    var nomeExibir = (militarInfo && militarInfo.nome) ? militarInfo.nome : (nomeExtraidoForm || (chaveIdentificacao ? chaveIdentificacao.split("@")[0].toUpperCase() : "VOLUNTÁRIO " + (idx + 1)));

    var rgExibir = (militarInfo && militarInfo.rg) ? militarInfo.rg : (rgExtraidoForm || "S/RG");



    var posRanking = "S/R", numPos = 999, textoEscalas = "0 esc.", chaveChave = (rgExibir !== "S/RG") ? rgExibir : nomeExibir;

    if (mapaRanking[chaveChave]) {

      posRanking = mapaRanking[chaveChave].posicao + "º"; numPos = parseInt(mapaRanking[chaveChave].posicao, 10) || 999;

      textoEscalas = ehVermelho ? (mapaRanking[chaveChave].vermelho + " esc. vermelha") : (mapaRanking[chaveChave].azul + " esc. azul");

    }



    resultado.push({

      id: idx, email: chaveIdentificacao, dataServico: formatarDataTexto(dObj), diaSemana: String(r[3] || "").trim(),

      turno: (turno === "Ambos" ? "Matutino" : turno), rg: rgExibir, nome: nomeExibir,

      funcao: funcaoExtraidaForm,

      posRanking: posRanking, numPos: numPos, textoEscalas: textoEscalas, tipoDia: ehVermelho ? "VERMELHO" : "AZUL",

      timestampData: dObj.getTime()

    });

  });



  // AGRUPAMENTO: Ordena cronologicamente por Data do Serviço -> Turno -> Ranking

  resultado.sort(function(a, b) {

    if (a.timestampData !== b.timestampData) return a.timestampData - b.timestampData;

    if (a.turno !== b.turno) return a.turno.localeCompare(b.turno);

    return a.numPos - b.numPos;

  });



  return resultado;

}



function obterListaMilitares_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaCadastro = ss.getSheetByName("Cadastro") || ss.getSheetByName("DADOS");
  var lista = [];

  if (!abaCadastro || abaCadastro.getLastRow() < 2) return lista;

  var numCols = abaCadastro.getLastColumn();
  var cabecalhos = abaCadastro.getRange(1, 1, 1, numCols).getDisplayValues()[0];
  var idxRg = -1, idxCpf = -1, idxIdMilitar = -1, idxNomeGuerra = -1, idxNomeCompleto = -1, idxEmail = -1, idxPostoGrad = -1;

  cabecalhos.forEach(function(h, i) {
    var headerStr = String(h || "").trim().toUpperCase();
    if (headerStr === "RG" || headerStr.indexOf("RG") !== -1) idxRg = i;
    else if (headerStr.indexOf("CPF") !== -1) idxCpf = i;
    else if (headerStr.indexOf("ID MILITAR") !== -1 || headerStr.indexOf("ID_MILITAR") !== -1 || headerStr === "ID") idxIdMilitar = i;
    else if (headerStr.indexOf("GUERRA") !== -1) idxNomeGuerra = i;
    else if (headerStr.indexOf("COMPLETO") !== -1) idxNomeCompleto = i;
    else if (headerStr === "NOME") idxNomeCompleto = i;
    else if (headerStr.indexOf("EMAIL") !== -1 || headerStr.indexOf("E-MAIL") !== -1) idxEmail = i;
    else if (headerStr.indexOf("GRAD") !== -1 || headerStr.indexOf("POSTO") !== -1) idxPostoGrad = i;
  });

  // DisplayValues preserva zeros à esquerda e máscaras de CPF/RG.
  var valores = abaCadastro.getRange(2, 1, abaCadastro.getLastRow() - 1, numCols).getDisplayValues();

  valores.forEach(function(linha) {
    var rg = idxRg !== -1 ? normalizarRgCadastro_(linha[idxRg]) : "";
    var cpf = idxCpf !== -1 ? formatarCpfCadastro_(linha[idxCpf]) : "";
    var idMilitar = idxIdMilitar !== -1 ? String(linha[idxIdMilitar] || "").trim() : "";
    var nomeGuerra = idxNomeGuerra !== -1 ? String(linha[idxNomeGuerra] || "").trim() : "";
    var nomeCompleto = idxNomeCompleto !== -1 ? String(linha[idxNomeCompleto] || "").trim() : "";
    var email = idxEmail !== -1 ? String(linha[idxEmail] || "").trim().toLowerCase() : "";
    var postoGrad = idxPostoGrad !== -1 ? String(linha[idxPostoGrad] || "").trim().toUpperCase() : "";

    if (!rg || (!idMilitar && !nomeGuerra && !nomeCompleto)) {
      for (var c = 0; c < linha.length; c++) {
        var val = String(linha[c] || "").trim();
        if (val.indexOf("@") !== -1 && !email) email = val.toLowerCase();
        else if (/^\d{3}\.?\d{3}\.?\d{3}\-?\d{2}$/.test(val.replace(/\s/g, "")) && !cpf) cpf = formatarCpfCadastro_(val);
        else if (/^\d{3,8}$/.test(val.replace(/\.0$/, '')) && !rg) rg = normalizarRgCadastro_(val);
      }
    }

    var nomeExibir = idMilitar || nomeGuerra || nomeCompleto;
    if (!nomeExibir) {
      for (var k = 0; k < linha.length; k++) {
        var itemVal = String(linha[k] || "").trim();
        if (itemVal.length > 2 && itemVal.indexOf("@") === -1 && !/^\d+$/.test(itemVal) && itemVal.toUpperCase() !== "RG") {
          nomeExibir = itemVal;
          break;
        }
      }
    }

    var infoId = extrairPostoENome(idMilitar || nomeExibir);
    if (!postoGrad || postoGrad === "SGT/CB/SD") postoGrad = infoId.posto;
    if (!nomeGuerra) nomeGuerra = infoId.nome || nomeExibir;

    if (rg !== "") {
      lista.push({
        rg: rg,
        cpf: cpf || "000.000.000-00",
        nome: (nomeExibir || ("MILITAR " + rg)).toUpperCase(),
        nomeGuerra: String(nomeGuerra || nomeExibir || "MILITAR").toUpperCase(),
        postoGrad: String(postoGrad || "SGT/CB/SD").toUpperCase(),
        email: email
      });
    }
  });

  return lista;
}

function normalizarRgCadastro_(valor) {
  return String(valor === null || valor === undefined ? "" : valor).trim().replace(/\.0$/, '').replace(/\s+/g, '');
}

function formatarCpfCadastro_(valor) {
  var original = String(valor === null || valor === undefined ? "" : valor).trim();
  if (!original) return "";
  var digitos = original.replace(/\D/g, '');
  if (!digitos) return "";
  if (digitos.length < 11) digitos = ("00000000000" + digitos).slice(-11);
  if (digitos.length === 11) {
    return digitos.substring(0,3) + "." + digitos.substring(3,6) + "." + digitos.substring(6,9) + "-" + digitos.substring(9,11);
  }
  return original;
}

function obterMapaMilitaresPorRg_() {
  var mapa = {};
  obterListaMilitares_().forEach(function(m) {
    mapa[normalizarRgCadastro_(m.rg)] = m;
  });
  return mapa;
}





function removerMilitarDaEscala_(dataStr, rg, turno, nome) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaControle = ss.getSheetByName("CONTROLE_ESCALAS");
  var removidos = 0;

  var dObj = criarDataSegura(dataStr);
  if (!dObj) return "Data inválida para remoção.";

  var dataFiltroNorm = formatarDataTexto(dObj);
  var rgBusca = normalizarRgCadastro_(rg);
  var turnoBusca = String(turno || "").trim().toLowerCase();

  var nomeBusca = String(nome || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

  if (abaControle && abaControle.getLastRow() >= 2) {
    var dadosC = abaControle
      .getRange(2, 1, abaControle.getLastRow() - 1, 13)
      .getDisplayValues();

    for (var i = 0; i < dadosC.length; i++) {
      var rgReg = normalizarRgCadastro_(dadosC[i][1]);
      var statusReg = String(dadosC[i][6] || "").trim().toUpperCase();
      var dataReg = formatarDataTexto(criarDataSegura(dadosC[i][0]));
      var turnoReg = String(dadosC[i][3] || "").trim().toLowerCase();

      var nomeReg = String(dadosC[i][2] || "")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");

      var mesmoRg = (
        rgBusca !== "" &&
        rgReg !== "" &&
        rgReg === rgBusca
      );

      // Fallback por nome resolve registros antigos em que o campo RG
      // foi gravado incorretamente como CPF ou em outro formato.
      var mesmoNome = (
        nomeBusca !== "" &&
        nomeReg !== "" &&
        (
          nomeReg === nomeBusca ||
          nomeReg.indexOf(nomeBusca) !== -1 ||
          nomeBusca.indexOf(nomeReg) !== -1
        )
      );

      var mesmoTurno = (
        !turnoBusca ||
        turnoReg === turnoBusca
      );

      if (
        statusReg === "ESCALADO" &&
        dataReg === dataFiltroNorm &&
        mesmoTurno &&
        (mesmoRg || mesmoNome)
      ) {
        abaControle
          .getRange(i + 2, 7)
          .setValue("CANCELADO");

        removidos++;
      }
    }
  }

  // A Escala PSE é reconstruída a partir dos registros que continuam ESCALADOS.
  sincronizarEscalaPSE();

  var mVal = dObj.getMonth() + 1;

  recalcularRankingGeral(
    "TOTAL",
    dObj.getFullYear() +
      "-" +
      (mVal < 10 ? "0" + mVal : mVal)
  );

  return removidos > 0
    ? "Militar removido com sucesso da escala do dia " +
        dataFiltroNorm +
        " (" +
        String(turno || "").toUpperCase() +
        ")!"
    : "Nenhum registro ativo encontrado para esta data/militar/turno.";
}





function salvarInscricoesVoluntario_(inscricoes) {

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var aba = ss.getSheetByName("Lista de Voluntários");

  if (!aba) { aba = ss.insertSheet("Lista de Voluntários"); aba.appendRow(["Registro Data/Hora", "Email Militar", "Data Serviço", "Dia da Semana", "Turno"]); }



  var user = obterDadosUsuario();

  var email = user.email || Session.getActiveUser().getEmail() || "militar@cbm.go.gov.br";

  var dataHoraLocal = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");

  var inseridos = 0;
  var novasInscricoes = [];

  inscricoes.forEach(function(item) {

    if (item.turno && item.turno !== "" && item.turno !== "Nenhum") {

      novasInscricoes.push([dataHoraLocal, email, item.data, item.diaSemana, item.turno]); inseridos++;

    }

  });

  if (novasInscricoes.length) aba.getRange(aba.getLastRow()+1,1,novasInscricoes.length,5).setValues(novasInscricoes);

  return "Sucesso! " + inseridos + " inscrição(ões) registrada(s).";

}





// ----------------------------------------------------------
// APOIO DA ESCALA PSE - DADOS ORIGINAIS DA LISTA DE VOLUNTÁRIOS
// ----------------------------------------------------------
// Para a representação da Escala PSE:
// - RG vem da "Lista de Voluntários" (coluna F);
// - Função vem da "Lista de Voluntários" (coluna H);
// - o cruzamento é feito por Data + Turno + Nome e, quando possível, RG.
// ----------------------------------------------------------

function normalizarTextoChavePSE_(valor) {
  return String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}


function normalizarTurnoPSE_(valor) {
  var t = normalizarTextoChavePSE_(valor);

  if (t.indexOf("MATUT") !== -1 || t.indexOf("MANHA") !== -1) return "MATUTINO";
  if (t.indexOf("VESPERT") !== -1 || t.indexOf("TARDE") !== -1) return "VESPERTINO";
  if (t.indexOf("NOTURN") !== -1 || t.indexOf("NOITE") !== -1) return "NOTURNO";

  return t;
}


function obterMapasListaVoluntariosPSE_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("Lista de Voluntários");

  var resultado = {
    porNomeDataTurno: {},
    porRgDataTurno: {}
  };

  if (!aba || aba.getLastRow() < 2) return resultado;

  // Estrutura atual:
  // A Registro | B Email/ID | C Data | D Dia | E Turno
  // F RG Form | G Nome Form | H Função Form
  var dados = aba
    .getRange(2, 1, aba.getLastRow() - 1, Math.max(aba.getLastColumn(), 8))
    .getDisplayValues();

  dados.forEach(function(r) {
    var data = formatarDataTexto(criarDataSegura(r[2]));
    var turno = normalizarTurnoPSE_(r[4]);
    var rg = String(r[5] || "").trim().replace(/\.0$/, "");
    var nome = String(r[6] || "").trim();
    var funcao = normalizarFuncaoMilitar(r[7] || "Vistoriador");

    if (!data || !turno) return;

    var item = {
      rg: rg,
      nome: nome,
      funcao: funcao
    };

    var chaveNome =
      data +
      "|" +
      turno +
      "|" +
      normalizarTextoChavePSE_(nome);

    resultado.porNomeDataTurno[chaveNome] = item;

    if (rg) {
      var chaveRg =
        data +
        "|" +
        turno +
        "|" +
        normalizarRgCadastro_(rg);

      resultado.porRgDataTurno[chaveRg] = item;
    }
  });

  return resultado;
}


function localizarVoluntarioPSE_(mapas, data, turno, rgControle, nomeControle) {
  var turnoNorm = normalizarTurnoPSE_(turno);

  var chaveNome =
    data +
    "|" +
    turnoNorm +
    "|" +
    normalizarTextoChavePSE_(nomeControle);

  if (mapas.porNomeDataTurno[chaveNome]) {
    return mapas.porNomeDataTurno[chaveNome];
  }

  var rgNorm = normalizarRgCadastro_(rgControle);

  if (rgNorm) {
    var chaveRg =
      data +
      "|" +
      turnoNorm +
      "|" +
      rgNorm;

    if (mapas.porRgDataTurno[chaveRg]) {
      return mapas.porRgDataTurno[chaveRg];
    }
  }

  return null;
}


// ----------------------------------------------------------
// SINCRONIZAÇÃO DA ABA "Escala PSE" - MODELO LINEAR A:I
// A Nº | B Data | C Graduação | D RG | E Nome | F Função
// G Horário | H Turno | I OS / SEI / RAI
// ----------------------------------------------------------
function sincronizarEscalaPSE() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaControle = ss.getSheetByName("CONTROLE_ESCALAS");
  var abaEscala = ss.getSheetByName("Escala PSE");

  if (!abaEscala) {
    abaEscala = ss.insertSheet("Escala PSE");
  }

  // Desfaz mesclagens anteriores antes de reconstruir a tabela.
  try {
    abaEscala
      .getRange(1, 1, Math.max(abaEscala.getMaxRows(), 1), 9)
      .breakApart();
  } catch (e) {}

  // Remove filtro anterior para permitir a reconstrução.
  var filtroAnterior = abaEscala.getFilter();
  if (filtroAnterior) {
    filtroAnterior.remove();
  }

  var cabecalho = [[
    "Nº",
    "DATA",
    "POSTO/GRADUAÇÃO",
    "RG",
    "NOME",
    "FUNÇÃO",
    "HORÁRIO",
    "TURNO",
    "OS / SEI / RAI"
  ]];

  var registros = [];

  var mapaMilitares = obterMapaMilitaresPorRg_();

  // Fonte preferencial para RG e FUNÇÃO na representação PSE.
  var mapasVoluntarios = obterMapasListaVoluntariosPSE_();

  var ordemTurnos = {
    "MATUTINO": 1,
    "VESPERTINO": 2,
    "NOTURNO": 3
  };

  if (abaControle && abaControle.getLastRow() >= 2) {
    var dados = abaControle
      .getRange(2, 1, abaControle.getLastRow() - 1, 13)
      .getDisplayValues();

    dados.forEach(function(r) {
      var status = String(r[6] || "").trim().toUpperCase();
      var dObj = criarDataSegura(r[0]);

      if (status !== "ESCALADO" || !dObj) return;

      var dataTexto = formatarDataTexto(dObj);

      var turnoOriginal = String(r[3] || "Matutino").trim();
      var turnoNorm = normalizarTurnoPSE_(turnoOriginal);

      var rgControle = String(r[1] || "").trim().replace(/\.0$/, "");
      var nomeControle = String(r[2] || "").trim();

      // Tenta localizar a inscrição original do militar no Forms.
      var voluntario = localizarVoluntarioPSE_(
        mapasVoluntarios,
        dataTexto,
        turnoOriginal,
        rgControle,
        nomeControle
      );

      // RG correto para a Escala PSE:
      // prioriza o RG de 4 dígitos gravado na Lista de Voluntários.
      var rgPSE =
        voluntario && voluntario.rg
          ? String(voluntario.rg).trim().replace(/\.0$/, "")
          : rgControle;

      // Cadastro auxiliar para posto/graduação e nome.
      var cad =
        mapaMilitares[normalizarRgCadastro_(rgPSE)] ||
        mapaMilitares[normalizarRgCadastro_(rgControle)] ||
        null;

      var info = extrairPostoENome(nomeControle);

      var postoGrad =
        cad && cad.postoGrad
          ? cad.postoGrad
          : info.posto;

      var nomeGuerra =
        cad && cad.nomeGuerra
          ? cad.nomeGuerra
          : info.nome;

      // FUNÇÃO correta:
      // prioriza exatamente a função originada da Lista de Voluntários / Forms.
      var funcao =
        voluntario && voluntario.funcao
          ? voluntario.funcao
          : normalizarFuncaoMilitar(r[4] || "Vistoriador");

      var hIni = String(r[7] || "").trim();
      var hFim = String(r[8] || "").trim();
      var obs = String(r[11] || "").trim();

      registros.push({
        dataObj: dObj,
        data: dataTexto,
        postoGrad: String(postoGrad || "SGT/CB/SD").toUpperCase(),
        rg: rgPSE,
        nome: String(nomeGuerra || nomeControle || "MILITAR").toUpperCase(),
        funcao: funcao,
        horario: formatarHorarioFaixa_(hIni, hFim),
        turno: turnoNorm,
        ordemTurno: ordemTurnos[turnoNorm] || 99,
        obs: formatarObsPSE_(obs)
      });
    });
  }

  registros.sort(function(a, b) {
    var ta = a.dataObj.getTime();
    var tb = b.dataObj.getTime();

    if (ta !== tb) return ta - tb;
    if (a.ordemTurno !== b.ordemTurno) return a.ordemTurno - b.ordemTurno;

    return a.nome.localeCompare(b.nome);
  });

  // Monta linhas e identifica grupos por DIA + TURNO.
  var linhas = [];
  var grupos = [];

  var dataAtual = "";
  var numeroDia = 0;

  var chaveGrupoAtual = "";
  var grupoAtual = null;

  registros.forEach(function(r) {
    if (r.data !== dataAtual) {
      dataAtual = r.data;
      numeroDia = 1;
    } else {
      numeroDia++;
    }

    var chaveGrupo = r.data + "|" + r.turno;

    if (chaveGrupo !== chaveGrupoAtual) {
      if (grupoAtual) {
        grupoAtual.fim = linhas.length + 1;
        grupos.push(grupoAtual);
      }

      chaveGrupoAtual = chaveGrupo;

      grupoAtual = {
        chave: chaveGrupo,
        data: r.data,
        turno: r.turno,
        inicio: linhas.length + 2, // linha real da planilha
        fim: linhas.length + 2,
        obs: r.obs
      };
    } else {
      grupoAtual.fim = linhas.length + 2;
    }

    // A coluna I recebe o conteúdo só na primeira linha do grupo.
    // Depois ela será mesclada verticalmente por DIA + TURNO.
    var conteudoObs =
      grupoAtual.inicio === linhas.length + 2
        ? r.obs
        : "";

    linhas.push([
      numeroDia,
      r.data,
      r.postoGrad,
      r.rg,
      r.nome,
      r.funcao,
      r.horario,
      r.turno,
      conteudoObs
    ]);
  });

  if (grupoAtual) {
    grupoAtual.fim = linhas.length + 1;
    grupos.push(grupoAtual);
  }

  // Limpa conteúdo e formatação anteriores.
  abaEscala.clear();

  abaEscala
    .getRange(1, 1, 1, 9)
    .setValues(cabecalho);

  if (linhas.length > 0) {
    abaEscala
      .getRange(2, 1, linhas.length, 9)
      .setValues(linhas);
  }

  // -----------------------------
  // FORMATAÇÃO DO CABEÇALHO
  // -----------------------------
  abaEscala.setFrozenRows(1);

  abaEscala
    .getRange(1, 1, 1, 9)
    .setFontWeight("bold")
    .setFontColor("#FFFFFF")
    .setBackground("#1F2933")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  if (linhas.length > 0) {
    var faixaDados = abaEscala.getRange(2, 1, linhas.length, 9);

    faixaDados
      .setWrap(true)
      .setVerticalAlignment("middle");

    abaEscala
      .getRange(2, 1, linhas.length, 4)
      .setHorizontalAlignment("center");

    abaEscala
      .getRange(2, 6, linhas.length, 4)
      .setHorizontalAlignment("center");

    abaEscala
      .getRange(2, 4, linhas.length, 1)
      .setNumberFormat("@");

    // Bordas gerais.
    faixaDados.setBorder(
      true, true, true, true, true, true
    );

    // -----------------------------
    // COLORAÇÃO POR DIA
    // -----------------------------
    // Todas as pessoas escaladas no mesmo dia recebem a mesma cor.
    var coresPorDia = [
      "#FFF2CC", // amarelo claro
      "#DDEBF7", // azul claro
      "#E2F0D9", // verde claro
      "#FCE4D6", // pêssego claro
      "#E4DFEC", // lilás claro
      "#DDEBF7"
    ];

    var mapaCorDia = {};
    var indiceCor = 0;

    registros.forEach(function(r, idx) {
      if (!mapaCorDia[r.data]) {
        mapaCorDia[r.data] = coresPorDia[indiceCor % coresPorDia.length];
        indiceCor++;
      }

      abaEscala
        .getRange(idx + 2, 1, 1, 9)
        .setBackground(mapaCorDia[r.data]);
    });

    // -----------------------------
    // COLUNA I - AGRUPADA POR DIA + TURNO
    // -----------------------------
    grupos.forEach(function(g) {
      var quantidadeLinhas = g.fim - g.inicio + 1;

      if (quantidadeLinhas > 1) {
        var rangeObs = abaEscala.getRange(
          g.inicio,
          9,
          quantidadeLinhas,
          1
        );

        rangeObs.mergeVertically();
      }

      abaEscala
        .getRange(g.inicio, 9)
        .setValue(g.obs)
        .setHorizontalAlignment("center")
        .setVerticalAlignment("middle")
        .setWrap(true)
        .setFontWeight("bold");

      // Separação visual mais forte entre MATUTINO / VESPERTINO / NOTURNO.
      abaEscala
        .getRange(g.inicio, 1, 1, 9)
        .setBorder(
          true,
          null,
          null,
          null,
          null,
          null,
          "#000000",
          SpreadsheetApp.BorderStyle.SOLID_THICK
        );

      abaEscala
        .getRange(g.fim, 1, 1, 9)
        .setBorder(
          null,
          null,
          true,
          null,
          null,
          null,
          "#000000",
          SpreadsheetApp.BorderStyle.SOLID_THICK
        );
    });

    // -----------------------------
    // FILTRO
    // -----------------------------
    // O filtro vai de A:H para permitir que a coluna I permaneça
    // mesclada por dia + turno sem conflito com o filtro.
    abaEscala
      .getRange(1, 1, linhas.length + 1, 8)
      .createFilter();
  }

  var larguras = [
    45,  // A Nº
    100, // B Data
    130, // C Posto
    75,  // D RG
    175, // E Nome
    125, // F Função
    125, // G Horário
    105, // H Turno
    220  // I OS/SEI/RAI
  ];

  for (var c = 0; c < larguras.length; c++) {
    abaEscala.setColumnWidth(c + 1, larguras[c]);
  }

  return linhas.length;
}

function formatarHorarioFaixa_(inicio, fim) {
  function f(h) {
    var s = String(h || "").trim();
    if (!s) return "";
    var m = s.match(/(\d{1,2}):(\d{2})/);
    if (!m) return s;
    var hh = (parseInt(m[1], 10) < 10 ? "0" : "") + parseInt(m[1], 10);
    return hh + "h" + m[2];
  }
  var a = f(inicio), b = f(fim);
  return (a && b) ? (a + " às " + b) : (a || b || "");
}

function formatarObsPSE_(obs) {
  var texto = String(obs || "").trim();
  var os = "N/A", sei = "N/A", rai = "N/A";
  var mOs = texto.match(/OS:\s*([^|]+)/i);
  var mSei = texto.match(/SEI:\s*([^|]+)/i);
  var mRai = texto.match(/RAI:\s*([^|]+)/i);
  if (mOs) os = String(mOs[1]).trim();
  if (mSei) sei = String(mSei[1]).trim();
  if (mRai) rai = String(mRai[1]).trim();
  return "OS\n" + os + "\nSEI\n" + sei + "\nRAI\n" + rai;
}

function obterDadosEscala_(dataInicio, dataFim) {
  sincronizarEscalaPSE();
  var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Escala PSE");
  if (!aba) return { erro: "Aba 'Escala PSE' não encontrada." };
  if (aba.getLastRow() === 0) return { matriz: [] };
  return { matriz: aba.getDataRange().getDisplayValues() };
}





// ----------------------------------------------------------

// RELATÓRIO DO SEI - NOVO MODELO (Ord, Posto/Grad, RG, Nome, Função, Horário)

// ----------------------------------------------------------




// ----------------------------------------------------------
// CONSULTA DA ESCALA PSE NO MÓDULO VISTORIAS
// ----------------------------------------------------------
function obterEscalaPSEVistorias(dataFiltro, token) {
  exigirPerfil_(token, ["CONFERENCIA"]);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("Escala PSE");

  // A Escala PSE já é mantida pelo módulo de escala.
  // Não reconstruímos a planilha em toda consulta do WebApp,
  // pois isso deixava a navegação lenta. Só cria/sincroniza
  // se a aba ainda não existir.
  if (!aba) {
    sincronizarEscalaPSE();
    aba = ss.getSheetByName("Escala PSE");
  }

  if (!aba || aba.getLastRow() < 2) {
    return { sucesso:true, itens:[], dataExibicao:"" };
  }

  var totalLinhas = aba.getLastRow() - 1;
  var range = aba.getRange(2, 1, totalLinhas, 9);
  var vals = range.getDisplayValues();
  var cores = range.getBackgrounds();

  var filtroObj = criarDataSegura(dataFiltro);
  var filtroTexto = filtroObj ? formatarDataTexto(filtroObj) : "";

  var itens = [];
  var obsGrupo = "";
  var chaveGrupoAnterior = "";

  vals.forEach(function(r, i) {
    var data = String(r[1] || "").trim();
    var turno = String(r[7] || "").trim();
    var chaveGrupo = data + "|" + turno;

    if (chaveGrupo !== chaveGrupoAnterior) {
      obsGrupo = String(r[8] || "").trim();
      chaveGrupoAnterior = chaveGrupo;
    } else if (String(r[8] || "").trim()) {
      obsGrupo = String(r[8] || "").trim();
    }

    if (filtroTexto && data !== filtroTexto) return;

    itens.push({
      numero:String(r[0] || "").trim(),
      data:data,
      postoGrad:String(r[2] || "").trim(),
      rg:String(r[3] || "").trim(),
      nome:String(r[4] || "").trim(),
      funcao:String(r[5] || "").trim(),
      horario:String(r[6] || "").trim(),
      turno:turno,
      obs:obsGrupo,
      corFundo:(cores[i] && cores[i][0]) ? cores[i][0] : "#FFFFFF",
      chaveGrupo:chaveGrupo
    });
  });

  var quantidades = {};
  itens.forEach(function(x) {
    quantidades[x.chaveGrupo] = (quantidades[x.chaveGrupo] || 0) + 1;
  });

  itens.forEach(function(x) {
    x.tamanhoGrupo = quantidades[x.chaveGrupo] || 1;
    delete x.chaveGrupo;
  });

  return {
    sucesso:true,
    itens:itens,
    dataExibicao:filtroTexto
  };
}


function obterVisualizacaoEscalaSEI_(dataInicio, dataFim) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaControle = ss.getSheetByName("CONTROLE_ESCALAS");
  if (!abaControle) return { erro: "Aba CONTROLE_ESCALAS não encontrada." };
  if (abaControle.getLastRow() < 2) return { erro: "Não há registros de escala." };

  var dIniObj = criarDataSegura(dataInicio);
  var dFimObj = criarDataSegura(dataFim);
  var mapaMilitares = obterMapaMilitaresPorRg_();

  // Para a visualização do SEI, a FUNÇÃO deve ser a mesma informada no Forms.
  var mapasVoluntariosSEI = obterMapasListaVoluntariosPSE_();
  var dados = abaControle.getRange(2, 1, abaControle.getLastRow() - 1, 13).getDisplayValues();
  var listaBruta = [];
  var ordemTurnos = { "Matutino": 1, "Vespertino": 2, "Noturno": 3 };

  dados.forEach(function(r) {
    var dObj = criarDataSegura(r[0]);
    var dataStr = formatarDataTexto(dObj);
    var rg = normalizarRgCadastro_(r[1]);
    var nomeControle = String(r[2] || "").trim();
    var turno = String(r[3] || "Matutino").trim();
    var voluntarioSEI = localizarVoluntarioPSE_(
      mapasVoluntariosSEI,
      dataStr,
      turno,
      rg,
      nomeControle
    );

    var funcaoMilitar = (
      voluntarioSEI && voluntarioSEI.funcao
    )
      ? voluntarioSEI.funcao
      : normalizarFuncaoMilitar(r[4] || "Vistoriador");
    var status = String(r[6] || "").trim().toUpperCase();

    if (status !== "ESCALADO" || !rg || !dObj) return;
    if (dIniObj && dObj < dIniObj) return;
    if (dFimObj && dObj > dFimObj) return;

    var cad = mapaMilitares[rg] || null;
    var infoNome = extrairPostoENome(nomeControle);
    var postoGrad = cad && cad.postoGrad ? cad.postoGrad : infoNome.posto;
    var nomeGuerra = cad && cad.nomeGuerra ? cad.nomeGuerra : infoNome.nome;
    var hIni = String(r[7] || (turno === "Vespertino" ? "13:00" : (turno === "Noturno" ? "19:00" : "07:00"))).trim();
    var hFim = String(r[8] || (turno === "Vespertino" ? "19:00" : (turno === "Noturno" ? "01:00" : "13:00"))).trim();

    listaBruta.push({
      timestamp: dObj.getTime(),
      dataStr: dataStr,
      turno: turno,
      ordemTurno: ordemTurnos[turno] || 99,
      rg: rg,
      postoGrad: String(postoGrad || "SGT/CB/SD").toUpperCase(),
      nomeGuerra: String(nomeGuerra || nomeControle || "MILITAR").toUpperCase(),
      funcao: funcaoMilitar,
      horario: formatarHorarioFaixa_(hIni, hFim)
    });
  });

  listaBruta.sort(function(a, b) {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    if (a.ordemTurno !== b.ordemTurno) return a.ordemTurno - b.ordemTurno;
    return a.nomeGuerra.localeCompare(b.nomeGuerra);
  });

  var registrosFormatados = [];
  var chaveGrupoAtual = "";
  var ordContador = 1;

  listaBruta.forEach(function(item) {
    var chaveGrupo = item.dataStr + "|" + item.turno;
    if (chaveGrupo !== chaveGrupoAtual) {
      chaveGrupoAtual = chaveGrupo;
      ordContador = 1;
    }
    registrosFormatados.push({
      ord: ordContador++,
      postoGrad: item.postoGrad,
      rg: item.rg,
      nome: item.nomeGuerra,
      funcao: item.funcao,
      horario: item.horario,
      data: item.dataStr,
      turno: item.turno
    });
  });

  return {
    periodo: (dataInicio && dataFim) ? (dataInicio.split("-").reverse().join("/") + " a " + dataFim.split("-").reverse().join("/")) : "PERÍODO CORRENTE",
    total: registrosFormatados.length,
    registros: registrosFormatados
  };
}





function lancarEscalaSEI_(dataInicio, dataFim) {

  var dadosSEI = obterVisualizacaoEscalaSEI_(dataInicio, dataFim);

  if (dadosSEI.erro) return { sucesso: false, mensagem: dadosSEI.erro };

  return { sucesso: true, mensagem: "Escala SEI processada com sucesso! Total de " + dadosSEI.total + " militar(es) escalados.", dados: dadosSEI };

}

// Arquivamento exclusivo de rascunhos. Instalar uma vez pelo editor, com a conta responsável.
function dataRascunhoArquivo_(valor) {
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
  var s = String(valor || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s = s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4);
  if (!/^\d{2}\/\d{2}\/\d{4}(?: \d{2}:\d{2}(?::\d{2})?)?$/.test(s)) return null;
  var formato = s.length === 10 ? 'dd/MM/yyyy' : (s.length === 16 ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy HH:mm:ss');
  try {
    var d = Utilities.parseDate(s, 'America/Sao_Paulo', formato);
    return Utilities.formatDate(d, 'America/Sao_Paulo', formato) === s ? d : null;
  } catch (e) { return null; }
}

function planejarArquivamentoRascunhos_(linhas, agora) {
  var corte = agora.getTime() - 15 * 24 * 60 * 60 * 1000;
  var hoje = Utilities.formatDate(agora, 'America/Sao_Paulo', 'yyyy-MM-dd');
  var elegiveis = [], datasInvalidas = 0;
  linhas.forEach(function(r, i) {
    var status = String(r[20] || '').trim().toUpperCase();
    if (status !== 'RASCUNHO' && status !== 'REMOVIDO') return;
    if (!String(r[1] || '').trim()) return;
    var salvo = dataRascunhoArquivo_(r[19]), data = dataRascunhoArquivo_(r[0]);
    if (!salvo || !data) { datasInvalidas++; return; }
    if (salvo.getTime() <= corte &&
        Utilities.formatDate(data, 'America/Sao_Paulo', 'yyyy-MM-dd') < hoje) elegiveis.push(i);
  });
  return {indices:elegiveis, datasInvalidas:datasInvalidas};
}

function configurarColunasArquivoRascunhos_(origem, destino) {
  if (origem.getMaxColumns() < 24) origem.insertColumnsAfter(origem.getMaxColumns(), 24-origem.getMaxColumns());
  var cabId = String(origem.getRange(1,24).getDisplayValue() || '').trim();
  if (cabId && cabId !== 'ARQUIVO_RASCUNHO_ID') throw new Error('Coluna 24 do rascunho já está ocupada. Arquivamento não ativado.');
  if (!cabId) origem.getRange(1,24).setValue('ARQUIVO_RASCUNHO_ID');
  if (destino.getMaxColumns() < 30) destino.insertColumnsAfter(destino.getMaxColumns(),30-destino.getMaxColumns());
  var cab = origem.getRange(1,1,1,23).getDisplayValues()[0].concat([
    'ARQUIVO_RASCUNHO_ID','ARQUIVADO_EM','ARQUIVADO_POR','ORIGEM_PLANILHA_ID','ORIGEM_LINHA','RESTAURADO_EM','RESTAURADO_POR'
  ]);
  if (destino.getLastRow() === 0) destino.getRange(1,1,1,30).setValues([cab]);
  else {
    var atual = destino.getRange(1,1,1,30).getDisplayValues()[0];
    if (JSON.stringify(atual) !== JSON.stringify(cab)) throw new Error('Cabeçalho do arquivo incompatível. Nenhum rascunho foi excluído.');
  }
}

function configuracaoArquivoRascunhos_() {
  var p = PropertiesService.getScriptProperties();
  return {origem:p.getProperty('RASCUNHO_ORIGEM_ID'),destino:p.getProperty('RASCUNHO_ARQUIVO_ID'),ativo:p.getProperty('RASCUNHO_ARQUIVAMENTO_ATIVO') === 'SIM'};
}

function instalarArquivamentoRascunhos_(somenteSeNovo) {
  var lockInstalacao=LockService.getScriptLock();lockInstalacao.waitLock(15000);
  try {
  var props = PropertiesService.getScriptProperties();
  if(somenteSeNovo && props.getProperty('RASCUNHO_ARQUIVAMENTO_ATIVO')) return {ativo:props.getProperty('RASCUNHO_ARQUIVAMENTO_ATIVO')==='SIM'};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = configuracaoArquivoRascunhos_();
  if (!ss && config.origem) ss = SpreadsheetApp.openById(config.origem);
  if (!ss) throw new Error('Abra o projeto pela planilha correta ou configure RASCUNHO_ORIGEM_ID nas propriedades do script.');
  if (config.origem && config.origem !== ss.getId()) throw new Error('A origem configurada é diferente da planilha aberta. Confira RASCUNHO_ORIGEM_ID.');
  var origem = ss.getSheetByName('RASCUNHO_ROTEIRO');
  if (!origem || origem.getLastRow() < 1) throw new Error('A planilha precisa ter a aba RASCUNHO_ROTEIRO com cabeçalhos.');
  if (config.destino === ss.getId()) throw new Error('O arquivo deve ser uma planilha separada da origem.');
  var arquivo;
  if (config.destino) arquivo = SpreadsheetApp.openById(config.destino);
  else {
    arquivo = SpreadsheetApp.create('ARQUIVO_RASCUNHOS_DIC');
    arquivo.setSpreadsheetLocale('pt_BR');
    arquivo.setSpreadsheetTimeZone('America/Sao_Paulo');
    arquivo.getSheets()[0].setName('RASCUNHOS_ARQUIVADOS');
    props.setProperty('RASCUNHO_ARQUIVO_ID',arquivo.getId());
  }
  var destino = arquivo.getSheetByName('RASCUNHOS_ARQUIVADOS') || arquivo.insertSheet('RASCUNHOS_ARQUIVADOS');
  configurarColunasArquivoRascunhos_(origem,destino);
  props.setProperty('RASCUNHO_ORIGEM_ID',ss.getId());
  var existe = ScriptApp.getProjectTriggers().some(function(t) { return t.getHandlerFunction() === 'executarArquivamentoRascunhos_'; });
  if (!existe) ScriptApp.newTrigger('executarArquivamentoRascunhos_').timeBased().everyDays(1).atHour(3).inTimezone('America/Sao_Paulo').create();
  props.setProperty('RASCUNHO_ARQUIVAMENTO_ATIVO','SIM');
  console.log('Arquivamento diário ativado, por volta das 03h de São Paulo. Arquivo: ' + arquivo.getUrl());
  return {ativo:true,arquivoUrl:arquivo.getUrl()};
  } finally { lockInstalacao.releaseLock(); }
}

function desativarArquivamentoRascunhos_() {
  PropertiesService.getScriptProperties().setProperty('RASCUNHO_ARQUIVAMENTO_ATIVO','NÃO');
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'executarArquivamentoRascunhos_') ScriptApp.deleteTrigger(t);
  });
  return 'Arquivamento desativado. Nenhum dado foi removido.';
}

function abrirBasesArquivoRascunhos_() {
  var c = configuracaoArquivoRascunhos_();
  if (!c.origem || !c.destino || c.origem === c.destino) throw new Error('Arquivamento não configurado ou origem/destino inválidos.');
  var ativa = SpreadsheetApp.getActiveSpreadsheet();
  if (ativa && ativa.getId() !== c.origem) throw new Error('O arquivo configurado pertence a outra planilha de origem.');
  var ss = SpreadsheetApp.openById(c.origem), arquivo = SpreadsheetApp.openById(c.destino);
  var origem = ss.getSheetByName('RASCUNHO_ROTEIRO'), destino = arquivo.getSheetByName('RASCUNHOS_ARQUIVADOS');
  if (!origem || !destino) throw new Error('Aba de rascunhos ou de arquivo não localizada.');
  return {origem:origem,destino:destino,origemId:c.origem};
}

function assinaturaLinhaArquivoRascunho_(linha) {
  return JSON.stringify(linha.map(function(v) { return v === null || v === undefined ? '' : v; }));
}

function simularArquivamentoRascunhos_() {
  var c = configuracaoArquivoRascunhos_();
  var ss = c.origem ? SpreadsheetApp.openById(c.origem) : SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss && ss.getSheetByName('RASCUNHO_ROTEIRO');
  if (!aba) throw new Error('Aba RASCUNHO_ROTEIRO não encontrada.');
  var vals = aba.getLastRow() < 2 ? [] : aba.getRange(2,1,aba.getLastRow()-1,23).getValues();
  var plano = planejarArquivamentoRascunhos_(vals,new Date());
  var resumo = {elegiveis:plano.indices.length,datasInvalidasPreservadas:plano.datasInvalidas,limitePorExecucao:50};
  console.log(JSON.stringify(resumo));
  return resumo;
}

function executarArquivamentoRascunhos_() {
  if (!configuracaoArquivoRascunhos_().ativo) return {ativo:false,arquivados:0};
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return {ocupado:true,arquivados:0};
  try {
    var bases = abrirBasesArquivoRascunhos_();
    var resultado = moverLoteRascunhosArquivo_(bases,new Date(),50);
    console.log(JSON.stringify(resultado));
    return resultado;
  } finally { lock.releaseLock(); }
}

function moverLoteRascunhosArquivo_(bases, agora, limite) {
  var origem=bases.origem,destino=bases.destino;
  configurarColunasArquivoRascunhos_(origem,destino);
  var vals = origem.getLastRow() < 2 ? [] : origem.getRange(2,1,origem.getLastRow()-1,24).getValues();
  var plano = planejarArquivamentoRascunhos_(vals,agora);
  var idsOrigem=Object.create(null),mapaArquivo=Object.create(null);
  vals.forEach(function(r) { if(r[23]) idsOrigem[String(r[23])]=(idsOrigem[String(r[23])]||0)+1; });
  if (destino.getLastRow()>=2) destino.getRange(2,24,destino.getLastRow()-1,1).getDisplayValues().forEach(function(r,i) {
    if(r[0]) { if(mapaArquivo[r[0]]) throw new Error('Identificador duplicado no arquivo. Nenhuma exclusão iniciada.'); mapaArquivo[r[0]]=i+2; }
  });
  var selecionados=[],novas=[],verificadas=0,colisoes=0;
  for(var k=0;k<plano.indices.length && selecionados.length<limite;k++) {
    var i=plano.indices[k],r=vals[i],id=String(r[23]||''),anterior=null;
    if(id && idsOrigem[id]>1) { colisoes++;continue; }
    if(id && mapaArquivo[id]) {
      anterior=destino.getRange(mapaArquivo[id],1,1,30).getValues()[0];
      if(anterior[28]) { id='';anterior=null; }
    }
    if(!id) { id=Utilities.getUuid();origem.getRange(i+2,24).setValue(id);r[23]=id; }
    if(anterior) {
      if(String(anterior[26])!==bases.origemId || assinaturaLinhaArquivoRascunho_(anterior.slice(0,24))!==assinaturaLinhaArquivoRascunho_(r)) throw new Error('Cópia arquivada diverge da origem. Nenhuma exclusão iniciada.');
      verificadas++;
    } else novas.push(r.slice(0,24).concat([Utilities.formatDate(agora,'America/Sao_Paulo','dd/MM/yyyy HH:mm:ss'),'AUTOMÁTICO',bases.origemId,i+2,'','']));
    selecionados.push({linha:i+2,valores:r.slice(0,24)});
  }
  if(novas.length) {
    var inicio=destino.getLastRow()+1;
    garantirLinhasArquivoRascunhos_(destino,inicio+novas.length-1);
    destino.getRange(inicio,1,novas.length,30).setValues(novas);
    SpreadsheetApp.flush();
    var conferidas=destino.getRange(inicio,1,novas.length,30).getValues();
    if(assinaturaLinhaArquivoRascunho_(conferidas)!==assinaturaLinhaArquivoRascunho_(novas)) throw new Error('Falha ao verificar o arquivo. Nenhum rascunho foi excluído.');
    verificadas+=novas.length;
  }
  if(verificadas!==selecionados.length) throw new Error('Lote incompleto. Nenhuma exclusão iniciada.');
  // Exclui blocos de baixo para cima, rechecando os dados antes de cada exclusão.
  var n=selecionados.length-1,removidos=0;
  while(n>=0) {
    var fim=n,inicioGrupo=n;
    while(inicioGrupo>0 && selecionados[inicioGrupo-1].linha===selecionados[inicioGrupo].linha-1) inicioGrupo--;
    var grupo=selecionados.slice(inicioGrupo,fim+1),primeira=grupo[0].linha;
    var atuais=origem.getRange(primeira,1,grupo.length,24).getValues();
    if(assinaturaLinhaArquivoRascunho_(atuais)!==assinaturaLinhaArquivoRascunho_(grupo.map(function(x){return x.valores;}))) throw new Error('Os rascunhos mudaram durante a operação. As cópias foram preservadas; confira antes de repetir.');
    origem.deleteRows(primeira,grupo.length);removidos+=grupo.length;n=inicioGrupo-1;
  }
  return {arquivados:removidos,elegiveisAntes:plano.indices.length,datasInvalidasPreservadas:plano.datasInvalidas,idsDuplicadosPreservados:colisoes};
}

function listarRascunhosArquivados(dataRoteiro,token) {
  exigirPerfil_(token,['GESTOR']);
  var config=configuracaoArquivoRascunhos_();
  if(!config.destino) return {configurado:false,itens:[]};
  var data=dataRascunhoArquivo_(dataRoteiro),chave=data && Utilities.formatDate(data,'America/Sao_Paulo','yyyy-MM-dd');
  if(!chave) throw new Error('Selecione a data do roteiro para consultar o arquivo.');
  var bases=abrirBasesArquivoRascunhos_(),aba=bases.destino,linhas=[];
  if(aba.getLastRow()>=2) aba.getRange(2,1,aba.getLastRow()-1,1).getValues().forEach(function(r,i) {
    var d=dataRascunhoArquivo_(r[0]);if(d && Utilities.formatDate(d,'America/Sao_Paulo','yyyy-MM-dd')===chave) linhas.push(i+2);
  });
  var mapa={data:linhas.slice(-100)},valores=lerLinhasProtocolosRoteiro_(aba,mapa,30);
  var itens=mapa.data.map(function(linha) {
    var r=valores[linha];return {id:String(r[26])===bases.origemId?r[23]:'',protocolo:r[1],status:r[20],arquivadoEm:r[24],restauradoEm:r[28]||''};
  }).filter(function(item) { return !!item.id; }).reverse();
  return {configurado:true,total:linhas.length,itens:itens};
}

function restaurarRascunhoArquivado(id,token) {
  var sessao=exigirPerfil_(token,['GESTOR']);
  id=String(id||'').trim();if(!/^[A-Za-z0-9-]{1,100}$/.test(id)) throw new Error('Identificador inválido.');
  var lock=LockService.getScriptLock();lock.waitLock(15000);
  try {
    var bases=abrirBasesArquivoRascunhos_(),origem=bases.origem,arquivo=bases.destino;
    configurarColunasArquivoRascunhos_(origem,arquivo);
    if(arquivo.getLastRow()<2) throw new Error('Rascunho não encontrado.');
    var achados=arquivo.getRange(2,24,arquivo.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findAll();
    if(achados.length!==1) throw new Error('Rascunho não encontrado ou identificador duplicado.');
    var linha=achados[0].getRow(),r=arquivo.getRange(linha,1,1,30).getValues()[0];
    if(String(r[26])!==bases.origemId) throw new Error('O rascunho pertence a outra origem.');
    if(r[28]) return {restaurado:false,jaRestaurado:true};
    var ativos=origem.getLastRow()<2?[]:origem.getRange(2,1,origem.getLastRow()-1,24).getValues();
    var existentes=ativos.filter(function(x){return String(x[23]||'')===id;});
    if(existentes.length>1) throw new Error('Identificador duplicado na origem.');
    if(!existentes.length && ativos.some(function(x){return assinaturaDataRascunhoArquivo_(x[0])===assinaturaDataRascunhoArquivo_(r[0])&&String(x[1])===String(r[1])&&String(x[20]).toUpperCase()==='RASCUNHO';})) throw new Error('Já existe rascunho ativo desse protocolo na mesma data. Nenhum dado foi sobrescrito.');
    var agora=dataHoraSaoPauloTexto_(),volta=r.slice(0,24);
    volta[17]=sessao.rg;volta[18]=sessao.nomeGuerra||sessao.nome||sessao.rg;volta[19]=agora;volta[20]='RASCUNHO';
    if(existentes.length) {
      if(String(existentes[0][20]).trim().toUpperCase()!=='RASCUNHO') throw new Error('O registro na origem já mudou de situação. Nenhum dado foi sobrescrito.');
      var ok=existentes[0].every(function(v,i){return [17,18,19,20].indexOf(i)>=0 || assinaturaLinhaArquivoRascunho_([v])===assinaturaLinhaArquivoRascunho_([volta[i]]);});
      if(!ok) throw new Error('O rascunho recuperado já foi editado. Nenhum dado foi sobrescrito.');
    } else {
      var novaLinha=origem.getLastRow()+1;garantirLinhasArquivoRascunhos_(origem,novaLinha);origem.getRange(novaLinha,1,1,24).setValues([volta]);SpreadsheetApp.flush();
      if(assinaturaLinhaArquivoRascunho_(origem.getRange(novaLinha,1,1,24).getValues()[0])!==assinaturaLinhaArquivoRascunho_(volta)) throw new Error('Recuperação não confirmada. A cópia arquivada permanece disponível.');
    }
    arquivo.getRange(linha,29,1,2).setValues([[agora,String(sessao.rg)]]);
    return {restaurado:true,protocolo:String(r[1])};
  } finally { lock.releaseLock(); }
}

function assinaturaDataRascunhoArquivo_(valor) {
  var d=dataRascunhoArquivo_(valor);
  return d ? Utilities.formatDate(d,'America/Sao_Paulo','yyyy-MM-dd') : String(valor);
}

function garantirLinhasArquivoRascunhos_(aba,ultima) {
  if (ultima>aba.getMaxRows()) aba.insertRowsAfter(aba.getMaxRows(),ultima-aba.getMaxRows());
}

// Controle administrativo: autenticação sempre antes de abrir ou alterar o arquivo.
function inicializarControleDadosGestor(token) {
  exigirPerfil_(token,['GESTOR']);
  var props=PropertiesService.getScriptProperties();
  // Ausência da propriedade indica primeira instalação. Pausa explícita é respeitada.
  if (!props.getProperty('RASCUNHO_ARQUIVAMENTO_ATIVO')) instalarArquivamentoRascunhos_(true);
  var c=configuracaoArquivoRascunhos_();
  var ativa=SpreadsheetApp.getActiveSpreadsheet();
  if(ativa && c.origem && ativa.getId()!==c.origem)throw new Error('O arquivo configurado pertence a outra planilha. Confira as propriedades de origem e arquivo antes de ativar.');
  return {ativo:c.ativo,configurado:!!(c.origem&&c.destino),retencaoDias:15,
    limitePorExecucao:50,arquivoUrl:c.destino?'https://docs.google.com/spreadsheets/d/'+encodeURIComponent(c.destino)+'/edit':''};
}

function obterControleDadosGestor(token) {
  var controle=inicializarControleDadosGestor(token);
  var resumo=simularArquivamentoRascunhos_();
  return {controle:controle,resumo:resumo};
}

function gerenciarArquivoRascunhosGestor(acao,token) {
  exigirPerfil_(token,['GESTOR']);
  var resultado;
  if(acao==='ativar') resultado=instalarArquivamentoRascunhos_();
  else if(acao==='pausar') resultado=desativarArquivamentoRascunhos_();
  else if(acao==='executar') resultado=executarArquivamentoRascunhos_();
  else throw new Error('Ação inválida.');
  return {resultado:resultado,controle:inicializarControleDadosGestor(token)};
}

// Datas exibidas pelo Sheets: interpretação explícita evita confundir dia e mês.
function timestampAtualizacaoCredenciamento_(valor) {
  if(valor instanceof Date)return isNaN(valor.getTime())?0:valor.getTime();
  var texto=String(valor||'').trim();
  var br=texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  var iso=texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  var m=br||iso;if(!m)return 0;
  var ano=Number(br?m[3]:m[1]),mes=Number(m[2])-1,dia=Number(br?m[1]:m[3]);
  var hora=Number(m[4]||0),minuto=Number(m[5]||0),segundo=Number(m[6]||0);
  var d=new Date(ano,mes,dia,hora,minuto,segundo);
  return d.getFullYear()===ano && d.getMonth()===mes && d.getDate()===dia &&
    d.getHours()===hora && d.getMinutes()===minuto && d.getSeconds()===segundo?d.getTime():0;
}

function camposComplementosCredenciamento_() {
  return ['origem','numeroSei','numeroCbmgo','endereco','bairro','obmResponsavel','cnpjCpf','responsavelTecnico','area','dataEnvio'];
}
function cabecalhoComplementosCredenciamento_() {
  return ['PROTOCOLO','ORIGEM','NUMERO_SEI','NUMERO_CBMGO','ENDERECO','BAIRRO','OBM_RESPONSAVEL','CNPJ_CPF','RESPONSAVEL_TECNICO','AREA','DATA_ENVIO','ATUALIZADO_EM'];
}
function conferirComplementosCredenciamento_(aba) {
  if(aba&&aba.getLastRow()>0&&JSON.stringify(aba.getRange(1,1,1,12).getDisplayValues()[0])!==JSON.stringify(cabecalhoComplementosCredenciamento_()))throw new Error('Cabeçalho de CREDENCIAMENTO_COMPLEMENTOS incompatível. Confira a aba antes de importar.');
}
function mapaComplementosCredenciamento_() {
  var a=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CREDENCIAMENTO_COMPLEMENTOS'),mapa=Object.create(null);
  conferirComplementosCredenciamento_(a);
  if(a&&a.getLastRow()>=2)a.getRange(2,1,a.getLastRow()-1,12).getDisplayValues().forEach(function(r,i){
    var p=normalizarProtocoloRoteiro_(r[0]);if(!p)return;
    var x={};camposComplementosCredenciamento_().forEach(function(c,k){x[c]=String(r[k+1]||'');});
    if(mapa[p])throw new Error('Protocolo duplicado na aba de complementos: '+p);
    mapa[p]={linha:i+2,dados:x};
  });
  return mapa;
}
function complementarCredenciamento_(item,mapa) {
  var entrada=mapa[normalizarProtocoloRoteiro_(item.protocolo)];
  if(entrada)Object.keys(entrada.dados).forEach(function(c){item[c]=entrada.dados[c];});
  return item;
}
function validarNumeroSeiCredenciamento_(numero) {
  var n=String(numero||'').trim();
  if(n && (!/^[0-9.\/ -]+$/.test(n)||n.replace(/\D/g,'').length<5||n.length>40))throw new Error('Informe um número de processo SEI válido, mantendo os zeros iniciais.');
  return n;
}
function gravarComplementosCredenciamento_(itens,mapa) {
  if(!itens.length)return;
  var ss=SpreadsheetApp.getActiveSpreadsheet(),a=ss.getSheetByName('CREDENCIAMENTO_COMPLEMENTOS');
  if(!a)a=ss.insertSheet('CREDENCIAMENTO_COMPLEMENTOS');
  conferirComplementosCredenciamento_(a);
  prepararCabecalhoLeve_(a,cabecalhoComplementosCredenciamento_(),{primeiroVazio:true});
  var alteradas={},proxima=a.getLastRow()+1,agora=dataHoraSaoPauloTexto_();
  itens.forEach(function(item){
    var p=normalizarProtocoloRoteiro_(item.protocolo),anterior=mapa[p],dados=Object.assign({},anterior?anterior.dados:{});
    camposComplementosCredenciamento_().forEach(function(c){if(item[c]!==undefined&&String(item[c]).trim())dados[c]=String(item[c]).trim();});
    if(anterior&&anterior.dados.origem&&item.origem){
      dados.origem=anterior.dados.origem.split(' / ').concat(item.origem.split(' / ')).filter(function(v,i,t){return t.indexOf(v)===i;}).join(' / ');
    }
    dados.numeroSei=validarNumeroSeiCredenciamento_(dados.numeroSei);
    var linha=anterior?anterior.linha:proxima++;
    alteradas[linha]=[p].concat(camposComplementosCredenciamento_().map(function(c){return dados[c]||'';}),[agora]);
    mapa[p]={linha:linha,dados:dados};
  });
  garantirLinhasArquivoRascunhos_(a,Math.max.apply(null,Object.keys(alteradas).map(Number)));
  // Identificadores são texto: mantém zeros iniciais e números SEI extensos.
  a.getRangeList(Object.keys(alteradas).map(function(l){return 'A'+l+':L'+l;})).setNumberFormat('@');
  gravarLinhasAlteradasLeve_(a,alteradas,12);
}
function prepararEntradaCredenciamento(itens,origem,token) {
  exigirPerfil_(token,['CONFERENCIA']);
  if(['SIAPI','SEI'].indexOf(origem)<0)throw new Error('Origem inválida.');
  if(!Array.isArray(itens)||!itens.length)throw new Error('Nenhum protocolo identificado.');
  var vistos=Object.create(null);
  itens.forEach(function(x){
    var p=normalizarProtocoloRoteiro_(x.protocolo);
    if(!/^\d{3,12}\/\d{2,4}$/.test(p))throw new Error('Protocolo inválido: '+p);
    if(vistos[p])throw new Error('Protocolo repetido no lote: '+p+'. Confira a cópia antes de salvar.');vistos[p]=true;
  });
  var preparada=prepararAlimentacaoCredenciamento(itens,token),mapa=mapaComplementosCredenciamento_();
  preparada.itens.forEach(function(x,i){
    var entrada=itens[i];complementarCredenciamento_(x,mapa);
    camposComplementosCredenciamento_().forEach(function(c){if(entrada[c]!==undefined&&String(entrada[c]).trim())x[c]=String(entrada[c]).trim();});
    x.origem=origem;x.entradaCredenciamento=true;
  });
  return preparada;
}
function salvarNumeroSeiCredenciamento(protocolo,numero,token) {
  var sessao=exigirPerfil_(token,['CONFERENCIA']),n=validarNumeroSeiCredenciamento_(numero);
  if(!n)throw new Error('Preencha o número do processo SEI.');
  var p=normalizarProtocoloRoteiro_(protocolo),lock=LockService.getScriptLock();lock.waitLock(15000);
  try {
    var a=garantirEstruturaCredenciamentoProcessos_(),mapa=mapaCredenciamentoProcessos_(a);
    if(!mapa[p])throw new Error('Protocolo não encontrado.');
    var extras=mapaComplementosCredenciamento_(),anterior=extras[p]&&extras[p].dados.numeroSei||'';
    if(n!==anterior){
      gravarComplementosCredenciamento_([{protocolo:p,numeroSei:n}],extras);
      mapa[p].r[14]=dataHoraSaoPauloTexto_();
      a.getRange(mapa[p].linha,15).setValue(mapa[p].r[14]);
      garantirEstruturaHistoricoCredenciamento_().appendRow([dataHoraSaoPauloTexto_(),p,'PROCESSO_SEI_ATUALIZADO',mapa[p].r[1]||'',mapa[p].r[2]||'',mapa[p].r[3]||'',mapa[p].r[4]||'',mapa[p].r[5]||'',sessao.rg,sessao.nome||sessao.rg,'Processo SEI: '+n+(anterior?' (anterior: '+anterior+')':''),'','SEI']);
    }
    var item=complementarCredenciamento_(objetoCredenciamentoLinha_(mapa[p].r),extras);
    return {sucesso:true,item:item,mensagem:'Número do processo SEI salvo.'};
  } finally {lock.releaseLock();}
}

function obterUltimosConferentesConsulta_(itens) {
  var mapa=Object.create(null),alvos=Object.create(null);
  itens.forEach(function(x){alvos[x.protocolo]=true;});
  if(!itens.length)return mapa;
  var a=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('HISTORICO_CONFERENCIA');
  if(!a||a.getLastRow()<2)return mapa;
  var achados=a.getRange(2,4,a.getLastRow()-1,1).createTextFinder('CONCLUÍDO').matchEntireCell(true).findAll();
  var linhas=achados.map(function(c){return c.getRow();}),dados=lerLinhasProtocolosRoteiro_(a,{conclusoes:linhas},6);
  linhas.forEach(function(l){var r=dados[l],p=normalizarTextoConferencia_(r[1]);if(!alvos[p])return;
    var ts=timestampAtualizacaoCredenciamento_(r[0]),anterior=mapa[p];
    if(!anterior||ts>anterior.ts||(ts===anterior.ts&&l>anterior.linha))mapa[p]={nome:r[5]||r[4]||'',rg:r[4]||'',ts:ts,linha:l};
  });return mapa;
}
function atualizarPreferenciasRascunhosRoteiro(itens,token) {
  exigirPerfil_(token,['CONFERENCIA']);
  if(!Array.isArray(itens)||!itens.length)return {atualizados:0,ignorados:[]};
  itens.forEach(function(x){if(!x.protocolo||!criarDataSegura(x.dataRoteiro)||['NORMAL','PEDIDO CEL','ATRASADA','EVENTO TEMPORÁRIO'].indexOf(x.prioridade)<0)throw new Error('Preferência de rascunho inválida.');});
  var lock=LockService.getScriptLock();lock.waitLock(15000);
  try {
    var a=garantirEstruturaRascunhoRoteiro_(),qtd=Math.max(0,a.getLastRow()-1),mapa=Object.create(null);
    var vals=qtd?a.getRange(2,1,qtd,2).getDisplayValues():[],status=qtd?a.getRange(2,21,qtd,1).getDisplayValues():[];
    vals.forEach(function(r,i){if(String(status[i][0]).trim().toUpperCase()==='RASCUNHO')mapa[String(r[0]).trim()+'|'+normalizarProtocoloRoteiro_(r[1])]=i+2;});
    var alteradas={},tocados=[],ignorados=[];
    itens.forEach(function(x){var chave=formatarDataTexto(criarDataSegura(x.dataRoteiro))+'|'+normalizarProtocoloRoteiro_(x.protocolo),l=mapa[chave];
      if(!l){ignorados.push(x.protocolo);return;}
      alteradas[l]=[String(x.observacao||''),x.prioridade];tocados.push('T'+l);
    });
    var linhas=Object.keys(alteradas).map(Number).sort(function(a,b){return a-b;}),i=0;
    while(i<linhas.length){var inicio=linhas[i],bloco=[alteradas[inicio]];i++;while(i<linhas.length&&linhas[i]===inicio+bloco.length&&bloco.length<500)bloco.push(alteradas[linhas[i++]]);a.getRange(inicio,13,bloco.length,2).setValues(bloco);}
    if(tocados.length)a.getRangeList(tocados).setValue(dataHoraSaoPauloTexto_());
    return {atualizados:linhas.length,ignorados:ignorados};
  } finally {lock.releaseLock();}
}
