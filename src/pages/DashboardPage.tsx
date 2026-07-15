import { FaPaw } from 'react-icons/fa6'
import { GiCat } from 'react-icons/gi'

export function DashboardPage() {
  return (
    <>
      <div className="welcome-card">
        <div>
          <span className="eyebrow">QUARTA-FEIRA, 15 DE JULHO</span>
          <h2>Bom dia, Renata <FaPaw className="greeting-paw" /></h2>
          <p>Um resumo do que precisa da sua atenção hoje.</p>
        </div>
        <div className="cat-scene">
          <FaPaw className="scene-paw scene-paw-one" />
          <FaPaw className="scene-paw scene-paw-two" />
          <GiCat className="decorative-cat" />
        </div>
      </div>

      <div className="summary-grid mt-[18px] grid grid-cols-1 gap-4 md:grid-cols-3">
        <article><span>Projetos ativos</span><strong>0</strong><small>Prontos para começar</small></article>
        <article><span>Próximas entregas</span><strong>0</strong><small>Nenhum prazo próximo</small></article>
        <article><span>Ideias salvas</span><strong>0</strong><small>Seu banco de inspirações</small></article>
      </div>

      <div className="empty-panel">
        <div className="empty-icon"><FaPaw /></div>
        <h3>Seu espaço está pronto</h3>
        <p>Em breve, suas tarefas e entregas importantes aparecerão aqui.</p>
      </div>
    </>
  )
}
