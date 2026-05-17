// src/lib/personagem.js
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
    this.info = { nome: "", jogador: "", origem: "desgarrado", classe: "especialista", trilha: "nenhuma", nex: "5%", prestigio: 0, deslocamento: 9, monstruoso_elemento: "", possuido_elemento: "", foto: "", tema: "tema-ordem" };
    this.recursos = { pv_atual: 10, pv_max: 10, pe_atual: 10, pe_max: 10, san_atual: 10, san_max: 10 };
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
    if (valorNovo < 0) valorNovo = 0; if (valorNovo > 3) valorNovo = 3; 
    this.visibilidade = valorNovo;
  }
  
  setAtributo(campo, valor) {
    if (valor === "") { this.atributos[campo] = ""; return; }
    let num = parseInt(valor);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0; if (num > 10) num = 10;
    this.atributos[campo] = num;
  }
  
  setTreinoPericia(campo, valor) { this.pericias[campo] = parseInt(valor) || 0; }
  setInfo(campo, valor) { this.info[campo] = valor; }
  setRecurso(campo, valor) { this.recursos[campo] = parseInt(valor) || 0; }
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
  
  getCondicoes() { return this.condicoesAtivas; }

  // --- LÓGICA DE ATRIBUTOS DETALHADOS ---
  getAtributoDetalhado(attrKey) {
    let valorBase = parseInt(this.atributos[attrKey]) || 0;
    let mods = [];

    // Físicos (FOR, AGI, VIG)
    if (['for', 'agi', 'vig'].includes(attrKey)) {
      if (this.condicoesAtivas.includes('inconsciente')) {
         mods.push({ nome: 'Inconsciente', valor: -valorBase }); // Zera
         valorBase = 0;
      } else if (this.condicoesAtivas.includes('debilitado')) {
         valorBase -= 2;
         mods.push({ nome: 'Debilitado', valor: -2 });
      } else if (this.condicoesAtivas.includes('fraco')) {
         valorBase -= 1;
         mods.push({ nome: 'Fraco', valor: -1 });
      }
    }
    
    // Mentais (INT, PRE)
    if (['int', 'pre'].includes(attrKey)) {
       if (this.condicoesAtivas.includes('inconsciente')) {
          mods.push({ nome: 'Inconsciente', valor: -valorBase });
          valorBase = 0;
       } else if (this.condicoesAtivas.includes('esmorecido')) {
          valorBase -= 2;
          mods.push({ nome: 'Esmorecido', valor: -2 });
       } else if (this.condicoesAtivas.includes('frustrado')) {
          valorBase -= 1;
          mods.push({ nome: 'Frustrado', valor: -1 });
       }
    }

    return { valorFinal: valorBase, modificadores: mods };
  }

  getAtributoFinal(attrKey) {
    return this.getAtributoDetalhado(attrKey).valorFinal;
  }

  // --- LÓGICA DE DADOS DE PERÍCIA ---
  getDadosPericia(periciaKey, atributoBase, bonusInventario) {
      const attrDet = this.getAtributoDetalhado(atributoBase);
      let dadosAtuais = attrDet.valorFinal;
      let msgCondicao = "";
      let temPenalidade = false;

      if (dadosAtuais < 1) dadosAtuais = 0; 
      
      if (this.condicoesAtivas.includes('cego') && ['agi', 'for'].includes(atributoBase)) {
          dadosAtuais -= 2;
          msgCondicao += "Cego (-2d)\n";
          temPenalidade = true;
      }
      
      if (this.condicoesAtivas.includes('apavorado')) {
           dadosAtuais -= 2;
           msgCondicao += "Apavorado (-2d)\n";
           temPenalidade = true;
      } else if (this.condicoesAtivas.includes('abalado')) {
           dadosAtuais -= 1;
           msgCondicao += "Abalado (-1d)\n";
           temPenalidade = true;
      }

      const treino = this.pericias[periciaKey] || 0;
      const bonusTotal = parseInt(treino) + parseInt(bonusInventario);

      return {
          dados: dadosAtuais,
          bonus: bonusTotal,
          temPenalidade,
          msgCondicao: msgCondicao.trim() + (attrDet.modificadores.length > 0 ? `\nAtributo: ${attrDet.modificadores.map(m=>`${m.nome} ${m.valor}`).join(', ')}` : '')
      };
  }
  
  aplicarInterludio(opcoes) {
    const { acoes, conforto, prato, emGrupo } = opcoes;
    const limitePE = this.calculosDetalhados.limite_pe || 1;
    
    let fatorBase = 1;
    if (conforto === 'precario') fatorBase = 0.5;
    if (conforto === 'confortavel') fatorBase = 2;
    if (conforto === 'luxuoso') fatorBase = 3;

    let pvRecuperado = 0;
    let peRecuperado = 0;
    let sanRecuperada = 0;
    let msgExtras = [];

    let fatorPV = fatorBase;
    let fatorPE = fatorBase;

    if (acoes.includes('alimentar')) {
        if (prato === 'nutritivo') fatorPV += 1; 
        if (prato === 'energetico') fatorPE += 1; 
    }

    if (acoes.includes('dormir')) {
        pvRecuperado += Math.floor(limitePE * fatorPV);
        peRecuperado += Math.floor(limitePE * fatorPE);
    }

    if (acoes.includes('relaxar')) {
        let sanTotal = Math.floor(limitePE * fatorBase);
        if (emGrupo) sanTotal += 1;
        if (acoes.includes('alimentar') && prato === 'favorito') sanTotal += 2;
        sanRecuperada += sanTotal;
    }

    if (acoes.includes('exercitar')) {
        this.buffsTemporarios.exercicio += 1;
        msgExtras.push("Você recebeu +1d6 em um teste Físico (AGI/FOR/VIG) futuro.");
    }

    if (acoes.includes('ler')) {
        this.buffsTemporarios.leitura += 1;
        msgExtras.push("Você recebeu +1d6 em um teste Mental (INT/PRE) futuro.");
    }

    if (acoes.includes('manutencao')) {
        msgExtras.push("Seus itens quebrados foram reparados e munições repostas.");
    }

    if (acoes.includes('revisar')) {
        let bonusRevisar = 0;
        if (acoes.includes('alimentar') && prato === 'rapido') bonusRevisar = 5;
        const msgBonus = bonusRevisar > 0 ? ` (Bônus +${bonusRevisar} por Prato Rápido)` : "";
        msgExtras.push(`Faça um teste de Perícia${msgBonus} para encontrar pistas perdidas.`);
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
        extras: msgExtras
    };
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
      modificacoes: item.modificacoes || [], 
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
        modificacoes: dadosAtualizados.modificacoes || itemOriginal.modificacoes || [],
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
    const inventarioAtivo = this.inventario.filter((item) => !item.ignorarCalculos);
    let bonusProtecao = 0;
    let bonusEscudo = 0;
    
    const protecaoLeve = inventarioAtivo.find((item) => item.id === "protecao_leve");
    const protecaoPesada = inventarioAtivo.find((item) => item.id === "protecao_pesada");
    
    if (protecaoPesada) { bonusProtecao = protecaoPesada.defesa || 10; } 
    else if (protecaoLeve) { bonusProtecao = protecaoLeve.defesa || 5; }
    
    const escudo = inventarioAtivo.find((item) => item.id === "escudo");
    if (escudo) { bonusEscudo = escudo.defesa || 2; }
    
    const bonusOutrosItens = inventarioAtivo
      .filter(item => item.defesa > 0 && item.id !== "protecao_leve" && item.id !== "protecao_pesada" && item.id !== "escudo")
      .reduce((acc, item) => acc + (parseInt(item.defesa) || 0), 0);

    return bonusProtecao + bonusEscudo + bonusOutrosItens;
  }

  getBonusPericiaInventario(periciaKey) {
    const inventarioAtivo = this.inventario.filter((item) => !item.ignorarCalculos);
    const bonusVestimentas = inventarioAtivo
      .filter((item) => (item.id === "vestimenta" || item.tipoBonus === "generico") && item.periciaVinculada === periciaKey)
      .map((item) => parseInt(item.valorBonus) || 0).sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0);
    const bonusUtensilios = inventarioAtivo
      .filter((item) => (item.id === "utensilio" || item.tipoBonus === "generico") && item.periciaVinculada === periciaKey)
      .map((item) => parseInt(item.valorBonus) || 0).sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0);
    const bonusEspecificos = inventarioAtivo
      .filter((item) => item.tipoBonus === "especifico" && item.periciaVinculada === periciaKey)
      .map((item) => parseInt(item.valorBonus) || 0).reduce((a, b) => a + b, 0);
    
    // --- CORREÇÃO DE SEGURANÇA NO ID ---
    const bonusCustom = inventarioAtivo
      .filter((item) => ((item.id && item.id.startsWith("custom_")) || item.tipoBonus === 'custom') && item.periciaVinculada === periciaKey)
      .reduce((acc, item) => acc + (parseInt(item.valorBonus) || 0), 0); 
      
    return bonusVestimentas + bonusUtensilios + bonusEspecificos + bonusCustom;
  }
  
  getPesoTotal() {
    return this.inventario.filter((item) => !item.ignorarCalculos).reduce((acc, item) => acc + (parseFloat(item.espacosBase ?? item.espacos) || 0), 0);
  }
  
  getMaxPeso() {
    const forca = this.getAtributoFinal('for');
    let maxPesoBase = forca > 0 ? forca * 5 : 2; 
    
    const inventarioAtivo = this.inventario.filter((item) => !item.ignorarCalculos);
    if (inventarioAtivo.some((item) => item.id === "mochila_militar")) maxPesoBase += 2;

    if (this.info.trilha === "tecnico") {
      const intelecto = this.getAtributoFinal('int');
      maxPesoBase += (intelecto * 5); 
    }
    return Math.max(0, maxPesoBase);
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
      trilhas_personalizadas: [...this.trilhas_personalizadas], 
      poderes_aprendidos: [...this.poderes_aprendidos], 
      diario: [...this.diario], 
      condicoesAtivas: [...this.condicoesAtivas], 
      buffsTemporarios: {...this.buffsTemporarios}
    };
  }
  
  carregarDados(dados) {
    if (dados) {
      this.reset();
      this.atributos = dados.atributos || this.atributos;
      this.pericias = { ...this.pericias, ...(dados.pericias || {}) };
      this.info = { ...this.info, ...dados.info };
      this.recursos = dados.recursos || this.recursos;
      this.defesa = dados.defesa || this.defesa;
      this.resistencias = dados.resistencias || this.resistencias;
      this.perseguicao = dados.perseguicao || { sucessos: 0, falhas: 0 }; 
      this.visibilidade = dados.visibilidade || 0; 
      this.inventario = dados.inventario || [];
      this.rituais = dados.rituais || []; 
      this.bonusManuais = { ...this.bonusManuais, ...(dados.bonusManuais || {}) };
      this.bonusPericiasManuais = { ...(dados.bonusPericiasManuais || {}) };
      this.periciasCustom = Array.isArray(dados.periciasCustom) ? dados.periciasCustom : [];
      this.periciasCustom.forEach(pericia => {
        if (this.pericias[pericia.key] === undefined) this.pericias[pericia.key] = 0;
        if (this.bonusPericiasManuais[pericia.key] === undefined) this.bonusPericiasManuais[pericia.key] = 0;
      });
      this.trilhas_personalizadas = dados.trilhas_personalizadas || []; 
      this.poderes_aprendidos = dados.poderes_aprendidos || []; 
      this.diario = dados.diario || [];
      this.condicoesAtivas = dados.condicoesAtivas || [];
      this.buffsTemporarios = dados.buffsTemporarios || { exercicio: 0, leitura: 0 };
    }
  }

  // --- CÁLCULO DE VALORES MÁXIMOS CORRIGIDO ---
  calcularValoresMaximos() {
    const classe = this.info.classe.toLowerCase().trim();
    const origem = this.info.origem.toLowerCase().trim(); 
    const nexString = this.info.nex || "5%";
    const nex = parseInt(nexString.replace('%', '')) || 5;

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
        pvPorNivel = 2 + vigor; pePorNivel = 1 + presenca; sanPorNivel = 2;
        break;
      default: 
        pvBase = 16 + vigor; peBase = 3 + presenca; sanBase = 16;
        pvPorNivel = 3 + vigor; pePorNivel = 3 + presenca; sanPorNivel = 4;
        break; 
    }

    // --- CORREÇÃO DO NEX 99% ---
    // Níveis acima de 5% (cada 5% é um nível).
    // 5% = 0 aumentos
    // 95% = 18 aumentos
    // 99% = 19 aumentos
    let niveisAcima = Math.floor((nex - 5) / 5);
    if (nex >= 99) niveisAcima = 19;
    
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
    let limitePE = Math.floor(nex / 5);
    if (nex >= 99) { limitePE = 20; } 
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

    if (origem === "cultista_arrependido") {
      this.recursos.san_max = Math.floor(this.recursos.san_max / 2); 
    }

    this.calculosDetalhados.pv_total = this.recursos.pv_max;
    this.calculosDetalhados.pe_total = this.recursos.pe_max;
    this.calculosDetalhados.san_total = this.recursos.san_max;
  }
}

export default Personagem;
