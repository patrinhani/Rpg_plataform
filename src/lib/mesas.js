// src/lib/mesas.js
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  arrayUnion, 
  getDoc,
  setDoc
} from 'firebase/firestore';
import { ficha as FichaClass } from './personagem'; // Para pegar o modelo padrão

// 1. Criar uma Nova Mesa
export async function criarMesa(nome, mestreUid) {
  try {
    const docRef = await addDoc(collection(db, "mesas"), {
      nome: nome,
      mestre: mestreUid,
      jogadores: [], // Lista de UIDs dos jogadores
      dataCriacao: new Date().toISOString()
    });
    return docRef.id;
  } catch (e) {
    console.error("Erro ao criar mesa:", e);
    throw e;
  }
}

// 2. Buscar Mesas do Usuário (Como Mestre ou Jogador)
export async function buscarMinhasMesas(uid) {
  const mesas = [];
  
  // Mesas que eu mestro
  const qMestre = query(collection(db, "mesas"), where("mestre", "==", uid));
  const snapMestre = await getDocs(qMestre);
  snapMestre.forEach(doc => mesas.push({ id: doc.id, ...doc.data(), papel: 'mestre' }));

  // Mesas que sou jogador
  const qJogador = query(collection(db, "mesas"), where("jogadores", "array-contains", uid));
  const snapJogador = await getDocs(qJogador);
  snapJogador.forEach(doc => mesas.push({ id: doc.id, ...doc.data(), papel: 'jogador' }));

  return mesas;
}

// 3. Entrar em uma Mesa (via ID/Código)
export async function entrarNaMesa(mesaId, jogadorUid) {
  const mesaRef = doc(db, "mesas", mesaId);
  const mesaSnap = await getDoc(mesaRef);

  if (!mesaSnap.exists()) {
    throw new Error("Mesa não encontrada.");
  }

  // Adiciona o jogador ao array (arrayUnion evita duplicatas)
  await updateDoc(mesaRef, {
    jogadores: arrayUnion(jogadorUid)
  });
  
  return mesaSnap.data().nome;
}

// 4. Importar Ficha para a Mesa (Cria uma cópia dentro da subcoleção da mesa)
export async function importarPersonagemParaMesa(mesaId, jogadorUid, dadosPersonagem) {
  // O caminho será: mesas/{mesaId}/personagens/{jogadorUid}
  // Isso significa que cada jogador tem 1 ficha ativa por mesa (simplificação)
  const charRef = doc(db, "mesas", mesaId, "personagens", jogadorUid);
  
  // Se dadosPersonagem for null, cria uma ficha nova
  const dadosFinais = dadosPersonagem || FichaClass.getDados();
  
  // Atualiza info básica para vincular ao jogador atual
  dadosFinais.info.jogador = jogadorUid; 
  
  await setDoc(charRef, dadosFinais);
}