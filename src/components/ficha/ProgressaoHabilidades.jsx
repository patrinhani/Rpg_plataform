// /src/components/ficha/ProgressaoHabilidades.jsx

import React from 'react';

/**
 * Componente para exibir a progressão de habilidades da classe e da trilha lado a lado.
 * @param {object} props - As propriedades.
 * @param {string} props.classe - A classe do personagem.
 * @param {string} props.trilha - A trilha do personagem (ex: 'monstruoso' ou 'nenhuma').
 * @param {string} props.nexString - O NEX do personagem.
 * @param {object} props.progressaoClasses - Dados da progressão de classes.
 * @param {object} props.progressaoTrilhas - Dados da progressão de trilhas.
 * @param {object} props.info - O objeto personagem.info completo.
 */
function ProgressaoHabilidades({ 
    classe, 
    trilha, 
    nexString, 
    progressaoClasses,
    progressaoTrilhas,
    info
}) {
  
  const nexAtual = parseInt(nexString.replace('%', '')) || 0;
  
  const isTrilhaAtiva = trilha && trilha !== 'nenhuma' && progressaoTrilhas[trilha.toLowerCase()];
  
  const dadosClasse = progressaoClasses[classe.toLowerCase()] || null;
  const dadosTrilha = isTrilhaAtiva ? progressaoTrilhas[trilha.toLowerCase()] : null;

  if (!dadosClasse) {
    return (
      <main className="ficha-container-inventario">
        <section className="box calc-bloco" id="grid-progressao">
          <h3>PROGRESSÃO</h3>
          <p>Selecione uma classe para ver a progressão.</p>
        </section>
      </main>
    );
  }

  // --- Funções de Processamento ---

  const getElementoParaExibir = (trilhaKey) => {
    const elementoChave = `${trilhaKey.toLowerCase()}_elemento`;
    const elementoSalvo = info[elementoChave];
    
    if (elementoSalvo && elementoSalvo !== 'nenhuma') {
      return elementoSalvo;
    }
    
    const dados = progressaoTrilhas[trilhaKey.toLowerCase()];
    if (dados && dados.requiresChoice === 'elemento') {
      return '[ESCOLHA ELEMENTO]';
    }
    
    return null;
  };
  
  const processarHabilidade = (habilidadeText, trilhaKey = null) => {
      if (!habilidadeText) return '';
      
      let texto = habilidadeText;
      const elemento = trilhaKey ? getElementoParaExibir(trilhaKey) : null;
      
      if (elemento) {
         // Substitui o placeholder de elemento.
         texto = texto.replace(/Elemento/g, elemento);
         texto = texto.replace(/\[ESCOLHA ELEMENTO\]/g, `(${elemento})`);
         
         // Limpa os placeholders de bônus/penalidades que são tratados em outro lugar (ex: +O ou -O)
         texto = texto.replace(/\+\s*\d?O/g, ''); 
         texto = texto.replace(/-\s*\d?O/g, '');
      }

      return texto;
  };
  
  const gerarProgressao = (progressao, isTrilha = false) => {
    const key = isTrilha ? trilha.toLowerCase() : classe.toLowerCase();
    const nomeFonte = progressao.nome.toUpperCase();
    const niveis = Object.keys(progressao.habilidades)
      .map(Number)
      .sort((a, b) => a - b);
      
    let habilidadesAdquiridas = [];
    let proximoNivel = null;
    let proximaHabilidade = null;

    for (const nivel of niveis) {
      const habilidade = progressao.habilidades[nivel];
      
      if (nivel <= nexAtual) {
        habilidadesAdquiridas.push({ nivel, habilidade: processarHabilidade(habilidade, isTrilha ? trilha : null) });
      } else if (nivel > nexAtual && proximoNivel === null) {
        proximoNivel = nivel;
        proximaHabilidade = processarHabilidade(habilidade, isTrilha ? trilha : null);
      }
    }
    
    const escalaLabel = progressao.escala;

    // Conclusão
    const isCompleted = nexAtual >= niveis[niveis.length - 1] && niveis.length > 0;

    if (isCompleted) {
      proximoNivel = 'FIM';
      proximaHabilidade = `Progressão completa da ${isTrilha ? 'trilha' : 'classe'}.`;
    }

    return (
        <div className="calc-bloco-coluna">
            <h4>{nomeFonte}</h4>
            <ul className="progressao-lista adquirida">
              {habilidadesAdquiridas.length > 0 ? (
                habilidadesAdquiridas.map(({ nivel, habilidade }) => (
                  <li key={`${key}-${nivel}`}>
                    <strong className="nivel-adquirido">{nivel}{escalaLabel === 'NEX' ? '%' : ''}:</strong> {habilidade}
                  </li>
                ))
              ) : (
                <li>Nenhuma habilidade adquirida ainda.</li>
              )}
            </ul>
            <div className="progressao-proximo">
              <p><strong>Próximo {isCompleted ? 'Status' : escalaLabel} {proximoNivel}{escalaLabel === 'NEX' && proximoNivel !== 'FIM' ? '%' : ''}:</strong></p>
              <p className="proxima-habilidade">{proximaHabilidade}</p>
            </div>
        </div>
    );
  };
  
  // --- Renderização Principal ---
  
  // 1. Renderiza a progressão da classe (sempre)
  const progressaoClasseComponente = gerarProgressao(dadosClasse, false);

  // 2. Renderiza a progressão da trilha (se ativa)
  const progressaoTrilhaComponente = dadosTrilha 
    ? gerarProgressao(dadosTrilha, true)
    : <div className="calc-bloco-coluna"><h4>PROGRESSÃO DA TRILHA</h4><p>Nenhuma trilha selecionada. Selecione uma na aba "Principal".</p></div>;


  return (
    <main className="ficha-container-inventario">
      <section className="box" id="grid-progressao">
        <h3>PROGRESSÃO DE HABILIDADES</h3>
        
        <div className="progressao-conteudo">
            {progressaoClasseComponente}
            {progressaoTrilhaComponente}
        </div>
        
      </section>
    </main>
  );
}

export default ProgressaoHabilidades;