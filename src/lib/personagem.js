/**
 * js/personagem.js
 * (ATUALIZADO PARA REACT/VITE)
 * - 'setAtributo' agora aceita strings vazias ("")
 * - Funções de cálculo (getMaxPeso, calcularValoresMaximos) usam 
 * parseInt(valor) || 0 para tratar "" como 0.
 * - Adicionado 'export { ficha }'
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

    this.inventario = []; // Array de objetos de item

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

  // --- Métodos "Set" ---
  setAtributo(campo, valor) {
    // CORREÇÃO DO "BUG DO 0":
    // Se o valor for uma string vazia, guardamos ela
    if (valor === "") {
      this.atributos[campo] = "";
      return;
    }
    // Se não for vazia, tentamos converter para número.
    // Se falhar (NaN), guardamos 0.
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

  // ... (getBonusTotalPericia, addItemInventario, etc. continuam iguais) ...
  getBonusTotalPericia(pericia, atributoBase) {
    return this.pericias[pericia] || 0;
  }
  addItemInventario(item) {
    const itemComId = {
      ...item,
      inventarioId: Date.now() + Math.random(),
      ignorarCalculos: false,
    };
    this.inventario.push(itemComId);
  }
  removeItemInventario(inventarioId) {
    this.inventario = this.inventario.filter(
      (item) => item.inventarioId !== inventarioId
    );
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
  getBonusDefesaInventario() {
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
    const bonusCustom = inventarioAtivo
      .filter((item) => item.id === "custom" && item.defesa > 0)
      .reduce((acc, item) => acc + (item.defesa || 0), 0);
    return bonusProtecao + bonusEscudo + bonusCustom;
  }
  getBonusPericiaInventario(periciaKey) {
    const inventarioAtivo = this.inventario.filter(
      (item) => !item.ignorarCalculos
    );
    const bonusVestimentas = inventarioAtivo
      .filter(
        (item) =>
          (item.id === "vestimenta" || item.tipoBonus === "generico") &&
          item.periciaVinculada === periciaKey
      )
      .map((item) => item.valorBonus || 0)
      .sort((a, b) => b - a)
      .slice(0, 2)
      .reduce((a, b) => a + b, 0);
    const bonusUtensilios = inventarioAtivo
      .filter(
        (item) =>
          (item.id === "utensilio" || item.tipoBonus === "generico") &&
          item.periciaVinculada === periciaKey
      )
      .map((item) => item.valorBonus || 0)
      .sort((a, b) => b - a)
      .slice(0, 2)
      .reduce((a, b) => a + b, 0);
    const bonusEspecificos = inventarioAtivo
      .filter(
        (item) =>
          item.tipoBonus === "especifico" &&
          item.periciaVinculada === periciaKey
      )
      .map((item) => item.valorBonus || 0)
      .reduce((a, b) => a + b, 0);
    const bonusCustom = inventarioAtivo
      .filter(
        (item) => item.id === "custom" && item.periciaVinculada === periciaKey
      )
      .reduce((acc, item) => acc + (item.valorBonus || 0), 0);
    return bonusVestimentas + bonusUtensilios + bonusEspecificos + bonusCustom;
  }
  getPesoTotal() {
    let pesoBase = this.inventario
      .filter((item) => !item.ignorarCalculos)
      .reduce((acc, item) => acc + (item.espacos || 0), 0);
    return pesoBase;
  }
  
  getMaxPeso() {
    // CORREÇÃO DO "BUG DO 0":
    // Garante que 'for' (que pode ser "") seja tratado como 0
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
      // CORREÇÃO DO "BUG DO 0":
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

  // --- Métodos de Salvamento ---
  getDados() {
    return {
      atributos: this.atributos,
      pericias: this.pericias,
      info: this.info,
      recursos: this.recursos,
      defesa: this.defesa,
      inventario: this.inventario,
      bonusManuais: this.bonusManuais,
    };
  }
  carregarDados(dados) {
    if (dados) {
      this.atributos = dados.atributos || this.atributos;
      this.pericias = dados.pericias || this.pericias;
      this.info = dados.info || this.info;
      this.recursos = dados.recursos || this.recursos;
      this.defesa = dados.defesa || this.defesa;
      this.inventario = dados.inventario || [];
      this.bonusManuais = dados.bonusManuais || this.bonusManuais;
    }
  }

  // --- CÁLCULO DE RECURSOS MÁXIMOS ---
  calcularValoresMaximos() {
    const classe = this.info.classe.toLowerCase().trim();
    const origem = this.info.origem.toLowerCase().trim(); 
    const nex = parseInt(this.info.nex) || 0;

    // CORREÇÃO DO "BUG DO 0":
    // Garante que 'vig' e 'pre' (que podem ser "") sejam tratados como 0
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
      default: 
        pvBase = 16 + vigor;
        peBase = 3 + presenca;
        sanBase = 16;
        pvPorNivel = 3 + vigor;
        pePorNivel = 3 + presenca;
        sanPorNivel = 4;
        break; 
      case "sobrevivente":
        pvBase = 8 + vigor; 
        peBase = 2 + presenca; 
        sanBase = 8; 
        pvPorNivel = 2 + vigor;
        pePorNivel = 1 + presenca;
        sanPorNivel = 2;
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