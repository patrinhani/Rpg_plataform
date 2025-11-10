// /src/components/Rituais.jsx
// ATUALIZADO (para listar os rituais do database)

import React from 'react';
// 1. Importa o database para ler os rituais
import { database } from '../lib/database.js';
// 2. Importa o componente de card que acabamos de criar
import RitualCard from './RitualCard.jsx';

function Rituais() {
  // 3. Pega a lista de rituais do database
  const todosOsRituais = database.rituais || [];

  return (
    <main className="ficha-container-inventario">
      <section className="box box-inventario" id="grid-rituais">
        <div className="inventario-header">
          <h2>RITUAIS</h2>
        </div>
        
        {/* 4. Usa a lista de rituais */}
        <ul id="lista-rituais" className="loja-lista-itens">
          {todosOsRituais.length > 0 ? (
            // 5. Usa .map() para renderizar um <RitualCard> para cada item
            todosOsRituais.map((ritual) => (
              <RitualCard key={ritual.id} ritual={ritual} />
            ))
          ) : (
            // Mensagem de fallback caso o database falhe
            <li className="item-placeholder">Nenhum ritual encontrado no database.</li>
          )}
        </ul>

      </section>
    </main>
  );
}

export default Rituais;