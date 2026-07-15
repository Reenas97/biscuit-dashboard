import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { FaInstagram, FaMagnifyingGlass, FaPen, FaPlus, FaTrash, FaUser, FaUsers, FaWhatsapp, FaXmark } from 'react-icons/fa6'

type Client = { id: string; name: string; phone: string; instagram: string; email: string; notes: string; createdAt: string }
type StoredProject = { id: string; client?: string; type?: string }
type ClientForm = Omit<Client, 'id' | 'createdAt'>

const clientStorageKey = 'reena-biscuit-clients'
const projectStorageKey = 'reena-biscuit-projects'
const emptyForm: ClientForm = { name: '', phone: '', instagram: '', email: '', notes: '' }

function readStorage<T>(key: string): T[] {
  const saved = localStorage.getItem(key)
  if (!saved) return []
  try { return JSON.parse(saved) as T[] } catch { return [] }
}

function onlyNumbers(value: string) { return value.replace(/\D/g, '') }

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>(() => readStorage<Client>(clientStorageKey))
  const [projects] = useState<StoredProject[]>(() => readStorage<StoredProject>(projectStorageKey))
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<ClientForm | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const filteredClients = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR')
    if (!term) return clients
    return clients.filter((client) => [client.name, client.phone, client.instagram, client.email].some((value) => value.toLocaleLowerCase('pt-BR').includes(term)))
  }, [clients, query])

  function saveClients(nextClients: Client[]) { setClients(nextClients); localStorage.setItem(clientStorageKey, JSON.stringify(nextClients)) }
  function openNew() { setEditingId(null); setForm(emptyForm) }
  function openEdit(client: Client) { setEditingId(client.id); setForm({ name: client.name, phone: client.phone, instagram: client.instagram, email: client.email, notes: client.notes }) }
  function closeForm() { setEditingId(null); setForm(null) }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return
    const data = { ...form, name: form.name.trim(), phone: form.phone.trim(), instagram: form.instagram.trim().replace(/^@/, ''), email: form.email.trim(), notes: form.notes.trim() }
    if (editingId) saveClients(clients.map((client) => client.id === editingId ? { ...client, ...data } : client))
    else saveClients([{ id: crypto.randomUUID(), ...data, createdAt: new Date().toISOString() }, ...clients])
    closeForm()
  }

  function projectCount(client: Client) { return projects.filter((project) => project.client?.trim().toLocaleLowerCase('pt-BR') === client.name.toLocaleLowerCase('pt-BR')).length }

  return <div className="clients-page">
    <div className="ideas-heading flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 flex-1"><span className="section-kicker"><FaUsers /> CLIENTES DO ATELIÊ</span><h2>Quem faz parte dessa história</h2><p>Guarde contatos, preferências e o histórico de quem encomenda suas peças.</p></div>
      <button className="primary-button shrink-0" onClick={openNew} type="button"><FaPlus /> Novo cliente</button>
    </div>
    <div className="clients-toolbar mt-7"><label><FaMagnifyingGlass /><input aria-label="Buscar clientes" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, telefone ou Instagram" /></label><span>{filteredClients.length} {filteredClients.length === 1 ? 'cliente' : 'clientes'}</span></div>
    {filteredClients.length > 0 ? <div className="clients-grid mt-6">{filteredClients.map((client) => {
      const orders = projectCount(client); const phone = onlyNumbers(client.phone)
      return <article className="client-card" key={client.id}>
        <div className="client-card-heading"><div className="client-avatar"><FaUser /></div><div><h3>{client.name}</h3><span>{orders} {orders === 1 ? 'encomenda' : 'encomendas'}</span></div></div>
        <div className="client-contact">{client.phone && <span>{client.phone}</span>}{client.instagram && <a href={`https://instagram.com/${client.instagram}`} target="_blank" rel="noreferrer"><FaInstagram /> @{client.instagram}</a>}{client.email && <a href={`mailto:${client.email}`}>{client.email}</a>}{!client.phone && !client.instagram && !client.email && <span>Nenhum contato informado</span>}</div>
        {client.notes && <p>{client.notes}</p>}
        <div className="client-actions">{phone && <a className="client-whatsapp" href={`https://wa.me/55${phone}`} target="_blank" rel="noreferrer"><FaWhatsapp /> WhatsApp</a>}<button onClick={() => openEdit(client)} type="button"><FaPen /> Editar</button><button onClick={() => saveClients(clients.filter((item) => item.id !== client.id))} type="button" aria-label={`Excluir ${client.name}`}><FaTrash /></button></div>
      </article>
    })}</div> : <div className="ideas-empty mt-7"><FaUsers /><h3>{query ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</h3><p>{query ? 'Tente buscar por outro nome ou contato.' : 'Cadastre seu primeiro cliente para começar o histórico de encomendas.'}</p></div>}
    {form && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}><section className="idea-modal" role="dialog" aria-modal="true" aria-labelledby="client-form-title">
      <div className="modal-heading"><div><span className="section-kicker"><FaUser /> {editingId ? 'ATUALIZAR CLIENTE' : 'NOVO CLIENTE'}</span><h2 id="client-form-title">{editingId ? 'Editar cliente' : 'Cadastrar cliente'}</h2></div><button onClick={closeForm} type="button" aria-label="Fechar formulário"><FaXmark /></button></div>
      <form onSubmit={handleSubmit}>
        <label className="form-field form-field--full">Nome<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nome completo" /></label>
        <div className="form-grid"><label className="form-field">Telefone / WhatsApp<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="(00) 00000-0000" /></label><label className="form-field">Instagram<input value={form.instagram} onChange={(event) => setForm({ ...form, instagram: event.target.value })} placeholder="@usuario" /></label></div>
        <label className="form-field form-field--full">E-mail<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="cliente@email.com" /></label>
        <label className="form-field form-field--full">Observações<textarea rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Preferências, datas importantes ou outros detalhes..." /></label>
        <div className="modal-actions"><button className="secondary-button" onClick={closeForm} type="button">Cancelar</button><button className="primary-button" type="submit">{editingId ? 'Salvar alterações' : 'Cadastrar cliente'}</button></div>
      </form>
    </section></div>}
  </div>
}
