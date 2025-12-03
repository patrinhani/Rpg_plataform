// src/contexts/FichaContext.jsx
import React, { createContext, useContext, useState, useRef, useMemo } from 'react';
import Personagem from '../lib/personagem.js';
import { database, Patentes, getPatenteInfo } from '../lib/database.js';

const FichaContext = createContext();

export function useFicha() {
  return useContext(FichaContext);
}

export function FichaProvider({ children }) {
  // 1. Instância Única por Ciclo de Vida do Componente
  // Usamos useRef para manter a instância da classe viva e estável
  const fichaRef = useRef(new Personagem());
  
  // 2. Estado Reativo para a UI
  // O React precisa desse estado para saber quando redesenhar a tela
  const [personagem, setPersonagem] = useState(fichaRef.current.getDados());
  
  // 3. Estado de Valores Calculados (Movido da index.jsx para cá)
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
  });

  // --- Ação: Carregar Dados (Vinda do Firestore) ---
  const carregarFicha = (dados) => {
    fichaRef.current.carregarDados(dados);
    atualizarCalculos(); // Já atualiza tudo ao carregar
  };

  // --- Ação: Atualizar Dados (Input do Usuário) ---
  // Esta função substitui a antiga 'handleFichaChange'
  const atualizarFicha = (secao, campo, valor, skipRecalc = false) => {
    const ficha = fichaRef.current;

    if (secao === 'info') {
        if (campo === 'nex') { 
            let nex = parseInt(String(valor).replace(/[^0-9]/g, '')) || 0; 
            if (nex > 100) nex = 100; 
            valor = `${nex}%`; 
            ficha.setInfo(campo, valor); 
        } else if (campo === 'origem') {
            // Lógica de limpar perícias antigas de origem e adicionar novas
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
            
            // Remove poder de origem antigo e adiciona o novo
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
             // Lógica de limpar trilha se mudar de classe
             // (Simplificada aqui, a validação completa pode ficar no componente visual se preferir)
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
        // Se pular o recálculo pesado, pelo menos sincroniza o estado básico
        setPersonagem({ ...ficha.getDados() });
    }
  };

  // --- Função Central de Cálculo (Extraída da index.jsx) ---
  const atualizarCalculos = () => {
    const ficha = fichaRef.current;
    ficha.calcularValoresMaximos(); 
    
    const dados = ficha.getDados(); 

    // --- NOVO: Calcula Atributos Detalhados ---
    const atributosDetalhados = {
        for: ficha.getAtributoDetalhado('for'),
        agi: ficha.getAtributoDetalhado('agi'),
        int: ficha.getAtributoDetalhado('int'),
        pre: ficha.getAtributoDetalhado('pre'),
        vig: ficha.getAtributoDetalhado('vig'),
    };
    
    // 1. Defesa (Usa os valores finais)
    const agi = atributosDetalhados.agi.valorFinal;
    const vig = atributosDetalhados.vig.valorFinal; 
    const int = atributosDetalhados.int.valorFinal;
    const equip = dados.defesa.equip || 0; 
    const outros = parseInt(dados.defesa.outros) || 0;
    
    // ... (lógica de defesa continua igual, usando as variáveis agi/vig/int acima) ...

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

    // 2. Ações de Defesa
    const treino_fortitude = parseInt(dados.pericias.fortitude) || 0; 
    const treino_reflexos = parseInt(dados.pericias.reflexos) || 0; 
    const treino_luta = parseInt(dados.pericias.luta) || 0;
    
    const bonus_fortitude = Math.floor(treino_fortitude / 5) + vig; 
    const bonus_reflexos = Math.floor(treino_reflexos / 5) + agi;
    
    // ...

    // 4. Perícias (Mantém lógica de bônus de inventário)
    const bonusPericiaCalculado = {}; 
    Object.keys(dados.pericias).forEach(key => { 
        bonusPericiaCalculado[key] = ficha.getBonusPericiaInventario(key); 
    });
    
    // ... (Cálculo de periciasTotal mantido) ...
    // ...

    setCalculados({ 
        defesaTotal, 
        // ... (outros campos)
        atributosDetalhados, // <--- ADICIONADO AQUI PARA A UI CONSUMIR
        // ...
        // ... (resto do objeto)
        cargaAtual: ficha.getPesoTotal(), 
        cargaMax: ficha.getMaxPeso(), 
        periciasTreinadas: Object.values(dados.pericias).filter(v => parseInt(v) >= 5).length, 
        periciasTotal: Math.max(0, 0), // (Ajuste conforme sua lógica existente)
        bonusPericia: bonusPericiaCalculado, 
        canChangeTheme: parseInt(String(dados.info.nex).replace(/[^0-9]/g, '')) >= 50, 
        patente: getPatenteInfo(parseInt(dados.info.prestigio) || 0) || Patentes[0], 
        bloqueio_rd: (treino_fortitude >= 5) ? bonus_fortitude : '—', 
        esquiva_bonus: (treino_reflexos >= 5) ? bonus_reflexos : '—', 
        tem_contra_ataque: treino_luta >= 5, 
    });
    
    setPersonagem({ ...dados });
  };

  // Helpers diretos da classe (para não precisar acessar fichaRef em todo lugar)
  const helpers = {
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
  };

  const value = {
      personagem,
      calculados,
      carregarFicha,
      atualizarFicha,
      fichaInstance: fichaRef.current, // Acesso direto se necessário
      ...helpers
  };

  return (
    <FichaContext.Provider value={value}>
      {children}
    </FichaContext.Provider>
  );
}