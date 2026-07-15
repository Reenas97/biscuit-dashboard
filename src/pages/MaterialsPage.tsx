import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { FaBoxOpen, FaBoxesStacked, FaPen, FaPlus, FaTrash, FaTriangleExclamation, FaXmark } from 'react-icons/fa6'

type Material = {
  id: string
  name: string
  category: string
  unit: string
  stock: number
  minimumStock: number
  unitCost: number
  createdAt: string
}

type MaterialForm = Omit<Material, 'id' | 'createdAt' | 'stock' | 'minimumStock' | 'unitCost'> & {
  stock: string
  minimumStock: string
  unitCost: string
}

const storageKey = 'reena-biscuit-materials'
const emptyForm: MaterialForm = { name: '', category: '', unit: 'g', stock: '', minimumStock: '', unitCost: '' }

function loadMaterials() {
  const saved = localStorage.getItem(storageKey)
  if (!saved) return []
  try { return JSON.parse(saved) as Material[] } catch { return [] }
}

export function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>(loadMaterials)
  const [form, setForm] = useState<MaterialForm | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const lowStock = useMemo(() => materials.filter((material) => material.stock <= material.minimumStock), [materials])
  const totalValue = useMemo(() => materials.reduce((sum, material) => sum + material.stock * material.unitCost, 0), [materials])

  function saveMaterials(nextMaterials: Material[]) {
    setMaterials(nextMaterials)
    localStorage.setItem(storageKey, JSON.stringify(nextMaterials))
  }

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
  }

  function openEdit(material: Material) {
    setEditingId(material.id)
    setForm({ name: material.name, category: material.category, unit: material.unit, stock: String(material.stock), minimumStock: String(material.minimumStock), unitCost: String(material.unitCost) })
  }

  function closeForm() {
    setForm(null)
    setEditingId(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return
    const data = { name: form.name.trim(), category: form.category.trim(), unit: form.unit, stock: Number(form.stock), minimumStock: Number(form.minimumStock), unitCost: Number(form.unitCost) }
    if (editingId) saveMaterials(materials.map((material) => material.id === editingId ? { ...material, ...data } : material))
    else saveMaterials([{ id: crypto.randomUUID(), ...data, createdAt: new Date().toISOString() }, ...materials])
    closeForm()
  }

  function deleteMaterial(id: string) {
    saveMaterials(materials.filter((material) => material.id !== id))
  }

  return (
    <div className="materials-page">
      <div className="ideas-heading flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-1">
          <span className="section-kicker"><FaBoxOpen /> ESTOQUE DO ATELIÊ</span>
          <h2>Materiais sempre à mão</h2>
          <p>Controle o que você tem, acompanhe os custos e saiba o que precisa entrar na próxima lista de compras.</p>
        </div>
        <button className="primary-button shrink-0" onClick={openNew} type="button"><FaPlus /> Novo material</button>
      </div>

      <div className="materials-summary mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <article><span>Materiais cadastrados</span><strong>{materials.length}</strong></article>
        <article><span>Estoque baixo</span><strong>{lowStock.length}</strong></article>
        <article><span>Valor em estoque</span><strong>{totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></article>
      </div>

      {materials.length > 0 ? (
        <div className="materials-grid mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {materials.map((material) => {
            const isLow = material.stock <= material.minimumStock
            return (
              <article className={isLow ? 'material-card low' : 'material-card'} key={material.id}>
                <div className="material-card-heading">
                  <div className="material-icon"><FaBoxesStacked /></div>
                  <div><span>{material.category || 'Sem categoria'}</span><h3>{material.name}</h3></div>
                  {isLow && <span className="low-stock-badge"><FaTriangleExclamation /> Estoque baixo</span>}
                </div>
                <div className="stock-numbers">
                  <div><span>Disponível</span><strong>{material.stock.toLocaleString('pt-BR')} {material.unit}</strong></div>
                  <div><span>Mínimo</span><strong>{material.minimumStock.toLocaleString('pt-BR')} {material.unit}</strong></div>
                  <div><span>Custo unitário</span><strong>{material.unitCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>
                </div>
                <div className="material-actions"><button onClick={() => openEdit(material)} type="button"><FaPen /> Editar</button><button onClick={() => deleteMaterial(material.id)} type="button"><FaTrash /> Excluir</button></div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="ideas-empty mt-7"><FaBoxOpen /><h3>Nenhum material cadastrado</h3><p>Comece pelas massas, tintas e itens que você mais usa.</p></div>
      )}

      {form && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}>
          <section className="idea-modal" role="dialog" aria-modal="true" aria-labelledby="material-form-title">
            <div className="modal-heading">
              <div><span className="section-kicker"><FaBoxOpen /> {editingId ? 'ATUALIZAR MATERIAL' : 'NOVO MATERIAL'}</span><h2 id="material-form-title">{editingId ? 'Editar material' : 'Cadastrar material'}</h2></div>
              <button onClick={closeForm} type="button" aria-label="Fechar formulário"><FaXmark /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <label className="form-field form-field--full">Nome do material<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Massa branca" /></label>
              <div className="form-grid">
                <label className="form-field">Categoria<input required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Ex.: Massa" /></label>
                <label className="form-field">Unidade<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}><option value="g">gramas (g)</option><option value="kg">quilos (kg)</option><option value="ml">mililitros (ml)</option><option value="l">litros (l)</option><option value="cm">centímetros (cm)</option><option value="un">unidades (un)</option></select></label>
                <label className="form-field">Estoque atual<input required min="0" step="0.01" type="number" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} /></label>
                <label className="form-field">Estoque mínimo<input required min="0" step="0.01" type="number" value={form.minimumStock} onChange={(event) => setForm({ ...form, minimumStock: event.target.value })} /></label>
              </div>
              <label className="form-field form-field--full">Custo por unidade<input required min="0" step="0.01" type="number" value={form.unitCost} onChange={(event) => setForm({ ...form, unitCost: event.target.value })} placeholder="0,00" /><small>Informe o custo por g, kg, ml, l ou unidade escolhida.</small></label>
              <div className="modal-actions"><button className="secondary-button" onClick={closeForm} type="button">Cancelar</button><button className="primary-button" type="submit">{editingId ? 'Salvar alterações' : 'Cadastrar material'}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
