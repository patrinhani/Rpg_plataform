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
    periciasTreinadas: 0, 
    periciasTotal: 0, 
    bonusPericia: {}, 
    canChangeTheme: false, 
    patente: Patentes[0], 
    bloqueio_rd: '—', 
    esquiva_bonus: '—', 
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
    const vig = atributosDetalhados.vig.valorFinal; 
    const equip = dados.defesa.equip || 0; 
    const outros = parseInt(dados.defesa.outros) || 0;
    const ajusteManualDefesa = parseInt(dados.bonusManuais?.defesa) || 0;
    
    let bonusOrigemDefesa = (dados.info.origem === "policial") ? 2 : 0;
    let penalidadeDefesa = 0;
    
    if (dados.condicoesAtivas.includes('vulneravel') || 
        dados.condicoesAtivas.includes('desprevenido') || 
        dados.condicoesAtivas.includes('atordoado') || 
        dados.condicoesAtivas.includes('cego') ||
        dados.condicoesAtivas.includes('agarrado') || 
        dados.condicoesAtivas.includes('caido')) {
            penalidadeDefesa -= 5;
    }
    if (dados.condicoesAtivas.includes('indefeso') || dados.condicoesAtivas.includes('inconsciente')) {
        penalidadeDefesa -= 10;
    }
    
    const defesaTotal = 10 + agi + equip + outros + bonusOrigemDefesa + penalidadeDefesa + ajusteManualDefesa; 

    // Ações de Defesa e Perícias
    const treino_fortitude = parseInt(dados.pericias.fortitude) || 0; 
    const treino_reflexos = parseInt(dados.pericias.reflexos) || 0; 
    const treino_luta = parseInt(dados.pericias.luta) || 0;
    
    const bonus_fortitude = Math.floor(treino_fortitude / 5) + vig; 
    const bonus_reflexos = Math.floor(treino_reflexos / 5) + agi;
    const bonusManualBloqueio = parseInt(dados.bonusManuais?.bloqueio) || 0;
    const bonusManualEsquiva = parseInt(dados.bonusManuais?.esquiva) || 0;
    
    const bonusPericiaCalculado = {}; 
    Object.keys(dados.pericias).forEach(key => { 
        bonusPericiaCalculado[key] = ficha.getBonusPericiaInventario(key) + (parseInt(dados.bonusPericiasManuais?.[key]) || 0); 
    });

    const nexNum = parseInt(String(dados.info.nex).replace(/[^0-9]/g, '')) || 0;

    setCalculados({ 
        defesaTotal, 
        atributosDetalhados,
        cargaAtual: ficha.getPesoTotal(), 
        cargaMax: ficha.getMaxPeso(), 
        periciasTreinadas: Object.values(dados.pericias).filter(v => parseInt(v) >= 5).length, 
        periciasTotal: Object.keys(dados.pericias).length, 
        bonusPericia: bonusPericiaCalculado, 
        canChangeTheme: nexNum >= 50, 
        patente: getPatenteInfo(parseInt(dados.info.prestigio) || 0) || Patentes[0], 
        bloqueio_rd: (treino_fortitude >= 5 || bonusManualBloqueio !== 0) ? ((treino_fortitude >= 5 ? bonus_fortitude : 0) + bonusManualBloqueio) : '—', 
        esquiva_bonus: (treino_reflexos >= 5 || bonusManualEsquiva !== 0) ? ((treino_reflexos >= 5 ? bonus_reflexos : 0) + bonusManualEsquiva) : '—', 
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
            if (nex > 100) nex = 100; 
            valor = `${nex}%`; 
            ficha.setInfo(campo, valor); 
        } else if (campo === 'origem') {
            const nova = valor; 
            const antiga = ficha.getDados().info.origem; 
            
            // Remove perícias da origem antiga
            if (antiga && database.periciasPorOrigem?.[antiga]?.fixas) {
                database.periciasPorOrigem[antiga].fixas.forEach(p => { 
                    if (ficha.getBonusTotalPericia(p) === 5) ficha.setTreinoPericia(p, 0); 
                }); 
            }
            // Adiciona novas
            if (database.periciasPorOrigem?.[nova]?.fixas) {
                database.periciasPorOrigem[nova].fixas.forEach(p => { 
                    if (ficha.getBonusTotalPericia(p) === 0) ficha.setTreinoPericia(p, 5); 
                }); 
            }
            
            // Remove poder de origem antigo
            if (antiga) ficha.poderes_aprendidos = ficha.poderes_aprendidos.filter(p => !p.isOrigemPower); 
            
            // Adiciona novo poder
            const dadosOrigem = database.periciasPorOrigem?.[nova]; 
            if (dadosOrigem && dadosOrigem.poder) {
                ficha.addPoder({ 
                    key: `origem_${nova}`, 
                    nome: dadosOrigem.poder.nome, 
                    descricao: dadosOrigem.poder.descricao, 
                    tipo: "Origem", 
                    isOrigemPower: true 
                }); 
            }
            ficha.setInfo(campo, valor); 
        } 
        else {
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
      aplicarInterludio: (opcoes) => { const res = fichaRef.current.aplicarInterludio(opcoes); atualizarCalculos(); return res; }
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
