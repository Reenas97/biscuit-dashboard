import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  FaArrowRight,
  FaHeart,
  FaImage,
  FaLightbulb,
  FaLink,
  FaMagnifyingGlass,
  FaPen,
  FaPlus,
  FaTag,
  FaTrash,
  FaWandMagicSparkles,
  FaXmark,
} from 'react-icons/fa6'

type Priority = 'Alta' | 'Média' | 'Baixa'

type Idea = {
  id: string
  title: string
  description: string
  category: string
  priority: Priority
  tags: string[]
  link: string
  favorite: boolean
  tone: 'pink' | 'brown' | 'blush'
  createdAt: string
  converted: boolean
}

type IdeaForm = {
  title: string
  description: string
  category: string
  priority: Priority
  tags: string
  link: string
}

const initialIdeas: Idea[] = [
  { id: 'sample-1', title: 'Topo de bolo jardim encantado', description: 'Personagens delicados entre flores, cogumelos e pequenas luzes.', category: 'Topo de bolo', priority: 'Alta', tags: ['flores', 'aniversário'], link: '', favorite: false, tone: 'pink', createdAt: '2026-07-15T10:00:00.000Z', converted: false },
  { id: 'sample-2', title: 'Coleção de gatinhos profissões', description: 'Miniaturas de gatos representando profissões para pronta-entrega.', category: 'Coleção', priority: 'Média', tags: ['gatos', 'miniaturas'], link: '', favorite: false, tone: 'brown', createdAt: '2026-07-14T10:00:00.000Z', converted: false },
  { id: 'sample-3', title: 'Noivinhos com pets', description: 'Casal personalizado acompanhado pelos animais da família.', category: 'Casamento', priority: 'Baixa', tags: ['noivinhos', 'pets'], link: '', favorite: false, tone: 'blush', createdAt: '2026-07-13T10:00:00.000Z', converted: false },
]

const emptyForm: IdeaForm = { title: '', description: '', category: '', priority: 'Média', tags: '', link: '' }
const storageKey = 'reena-biscuit-ideas'
const projectStorageKey = 'reena-biscuit-projects'

function loadIdeas() {
  const saved = localStorage.getItem(storageKey)
  if (!saved) return initialIdeas

  try {
    return JSON.parse(saved) as Idea[]
  } catch {
    return initialIdeas
  }
}

export function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>(loadIdeas)
  const [form, setForm] = useState<IdeaForm>(emptyForm)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null)
  const [convertingIdeaId, setConvertingIdeaId] = useState<string | null>(null)
  const [projectForm, setProjectForm] = useState({ type: 'Pessoal' as 'Pessoal' | 'Encomenda', client: '', deadline: '', keepIdea: true })
  const [search, setSearch] = useState('')
  const [showFavorites, setShowFavorites] = useState(false)
  const [category, setCategory] = useState('Todas')

  const categories = useMemo(() => ['Todas', ...new Set(ideas.map((idea) => idea.category))], [ideas])
  const selectedIdea = ideas.find((idea) => idea.id === selectedIdeaId) ?? null
  const convertingIdea = ideas.find((idea) => idea.id === convertingIdeaId) ?? null
  const visibleIdeas = useMemo(() => ideas.filter((idea) => {
    const searchable = `${idea.title} ${idea.description} ${idea.category} ${idea.tags.join(' ')}`.toLowerCase()
    const matchesSearch = searchable.includes(search.trim().toLowerCase())
    const matchesFavorite = !showFavorites || idea.favorite
    const matchesCategory = category === 'Todas' || idea.category === category
    return matchesSearch && matchesFavorite && matchesCategory
  }), [ideas, search, showFavorites, category])

  function saveIdeas(nextIdeas: Idea[]) {
    setIdeas(nextIdeas)
    localStorage.setItem(storageKey, JSON.stringify(nextIdeas))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const ideaData = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      priority: form.priority,
      tags: form.tags.split(',').map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean),
      link: form.link.trim(),
    }

    if (editingId) {
      saveIdeas(ideas.map((idea) => idea.id === editingId ? { ...idea, ...ideaData } : idea))
      setSelectedIdeaId(editingId)
    } else {
      const newIdea: Idea = {
        id: crypto.randomUUID(),
        ...ideaData,
        favorite: false,
        tone: ['pink', 'brown', 'blush'][ideas.length % 3] as Idea['tone'],
        createdAt: new Date().toISOString(),
        converted: false,
      }
      saveIdeas([newIdea, ...ideas])
    }
    setForm(emptyForm)
    setEditingId(null)
    setIsFormOpen(false)
  }

  function openNewIdea() {
    setEditingId(null)
    setForm(emptyForm)
    setIsFormOpen(true)
  }

  function openEditIdea(idea: Idea) {
    setEditingId(idea.id)
    setForm({
      title: idea.title,
      description: idea.description,
      category: idea.category,
      priority: idea.priority,
      tags: idea.tags.join(', '),
      link: idea.link,
    })
    setSelectedIdeaId(null)
    setIsFormOpen(true)
  }

  function closeForm() {
    setIsFormOpen(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function toggleFavorite(id: string) {
    saveIdeas(ideas.map((idea) => idea.id === id ? { ...idea, favorite: !idea.favorite } : idea))
  }

  function deleteIdea(id: string) {
    saveIdeas(ideas.filter((idea) => idea.id !== id))
    if (selectedIdeaId === id) setSelectedIdeaId(null)
  }

  function convertToProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!convertingIdea) return
    const savedProjects = localStorage.getItem(projectStorageKey)
    const projects = savedProjects ? JSON.parse(savedProjects) : []
    const project = {
      id: crypto.randomUUID(),
      title: convertingIdea.title,
      description: convertingIdea.description,
      category: convertingIdea.category,
      tags: convertingIdea.tags,
      type: projectForm.type,
      client: projectForm.client.trim(),
      deadline: projectForm.deadline,
      status: 'Planejamento',
      sourceIdeaId: convertingIdea.id,
      createdAt: new Date().toISOString(),
    }
    localStorage.setItem(projectStorageKey, JSON.stringify([project, ...projects]))
    saveIdeas(projectForm.keepIdea ? ideas.map((idea) => idea.id === convertingIdea.id ? { ...idea, converted: true } : idea) : ideas.filter((idea) => idea.id !== convertingIdea.id))
    setConvertingIdeaId(null)
    setProjectForm({ type: 'Pessoal', client: '', deadline: '', keepIdea: true })
  }

  return (
    <div className="ideas-page">
      <div className="ideas-heading flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-1">
          <span className="section-kicker"><FaLightbulb /> BANCO DE INSPIRAÇÕES</span>
          <h2>Suas próximas criações começam aqui</h2>
          <p>Guarde referências, organize possibilidades e transforme uma ideia em projeto quando quiser.</p>
        </div>
        <button className="primary-button shrink-0" onClick={openNewIdea} type="button"><FaPlus /> Nova ideia</button>
      </div>

      <div className="ideas-toolbar mt-7 flex flex-col gap-3 2xl:flex-row 2xl:items-center">
        <label className="search-field min-w-0 flex-1">
          <FaMagnifyingGlass aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Pesquisar ideias..." aria-label="Pesquisar ideias" />
        </label>
        <div className="filter-group flex flex-wrap gap-2">
          <button className={!showFavorites && category === 'Todas' ? 'filter-chip active' : 'filter-chip'} onClick={() => { setShowFavorites(false); setCategory('Todas') }} type="button">Todas <span>{ideas.length}</span></button>
          <button className={showFavorites ? 'filter-chip active' : 'filter-chip'} onClick={() => setShowFavorites((current) => !current)} type="button"><FaHeart /> Favoritas</button>
          <label className="category-filter">
            <FaTag aria-hidden="true" />
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filtrar por categoria">
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="ideas-summary mt-6 flex items-center justify-between">
        <p><strong>{visibleIdeas.length} {visibleIdeas.length === 1 ? 'ideia' : 'ideias'}</strong> {showFavorites ? 'favoritas' : 'para explorar'}</p>
        <span>Ordenar: mais recentes</span>
      </div>

      {visibleIdeas.length > 0 ? (
        <div className="ideas-grid mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {visibleIdeas.map((idea) => (
            <article className="idea-card" key={idea.id}>
              <div className={`idea-cover idea-cover--${idea.tone}`}>
                <FaImage aria-hidden="true" />
                <button className={idea.favorite ? 'favorite active' : 'favorite'} onClick={() => toggleFavorite(idea.id)} type="button" aria-label={`Favoritar ${idea.title}`}><FaHeart /></button>
              </div>
              <div className="idea-card-content">
                <div className="idea-meta">
                  <span>{idea.category}</span>
                  <span className={`priority priority--${idea.priority.toLowerCase()}`}>{idea.converted ? 'Projeto criado' : idea.priority}</span>
                </div>
                <h3>{idea.title}</h3>
                <p>{idea.description || 'Sem descrição.'}</p>
                <div className="idea-tags">{idea.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
                <div className="idea-card-actions">
                  <button className="idea-action" onClick={() => setSelectedIdeaId(idea.id)} type="button">Ver ideia <FaArrowRight /></button>
                  <button className="delete-action" onClick={() => deleteIdea(idea.id)} type="button" aria-label={`Excluir ${idea.title}`}><FaTrash /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="ideas-empty mt-4">
          <FaLightbulb />
          <h3>Nenhuma ideia encontrada</h3>
          <p>Tente mudar os filtros ou cadastre uma nova inspiração.</p>
        </div>
      )}

      {selectedIdea && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedIdeaId(null) }}>
          <section className="idea-modal idea-detail" role="dialog" aria-modal="true" aria-labelledby="idea-detail-title">
            <div className={`detail-cover idea-cover--${selectedIdea.tone}`}><FaImage /></div>
            <div className="modal-heading">
              <div>
                <span className="section-kicker">{selectedIdea.category} · PRIORIDADE {selectedIdea.priority.toUpperCase()}</span>
                <h2 id="idea-detail-title">{selectedIdea.title}</h2>
              </div>
              <button onClick={() => setSelectedIdeaId(null)} type="button" aria-label="Fechar detalhes"><FaXmark /></button>
            </div>
            <p className="detail-description">{selectedIdea.description || 'Esta ideia ainda não possui uma descrição.'}</p>
            {selectedIdea.tags.length > 0 && <div className="idea-tags detail-tags">{selectedIdea.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
            {selectedIdea.link && <a className="reference-link" href={selectedIdea.link} target="_blank" rel="noreferrer"><FaLink /> Abrir referência</a>}
            <div className="modal-actions detail-actions">
              <button className="secondary-button danger-button" onClick={() => deleteIdea(selectedIdea.id)} type="button"><FaTrash /> Excluir</button>
              {!selectedIdea.converted && <button className="secondary-button" onClick={() => { setConvertingIdeaId(selectedIdea.id); setSelectedIdeaId(null) }} type="button"><FaWandMagicSparkles /> Converter</button>}
              <button className="primary-button" onClick={() => openEditIdea(selectedIdea)} type="button"><FaPen /> Editar ideia</button>
            </div>
          </section>
        </div>
      )}

      {convertingIdea && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConvertingIdeaId(null) }}>
          <section className="idea-modal conversion-modal" role="dialog" aria-modal="true" aria-labelledby="conversion-title">
            <div className="modal-heading">
              <div><span className="section-kicker"><FaWandMagicSparkles /> CONVERTER IDEIA</span><h2 id="conversion-title">Criar projeto</h2></div>
              <button onClick={() => setConvertingIdeaId(null)} type="button" aria-label="Fechar conversão"><FaXmark /></button>
            </div>
            <div className="conversion-source"><span>Ideia selecionada</span><strong>{convertingIdea.title}</strong></div>
            <form onSubmit={convertToProject}>
              <div className="form-grid">
                <label className="form-field">Tipo<select value={projectForm.type} onChange={(event) => setProjectForm({ ...projectForm, type: event.target.value as 'Pessoal' | 'Encomenda' })}><option>Pessoal</option><option>Encomenda</option></select></label>
                <label className="form-field">Prazo<input type="date" value={projectForm.deadline} onChange={(event) => setProjectForm({ ...projectForm, deadline: event.target.value })} /></label>
              </div>
              {projectForm.type === 'Encomenda' && <label className="form-field form-field--full">Cliente<input required value={projectForm.client} onChange={(event) => setProjectForm({ ...projectForm, client: event.target.value })} placeholder="Nome do cliente" /></label>}
              <label className="keep-idea"><input type="checkbox" checked={projectForm.keepIdea} onChange={(event) => setProjectForm({ ...projectForm, keepIdea: event.target.checked })} /><span><strong>Manter no banco de ideias</strong><small>A ideia ficará marcada como convertida.</small></span></label>
              <div className="modal-actions"><button className="secondary-button" onClick={() => setConvertingIdeaId(null)} type="button">Cancelar</button><button className="primary-button" type="submit"><FaWandMagicSparkles /> Criar projeto</button></div>
            </form>
          </section>
        </div>
      )}

      {isFormOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}>
          <section className="idea-modal" role="dialog" aria-modal="true" aria-labelledby="new-idea-title">
            <div className="modal-heading">
              <div><span className="section-kicker"><FaLightbulb /> {editingId ? 'EDITAR INSPIRAÇÃO' : 'NOVA INSPIRAÇÃO'}</span><h2 id="new-idea-title">{editingId ? 'Editar ideia' : 'Cadastrar ideia'}</h2></div>
              <button onClick={closeForm} type="button" aria-label="Fechar formulário"><FaXmark /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <label className="form-field form-field--full">Nome da ideia<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ex.: Topo de bolo jardim encantado" /></label>
              <label className="form-field form-field--full">Descrição<textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Conte um pouco sobre a inspiração..." /></label>
              <div className="form-grid">
                <label className="form-field">Categoria<input required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Ex.: Topo de bolo" /></label>
                <label className="form-field">Prioridade<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}><option>Alta</option><option>Média</option><option>Baixa</option></select></label>
              </div>
              <label className="form-field form-field--full">Tags<input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="flores, casamento, gatos" /><small>Separe as tags por vírgulas.</small></label>
              <label className="form-field form-field--full">Link de referência<input type="url" value={form.link} onChange={(event) => setForm({ ...form, link: event.target.value })} placeholder="https://pinterest.com/..." /></label>
              <div className="modal-actions"><button className="secondary-button" onClick={closeForm} type="button">Cancelar</button><button className="primary-button" type="submit">{editingId ? 'Salvar alterações' : 'Salvar ideia'}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
