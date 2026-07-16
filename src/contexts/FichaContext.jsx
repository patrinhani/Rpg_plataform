// src/contexts/FichaContext.jsx
import React, { createContext, useContext, useState, useRef, useMemo, useCallback } from 'react';
import Personagem from '../lib/personagem.js';
import { database, Patentes, getPatenteInfo } from '../lib/database.js';

// Inicializa com null para podermos detectar se o Provider está faltando
const FichaContext = createContext(null);

export function useFicha() {
  const context = useContext(FichaContext);
  if (!context) {
    throw new Error("useFicha deve ser usado dentro de um FichaProvider.");
  }
  return context;
}

export function FichaProvider({ children }) {
  // 1. Instância Única da Classe Personagem
  const fichaRef = useRef(null);
  
  // Inicialização Lazy do Ref para evitar erros de construtor no render inicial
  if (!fichaRef.current) {
    fichaRef.current = new Personagem();
  }

  // 2. Estado React sincronizado com a instância
  const [personagem, setPersonagem] = useState(() => fichaRef.current.getDados());
  
  const [calculados, setCalculados] = useState({
    defesaTotal: 10, 
    cargaAtual: 0, 
    cargaMax: 2, 
    cargaLimiteAbsoluto: 4,
    sobrecarregado: false,
    cargaAcimaDoLimite: false,
    deslocamentoFinal: 9,
    resistenciasCalculadas: {},
    periciasTreinadas: 0, 
    periciasTotal: 0, 
    bonusPericia: {}, 
    canChangeTheme: false,
    patente: Patentes[0], 
    bloqueio_rd: '—', 
    esquiva_bonus: '—', 
    defesa_esquiva: '—',
    equipamentoDefesa: 0,
    modificadorCaido: null,
    efeitosOrientativosCondicoes: {
      naoPodeObservar: false,
      falhaAutomaticaReflexos: false,
    },
    tem_contra_ataque: false,
    atributosDetalhados: { 
        for: { valorFinal: 1 }, agi: { valorFinal: 1 }, int: { valorFinal: 1 }, 
        pre: { valorFinal: 1 }, vig: { valorFinal: 1 }
    },
    limite_pe: 1
  });

  // --- Função Central de Cálculo (Memoizada) ---
  const atualizarCalculos = useCallback(() => {
    const ficha = fichaRef.current;
    if (!ficha) return;

    ficha.calcularValoresMaximos(); 
    
    const dados = ficha.getDados(); 

    // Calcula Atributos Detalhados
    const atributosDetalhados = {
        for: ficha.getAtributoDetalhado('for'),
        agi: ficha.getAtributoDetalhado('agi'),
        int: ficha.getAtributoDetalhado('int'),
        pre: ficha.getAtributoDetalhado('pre'),
        vig: ficha.getAtributoDetalhado('vig'),
    };
    
    // Defesa
    const agi = atributosDetalhados.agi.valorFinal;
    const equipInventario = ficha.getBonusDefesaInventario();
    const equipManualLegado = Number.parseInt(dados.defesa.equip, 10) || 0;
    const equip = equipInventario + equipManualLegado;
    const outros = parseInt(dados.defesa.outros) || 0;
    const ajusteManualDefesa = parseInt(dados.bonusManuais?.defesa) || 0;
    const condicoes = dados.condicoesEfetivas || dados.condicoesAtivas || [];
    const estadoCarga = ficha.getEstadoCarga();
    
    let bonusOrigemDefesa = (dados.info.origem === "policial") ? 2 : 0;
    let penalidadeDefesa = 0;
    
    const indefeso = ['indefeso', 'inconsciente', 'paralisado', 'petrificado']
      .some(condicao => condicoes.includes(condicao));
    const vulneravel = ['vulneravel', 'desprevenido', 'atordoado', 'surpreendido', 'cego', 'agarrado', 'enredado', 'exausto', 'fatigado']
      .some(condicao => condicoes.includes(condicao));

    if (indefeso) penalidadeDefesa = -10;
    else if (vulneravel) penalidadeDefesa = -5;
    
    const defesaTotal = 10 + agi + equip + outros + bonusOrigemDefesa + penalidadeDefesa
      + ajusteManualDefesa + estadoCarga.penalidadeDefesa;

    const bonusPericiaCalculado = {};
    Object.keys(dados.pericias).forEach(key => {
        bonusPericiaCalculado[key] = ficha.getBonusPericiaInventario(key)
          + ficha.getBonusPericiaOrigem(key)
          + (parseInt(dados.bonusPericiasManuais?.[key]) || 0);
    });

    // Ações de Defesa e Perícias
    const treino_fortitude = parseInt(dados.pericias.fortitude) || 0; 
    const treino_reflexos = parseInt(dados.pericias.reflexos) || 0; 
    const treino_luta = parseInt(dados.pericias.luta) || 0;
    
    const bonus_fortitude = treino_fortitude + (bonusPericiaCalculado.fortitude || 0);
    const bonus_reflexos = treino_reflexos + (bonusPericiaCalculado.reflexos || 0);
    const bonusManualBloqueio = parseInt(dados.bonusManuais?.bloqueio) || 0;
    const bonusManualEsquiva = parseInt(dados.bonusManuais?.esquiva) || 0;

    const nexNum = parseInt(String(dados.info.nex).replace(/[^0-9]/g, '')) || 0;
    const resistenciasInventario = ficha.getResistenciasInventario();
    const resistenciasOrigem = ficha.getResistenciasOrigem();
    const rdPetrificado = condicoes.includes('petrificado') ? 10 : 0;
    const resistenciasCalculadas = Object.fromEntries(
      Object.keys(dados.resistencias).map(chave => [
        chave,
        (Number.parseInt(dados.resistencias[chave], 10) || 0)
          + (resistenciasInventario[chave] || 0)
          + (resistenciasOrigem[chave] || 0)
          + rdPetrificado,
      ]),
    );

    const deslocamentoFinal = ficha.getDeslocamentoFinal();

    const patenteBase = getPatenteInfo(parseInt(dados.info.prestigio) || 0) || Patentes[0];
    const creditos = ['Baixo', 'Médio', 'Alto', 'Ilimitado'];
    const patente = dados.info.origem === 'magnata'
      ? {
          ...patenteBase,
          credito: creditos[Math.min(creditos.indexOf(patenteBase.credito) + 1, creditos.length - 1)],
        }
      : patenteBase;

    setCalculados({
        defesaTotal, 
        equipamentoDefesa: equip,
        modificadorCaido: condicoes.includes('caido') ? { corpoACorpo: -5, distancia: 5 } : null,
        efeitosOrientativosCondicoes: {
          naoPodeObservar: condicoes.includes('cego'),
          falhaAutomaticaReflexos: indefeso,
        },
        atributosDetalhados,
        cargaAtual: estadoCarga.atual,
        cargaMax: estadoCarga.maximo,
        cargaLimiteAbsoluto: estadoCarga.limiteAbsoluto,
        sobrecarregado: estadoCarga.sobrecarregado,
        cargaAcimaDoLimite: estadoCarga.acimaDoLimite,
        deslocamentoFinal,
        resistenciasCalculadas,
        periciasTreinadas: Object.values(dados.pericias).filter(v => parseInt(v) >= 5).length, 
        periciasTotal: Object.keys(dados.pericias).length, 
        bonusPericia: bonusPericiaCalculado, 
        canChangeTheme: nexNum >= 50,
        patente,
        bloqueio_rd: (treino_fortitude >= 5 || bonusManualBloqueio !== 0) ? ((treino_fortitude >= 5 ? bonus_fortitude : 0) + bonusManualBloqueio) : '—', 
        esquiva_bonus: (treino_reflexos >= 5 || bonusManualEsquiva !== 0) ? ((treino_reflexos >= 5 ? bonus_reflexos : 0) + bonusManualEsquiva) : '—',
        defesa_esquiva: (treino_reflexos >= 5 || bonusManualEsquiva !== 0)
          ? defesaTotal + (treino_reflexos >= 5 ? bonus_reflexos : 0) + bonusManualEsquiva
          : '—',
        tem_contra_ataque: treino_luta >= 5, 
        limite_pe: ficha.calculosDetalhados?.limite_pe || 1
    });
    
    // Atualiza estado visual do React
    setPersonagem({ ...dados });
  }, []);

  // --- Carregar Dados ---
  const carregarFicha = useCallback((dados) => {
    if (!fichaRef.current) return;
    fichaRef.current.carregarDados(dados);
    atualizarCalculos(); 
  }, [atualizarCalculos]);

  // --- Atualizar Dados ---
  const atualizarFicha = useCallback((secao, campo, valor, skipRecalc = false) => {
    const ficha = fichaRef.current;
    if (!ficha) return;

    if (secao === 'info') {
        if (campo === 'nex') { 
            let nex = parseInt(String(valor).replace(/[^0-9]/g, '')) || 0; 
            if (nex > 99) nex = 99;
            if (nex < 0) nex = 0;
            valor = `${nex}%`; 
            ficha.setInfo(campo, valor); 
        } else if (campo === 'origem') {
            const nova = valor; 
            const antiga = ficha.getDados().info.origem; 
            
            ficha.trocarPericiasOrigem(database.periciasPorOrigem?.[nova]?.fixas || []);
            
            // Remove poder de origem antigo
            if (antiga) ficha.poderes_aprendidos = ficha.poderes_aprendidos.filter(p => !p.isOrigemPower); 
            
            ficha.setInfo(campo, valor); 
        } else if (campo === 'classe') {
            const classeAnterior = ficha.getDados().info.classe;
            ficha.setInfo(campo, valor);
            if (valor === 'sobrevivente') {
                ficha.setInfo('nex', '0%');
                ficha.setInfo('estagio_sobrevivente', 1);
                ficha.setInfo('trilha', 'nenhuma');
            } else if (classeAnterior === 'sobrevivente') {
                ficha.setInfo('nex', '5%');
                ficha.setInfo('trilha', 'nenhuma');
            }
        } else if (campo === 'estagio_sobrevivente') {
            ficha.setInfo(campo, Math.min(5, Math.max(1, parseInt(valor) || 1)));
            ficha.setInfo('nex', '0%');
        } else {
            ficha.setInfo(campo, valor);
        }
    } 
    else if (secao === 'atributos') ficha.setAtributo(campo, valor); 
    else if (secao === 'recursos') ficha.setRecurso(campo, valor); 
    else if (secao === 'perseguicao') ficha.setPerseguicao(campo, valor); 
    else if (secao === 'visibilidade_mudar') ficha.setVisibilidade(campo, valor);
    else if (secao === 'defesa') ficha.setDefesa(campo, valor); 
    else if (secao === 'pericias') ficha.setTreinoPericia(campo, valor); 
    else if (secao === 'bonusManuais') ficha.setBonusManual(campo, valor);
    else if (secao === 'bonusPericiasManuais') ficha.setBonusPericiaManual(campo, valor);
    else if (secao === 'resistencias') ficha.setResistencia(campo, valor);

    if (!skipRecalc) {
        atualizarCalculos();
    } else {
        setPersonagem({ ...ficha.getDados() });
    }
  }, [atualizarCalculos]);

  // --- Helpers (Memoizados) ---
  const helpers = useMemo(() => ({
      addItem: (item) => { fichaRef.current.addItemInventario(item); atualizarCalculos(); },
      removeItem: (id) => { fichaRef.current.removeItemInventario(id); atualizarCalculos(); },
      updateItem: (id, dados) => { fichaRef.current.updateItemInventario(id, dados); atualizarCalculos(); },
      toggleItem: (id) => { fichaRef.current.toggleIgnorarCalculos(id); atualizarCalculos(); },
      
      addRitual: (rit) => { fichaRef.current.addRitualInventario(rit); atualizarCalculos(); },
      removeRitual: (id) => { fichaRef.current.removeRitualInventario(id); atualizarCalculos(); },
      
      addPoder: (pod) => { fichaRef.current.addPoder(pod); atualizarCalculos(); },
      removePoder: (key) => { fichaRef.current.removePoder(key); atualizarCalculos(); },
      
      addTrilhaCustom: (t) => { const trilha = fichaRef.current.addTrilhaPersonalizada(t); atualizarCalculos(); return { trilha, dados: fichaRef.current.getDados() }; },
      addPericiaCustom: (p) => { const pericia = fichaRef.current.addPericiaCustom(p); atualizarCalculos(); return pericia; },
      removePericiaCustom: (key) => { fichaRef.current.removePericiaCustom(key); atualizarCalculos(); },
      
      addNota: (n) => { fichaRef.current.addNotaDiario(n); atualizarCalculos(); },
      updateNota: (id, n) => { fichaRef.current.updateNotaDiario(id, n); atualizarCalculos(); },
      removeNota: (id) => { fichaRef.current.removeNotaDiario(id); atualizarCalculos(); },
      
      toggleCondicao: (id) => { fichaRef.current.toggleCondicao(id); atualizarCalculos(); },
      reaplicarCondicao: (id) => {
        const condicao = database.condicoes?.find(item => item.id === id);
        fichaRef.current.aplicarCondicao(id, condicao?.evolucao || null);
        atualizarCalculos();
      },
      aplicarInterludio: (opcoes) => { const res = fichaRef.current.aplicarInterludio(opcoes); atualizarCalculos(); return res; },
      consumirBuffTemporario: (tipo) => { const consumiu = fichaRef.current.consumirBuffTemporario(tipo); atualizarCalculos(); return consumiu; }
  }), [atualizarCalculos]);

  // --- Valor Final do Contexto ---
  const value = useMemo(() => ({
      personagem,
      calculados,
      carregarFicha,
      atualizarFicha,
      fichaInstance: fichaRef.current, 
      ...helpers
  }), [personagem, calculados, carregarFicha, atualizarFicha, helpers]);

  return (
    <FichaContext.Provider value={value}>
      {children}
    </FichaContext.Provider>
  );
}
