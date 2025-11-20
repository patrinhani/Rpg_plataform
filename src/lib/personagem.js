// src/lib/personagem.js
import { database } from './database.js';

class Personagem {
  constructor() {
    this.atributos = { for: 0, agi: 0, int: 0, pre: 0, vig: 0 };
    
    this.pericias = {
      acrobacia: 0, crime: 0, furtividade: 0, iniciativa: 0, pilotagem: 0, pontaria: 0, reflexos: 0,
      atletismo: 0, luta: 0,
      atualidades: 0, ciencias: 0, investigacao: 0, medicina: 0, ocultismo: 0, profissao: 0, sobrevivencia: 0, tatica: 0, tecnologia: 0,
      adestramento: 0, artes: 0, diplomacia: 0, enganacao: 0, intimidacao: 0, intuicao: 0, percepcao: 0, religiao: 0, vontade: 0,
      fortitude: 0,
    };
    
    this.info = {
      nome: "",
      jogador: "",
      origem: "desgarrado",
      classe: "especialista",
      trilha: "nenhuma",
      nex: "5%",
      prestigio: 0,
      deslocamento: 9,
      monstruoso_elemento: "", 
      possuido_elemento: "",
      foto: "", 
    };
    
    this.recursos = {
      pv_atual: 10,
      pv_max: 10,
      pe_atual: 10,
      pe_max: 10,
      san_atual: 10,
      san_max: 10,
    };

    this.defesa = {
      equip: 0,
      outros: 0,
    };
    
    this.resistencias = {
      balistico: 0,
      corte: 0,
      impacto: 0,
      perfuracao: 0,
      eletricidade: 0,
      fogo: 0,
      frio: 0,
      quimico: 0,
      mental: 0,
      sangue: 0,
      morte: 0,
      conhecimento: 0,
      energia: 0,
    };
    
    this.perseguicao = { sucessos: 0, falhas: 0 };
    this.visibilidade = 0; 

    // --- LISTAS E OBJETOS COMPLEXOS ---
    this.inventario = []; 
    this.rituais = []; 
    this.trilhas_personalizadas = []; 
    this.poderes_aprendidos = []; 
    this.diario = []; 
    this.condicoesAtivas = []; // Armazena os IDs das condições (ex: 'fraco', 'abalado')

    this.bonusManuais = {
      pv_nex: 0,
      pv_outros: 0,
      pe_nex: 0,
      pe_outros: 0,
      san_nex: 0,
      san_outros: 0,
    };

    this.calculosDetalhados = {
      pv_base: 0,
      pv_nivel: 0,
      pv_origem: 0,
      pv_total: 0,
      pe_base: 0,
      pe_nivel: 0,
      pe_origem: 0,
      pe_total: 0,
      san_base: 0,
      san_nivel: 0,
      san_origem: 0,
      san_total: 0,
    };
  }
  
  // --- MÉTODOS DE SETTERS BÁSICOS ---

  setPerseguicao(tipo, valor) {
    if (tipo === 'sucessos' || tipo === 'falhas') {
      let num = parseInt(valor) || 0;
      if (num < 0) num = 0;
      if (num > 3) num = 3; 
      this.perseguicao[tipo] = num;
    } else if (tipo === 'reset') {
      this.perseguicao = { sucessos: 0, falhas: 0 };
      this.visibilidade = 0; 
    }
  }
  
  setVisibilidade(campo, delta) {
    let valor = parseInt(delta) || 0;
    let valorNovo = this.visibilidade + valor;
    
    if (valorNovo < 0) valorNovo = 0;
    if (valorNovo > 3) valorNovo = 3; 
    this.visibilidade = valorNovo;
  }
  
  setAtributo(campo, valor) {
    if (valor === "") {
      this.atributos[campo] = "";
      return;
    }
    const num = parseInt(valor);
    this.atributos[campo] = isNaN(num) ? 0 : num;
  }
  
  setTreinoPericia(campo, valor) {
    this.pericias[campo] = parseInt(valor) || 0;
  }
  
  setInfo(campo, valor) {
    this.info[campo] = valor;
  }
  
  setRecurso(campo, valor) {
    this.recursos[campo] = parseInt(valor) || 0;
  }
  
  setBonusManual(campo, valor) {
    this.bonusManuais[campo] = parseInt(valor) || 0;
  }
  
  setDefesa(campo, valor) {
    this.defesa[campo] = parseInt(valor) || 0;
  }

  setResistencia(campo, valor) {
    const num = parseInt(valor);
    if (this.resistencias.hasOwnProperty(campo)) {
      this.resistencias[campo] = isNaN(num) ? 0 : num;
    }
  }

  // --- MÉTODOS DE CONDIÇÕES (LÓGICA DE EVOLUÇÃO) ---

  toggleCondicao(condicaoId) {
    // 1. Verifica se a condição já existe na lista
    if (this.condicoesAtivas.includes(condicaoId)) {
      // Busca dados da condição no banco de dados para ver se ela evolui
      const dadosCondicao = database.condicoes ? database.condicoes.find(c => c.id === condicaoId) : null;
      
      if (dadosCondicao && dadosCondicao.evolucao) {
        // Se tem evolução (ex: Fraco -> Debilitado), remove a atual e adiciona a evolução
        this.condicoesAtivas = this.condicoesAtivas.filter(c => c !== condicaoId);
        
        // Só adiciona a evolução se ela já não estiver ativa (evita duplicatas)
        if (!this.condicoesAtivas.includes(dadosCondicao.evolucao)) {
            this.condicoesAtivas.push(dadosCondicao.evolucao);
        }
      } else {
        // Se não tem evolução (ou é o estágio final), apenas remove (desmarca)
        this.condicoesAtivas = this.condicoesAtivas.filter(c => c !== condicaoId);
      }
    } else {
      // 2. Se não tem, adiciona a condição
      this.condicoesAtivas.push(condicaoId);
    }
  }
  
  getCondicoes() {
    return this.condicoesAtivas;
  }

  // Método para pegar o valor final do atributo aplicando penalidades de condições
  getAtributoFinal(attrKey) {
    let valorBase = parseInt(this.atributos[attrKey]) || 0;
    
    // Penalidades Físicas (Força, Agilidade, Vigor)
    if (['for', 'agi', 'vig'].includes(attrKey)) {
      // Debilitado ou Inconsciente reduzem em 1 dado (mecanicamente -1 no atributo)
      if (this.condicoesAtivas.includes('debilitado') || this.condicoesAtivas.includes('inconsciente')) {
         valorBase -= 1;
      }
      // Fraco também reduz em 1 dado (-1 no atributo)
      // Nota: Se tiver ambos, não acumula a penalidade (aplica-se a pior condição, mas o valor é o mesmo)
      else if (this.condicoesAtivas.includes('fraco')) {
         valorBase -= 1;
      }
      
      // Outras penalidades específicas podem ser adicionadas aqui (ex: Fatigado afeta perícias físicas, não o atributo base diretamente na rolagem de dano, mas se quiser simplificar pode por aqui)
    }
    
    // Penalidades Mentais (Intelecto, Presença)
    if (['int', 'pre'].includes(attrKey)) {
       // Esmorecido ou Inconsciente
       if (this.condicoesAtivas.includes('esmorecido') || this.condicoesAtivas.includes('inconsciente')) {
          valorBase -= 1; // Ou -2 dependendo da interpretação, mas o padrão é perder dados gradualmente
       }
       // Frustrado
       else if (this.condicoesAtivas.includes('frustrado')) {
          valorBase -= 1;
       }
    }

    // Garante que o atributo não fique negativo (regra de mínimo 0, que rola 2d20 e pega o pior)
    if (valorBase < 0) valorBase = 0; 

    return valorBase; 
  }

  // --- MÉTODOS DE TRILHAS ---
  addTrilhaPersonalizada(trilhaData) {
      const key = `custom_${Date.now() + Math.random()}`.replace(/\./g, '');
      const newTrilha = {
        ...trilhaData,
        id: `custom_trilha_${Date.now() + Math.random()}`,
        key: key, 
        isCustom: true, 
      };
      this.trilhas_personalizadas.push(newTrilha);
  }
  
  removeTrilhaPersonalizada(trilhaKey) {
      this.trilhas_personalizadas = this.trilhas_personalizadas.filter(
          (trilha) => trilha.key !== trilhaKey
      );
  }
  
  getTrilhasPersonalizadas() {
      return this.trilhas_personalizadas;
  }
  
  // --- MÉTODOS DE PODERES ---
  addPoder(poder) {
      if (!this.poderes_aprendidos.some(p => p.key === poder.key)) {
          this.poderes_aprendidos.push(poder);
      }
  }
  
  removePoder(poderKey) {
      this.poderes_aprendidos = this.poderes_aprendidos.filter(p => p.key !== poderKey);
  }
  
  getPoderesAprendidos() {
      return this.poderes_aprendidos;
  }

  // --- MÉTODOS DE INVENTÁRIO ---
  
  getBonusTotalPericia(pericia, atributoBase) {
    return this.pericias[pericia] || 0;
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
    if (item) {
      item.ignorarCalculos = !item.ignorarCalculos;
    }
  }
  
  getInventario() {
    return this.inventario;
  }
  
  // --- MÉTODOS DE RITUAIS ---
  addRitualInventario(ritual) {
    const ritualComId = {
      ...ritual,
      inventarioId: Date.now() + Math.random(),
    };
    this.rituais.push(ritualComId);
  }
  
  removeRitualInventario(inventarioId) {
    this.rituais = this.rituais.filter((ritual) => ritual.inventarioId !== inventarioId);
  }
  
  getGrimorio() {
    return this.rituais;
  }

  // --- MÉTODOS DE DIÁRIO ---
  addNotaDiario(dadosNota) {
    const novaNota = { ...dadosNota, id: `nota_${Date.now()}` };
    this.diario.push(novaNota);
  }

  updateNotaDiario(notaId, dadosNota) {
    const index = this.diario.findIndex(n => n.id === notaId);
    if (index !== -1) {
      this.diario[index] = { ...this.diario[index], ...dadosNota };
    }
  }

  removeNotaDiario(notaId) {
    this.diario = this.diario.filter(n => n.id !== notaId);
  }
  
  // --- FUNÇÕES DE CÁLCULO AUXILIARES ---
  
  getBonusDefesaInventario() {
    const inventarioAtivo = this.inventario.filter((item) => !item.ignorarCalculos);
    let bonusProtecao = 0;
    let bonusEscudo = 0;
    
    const protecaoLeve = inventarioAtivo.find((item) => item.id === "protecao_leve");
    const protecaoPesada = inventarioAtivo.find((item) => item.id === "protecao_pesada");
    
    if (protecaoPesada) {
      bonusProtecao = protecaoPesada.defesa || 10;
    } else if (protecaoLeve) {
      bonusProtecao = protecaoLeve.defesa || 5;
    }
    
    const escudo = inventarioAtivo.find((item) => item.id === "escudo");
    if (escudo) {
      bonusEscudo = escudo.defesa || 2;
    }
    
    const bonusOutrosItens = inventarioAtivo
      .filter(item => item.defesa > 0 && item.id !== "protecao_leve" && item.id !== "protecao_pesada" && item.id !== "escudo")
      .reduce((acc, item) => acc + (parseInt(item.defesa) || 0), 0);

    return bonusProtecao + bonusEscudo + bonusOutrosItens;
  }

  getBonusPericiaInventario(periciaKey) {
    const inventarioAtivo = this.inventario.filter((item) => !item.ignorarCalculos);
    
    const bonusVestimentas = inventarioAtivo
      .filter((item) => (item.id === "vestimenta" || item.tipoBonus === "generico") && item.periciaVinculada === periciaKey)
      .map((item) => parseInt(item.valorBonus) || 0) 
      .sort((a, b) => b - a)
      .slice(0, 2)
      .reduce((a, b) => a + b, 0);
      
    const bonusUtensilios = inventarioAtivo
      .filter((item) => (item.id === "utensilio" || item.tipoBonus === "generico") && item.periciaVinculada === periciaKey)
      .map((item) => parseInt(item.valorBonus) || 0) 
      .sort((a, b) => b - a)
      .slice(0, 2)
      .reduce((a, b) => a + b, 0);
      
    const bonusEspecificos = inventarioAtivo
      .filter((item) => item.tipoBonus === "especifico" && item.periciaVinculada === periciaKey)
      .map((item) => parseInt(item.valorBonus) || 0) 
      .reduce((a, b) => a + b, 0);
      
    const bonusCustom = inventarioAtivo
      .filter((item) => (item.id.startsWith("custom_") || item.tipoBonus === 'custom') && item.periciaVinculada === periciaKey)
      .reduce((acc, item) => acc + (parseInt(item.valorBonus) || 0), 0); 
      
    return bonusVestimentas + bonusUtensilios + bonusEspecificos + bonusCustom;
  }
  
  getPesoTotal() {
    return this.inventario.filter((item) => !item.ignorarCalculos).reduce((acc, item) => {
          let espacosItem = parseFloat(item.espacosBase ?? item.espacos) || 0;
          if (item.modificacoes && item.modificacoes.length > 0) {
              espacosItem = parseFloat(item.espacos ?? item.espacosBase) || 0;
          }
          return acc + espacosItem;
      }, 0);
  }
  
  getMaxPeso() {
    // Usa o atributo calculado (com penalidades) para definir carga
    const forca = this.getAtributoFinal('for');
    let maxPesoBase = forca * 5 || 2; 

    const inventarioAtivo = this.inventario.filter((item) => !item.ignorarCalculos);
    const temMochilaMilitar = inventarioAtivo.some((item) => item.id === "mochila_militar");
    const temMochilaTatica = inventarioAtivo.some((item) => item.id === "mochila_tatica");

    if (temMochilaMilitar) { maxPesoBase += 2; }
    if (temMochilaTatica) { maxPesoBase += 5; }

    if (this.info.trilha === "tecnico") {
      const intelecto = this.getAtributoFinal('int');
      maxPesoBase = (forca + intelecto) * 5 || 2; 
      if (temMochilaMilitar) { maxPesoBase += 2; }
      if (temMochilaTatica) { maxPesoBase += 5; }
    }

    return maxPesoBase;
  }

  // --- PERSISTÊNCIA ---
  
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
      trilhas_personalizadas: [...this.trilhas_personalizadas], 
      poderes_aprendidos: [...this.poderes_aprendidos], 
      diario: [...this.diario],
      condicoesAtivas: [...this.condicoesAtivas], // Salva as condições
    };
  }
  
  carregarDados(dados) {
    if (dados) {
      this.atributos = dados.atributos || this.atributos;
      this.pericias = dados.pericias || this.pericias;
      this.info = { ...this.info, ...dados.info };
      this.recursos = dados.recursos || this.recursos;
      this.defesa = dados.defesa || this.defesa;
      this.resistencias = dados.resistencias || this.resistencias;
      this.perseguicao = dados.perseguicao || { sucessos: 0, falhas: 0 }; 
      this.visibilidade = dados.visibilidade || 0; 
      this.inventario = dados.inventario || [];
      this.rituais = dados.rituais || []; 
      this.bonusManuais = dados.bonusManuais || this.bonusManuais;
      this.trilhas_personalizadas = dados.trilhas_personalizadas || []; 
      this.poderes_aprendidos = dados.poderes_aprendidos || []; 
      this.diario = dados.diario || [];
      this.condicoesAtivas = dados.condicoesAtivas || [];
    }
  }

  // --- CÁLCULO DE RECURSOS MÁXIMOS ---
  calcularValoresMaximos() {
    const classe = this.info.classe.toLowerCase().trim();
    const origem = this.info.origem.toLowerCase().trim(); 
    const nexString = this.info.nex || "5%";
    const nex = parseInt(nexString.replace('%', '')) || 5;

    // Usa os atributos finais (com penalidades) para o cálculo
    const vigor = this.getAtributoFinal('vig');
    const presenca = this.getAtributoFinal('pre');

    let pvBase = 0, peBase = 0, sanBase = 0;
    let pvPorNivel = 0, pePorNivel = 0, sanPorNivel = 0;

    switch (classe) {
      case "combatente":
        pvBase = 20 + vigor;
        peBase = 2 + presenca;
        sanBase = 12;
        pvPorNivel = 4 + vigor;
        pePorNivel = 2 + presenca;
        sanPorNivel = 3;
        break;
      case "especialista":
        pvBase = 16 + vigor;
        peBase = 3 + presenca;
        sanBase = 16;
        pvPorNivel = 3 + vigor;
        pePorNivel = 3 + presenca;
        sanPorNivel = 4;
        break;
      case "ocultista":
        pvBase = 12 + vigor;
        peBase = 4 + presenca;
        sanBase = 20;
        pvPorNivel = 2 + vigor;
        pePorNivel = 4 + presenca;
        sanPorNivel = 5;
        break;
      case "sobrevivente":
        pvBase = 8 + vigor; 
        peBase = 2 + presenca; 
        sanBase = 8; 
        pvPorNivel = 2 + vigor;
        pePorNivel = 1 + presenca;
        sanPorNivel = 2;
        break;
      default: 
        pvBase = 16 + vigor;
        peBase = 3 + presenca;
        sanBase = 16;
        pvPorNivel = 3 + vigor;
        pePorNivel = 3 + presenca;
        sanPorNivel = 4;
        break; 
    }

    const niveisAcima = Math.floor((nex - 5) / 5);
    const nexLevelsCalculated = Math.max(0, niveisAcima);
    const multiplicadorNex = Math.floor(nex / 5);

    let bonusOrigemPv = 0;
    let bonusOrigemPe = 0;
    let bonusOrigemSan = 0;

    switch (origem) {
      case "desgarrado":
        bonusOrigemPv = 1 * multiplicadorNex;
        break;
      case "universitario":
        bonusOrigemPe = 1 + Math.floor((nex - 5) / 10);
        break;
      case "vitima":
        bonusOrigemSan = 1 * multiplicadorNex;
        break;
      case "mergulhador":
        bonusOrigemPv = 5; 
        break;
    }

    const bonusManualPvNex = (parseInt(this.bonusManuais.pv_nex) || 0) * nexLevelsCalculated;
    const bonusManualPvOutros = parseInt(this.bonusManuais.pv_outros) || 0;
    const bonusManualPeNex = (parseInt(this.bonusManuais.pe_nex) || 0) * nexLevelsCalculated;
    const bonusManualPeOutros = parseInt(this.bonusManuais.pe_outros) || 0;
    const bonusManualSanNex = (parseInt(this.bonusManuais.san_nex) || 0) * nexLevelsCalculated;
    const bonusManualSanOutros = parseInt(this.bonusManuais.san_outros) || 0;

    this.calculosDetalhados.pv_base = pvBase;
    this.calculosDetalhados.pv_nivel = nexLevelsCalculated * pvPorNivel;
    this.calculosDetalhados.pv_origem = bonusOrigemPv; 
    
    this.calculosDetalhados.pe_base = peBase;
    this.calculosDetalhados.pe_nivel = nexLevelsCalculated * pePorNivel;
    this.calculosDetalhados.pe_origem = bonusOrigemPe; 
    
    this.calculosDetalhados.san_base = sanBase;
    this.calculosDetalhados.san_nivel = nexLevelsCalculated * sanPorNivel;
    this.calculosDetalhados.san_origem = bonusOrigemSan; 

    this.recursos.pv_max = pvBase + this.calculosDetalhados.pv_nivel + bonusOrigemPv + bonusManualPvNex + bonusManualPvOutros;
    this.recursos.pe_max = peBase + this.calculosDetalhados.pe_nivel + bonusOrigemPe + bonusManualPeNex + bonusManualPeOutros;
    this.recursos.san_max = sanBase + this.calculosDetalhados.san_nivel + bonusOrigemSan + bonusManualSanNex + bonusManualSanOutros;

    if (origem === "cultista_arrependido") {
      this.recursos.san_max = Math.floor(this.recursos.san_max / 2); 
    }

    this.calculosDetalhados.pv_total = this.recursos.pv_max;
    this.calculosDetalhados.pe_total = this.recursos.pe_max;
    this.calculosDetalhados.san_total = this.recursos.san_max;
  }
}

const ficha = new Personagem();

export { ficha };