// src/contexts/FichaContext.jsx
import React, { createContext, useContext, useState, useRef, useMemo, useCallback } from 'react';
import Personagem from '../lib/personagem.js';
import { database, Patentes, getPatenteInfo } from '../lib/database.js';

const FichaContext = createContext();

export function useFicha() {
  return useContext(FichaContext);
}

export function FichaProvider({ children }) {
  // 1. Instância Única e Estado
  const fichaRef = useRef(new Personagem());
  const [personagem, setPersonagem] = useState(fichaRef.current.getDados());
  
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
    atributosDetalhados: { // Inicializa com valores padrão para evitar erro de undefined
        for: { valorFinal: 1 }, agi: { valorFinal: 1 }, int: { valorFinal: 1 }, 
        pre: { valorFinal: 1 }, vig: { valorFinal: 1 }
    }
  });

  // --- Função Central de Cálculo (Memoizada) ---
  const atualizarCalculos = useCallback(() => {
    const ficha = fichaRef.current;
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
    const int = atributosDetalhados.int.valorFinal; // Usado em lógica interna se houver
    const equip = dados.defesa.equip || 0; 
    const outros = parseInt(dados.defesa.outros) || 0;
    
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
    
    const defesaTotal = 10 + agi + equip + outros + bonusOrigemDefesa + penalidadeDefesa; 

    // Ações de Defesa e Perícias
    const treino_fortitude = parseInt(dados.pericias.fortitude) || 0; 
    const treino_reflexos = parseInt(dados.pericias.reflexos) || 0; 
    const treino_luta = parseInt(dados.pericias.luta) || 0;
    
    const bonus_fortitude = Math.floor(treino_fortitude / 5) + vig; 
    const bonus_reflexos = Math.floor(treino_reflexos / 5) + agi;
    
    const bonusPericiaCalculado = {}; 
    Object.keys(dados.pericias).forEach(key => { 
        bonusPericiaCalculado[key] = ficha.getBonusPericiaInventario(key); 
    });

    setCalculados({ 
        defesaTotal, 
        atributosDetalhados,
        cargaAtual: ficha.getPesoTotal(), 
        cargaMax: ficha.getMaxPeso(), 
        periciasTreinadas: Object.values(dados.pericias).filter(v => parseInt(v) >= 5).length, 
        periciasTotal: 0, // Ajuste conforme lógica
        bonusPericia: bonusPericiaCalculado, 
        canChangeTheme: parseInt(String(dados.info.nex).replace(/[^0-9]/g, '')) >= 50, 
        patente: getPatenteInfo(parseInt(dados.info.prestigio) || 0) || Patentes[0], 
        bloqueio_rd: (treino_fortitude >= 5) ? bonus_fortitude : '—', 
        esquiva_bonus: (treino_reflexos >= 5) ? bonus_reflexos : '—', 
        tem_contra_ataque: treino_luta >= 5, 
    });
    
    // Atualiza estado visual
    setPersonagem({ ...dados });
  }, []);

  // --- Carregar Dados ---
  const carregarFicha = useCallback((dados) => {
    fichaRef.current.carregarDados(dados);
    atualizarCalculos(); 
  }, [atualizarCalculos]);

  // --- Atualizar Dados ---
  const atualizarFicha = useCallback((secao, campo, valor, skipRecalc = false) => {
    const ficha = fichaRef.current;

    if (secao === 'info') {
        if (campo === 'nex') { 
            let nex = parseInt(String(valor).replace(/[^0-9]/g, '')) || 0; 
            if (nex > 100) nex = 100; 
            valor = `${nex}%`; 
            ficha.setInfo(campo, valor); 
        } else if (campo === 'origem') {
            const nova = valor; 
            const antiga = ficha.getDados().info.origem; 
            
            if (antiga && database.periciasPorOrigem?.[antiga]?.fixas) {
                database.periciasPorOrigem[antiga].fixas.forEach(p => { 
                    if (ficha.getBonusTotalPericia(p) === 5) ficha.setTreinoPericia(p, 0); 
                }); 
            }
            if (database.periciasPorOrigem?.[nova]?.fixas) {
                database.periciasPorOrigem[nova].fixas.forEach(p => { 
                    if (ficha.getBonusTotalPericia(p) === 0) ficha.setTreinoPericia(p, 5); 
                }); 
            }
            
            if (antiga) ficha.poderes_aprendidos = ficha.poderes_aprendidos.filter(p => !p.isOrigemPower); 
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
        else if (campo === 'classe') {
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
      
      addTrilhaCustom: (t) => { fichaRef.current.addTrilhaPersonalizada(t); atualizarCalculos(); },
      
      addNota: (n) => { fichaRef.current.addNotaDiario(n); atualizarCalculos(); },
      updateNota: (id, n) => { fichaRef.current.updateNotaDiario(id, n); atualizarCalculos(); },
      removeNota: (id) => { fichaRef.current.removeNotaDiario(id); atualizarCalculos(); },
      
      toggleCondicao: (id) => { fichaRef.current.toggleCondicao(id); atualizarCalculos(); },
      aplicarInterludio: (opcoes) => { const res = fichaRef.current.aplicarInterludio(opcoes); atualizarCalculos(); return res; }
  }), [atualizarCalculos]);

  // --- Valor Final do Contexto (Memoizado) ---
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