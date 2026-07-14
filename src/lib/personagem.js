// src/lib/personagem.js
import {
  calcularBonusCapacidadeCargaItem,
  calcularDefesaItem,
  calcularStatsItem,
  normalizarModificacoes,
} from './inventario.js';
class Personagem {
  constructor() {
    this.reset();
  }

  reset() {
    this.atributos = { for: 1, agi: 1, int: 1, pre: 1, vig: 1 };
    this.pericias = {
      acrobacia: 0, crime: 0, furtividade: 0, iniciativa: 0, pilotagem: 0, pontaria: 0, reflexos: 0,
      atletismo: 0, luta: 0,
      atualidades: 0, ciencias: 0, investigacao: 0, medicina: 0, ocultismo: 0, profissao: 0, sobrevivencia: 0, tatica: 0, tecnologia: 0,
      adestramento: 0, artes: 0, diplomacia: 0, enganacao: 0, intimidacao: 0, intuicao: 0, percepcao: 0, religiao: 0, vontade: 0,
      fortitude: 0,
    };
    this.info = { nome: "", jogador: "", origem: "desgarrado", classe: "especialista", trilha: "nenhuma", nex: "5%", estagio_sobrevivente: 1, prestigio: 0, deslocamento: 9, monstruoso_elemento: "", possuido_elemento: "", foto: "", tema: "tema-ordem" };
    this.recursos = { pv_atual: 10, pv_max: 10, pe_atual: 10, pe_max: 10, san_atual: 10, san_max: 10 };
    this._recursosInicializados = false;
    this.defesa = { equip: 0, outros: 0 };
    this.resistencias = { balistico: 0, corte: 0, impacto: 0, perfuracao: 0, eletricidade: 0, fogo: 0, frio: 0, quimico: 0, mental: 0, sangue: 0, morte: 0, conhecimento: 0, energia: 0 };
    this.perseguicao = { sucessos: 0, falhas: 0 };
    this.visibilidade = 0; 
    this.inventario = []; 
    this.rituais = []; 
    this.trilhas_personalizadas = []; 
    this.poderes_aprendidos = []; 
    this.diario = []; 
    this.periciasCustom = [];
    this.pericias.fortitude = 5;
    this.pericias.sobrevivencia = 5;
    this.periciasOrigemAplicadas = ['fortitude', 'sobrevivencia'];
    this.condicoesAtivas = [];
    this.buffsTemporarios = { exercicio: 0, leitura: 0 };
    this.bonusManuais = { pv_nex: 0, pv_outros: 0, pe_nex: 0, pe_outros: 0, san_nex: 0, san_outros: 0, defesa: 0, bloqueio: 0, esquiva: 0, limite_pe: 0 };
    this.bonusPericiasManuais = {};
    this.calculosDetalhados = { pv_base: 0, pv_nivel: 0, pv_origem: 0, pv_total: 0, pe_base: 0, pe_nivel: 0, pe_origem: 0, pe_total: 0, san_base: 0, san_nivel: 0, san_origem: 0, san_total: 0, limite_pe: 1 };
  }

  // --- SETTERS ---
  setPerseguicao(tipo, valor) {
    if (tipo === 'sucessos' || tipo === 'falhas') {
      let num = parseInt(valor) || 0;
      if (num < 0) num = 0; if (num > 3) num = 3; 
      this.perseguicao[tipo] = num;
    } else if (tipo === 'reset') {
      this.perseguicao = { sucessos: 0, falhas: 0 };
      this.visibilidade = 0; 
    }
  }
  
  setVisibilidade(campo, delta) {
    let valor = parseInt(delta) || 0;
    let valorNovo = this.visibilidade + valor;
    if (valorNovo < -99) valorNovo = -99;
    if (valorNovo > 99) valorNovo = 99;
    this.visibilidade = valorNovo;
  }
  
  setAtributo(campo, valor) {
    if (valor === "") { this.atributos[campo] = ""; return; }
    let num = parseInt(valor);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0; if (num > 10) num = 10;
    this.atributos[campo] = num;
  }
  
  setTreinoPericia(campo, valor) {
    const treino = parseInt(valor) || 0;
    this.pericias[campo] = treino;
    if (treino !== 5 && this.periciasOrigemAplicadas.includes(campo)) {
      this.periciasOrigemAplicadas = this.periciasOrigemAplicadas.filter(pericia => pericia !== campo);
    }
  }
  trocarPericiasOrigem(novasPericias = []) {
    this.periciasOrigemAplicadas.forEach(pericia => {
      if (this.pericias[pericia] === 5) this.pericias[pericia] = 0;
    });

    this.periciasOrigemAplicadas = [];
    novasPericias.forEach(pericia => {
      if (this.pericias[pericia] === 0) {
        this.pericias[pericia] = 5;
        this.periciasOrigemAplicadas.push(pericia);
      }
    });
  }
  setInfo(campo, valor) { this.info[campo] = valor; }
  setRecurso(campo, valor) {
    if (!Object.prototype.hasOwnProperty.call(this.recursos, campo)) return;

    const numero = Number.parseInt(valor, 10);
    const valorSeguro = Number.isNaN(numero) ? 0 : numero;

    if (campo.endsWith('_atual')) {
      const campoMaximo = campo.replace('_atual', '_max');
      const maximo = Math.max(0, Number.parseInt(this.recursos[campoMaximo], 10) || 0);
      this.recursos[campo] = Math.min(Math.max(0, valorSeguro), maximo);
      return;
    }

    if (campo.endsWith('_max')) {
      this.recursos[campo] = Math.max(1, valorSeguro);
      const campoAtual = campo.replace('_max', '_atual');
      this.recursos[campoAtual] = Math.min(
        Math.max(0, Number.parseInt(this.recursos[campoAtual], 10) || 0),
        this.recursos[campo],
      );
    }
  }
  setBonusManual(campo, valor) { this.bonusManuais[campo] = parseInt(valor) || 0; }
  setBonusPericiaManual(campo, valor) { this.bonusPericiasManuais[campo] = parseInt(valor) || 0; }
  setDefesa(campo, valor) { this.defesa[campo] = parseInt(valor) || 0; }
  setResistencia(campo, valor) {
    const num = parseInt(valor);
    if (Object.prototype.hasOwnProperty.call(this.resistencias, campo)) { this.resistencias[campo] = isNaN(num) ? 0 : num; }
  }

  toggleCondicao(condicaoId) {
    if (this.condicoesAtivas.includes(condicaoId)) {
      this.condicoesAtivas = this.condicoesAtivas.filter(c => c !== condicaoId);
    } else {
      this.condicoesAtivas.push(condicaoId);
    }
  }

  aplicarCondicao(condicaoId, evolucao = null) {
    if (!this.condicoesAtivas.includes(condicaoId)) {
      this.condicoesAtivas.push(condicaoId);
      return;
    }

    if (evolucao) {
      this.condicoesAtivas = this.condicoesAtivas.filter(condicao => condicao !== condicaoId);
      if (!this.condicoesAtivas.includes(evolucao)) this.condicoesAtivas.push(evolucao);
    }
  }

  getCondicoesAutomaticas() {
    const automaticas = [];
    const pvAtual = Number.parseInt(this.recursos.pv_atual, 10) || 0;
    const pvMax = Math.max(1, Number.parseInt(this.recursos.pv_max, 10) || 1);
    const sanAtual = Number.parseInt(this.recursos.san_atual, 10) || 0;
    const sanMax = Math.max(1, Number.parseInt(this.recursos.san_max, 10) || 1);

    if (pvAtual <= 0) automaticas.push('morrendo', 'inconsciente');
    else if (pvAtual * 2 < pvMax) automaticas.push('machucado');

    if (sanAtual <= 0) automaticas.push('enlouquecendo');
    else if (sanAtual * 2 < sanMax) automaticas.push('perturbado');

    return automaticas;
  }

  getCondicoesEfetivas() {
    return [...new Set([...this.condicoesAtivas, ...this.getCondicoesAutomaticas()])];
  }
  
  getCondicoes() { return this.condicoesAtivas; }

  // --- LÓGICA DE ATRIBUTOS DETALHADOS ---
  getAtributoDetalhado(attrKey) {
    const valorBase = Number.parseInt(this.atributos[attrKey], 10) || 0;
    return { valorFinal: valorBase, modificadores: [] };
  }

  getAtributoFinal(attrKey) {
    return this.getAtributoDetalhado(attrKey).valorFinal;
  }

  // --- LÓGICA DE DADOS DE PERÍCIA ---
  getDadosPericia(periciaKey, atributoBase, bonusInventario) {
      const attrDet = this.getAtributoDetalhado(atributoBase);
      let dadosAtuais = attrDet.valorFinal;
      const condicoes = this.getCondicoesEfetivas();
      const mensagens = [];
      let temPenalidade = false;

      if (['for', 'agi', 'vig'].includes(atributoBase)) {
        if (condicoes.includes('debilitado') || condicoes.includes('exausto')) {
          dadosAtuais -= 2;
          mensagens.push('Debilitado/Exausto (-2d20)');
          temPenalidade = true;
        } else if (condicoes.includes('fraco') || condicoes.includes('fatigado')) {
          dadosAtuais -= 1;
          mensagens.push('Fraco/Fatigado (-1d20)');
          temPenalidade = true;
        }
      }

      if (['int', 'pre'].includes(atributoBase)) {
        if (condicoes.includes('esmorecido')) {
          dadosAtuais -= 2;
          mensagens.push('Esmorecido (-2d20)');
          temPenalidade = true;
        } else if (condicoes.includes('frustrado')) {
          dadosAtuais -= 1;
          mensagens.push('Frustrado (-1d20)');
          temPenalidade = true;
        }
      }
      
      if (condicoes.includes('cego') && ['agi', 'for'].includes(atributoBase)) {
          dadosAtuais -= 2;
          mensagens.push('Cego (-2d20)');
          temPenalidade = true;
      }
      
      if (condicoes.includes('apavorado')) {
           dadosAtuais -= 2;
           mensagens.push('Apavorado (-2d20)');
           temPenalidade = true;
      } else if (condicoes.includes('abalado')) {
           dadosAtuais -= 1;
           mensagens.push('Abalado (-1d20)');
           temPenalidade = true;
      }

      if (condicoes.includes('ofuscado') && ['luta', 'pontaria', 'percepcao'].includes(periciaKey)) {
        dadosAtuais -= 1;
        mensagens.push('Ofuscado (-1d20)');
        temPenalidade = true;
      }

      if (this.info.origem === 'experimento' && periciaKey === 'diplomacia') {
        dadosAtuais -= 1;
        mensagens.push('Mutação/Experimento (-1d20)');
        temPenalidade = true;
      }

      const treino = this.pericias[periciaKey] || 0;
      let bonusTotal = (Number.parseInt(treino, 10) || 0) + (Number.parseInt(bonusInventario, 10) || 0);
      const aplicarPenalidade = (valor, mensagem) => {
        bonusTotal += valor;
        mensagens.push(mensagem);
        temPenalidade = true;
      };

      if (condicoes.includes('surdo') && periciaKey === 'iniciativa') aplicarPenalidade(-5, 'Surdo (-5)');
      const desprevenido = ['desprevenido', 'cego', 'atordoado', 'surpreendido']
        .some(condicao => condicoes.includes(condicao));
      if (desprevenido && periciaKey === 'reflexos') aplicarPenalidade(-5, 'Desprevenido (-5)');
      if (condicoes.includes('cego') && periciaKey === 'percepcao') aplicarPenalidade(-10, 'Cego (-10)');
      if (condicoes.includes('fascinado') && periciaKey === 'percepcao') aplicarPenalidade(-10, 'Fascinado (-10)');
      if (condicoes.includes('caido') && periciaKey === 'luta') aplicarPenalidade(-5, 'Caído (-5 em ataque corpo a corpo)');
      if ((condicoes.includes('agarrado') || condicoes.includes('enredado')) && ['luta', 'pontaria'].includes(periciaKey)) {
        aplicarPenalidade(-2, 'Agarrado/Enredado (-2 em ataque)');
      }

      if (['acrobacia', 'crime', 'furtividade'].includes(periciaKey)) {
        const usaProtecaoPesada = this.inventario.some(item =>
          !item.ignorarCalculos && !item.quebrado && item.id === 'protecao_pesada',
        );
        if (usaProtecaoPesada) {
          bonusTotal -= 5;
          mensagens.push('Proteção pesada (carga -5)');
          temPenalidade = true;
        }
        if (this.getEstadoCarga().sobrecarregado) {
          bonusTotal -= 5;
          mensagens.push('Sobrecarregado (carga -5)');
          temPenalidade = true;
        }
      }

      const descricaoDados = dadosAtuais > 0
        ? `${dadosAtuais}d20`
        : `${2 + Math.abs(dadosAtuais)}d20 (pior)`;

      return {
          dados: dadosAtuais,
          descricaoDados,
          bonus: bonusTotal,
          temPenalidade,
          msgCondicao: mensagens.join('\n'),
      };
  }
  
  aplicarInterludio(opcoes = {}) {
    const acoes = [...new Set(Array.isArray(opcoes.acoes) ? opcoes.acoes : [])].slice(0, 2);
    const conforto = opcoes.conforto || 'normal';
    const prato = opcoes.prato || 'simples';
    const participantesRelaxando = Math.max(1, parseInt(opcoes.participantesRelaxando) || (opcoes.emGrupo ? 2 : 1));
    const limitePE = this.calculosDetalhados.limite_pe || 1;

    let fatorBase = 1;
    if (conforto === 'precario') fatorBase = 0.5;
    if (conforto === 'confortavel') fatorBase = 2;
    if (conforto === 'luxuoso') fatorBase = 3;
    const fatorSono = conforto === 'precario' && ['explorador', 'mateiro'].includes(this.info.origem)
      ? 1
      : fatorBase;

    let pvRecuperado = 0;
    let peRecuperado = 0;
    let sanRecuperada = 0;
    const msgExtras = [];
    let fatorPV = fatorSono;
    let fatorPE = fatorSono;

    if (acoes.includes('alimentar')) {
      if (prato === 'nutritivo') fatorPV += 1;
      if (prato === 'energetico') fatorPE += 1;
    }

    if (acoes.includes('dormir')) {
      pvRecuperado += Math.floor(limitePE * fatorPV);
      peRecuperado += Math.floor(limitePE * fatorPE);
    }

    if (acoes.includes('relaxar')) {
      let sanTotal = Math.floor(limitePE * fatorBase) + participantesRelaxando;
      if (acoes.includes('alimentar') && prato === 'favorito') sanTotal += 2;
      sanRecuperada += sanTotal;
    }

    if (acoes.includes('exercitar')) {
      const limiteExercicio = Math.max(0, this.getAtributoFinal('vig'));
      if (this.buffsTemporarios.exercicio < limiteExercicio) {
        this.buffsTemporarios.exercicio += 1;
        msgExtras.push("Você recebeu +1d6 em um teste físico (AGI/FOR/VIG) futuro.");
      } else {
        msgExtras.push(`Bônus de exercício já está no limite do Vigor (${limiteExercicio}).`);
      }
    }

    if (acoes.includes('ler')) {
      const limiteLeitura = Math.max(0, this.getAtributoFinal('int'));
      if (this.buffsTemporarios.leitura < limiteLeitura) {
        this.buffsTemporarios.leitura += 1;
        const dadosLeitura = this.info.origem === 'nerd_entusiasta' ? 2 : 1;
        msgExtras.push(`Você recebeu +${dadosLeitura}d6 em um teste mental (INT/PRE) futuro.`);
      } else {
        msgExtras.push(`Bônus de leitura já está no limite do Intelecto (${limiteLeitura}).`);
      }
    }

    if (acoes.includes('manutencao')) {
      const item = this.inventario.find(itemInventario =>
        String(itemInventario.inventarioId) === String(opcoes.itemManutencaoId),
      );
      if (item) {
        item.quebrado = false;
        if (Number.isFinite(Number(item.pv_max))) item.pv_atual = Number(item.pv_max);
        msgExtras.push(`${item.nome || 'Item'} foi reparado.`);
      } else {
        msgExtras.push("Nenhum item foi selecionado para manutenção.");
      }
    }

    if (acoes.includes('revisar')) {
      const bonusRevisar = acoes.includes('alimentar') && prato === 'rapido' ? 5 : 0;
      const msgBonus = bonusRevisar > 0 ? ` (Bônus +${bonusRevisar} por Prato Rápido)` : "";
      msgExtras.push(`Faça um teste de perícia${msgBonus} para encontrar pistas perdidas.`);
    }

    const pvAntes = this.recursos.pv_atual;
    const peAntes = this.recursos.pe_atual;
    const sanAntes = this.recursos.san_atual;

    this.recursos.pv_atual = Math.min(this.recursos.pv_max, this.recursos.pv_atual + pvRecuperado);
    this.recursos.pe_atual = Math.min(this.recursos.pe_max, this.recursos.pe_atual + peRecuperado);
    this.recursos.san_atual = Math.min(this.recursos.san_max, this.recursos.san_atual + sanRecuperada);

    return {
      pv: this.recursos.pv_atual - pvAntes,
      pe: this.recursos.pe_atual - peAntes,
      san: this.recursos.san_atual - sanAntes,
      extras: msgExtras,
    };
  }

  consumirBuffTemporario(tipo) {
    if (!['exercicio', 'leitura'].includes(tipo)) return false;
    const quantidade = Math.max(0, parseInt(this.buffsTemporarios[tipo]) || 0);
    if (quantidade === 0) return false;
    this.buffsTemporarios[tipo] = quantidade - 1;
    return true;
  }

  addTrilhaPersonalizada(trilhaData) {
      const key = `custom_${Date.now() + Math.random()}`.replace(/\./g, '');
      const newTrilha = { ...trilhaData, id: `custom_trilha_${Date.now() + Math.random()}`, key: key, isCustom: true };
      this.trilhas_personalizadas.push(newTrilha);
      return newTrilha;
  }
  removeTrilhaPersonalizada(trilhaKey) {
      this.trilhas_personalizadas = this.trilhas_personalizadas.filter((trilha) => trilha.key !== trilhaKey);
  }
  getTrilhasPersonalizadas() { return this.trilhas_personalizadas; }
  
  addPoder(poder) {
      if (!this.poderes_aprendidos.some(p => p.key === poder.key)) {
          this.poderes_aprendidos.push(poder);
      }
  }
  removePoder(poderKey) {
      this.poderes_aprendidos = this.poderes_aprendidos.filter(p => p.key !== poderKey);
  }
  getPoderesAprendidos() { return this.poderes_aprendidos; }

  getBonusTotalPericia(pericia) { return this.pericias[pericia] || 0; }

  addPericiaCustom(dadosPericia) {
    const nome = (dadosPericia?.nome || '').trim();
    if (!nome) return null;

    const baseKey = nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'pericia';

    let key = `custom_${baseKey}`;
    let contador = 2;
    while (this.pericias[key] !== undefined || this.periciasCustom.some(p => p.key === key)) {
      key = `custom_${baseKey}_${contador}`;
      contador += 1;
    }

    const novaPericia = {
      key,
      nome,
      attr: dadosPericia?.attr || 'int',
    };

    this.periciasCustom.push(novaPericia);
    this.pericias[key] = 0;
    this.bonusPericiasManuais[key] = 0;
    return novaPericia;
  }

  removePericiaCustom(key) {
    this.periciasCustom = this.periciasCustom.filter(pericia => pericia.key !== key);
    delete this.pericias[key];
    delete this.bonusPericiasManuais[key];
  }

  addItemInventario(item) {
    const itemComId = {
      ...item,
      inventarioId: Date.now() + Math.random(),
      ignorarCalculos: false,
      categoriaBase: item.categoriaBase ?? item.categoria,
      espacosBase: item.espacosBase ?? item.espacos,
      modificacoes: normalizarModificacoes(item.modificacoes),
    };
    delete itemComId.categoria;
    delete itemComId.espacos;
    this.inventario.push(itemComId);
  }
  
  removeItemInventario(inventarioId) {
    this.inventario = this.inventario.filter((item) => item.inventarioId !== inventarioId);
  }

  updateItemInventario(inventarioId, dadosAtualizados) {
    const index = this.inventario.findIndex(item => item.inventarioId === inventarioId);
    if (index !== -1) {
      const itemOriginal = this.inventario[index];
      this.inventario[index] = {
        ...itemOriginal, 
        ...dadosAtualizados, 
        modificacoes: normalizarModificacoes(dadosAtualizados.modificacoes || itemOriginal.modificacoes),
        categoriaBase: dadosAtualizados.categoriaBase ?? itemOriginal.categoriaBase ?? itemOriginal.categoria,
        espacosBase: dadosAtualizados.espacosBase ?? itemOriginal.espacosBase ?? itemOriginal.espacos,
      };
      delete this.inventario[index].categoria;
      delete this.inventario[index].espacos;
    }
  }

  toggleIgnorarCalculos(inventarioId) {
    const item = this.inventario.find((item) => item.inventarioId === inventarioId);
    if (item) { item.ignorarCalculos = !item.ignorarCalculos; }
  }
  getInventario() { return this.inventario; }
  
  addRitualInventario(ritual) {
    const ritualComId = { ...ritual, inventarioId: Date.now() + Math.random() };
    this.rituais.push(ritualComId);
  }
  removeRitualInventario(inventarioId) {
    this.rituais = this.rituais.filter((ritual) => ritual.inventarioId !== inventarioId);
  }
  getGrimorio() { return this.rituais; }

  addNotaDiario(dadosNota) {
    const novaNota = { ...dadosNota, id: `nota_${Date.now()}` };
    this.diario.push(novaNota);
  }
  updateNotaDiario(notaId, dadosNota) {
    const index = this.diario.findIndex(n => n.id === notaId);
    if (index !== -1) { this.diario[index] = { ...this.diario[index], ...dadosNota }; }
  }
  removeNotaDiario(notaId) {
    this.diario = this.diario.filter(n => n.id !== notaId);
  }

  getBonusDefesaInventario() {
    const inventarioAtivo = this.inventario.filter((item) => !item.ignorarCalculos && !item.quebrado);
    const bonusProtecao = inventarioAtivo
      .filter(item => item.id === 'protecao_leve' || item.id === 'protecao_pesada')
      .map(calcularDefesaItem)
      .reduce((maior, defesa) => Math.max(maior, defesa), 0);

    const bonusEscudo = inventarioAtivo
      .filter(item => item.id === 'escudo' || item.id === 'escudo_balistico_sah')
      .map(calcularDefesaItem)
      .reduce((maior, defesa) => Math.max(maior, defesa), 0);

    const bonusOutrosItens = inventarioAtivo
      .filter(item => item.defesa > 0 && !item.id?.startsWith('protecao_') && !item.id?.startsWith('escudo'))
      .reduce((acc, item) => acc + calcularDefesaItem(item), 0);

    return bonusProtecao + bonusEscudo + bonusOutrosItens;
  }

  getResistenciasInventario() {
    const resistencias = {};
    const protecaoPesada = this.inventario.find(item =>
      !item.ignorarCalculos && !item.quebrado && item.id === 'protecao_pesada',
    );

    if (protecaoPesada) {
      const rd = normalizarModificacoes(protecaoPesada.modificacoes).includes('blindada') ? 5 : 2;
      for (const tipo of ['balistico', 'corte', 'impacto', 'perfuracao']) resistencias[tipo] = rd;
    }

    return resistencias;
  }

  getResistenciasOrigem() {
    if (this.info.origem === 'experimento') {
      return Object.fromEntries(Object.keys(this.resistencias).map(tipo => [tipo, 2]));
    }
    if (this.info.origem === 'teorico_conspiracao') {
      return { mental: Math.max(0, this.getAtributoFinal('int')) };
    }
    return {};
  }

  getBonusPericiaOrigem(periciaKey) {
    if (this.info.origem === 'diplomata' && periciaKey === 'diplomacia') return 2;
    if (this.info.origem === 'profetizado' && periciaKey === 'vontade') return 2;
    return 0;
  }

  getBonusPericiaInventario(periciaKey) {
    const inventarioAtivo = this.inventario.filter((item) => !item.ignorarCalculos && !item.quebrado);
    return inventarioAtivo
      .filter(item => item.periciaVinculada === periciaKey)
      .map(item => {
        const valorBase = Number.parseInt(item.valorBonus, 10) || 0;
        return normalizarModificacoes(item.modificacoes).includes('aprimorado')
          ? Math.max(5, valorBase)
          : valorBase;
      })
      .reduce((maior, valor) => Math.max(maior, valor), 0);
  }
  
  getPesoTotal() {
    return this.inventario
      .filter(item => !item.ignorarCalculos)
      .reduce((total, item) => total + calcularStatsItem(item).espacos, 0);
  }
  
  getMaxPeso() {
    const forca = this.getAtributoFinal('for');
    let maxPesoBase = forca > 0 ? forca * 5 : 2; 
    
    const inventarioAtivo = this.inventario.filter((item) => !item.ignorarCalculos && !item.quebrado);
    const bonusCapacidadeItens = inventarioAtivo
      .map(calcularBonusCapacidadeCargaItem)
      .reduce((maior, bonus) => Math.max(maior, bonus), 0);
    maxPesoBase += bonusCapacidadeItens;

    if (this.info.trilha === "tecnico") {
      const intelecto = this.getAtributoFinal('int');
      maxPesoBase += (intelecto * 5); 
    }
    return Math.max(0, maxPesoBase);
  }

  getEstadoCarga() {
    const atual = this.getPesoTotal();
    const maximo = this.getMaxPeso();
    return {
      atual,
      maximo,
      limiteAbsoluto: maximo * 2,
      sobrecarregado: atual > maximo,
      acimaDoLimite: atual > maximo * 2,
      penalidadeDefesa: atual > maximo ? -5 : 0,
      penalidadePericias: atual > maximo ? -5 : 0,
      penalidadeDeslocamento: atual > maximo ? -3 : 0,
    };
  }

  getDados() {
    return {
      atributos: { ...this.atributos }, 
      pericias: { ...this.pericias }, 
      info: { ...this.info }, 
      recursos: { ...this.recursos }, 
      defesa: { ...this.defesa }, 
      resistencias: { ...this.resistencias },
      perseguicao: { ...this.perseguicao }, 
      visibilidade: this.visibilidade,
      inventario: [...this.inventario], 
      rituais: [...this.rituais], 
      bonusManuais: { ...this.bonusManuais },
      bonusPericiasManuais: { ...this.bonusPericiasManuais },
      periciasCustom: [...this.periciasCustom],
      periciasOrigemAplicadas: [...this.periciasOrigemAplicadas],
      trilhas_personalizadas: [...this.trilhas_personalizadas], 
      poderes_aprendidos: [...this.poderes_aprendidos], 
      diario: [...this.diario], 
      condicoesAtivas: [...this.condicoesAtivas], 
      condicoesAutomaticas: this.getCondicoesAutomaticas(),
      condicoesEfetivas: this.getCondicoesEfetivas(),
      buffsTemporarios: {...this.buffsTemporarios}
    };
  }
  
  carregarDados(dados) {
    if (dados) {
      this.reset();
      this.atributos = dados.atributos || this.atributos;
      this.pericias = { ...this.pericias, ...(dados.pericias || {}) };
      this.info = { ...this.info, ...dados.info };
      this.recursos = { ...this.recursos, ...(dados.recursos || {}) };
      this._recursosInicializados = Boolean(dados.recursos);
      this.defesa = dados.defesa || this.defesa;
      this.resistencias = dados.resistencias || this.resistencias;
      this.perseguicao = dados.perseguicao || { sucessos: 0, falhas: 0 }; 
      this.visibilidade = dados.visibilidade ?? 0;
      this.inventario = Array.isArray(dados.inventario)
        ? dados.inventario.map(item => ({
            ...item,
            modificacoes: normalizarModificacoes(item.modificacoes),
          }))
        : [];
      this.rituais = Array.isArray(dados.rituais) ? dados.rituais : [];
      this.bonusManuais = { ...this.bonusManuais, ...(dados.bonusManuais || {}) };
      this.bonusPericiasManuais = { ...(dados.bonusPericiasManuais || {}) };
      this.periciasCustom = Array.isArray(dados.periciasCustom) ? dados.periciasCustom : [];
      this.periciasOrigemAplicadas = Array.isArray(dados.periciasOrigemAplicadas)
        ? dados.periciasOrigemAplicadas.filter(pericia => Object.prototype.hasOwnProperty.call(this.pericias, pericia))
        : [];
      this.periciasCustom.forEach(pericia => {
        if (this.pericias[pericia.key] === undefined) this.pericias[pericia.key] = 0;
        if (this.bonusPericiasManuais[pericia.key] === undefined) this.bonusPericiasManuais[pericia.key] = 0;
      });
      this.trilhas_personalizadas = Array.isArray(dados.trilhas_personalizadas) ? dados.trilhas_personalizadas : [];
      this.poderes_aprendidos = Array.isArray(dados.poderes_aprendidos) ? dados.poderes_aprendidos : [];
      this.diario = Array.isArray(dados.diario) ? dados.diario : [];
      this.condicoesAtivas = Array.isArray(dados.condicoesAtivas) ? [...new Set(dados.condicoesAtivas.filter(Boolean))] : [];
      this.buffsTemporarios = {
        exercicio: Math.max(0, parseInt(dados.buffsTemporarios?.exercicio) || 0),
        leitura: Math.max(0, parseInt(dados.buffsTemporarios?.leitura) || 0),
      };
    }
  }

  // --- CÁLCULO DE VALORES MÁXIMOS CORRIGIDO ---
  calcularValoresMaximos() {
    const classe = this.info.classe.toLowerCase().trim();
    const origem = this.info.origem.toLowerCase().trim(); 
    const sobrevivente = classe === 'sobrevivente';
    const nexString = this.info.nex || (sobrevivente ? "0%" : "5%");
    const nexInformado = parseInt(nexString.replace('%', ''));
    const nex = sobrevivente ? 0 : (Number.isNaN(nexInformado) ? 5 : Math.min(99, Math.max(0, nexInformado)));
    const estagioSobrevivente = sobrevivente
      ? Math.min(5, Math.max(1, parseInt(this.info.estagio_sobrevivente) || 1))
      : 0;

    const vigor = this.getAtributoFinal('vig');
    const presenca = this.getAtributoFinal('pre');

    let pvBase = 0, peBase = 0, sanBase = 0;
    let pvPorNivel = 0, pePorNivel = 0, sanPorNivel = 0;

    switch (classe) {
      case "combatente":
        pvBase = 20 + vigor; peBase = 2 + presenca; sanBase = 12;
        pvPorNivel = 4 + vigor; pePorNivel = 2 + presenca; sanPorNivel = 3;
        break;
      case "especialista":
        pvBase = 16 + vigor; peBase = 3 + presenca; sanBase = 16;
        pvPorNivel = 3 + vigor; pePorNivel = 3 + presenca; sanPorNivel = 4;
        break;
      case "ocultista":
        pvBase = 12 + vigor; peBase = 4 + presenca; sanBase = 20;
        pvPorNivel = 2 + vigor; pePorNivel = 4 + presenca; sanPorNivel = 5;
        break;
      case "sobrevivente":
        pvBase = 8 + vigor; peBase = 2 + presenca; sanBase = 8; 
        pvPorNivel = 2; pePorNivel = 1; sanPorNivel = 2;
        break;
      default: 
        pvBase = 16 + vigor; peBase = 3 + presenca; sanBase = 16;
        pvPorNivel = 3 + vigor; pePorNivel = 3 + presenca; sanPorNivel = 4;
        break; 
    }

    if (origem === 'cultista_arrependido') {
      sanBase = Math.floor(sanBase / 2);
    }

    // --- CORREÇÃO DO NEX 99% ---
    // Níveis acima de 5% (cada 5% é um nível).
    // 5% = 0 aumentos
    // 95% = 18 aumentos
    // 99% = 19 aumentos
    let niveisAcima = sobrevivente ? estagioSobrevivente - 1 : Math.floor((nex - 5) / 5);
    if (!sobrevivente && nex >= 99) niveisAcima = 19;
    
    const nexLevelsCalculated = Math.max(0, niveisAcima);
    const nivelTotal = nexLevelsCalculated + 1; // Equivalente ao "Nível" do personagem (1 a 20)
    const multiplicadorNex = Math.floor(nex / 5);

    // Bônus de Origem
    let bonusOrigemPv = 0;
    let bonusOrigemPe = 0;
    let bonusOrigemSan = 0;

    switch (origem) {
      case "desgarrado": bonusOrigemPv = 1 * multiplicadorNex; break;
      case "universitario": bonusOrigemPe = 1 + Math.floor((nex - 5) / 10); break;
      case "vitima": bonusOrigemSan = 1 * multiplicadorNex; break;
      case "mergulhador": bonusOrigemPv = 5; break;
    }

    // Bônus Manuais
    const bonusManualPvNex = (parseInt(this.bonusManuais.pv_nex) || 0) * nexLevelsCalculated;
    const bonusManualPvOutros = parseInt(this.bonusManuais.pv_outros) || 0;
    const bonusManualPeNex = (parseInt(this.bonusManuais.pe_nex) || 0) * nexLevelsCalculated;
    const bonusManualPeOutros = parseInt(this.bonusManuais.pe_outros) || 0;
    const bonusManualSanNex = (parseInt(this.bonusManuais.san_nex) || 0) * nexLevelsCalculated;
    const bonusManualSanOutros = parseInt(this.bonusManuais.san_outros) || 0;

    // --- CÁLCULO DE PODERES DE STATUS ---
    let bonusPoderesPv = 0;
    let bonusPoderesPe = 0;

    // Verifica Sangue de Ferro (+2 PV por nível)
    const temSangueDeFerro = this.poderes_aprendidos.some(p => 
        p.key === "sangue_de_ferro" || (p.nome && p.nome.toLowerCase().includes("sangue de ferro"))
    );
    if (temSangueDeFerro) {
        bonusPoderesPv += (2 * nivelTotal); 
    }

    // Verifica Potencial Aprimorado (+1 PE por nível)
    const temPotencialAprimorado = this.poderes_aprendidos.some(p => 
        p.key === "potencial_aprimorado" || (p.nome && p.nome.toLowerCase().includes("potencial aprimorado"))
    );
    if (temPotencialAprimorado) {
        bonusPoderesPe += (1 * nivelTotal);
    }

    // Limite PE
    let limitePE = sobrevivente ? 1 : Math.floor(nex / 5);
    if (!sobrevivente && nex >= 99) { limitePE = 20; }
    if (limitePE < 1) limitePE = 1;
    if (this.info.origem === 'universitario') { limitePE += 1; }
    limitePE += parseInt(this.bonusManuais.limite_pe) || 0;
    if (limitePE < 1) limitePE = 1;
    this.calculosDetalhados.limite_pe = limitePE;

    // Preenche Detalhes
    this.calculosDetalhados.pv_base = pvBase;
    this.calculosDetalhados.pv_nivel = nexLevelsCalculated * pvPorNivel;
    this.calculosDetalhados.pv_origem = bonusOrigemPv; 
    this.calculosDetalhados.pe_base = peBase;
    this.calculosDetalhados.pe_nivel = nexLevelsCalculated * pePorNivel;
    this.calculosDetalhados.pe_origem = bonusOrigemPe; 
    this.calculosDetalhados.san_base = sanBase;
    this.calculosDetalhados.san_nivel = nexLevelsCalculated * sanPorNivel;
    this.calculosDetalhados.san_origem = bonusOrigemSan; 

    // Soma Final (Incluindo Poderes)
    this.recursos.pv_max = Math.max(1, pvBase + this.calculosDetalhados.pv_nivel + bonusOrigemPv + bonusPoderesPv + bonusManualPvNex + bonusManualPvOutros);
    this.recursos.pe_max = Math.max(1, peBase + this.calculosDetalhados.pe_nivel + bonusOrigemPe + bonusPoderesPe + bonusManualPeNex + bonusManualPeOutros);
    this.recursos.san_max = Math.max(1, sanBase + this.calculosDetalhados.san_nivel + bonusOrigemSan + bonusManualSanNex + bonusManualSanOutros);

    if (!this._recursosInicializados) {
      this.recursos.pv_atual = this.recursos.pv_max;
      this.recursos.pe_atual = this.recursos.pe_max;
      this.recursos.san_atual = this.recursos.san_max;
      this._recursosInicializados = true;
    } else {
      this.recursos.pv_atual = Math.min(Math.max(0, Number.parseInt(this.recursos.pv_atual, 10) || 0), this.recursos.pv_max);
      this.recursos.pe_atual = Math.min(Math.max(0, Number.parseInt(this.recursos.pe_atual, 10) || 0), this.recursos.pe_max);
      this.recursos.san_atual = Math.min(Math.max(0, Number.parseInt(this.recursos.san_atual, 10) || 0), this.recursos.san_max);
    }

    this.calculosDetalhados.pv_total = this.recursos.pv_max;
    this.calculosDetalhados.pe_total = this.recursos.pe_max;
    this.calculosDetalhados.san_total = this.recursos.san_max;
  }
}

export default Personagem;
