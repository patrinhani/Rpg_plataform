// src/lib/calculosCombate.js

// Tabela de progressão de dados de dano (Ordem Paranormal)
const PASSOS_DANO = ["1d4", "1d6", "1d8", "1d10", "1d12"];

export function calcularDanoArma(item) {
    if (!item.dano) return null;

    // Regex para separar dados (ex: "1d8" -> qtd:1, faces:8, bonus:null)
    // Aceita formatos como "1d8", "2d6+2"
    const regex = /(\d+)d(\d+)(?:\+(\d+))?/;
    const match = item.dano.match(regex);
    
    if (!match) return item.dano; // Retorna original se for algo exótico

    let qtd = parseInt(match[1]);
    let faces = parseInt(match[2]);
    let bonusFixo = match[3] ? parseInt(match[3]) : 0;

    const mods = item.modificacoes || [];

    // 1. Calibre Grosso: Aumenta o passo do dado OU adiciona +1 dado se já for d12?
    // Regra Oficial: "aumenta o dano em mais um dado do mesmo tipo" (ex: 1d8 vira 2d8)
    // Nota: Algumas interpretações dizem passo de dano. Vamos seguir a regra escrita no seu txt:
    // "aumentando seu dano em mais um dado do mesmo tipo"
    if (mods.includes('calibre_grosso')) {
        qtd += 1; 
    }

    // 2. Golpe Pesado (Se for um poder que você queira aplicar, teria que vir de fora)
    // Por enquanto, vamos focar só nas modificações do item
    
    // 3. Cruel: +2 no dano
    if (mods.includes('cruel')) {
        bonusFixo += 2;
    }

    // 4. Empuxo (Energia): +1 dado do mesmo tipo (se arremessada, mas vamos simplificar e mostrar o potencial)
    if (mods.includes('empuxo')) {
        // qtd += 1; // (Opcional mostrar no card base ou não)
    }
    
    // 5. Lancinante (Sangue): +1d8
    let danoExtraString = "";
    if (mods.includes('lancinante')) {
        danoExtraString = " + 1d8";
    }
    
    // 6. Erosiva (Morte): +1d8
    if (mods.includes('erosiva')) {
        danoExtraString += " + 1d8";
    }

    // Monta a nova string
    let resultado = `${qtd}d${faces}`;
    if (bonusFixo > 0) resultado += `+${bonusFixo}`;
    
    return resultado + danoExtraString;
}