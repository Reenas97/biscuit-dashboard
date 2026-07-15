import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  FaArrowRight,
  FaBoxesStacked,
  FaCalendarDays,
  FaClipboardList,
  FaGripVertical,
  FaLink,
  FaPen,
  FaPlus,
  FaTag,
  FaTrash,
  FaUser,
  FaXmark,
} from 'react-icons/fa6'

const statuses = ['Planejamento', 'Modelagem', 'Secagem', 'Pintura', 'Finalização', 'Pronto', 'Entregue'] as const
type ProjectStatus = typeof statuses[number]

type Project = {
  id: string
  title: string
  description: string
  category: string
  tags: string[]
  type: 'Pessoal' | 'Encomenda'
  client: string
  deadline: string
  referenceLink: string
  status: ProjectStatus
  sourceIdeaId: string
  createdAt: string
  materials?: ProjectMaterial[]
}

type ProjectMaterial = {
  id: string
  materialId: string
  name: string
  unit: string
  quantity: number
  unitCost: number
}

type Material = {
  id: string
  name: string
  unit: string
  stock: number
  unitCost: number
  minimumStock: number
  category: string
  createdAt: string
}

type Client = { id: string; name: string }

type ProjectForm = Omit<Project, 'id' | 'sourceIdeaId' | 'createdAt' | 'tags'> & { tags: string }

const projectStorageKey = 'reena-biscuit-projects'
const materialStorageKey = 'reena-biscuit-materials'
const clientStorageKey = 'reena-biscuit-clients'
const emptyProjectForm: ProjectForm = { title: '', description: '', category: '', tags: '', type: 'Pessoal', client: '', deadline: '', referenceLink: '', status: 'Planejamento' }

function loadProjects() {
  const saved = localStorage.getItem(projectStorageKey)
  if (!saved) return []
  try { return JSON.parse(saved) as Project[] } catch { return [] }
}

function loadMaterials() {
  const saved = localStorage.getItem(materialStorageKey)
  if (!saved) return []
  try { return JSON.parse(saved) as Material[] } catch { return [] }
}

function loadClients() {
  const saved = localStorage.getItem(clientStorageKey)
  if (!saved) return []
  try { return JSON.parse(saved) as Client[] } catch { return [] }
}

function KanbanCard({ project, onOpen }: { project: Project; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: project.id })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <article ref={setNodeRef} style={style} className={isDragging ? 'kanban-card dragging' : 'kanban-card'}>
      <div className="kanban-card-top">
        <span>{project.type}</span>
        <button className="drag-handle" type="button" aria-label={`Mover ${project.title}`} {...listeners} {...attributes}><FaGripVertical /></button>
      </div>
      <h3>{project.title}</h3>
      {project.client && <p><FaUser /> {project.client}</p>}
      <p><FaCalendarDays /> {project.deadline ? new Date(`${project.deadline}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem prazo'}</p>
      <button className="kanban-open" onClick={() => onOpen(project.id)} type="button">Ver detalhes <FaArrowRight /></button>
    </article>
  )
}

function KanbanColumn({ status, projects, onOpen }: { status: ProjectStatus; projects: Project[]; onOpen: (id: string) => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: status })

  return (
    <section ref={setNodeRef} className={isOver ? 'kanban-column over' : 'kanban-column'}>
      <div className="kanban-column-heading">
        <span className={`kanban-status-dot status--${status.toLowerCase()}`} />
        <h3>{status}</h3>
        <strong>{projects.length}</strong>
      </div>
      <div className="kanban-column-content">
        {projects.map((project) => <KanbanCard key={project.id} project={project} onOpen={onOpen} />)}
        {projects.length === 0 && <div className="kanban-empty">Arraste um projeto para cá</div>}
      </div>
    </section>
  )
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>(loadProjects)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProjectForm | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [materials, setMaterials] = useState<Material[]>(loadMaterials)
  const [clients] = useState<Client[]>(loadClients)
  const [materialId, setMaterialId] = useState('')
  const [materialQuantity, setMaterialQuantity] = useState('')
  const [materialError, setMaterialError] = useState('')
  const selectedProject = projects.find((project) => project.id === selectedId) ?? null
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  function saveProjects(nextProjects: Project[]) {
    setProjects(nextProjects)
    localStorage.setItem(projectStorageKey, JSON.stringify(nextProjects))
  }

  function saveMaterials(nextMaterials: Material[]) {
    setMaterials(nextMaterials)
    localStorage.setItem(materialStorageKey, JSON.stringify(nextMaterials))
  }

  function addMaterialToProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedProject) return
    const material = materials.find((item) => item.id === materialId)
    const quantity = Number(materialQuantity)
    if (!material || !Number.isFinite(quantity) || quantity <= 0) {
      setMaterialError('Escolha um material e informe uma quantidade válida.')
      return
    }
    if (quantity > material.stock) {
      setMaterialError(`Há apenas ${material.stock.toLocaleString('pt-BR')} ${material.unit} em estoque.`)
      return
    }
    const usage: ProjectMaterial = { id: crypto.randomUUID(), materialId: material.id, name: material.name, unit: material.unit, quantity, unitCost: material.unitCost }
    saveProjects(projects.map((project) => project.id === selectedProject.id ? { ...project, materials: [...(project.materials ?? []), usage] } : project))
    saveMaterials(materials.map((item) => item.id === material.id ? { ...item, stock: item.stock - quantity } : item))
    setMaterialId('')
    setMaterialQuantity('')
    setMaterialError('')
  }

  function removeMaterialFromProject(usage: ProjectMaterial) {
    if (!selectedProject) return
    saveProjects(projects.map((project) => project.id === selectedProject.id ? { ...project, materials: (project.materials ?? []).filter((item) => item.id !== usage.id) } : project))
    saveMaterials(materials.map((material) => material.id === usage.materialId ? { ...material, stock: material.stock + usage.quantity } : material))
  }

  function deleteProject(id: string) {
    saveProjects(projects.filter((project) => project.id !== id))
    setSelectedId(null)
  }

  function openEdit(project: Project) {
    setEditingId(project.id)
    setForm({
      title: project.title,
      description: project.description,
      category: project.category,
      tags: project.tags.join(', '),
      type: project.type,
      client: project.client,
      deadline: project.deadline,
      referenceLink: project.referenceLink ?? '',
      status: project.status,
    })
    setSelectedId(null)
    setIsFormOpen(true)
  }

  function openNewProject() {
    setEditingId(null)
    setForm(emptyProjectForm)
    setIsFormOpen(true)
  }

  function closeEdit() {
    setEditingId(null)
    setForm(null)
    setIsFormOpen(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return
    const projectData = {
      ...form,
      client: form.type === 'Pessoal' ? '' : form.client.trim(),
      tags: form.tags.split(',').map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean),
    }

    if (editingId) {
      saveProjects(projects.map((project) => project.id === editingId ? { ...project, ...projectData } : project))
      setSelectedId(editingId)
    } else {
      saveProjects([{ id: crypto.randomUUID(), ...projectData, sourceIdeaId: '', createdAt: new Date().toISOString() }, ...projects])
    }
    closeEdit()
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const nextStatus = String(over.id) as ProjectStatus
    if (!statuses.includes(nextStatus)) return
    saveProjects(projects.map((project) => project.id === active.id ? { ...project, status: nextStatus } : project))
  }

  return (
    <div className="projects-page">
      <div className="ideas-heading flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-1">
          <span className="section-kicker"><FaClipboardList /> PROJETOS EM ANDAMENTO</span>
          <h2>Da inspiração para a bancada</h2>
          <p>Acompanhe os trabalhos que já saíram do papel e estão sendo planejados ou produzidos.</p>
        </div>
        <button className="primary-button shrink-0" onClick={openNewProject} type="button"><FaPlus /> Novo projeto</button>
      </div>

      {projects.length === 0 && <p className="kanban-hint mt-6"><FaClipboardList /> O quadro está vazio. Converta uma ideia para criar seu primeiro card.</p>}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="kanban-board mt-7">
          {statuses.map((status) => (
            <KanbanColumn key={status} status={status} projects={projects.filter((project) => project.status === status)} onOpen={setSelectedId} />
          ))}
        </div>
      </DndContext>

      {selectedProject && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null) }}>
          <section className="idea-modal project-detail" role="dialog" aria-modal="true" aria-labelledby="project-detail-title">
            <div className="modal-heading">
              <div><span className="section-kicker">{selectedProject.type} · {selectedProject.category}</span><h2 id="project-detail-title">{selectedProject.title}</h2></div>
              <button onClick={() => setSelectedId(null)} type="button" aria-label="Fechar detalhes do projeto"><FaXmark /></button>
            </div>
            <span className={`project-status-large status--${selectedProject.status.toLowerCase()}`}>{selectedProject.status}</span>
            <p className="detail-description project-description">{selectedProject.description || 'Este projeto ainda não possui uma descrição.'}</p>
            <div className="project-detail-grid">
              <div><span><FaCalendarDays /> Prazo</span><strong>{selectedProject.deadline ? new Date(`${selectedProject.deadline}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Sem prazo definido'}</strong></div>
              <div><span><FaUser /> Cliente</span><strong>{selectedProject.client || 'Projeto pessoal'}</strong></div>
            </div>
            {selectedProject.tags.length > 0 && <div className="idea-tags detail-tags"><FaTag />{selectedProject.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
            {selectedProject.referenceLink && <a className="reference-link project-reference" href={selectedProject.referenceLink} target="_blank" rel="noreferrer"><FaLink /> Abrir referência do projeto</a>}
            <section className="project-materials">
              <div className="project-materials-heading">
                <div><span className="section-kicker"><FaBoxesStacked /> MATERIAIS UTILIZADOS</span><h3>Consumo da encomenda</h3></div>
                <strong>{(selectedProject.materials ?? []).reduce((total, item) => total + item.quantity * item.unitCost, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </div>
              {(selectedProject.materials ?? []).length > 0 ? (
                <div className="project-material-list">
                  {(selectedProject.materials ?? []).map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.quantity.toLocaleString('pt-BR')} {item.unit} × {item.unitCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</small></span><b>{(item.quantity * item.unitCost).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b><button onClick={() => removeMaterialFromProject(item)} type="button" aria-label={`Remover ${item.name}`}><FaTrash /></button></div>)}
                </div>
              ) : <p className="project-material-empty">Nenhum material lançado neste projeto.</p>}
              {materials.length > 0 ? (
                <form className="project-material-form" onSubmit={addMaterialToProject}>
                  <label className="form-field">Material<select required value={materialId} onChange={(event) => { setMaterialId(event.target.value); setMaterialError('') }}><option value="">Selecione...</option>{materials.map((material) => <option key={material.id} value={material.id}>{material.name} · {material.stock.toLocaleString('pt-BR')} {material.unit}</option>)}</select></label>
                  <label className="form-field">Quantidade<input required min="0.01" step="0.01" type="number" value={materialQuantity} onChange={(event) => { setMaterialQuantity(event.target.value); setMaterialError('') }} /></label>
                  <button className="secondary-button" type="submit"><FaPlus /> Adicionar</button>
                  {materialError && <p className="project-material-error">{materialError}</p>}
                </form>
              ) : <p className="project-material-empty">Cadastre materiais na página de Materiais para poder lançá-los aqui.</p>}
            </section>
            <div className="modal-actions detail-actions">
              <button className="secondary-button danger-button" onClick={() => deleteProject(selectedProject.id)} type="button"><FaTrash /> Excluir</button>
              <button className="primary-button" onClick={() => openEdit(selectedProject)} type="button"><FaPen /> Editar projeto</button>
            </div>
          </section>
        </div>
      )}

      {isFormOpen && form && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEdit() }}>
          <section className="idea-modal" role="dialog" aria-modal="true" aria-labelledby="edit-project-title">
            <div className="modal-heading">
              <div><span className="section-kicker">{editingId ? <FaPen /> : <FaPlus />} {editingId ? 'ATUALIZAR PROJETO' : 'NOVO PROJETO'}</span><h2 id="edit-project-title">{editingId ? 'Editar projeto' : 'Cadastrar projeto'}</h2></div>
              <button onClick={closeEdit} type="button" aria-label="Fechar edição"><FaXmark /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <label className="form-field form-field--full">Nome do projeto<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
              <label className="form-field form-field--full">Descrição<textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              <div className="form-grid">
                <label className="form-field">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProjectStatus })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
                <label className="form-field">Prazo<input type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label>
                <label className="form-field">Tipo<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as Project['type'] })}><option>Pessoal</option><option>Encomenda</option></select></label>
                <label className="form-field">Categoria<input required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
              </div>
              {form.type === 'Encomenda' && <label className="form-field form-field--full">Cliente<select required value={form.client} onChange={(event) => setForm({ ...form, client: event.target.value })}><option value="">Selecione um cliente...</option>{form.client && !clients.some((client) => client.name === form.client) && <option value={form.client}>{form.client}</option>}{clients.map((client) => <option key={client.id} value={client.name}>{client.name}</option>)}</select>{clients.length === 0 && <small>Nenhum cliente cadastrado. Cadastre um cliente na página Clientes antes de criar a encomenda.</small>}</label>}
              <label className="form-field form-field--full">Tags<input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /><small>Separe as tags por vírgulas.</small></label>
              <label className="form-field form-field--full">Link de referência<input type="url" value={form.referenceLink} onChange={(event) => setForm({ ...form, referenceLink: event.target.value })} placeholder="https://pinterest.com/..." /><small>Pode ser Pinterest, Instagram ou outro site.</small></label>
              <div className="modal-actions"><button className="secondary-button" onClick={closeEdit} type="button">Cancelar</button><button className="primary-button" type="submit">{editingId ? 'Salvar alterações' : 'Criar projeto'}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
