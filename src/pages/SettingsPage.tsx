import { useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { FaArrowRotateLeft, FaClock, FaCoins, FaDownload, FaFloppyDisk, FaGear, FaImage, FaTrash, FaUpload } from 'react-icons/fa6'
import defaultLogo from '../assets/reena-biscuit-logo.png'
import { defaultSettings, loadSettings, settingsEvent, settingsStorageKey } from '../settings'
import type { AtelierSettings } from '../settings'
import { dataChangedEvent, removeLocalData, saveLocalData } from '../lib/cloudData'

const dataKeys = ['reena-biscuit-ideas', 'reena-biscuit-projects', 'reena-biscuit-clients', 'reena-biscuit-materials', 'reena-biscuit-tasks', 'reena-biscuit-unavailable-days', 'reena-biscuit-goals', 'reena-biscuit-time-entries', settingsStorageKey]

export function SettingsPage() {
  const [form, setForm] = useState<AtelierSettings>(loadSettings)
  const [message, setMessage] = useState('')
  const [logoError, setLogoError] = useState('')
  const [confirmingClear, setConfirmingClear] = useState(false)
  const importInput = useRef<HTMLInputElement>(null)

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    saveLocalData(settingsStorageKey, JSON.stringify({ ...form, instagram: form.instagram.replace(/^@/, '') }))
    window.dispatchEvent(new Event(settingsEvent))
    setMessage('Configurações salvas com sucesso.')
  }

  function handleLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setLogoError('Escolha um arquivo de imagem.'); return }
    if (file.size > 2 * 1024 * 1024) { setLogoError('A imagem deve ter no máximo 2 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => { setForm({ ...form, logo: String(reader.result) }); setLogoError('') }
    reader.readAsDataURL(file)
  }

  function exportBackup() {
    const data = Object.fromEntries(dataKeys.map((key) => [key, localStorage.getItem(key)]).filter(([, value]) => value !== null))
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `reena-biscuit-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url)
    setMessage('Backup criado com sucesso.')
  }

  function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const backup = JSON.parse(String(reader.result)) as { data?: Record<string, string> }
        if (!backup.data || typeof backup.data !== 'object') throw new Error('invalid')
        Object.entries(backup.data).forEach(([key, value]) => { if (dataKeys.includes(key) && typeof value === 'string') localStorage.setItem(key, value) })
        window.dispatchEvent(new Event(dataChangedEvent))
        window.dispatchEvent(new Event(settingsEvent)); setForm(loadSettings()); setMessage('Backup importado. As páginas já podem ser atualizadas com os dados restaurados.')
      } catch { setMessage('Não foi possível importar: o arquivo de backup é inválido.') }
      event.target.value = ''
    }
    reader.readAsText(file)
  }

  function clearData() {
    dataKeys.forEach((key) => removeLocalData(key))
    setForm(defaultSettings); setConfirmingClear(false); window.dispatchEvent(new Event(settingsEvent)); setMessage('Todos os dados locais foram apagados.')
  }

  return <div className="settings-page">
    <div className="ideas-heading"><span className="section-kicker"><FaGear /> PERSONALIZAÇÃO E DADOS</span><h2>Seu ateliê, do seu jeito</h2><p>Atualize a identidade do sistema, seus contatos e mantenha uma cópia segura dos dados.</p></div>
    {message && <div className="settings-message">{message}</div>}
    <form className="settings-layout mt-7" onSubmit={saveSettings}>
      <div className="settings-main">
        <section className="settings-card"><div className="settings-card-heading"><FaImage /><div><h3>Identidade do ateliê</h3><p>Essas informações aparecem na navegação do sistema.</p></div></div>
          <div className="logo-setting"><div className="logo-preview"><img src={form.logo || defaultLogo} alt="Prévia do logo" /></div><div><label className="secondary-button" htmlFor="logo-upload"><FaUpload /> Escolher logo</label><input id="logo-upload" accept="image/*" onChange={handleLogo} type="file" /><button onClick={() => { setForm({ ...form, logo: '' }); setLogoError('') }} type="button"><FaArrowRotateLeft /> Usar logo original</button><small>PNG, JPG ou WEBP com até 2 MB.</small>{logoError && <strong>{logoError}</strong>}</div></div>
          <div className="form-grid"><label className="form-field">Nome do ateliê<input required value={form.studioName} onChange={(event) => setForm({ ...form, studioName: event.target.value })} /></label><label className="form-field">Subtítulo<input required value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} /></label><label className="form-field">Nome da artesã<input required value={form.ownerName} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} /></label><label className="form-field">Moeda<select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}><option value="BRL">Real brasileiro (R$)</option></select></label></div>
        </section>
        <section className="settings-card"><div className="settings-card-heading"><FaGear /><div><h3>Contatos</h3><p>Dados gerais do negócio para a futura área de pedidos.</p></div></div><div className="form-grid"><label className="form-field">Telefone / WhatsApp<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="(00) 00000-0000" /></label><label className="form-field">Instagram<input value={form.instagram} onChange={(event) => setForm({ ...form, instagram: event.target.value })} placeholder="@seu_atelie" /></label><label className="form-field form-field--full">E-mail<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label className="form-field">Cidade<input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label><label className="form-field">Estado<input maxLength={2} value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value.toUpperCase() })} placeholder="UF" /></label></div></section>
        <section className="settings-card"><div className="settings-card-heading"><FaCoins /><div><h3>Valor do trabalho</h3><p>Define quanto cada hora trabalhada acrescenta ao valor da peça.</p></div></div><div className="form-grid"><label className="form-field form-field--full">Valor da hora (R$)<input required min="0" step="0.01" type="number" value={form.hourlyRate} onChange={(event) => setForm({ ...form, hourlyRate: Number(event.target.value) })} /><small>Valor inicial de R$ 7,37, equivalente à hora do salário mínimo nacional de 2026.</small></label></div></section>
        <section className="settings-card"><div className="settings-card-heading"><FaClock /><div><h3>Pausa automática</h3><p>Escolha quanto tempo o computador pode ficar sem interação antes de pausar o projeto.</p></div></div><div className="form-grid"><label className="form-field form-field--full">Pausar o cronômetro após<select value={form.timerPauseMinutes} onChange={(event) => setForm({ ...form, timerPauseMinutes: Number(event.target.value) })}><option value={10}>10 minutos</option><option value={20}>20 minutos</option><option value={30}>30 minutos</option><option value={40}>40 minutos</option><option value={60}>1 hora</option><option value={90}>1 hora e 30 minutos</option><option value={120}>2 horas</option></select><small>O alerta do Chrome aparecerá 5 minutos antes da pausa.</small></label></div></section>
        <button className="primary-button settings-save" type="submit"><FaFloppyDisk /> Salvar configurações</button>
      </div>
      <aside className="settings-side"><section className="settings-card"><div className="settings-card-heading compact"><FaDownload /><div><h3>Backup dos dados</h3><p>Proteja os cadastros enquanto usamos o armazenamento local.</p></div></div><button className="secondary-button settings-wide-button" onClick={exportBackup} type="button"><FaDownload /> Baixar backup</button><button className="secondary-button settings-wide-button" onClick={() => importInput.current?.click()} type="button"><FaUpload /> Importar backup</button><input ref={importInput} className="settings-hidden-input" accept="application/json,.json" onChange={importBackup} type="file" /></section>
        <section className="settings-card danger-zone"><div className="settings-card-heading compact"><FaTrash /><div><h3>Apagar dados locais</h3><p>Remove projetos, clientes, materiais, tarefas, metas e configurações deste navegador.</p></div></div>{confirmingClear ? <div className="clear-confirm"><strong>Esta ação não pode ser desfeita.</strong><button onClick={clearData} type="button">Sim, apagar tudo</button><button onClick={() => setConfirmingClear(false)} type="button">Cancelar</button></div> : <button className="secondary-button settings-wide-button" onClick={() => setConfirmingClear(true)} type="button"><FaTrash /> Apagar todos os dados</button>}</section>
      </aside>
    </form>
  </div>
}
