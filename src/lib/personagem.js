/**
 * js/personagem.js
 * (ATUALIZADO PARA O PASSO 2 - MODIFICAÇÕES)
 * - 'addItemInventario' e 'updateItemInventario' agora lidam
 * com 'categoriaBase', 'espacosBase' e 'modificacoes'.
 */

class Personagem {
  constructor() {
    this.atributos = { for: 0, agi: 0, int: 0, pre: 0, vig: 0 };
    this.pericias = {
      acrobacia: 0,
      crime: 0,
      furtividade: 0,
      iniciativa: 0,
      pilotagem: 0,
      pontaria: 0,
      reflexos: 0,
      atletismo: 0,
      luta: 0,
      atualidades: 0,
      ciencias: 0,
      investigacao: 0,
      medicina: 0,
      ocultismo: 0,
      profissao: 0,
      sobrevivencia: 0,
      tatica: 0,
      tecnologia: 0,
      adestramento: 0,
      artes: 0,
      diplomacia: 0,
      enganacao: 0,
      intimidacao: 0,
      intuicao: 0,
      percepcao: 0,
      religiao: 0,
      vontade: 0,
      fortitude: 0,
    };
    this.info = {
      nome: "",
      jogador: "",
      origem: "desgarrado",
      classe: "especialista",
      trilha: "nenhuma",
      nex: "5%",
      deslocamento: 9,
      monstruoso_elemento: "", 
      possuido_elemento: "",
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

    this.inventario = []; 
    this.rituais = []; 
    this.trilhas_personalizadas = []; 
    this.poderes_aprendidos = []; 

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

  // --- Métodos "Set" (Sem alterações) ---
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

  // --- MÉTODOS PARA TRILHAS (Sem alterações) ---
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
  
  // --- MÉTODOS PARA PODERES (Sem alterações) ---
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

  // --- MÉTODOS DE INVENTÁRIO/RITUAIS (MODIFICADOS) ---
  
  getBonusTotalPericia(pericia, atributoBase) {
    return this.pericias[pericia] || 0;
  }

  // --- (MODIFICAÇÃO PASSO 2) ---
  addItemInventario(item) {
    const itemComId = {
      ...item,
      inventarioId: Date.now() + Math.random(),
      ignorarCalculos: false,
      
      // Salva a categoria e espaços originais
      categoriaBase: item.categoriaBase ?? item.categoria,
      espacosBase: item.espacosBase ?? item.espacos,
      
      // Garante que o array de modificações exista
      modificacoes: item.modificacoes || [], 
    };
    
    // Remove a 'categoria' e 'espacos' de nível superior
    // (Eles serão calculados pelos componentes)
    delete itemComId.categoria;
    delete itemComId.espacos;

    this.inventario.push(itemComId);
  }
  
  removeItemInventario(inventarioId) {
    this.inventario = this.inventario.filter(
      (item) => item.inventarioId !== inventarioId
    );
  }

  // --- (MODIFICAÇÃO PASSO 2) ---
  updateItemInventario(inventarioId, dadosAtualizados) {
    const index = this.inventario.findIndex(item => item.inventarioId === inventarioId);
    
    if (index !== -1) {
      const itemOriginal = this.inventario[index];
      
      this.inventario[index] = {
        ...itemOriginal, // Mantém ID e estado do toggle
        ...dadosAtualizados, // Aplica todas as mudanças do formulário (nome, desc, etc.)
        
        // Garante que as modificações sejam salvas
        modificacoes: dadosAtualizados.modificacoes || itemOriginal.modificacoes || [],
        
        // Salva a categoria base se ela ainda não existir (para itens antigos)
        categoriaBase: dadosAtualizados.categoriaBase ?? itemOriginal.categoriaBase ?? itemOriginal.categoria,
        espacosBase: dadosAtualizados.espacosBase ?? itemOriginal.espacosBase ?? itemOriginal.espacos,
      };
      
      // Limpa a 'categoria' e 'espacos' de nível superior
      delete this.inventario[index].categoria;
      delete this.inventario[index].espacos;
    }
  }

  toggleIgnorarCalculos(inventarioId) {
    const item = this.inventario.find(
      (item) => item.inventarioId === inventarioId
    );
    if (item) {
      item.ignorarCalculos = !item.ignorarCalculos;
    }
  }
  getInventario() {
    return this.inventario;
  }
  
  // --- Rituais (Sem alterações) ---
  addRitualInventario(ritual) {
    const ritualComId = {
      ...ritual,
      inventarioId: Date.now() + Math.random(),
    };
    this.rituais.push(ritualComId);
  }
  removeRitualInventario(inventarioId) {
    this.rituais = this.rituais.filter(
      (ritual) => ritual.inventarioId !== inventarioId
    );
  }
  getGrimorio() {
    return this.rituais;
  }
  
  // --- Funções de Cálculo (Sem alterações nesta etapa) ---
  // (A lógica de cálculo das modificações será feita nos componentes React)
  
  getBonusDefesaInventario() {
    // ... (Esta função permanece a mesma por enquanto)
    const inventarioAtivo = this.inventario.filter(
      (item) => !item.ignorarCalculos
    );
    let bonusProtecao = 0;
    let bonusEscudo = 0;
    const protecaoLeve = inventarioAtivo.find(
      (item) => item.id === "protecao_leve"
    );
    const protecaoPesada = inventarioAtivo.find(
      (item) => item.id === "protecao_pesada"
    );
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
      .filter(item => 
          item.defesa > 0 && 
          item.id !== "protecao_leve" && 
          item.id !== "protecao_pesada" && 
          item.id !== "escudo"
      )
      .reduce((acc, item) => acc + (parseInt(item.defesa) || 0), 0);

    return bonusProtecao + bonusEscudo + bonusOutrosItens;
  }

  getBonusPericiaInventario(periciaKey) {
    // ... (Esta função permanece a mesma por enquanto)
    const inventarioAtivo = this.inventario.filter(
      (item) => !item.ignorarCalculos
    );
    
    const bonusVestimentas = inventarioAtivo
      .filter(
        (item) =>
          (item.id === "vestimenta" || item.tipoBonus === "generico") &&
          item.periciaVinculada === periciaKey
      )
      .map((item) => parseInt(item.valorBonus) || 0) 
      .sort((a, b) => b - a)
      .slice(0, 2)
      .reduce((a, b) => a + b, 0);
      
    const bonusUtensilios = inventarioAtivo
      .filter(
        (item) =>
          (item.id === "utensilio" || item.tipoBonus === "generico") &&
          item.periciaVinculada === periciaKey
      )
      .map((item) => parseInt(item.valorBonus) || 0) 
      .sort((a, b) => b - a)
      .slice(0, 2)
      .reduce((a, b) => a + b, 0);
      
    const bonusEspecificos = inventarioAtivo
      .filter(
        (item) =>
          item.tipoBonus === "especifico" &&
          item.periciaVinculada === periciaKey
      )
      .map((item) => parseInt(item.valorBonus) || 0) 
      .reduce((a, b) => a + b, 0);
      
    const bonusCustom = inventarioAtivo
      .filter(
        (item) => (item.id.startsWith("custom_") || item.tipoBonus === 'custom') && item.periciaVinculada === periciaKey
      )
      .reduce((acc, item) => acc + (parseInt(item.valorBonus) || 0), 0); 
      
    return bonusVestimentas + bonusUtensilios + bonusEspecificos + bonusCustom;
  }
  
  getPesoTotal() {
    // --- (MODIFICAÇÃO PASSO 2 - LÓGICA DE CÁLCULO) ---
    // Agora calculamos o peso com base nos espaços base + mods
    let pesoBase = this.inventario
      .filter((item) => !item.ignorarCalculos)
      .reduce((acc, item) => {
          // Pega o espaço base (fallback para itens antigos)
          let espacosItem = parseFloat(item.espacosBase ?? item.espacos) || 0;
          
          // (Esta lógica será movida para o Modal de Edição,
          // mas deixamos aqui como um fallback)
          if (item.modificacoes && item.modificacoes.length > 0) {
              // Simplesmente assumimos que o valor em 'item.espacos' 
              // (se existir) já foi calculado pelo ModalEditarItem.
              // Se não, usamos o espacosBase.
              espacosItem = parseFloat(item.espacos ?? item.espacosBase) || 0;
          }
          
          return acc + espacosItem;
      }, 0);
      
    return pesoBase;
  }
  
  getMaxPeso() {
    // ... (Esta função permanece a mesma)
    const forca = parseInt(this.atributos.for) || 0;
    let maxPesoBase = forca * 5 || 2;

    const inventarioAtivo = this.inventario.filter(
      (item) => !item.ignorarCalculos
    );

    const temMochilaMilitar = inventarioAtivo.some(
      (item) => item.id === "mochila_militar"
    );
    const temMochilaTatica = inventarioAtivo.some(
      (item) => item.id === "mochila_tatica"
    );

    if (temMochilaMilitar) {
      maxPesoBase += 2;
    }
    if (temMochilaTatica) {
      maxPesoBase += 5;
    }

    if (this.info.trilha === "tecnico") {
      const intelecto = parseInt(this.atributos.int) || 0;
      maxPesoBase = (forca + intelecto) * 5 || 2; 

      if (temMochilaMilitar) {
        maxPesoBase += 2;
      }
      if (temMochilaTatica) {
        maxPesoBase += 5;
      }
    }

    return maxPesoBase;
  }

  // --- Métodos de Salvamento/Carregamento (Sem alterações) ---
  getDados() {
    return {
      atributos: this.atributos,
      pericias: this.pericias,
      info: this.info, 
      recursos: this.recursos,
      defesa: this.defesa,
      inventario: this.inventario,
      rituais: this.rituais, 
      bonusManuais: this.bonusManuais,
      trilhas_personalizadas: this.trilhas_personalizadas, 
      poderes_aprendidos: this.poderes_aprendidos, 
    };
  }
  
  carregarDados(dados) {
    if (dados) {
      this.atributos = dados.atributos || this.atributos;
      this.pericias = dados.pericias || this.pericias;
      this.info = { ...this.info, ...dados.info };
      this.recursos = dados.recursos || this.recursos;
      this.defesa = dados.defesa || this.defesa;
      this.inventario = dados.inventario || [];
      this.rituais = dados.rituais || []; 
      this.bonusManuais = dados.bonusManuais || this.bonusManuais;
      this.trilhas_personalizadas = dados.trilhas_personalizadas || []; 
      this.poderes_aprendidos = dados.poderes_aprendidos || []; 
    }
  }

  // --- CÁLCULO DE RECURSOS MÁXIMOS (Sem alterações) ---
  calcularValoresMaximos() {
    const classe = this.info.classe.toLowerCase().trim();
    const origem = this.info.origem.toLowerCase().trim(); 
    const nex = parseInt(this.info.nex) || 0;

    const vigor = parseInt(this.atributos.vig) || 0;
    const presenca = parseInt(this.atributos.pre) || 0;

    let pvBase = 0,
      peBase = 0,
      sanBase = 0;
    let pvPorNivel = 0,
      pePorNivel = 0,
      sanPorNivel = 0;

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

    const niveisAcima = Math.max(0, (nex - 5) / 5);
    let bonusOrigemPv = 0;
    let bonusOrigemPe = 0;
    let bonusOrigemSan = 0;

    switch (origem) {
      case "desgarrado":
        bonusOrigemPv = 1 * (niveisAcima + 1);
        break;
      case "universitario":
        bonusOrigemPe = 1 + Math.floor(niveisAcima / 2);
        break;
      case "vitima":
        bonusOrigemSan = 1 * (niveisAcima + 1);
        break;
    }

    const bonusManualPvNex = (parseInt(this.bonusManuais.pv_nex) || 0) * niveisAcima;
    const bonusManualPvOutros = parseInt(this.bonusManuais.pv_outros) || 0;
    const bonusManualPeNex = (parseInt(this.bonusManuais.pe_nex) || 0) * niveisAcima;
    const bonusManualPeOutros = parseInt(this.bonusManuais.pe_outros) || 0;
    const bonusManualSanNex = (parseInt(this.bonusManuais.san_nex) || 0) * niveisAcima;
    const bonusManualSanOutros = parseInt(this.bonusManuais.san_outros) || 0;

    this.calculosDetalhados.pv_base = pvBase;
    this.calculosDetalhados.pv_nivel = niveisAcima * pvPorNivel;
    this.calculosDetalhados.pv_origem = bonusOrigemPv; 
    this.calculosDetalhados.pe_base = peBase;
    this.calculosDetalhados.pe_nivel = niveisAcima * pePorNivel;
    this.calculosDetalhados.pe_origem = bonusOrigemPe; 
    this.calculosDetalhados.san_base = sanBase;
    this.calculosDetalhados.san_nivel = niveisAcima * sanPorNivel;
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