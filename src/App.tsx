import { useState } from 'react'
import './App.css'

const sections = [
  { icon: '⌂', label: 'Dashboard' },
  { icon: '✦', label: 'Ideias' },
  { icon: '▣', label: 'Projetos' },
  { icon: '♙', label: 'Clientes' },
  { icon: '□', label: 'Planejamento' },
  { icon: '◇', label: 'Materiais' },
  { icon: '◎', label: 'Metas' },
  { icon: '⚙', label: 'Configurações' },
]

const pageDescriptions: Record<string, string> = {
  Dashboard: 'Um resumo do que precisa da sua atenção hoje.',
  Ideias: 'Guarde inspirações e transforme-as em projetos quando estiver pronta.',
  Projetos: 'Acompanhe encomendas e projetos pessoais em cada etapa.',
  Clientes: 'Organize contatos, pedidos e o histórico de cada cliente.',
  Planejamento: 'Visualize tarefas, prazos e sua disponibilidade.',
  Materiais: 'Acompanhe estoque, consumo e sua lista de compras.',
  Metas: 'Defina objetivos e acompanhe seu progresso.',
  Configurações: 'Personalize o Reena Studio para a sua rotina.',
}

function App() {
  const [activeSection, setActiveSection] = useState('Dashboard')

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">R</div>
          <div>
            <strong>Reena Studio</strong>
            <span>Ateliê de biscuit</span>
          </div>
        </div>

        <nav aria-label="Navegação principal">
          {sections.map((section) => (
            <button
              className={activeSection === section.label ? 'nav-item active' : 'nav-item'}
              key={section.label}
              onClick={() => setActiveSection(section.label)}
              type="button"
            >
              <span className="nav-icon" aria-hidden="true">{section.icon}</span>
              {section.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="avatar">RS</div>
          <div>
            <strong>Renata</strong>
            <span>Meu ateliê</span>
          </div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <span className="eyebrow">REENA STUDIO</span>
            <h1>{activeSection}</h1>
          </div>
          <button className="notification" type="button" aria-label="Notificações">○</button>
        </header>

        <section className="page-content">
          {activeSection === 'Dashboard' ? (
            <>
              <div className="welcome-card">
                <div>
                  <span className="eyebrow">QUARTA-FEIRA, 15 DE JULHO</span>
                  <h2>Bom dia, Renata <span aria-hidden="true">🌸</span></h2>
                  <p>{pageDescriptions.Dashboard}</p>
                </div>
                <div className="decorative-flower" aria-hidden="true">✿</div>
              </div>

              <div className="summary-grid">
                <article><span>Projetos ativos</span><strong>0</strong><small>Prontos para começar</small></article>
                <article><span>Próximas entregas</span><strong>0</strong><small>Nenhum prazo próximo</small></article>
                <article><span>Ideias salvas</span><strong>0</strong><small>Seu banco de inspirações</small></article>
              </div>

              <div className="empty-panel">
                <div className="empty-icon">✦</div>
                <h3>Seu espaço está pronto</h3>
                <p>Em breve, suas tarefas e entregas importantes aparecerão aqui.</p>
              </div>
            </>
          ) : (
            <div className="empty-panel page-placeholder">
              <div className="empty-icon">{sections.find((section) => section.label === activeSection)?.icon}</div>
              <h2>{activeSection}</h2>
              <p>{pageDescriptions[activeSection]}</p>
              <span>Esta página será construída em uma próxima etapa.</span>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
