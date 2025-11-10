// /src/components/ficha/atributos.jsx

import React from 'react';

// Recebe 'dados' (personagem.atributos) e 'onFichaChange'
function Atributos({ dados, onFichaChange }) {

  // ATENÇÃO AQUI:
  // O 'onChange' agora passa o nome da *chave* ('for', 'agi', etc.)
  // diretamente, pois os IDs do HTML são diferentes ('forca', 'agilidade').
  
  return (
    <section className="box-atributos" id="grid-atributos">
      
      <input 
        type="number" 
        id="forca" // ID CORRIGIDO (para bater com o style.css)
        className="input-hex"
        value={dados.for}
        // Chama a função passando a CHAVE 'for'
        onChange={(e) => onFichaChange('atributos', 'for', e.target.value)}
      />
      
      <input 
        type="number" 
        id="agilidade" // ID CORRIGIDO
        className="input-hex"
        value={dados.agi}
        // Chama a função passando a CHAVE 'agi'
        onChange={(e) => onFichaChange('atributos', 'agi', e.target.value)}
      />
      
      <input 
        type="number" 
        id="intelecto" // ID CORRIGIDO
        className="input-hex"
        value={dados.int}
        // Chama a função passando a CHAVE 'int'
        onChange={(e) => onFichaChange('atributos', 'int', e.target.value)}
      />
      
      <input 
        type="number" 
        id="presenca" // ID CORRIGIDO
        className="input-hex"
        value={dados.pre}
        // Chama a função passando a CHAVE 'pre'
        onChange={(e) => onFichaChange('atributos', 'pre', e.target.value)}
      />
      
      <input 
        type="number" 
        id="vigor" // ID CORRIGIDO
        className="input-hex"
        value={dados.vig}
        // Chama a função passando a CHAVE 'vig'
        onChange={(e) => onFichaChange('atributos', 'vig', e.target.value)}
      />

    </section>
  );
}

export default Atributos;