import { useState } from 'react'
import type { FormEvent } from 'react'
import { FaArrowRightToBracket, FaEnvelope, FaLock, FaPaw, FaUser } from 'react-icons/fa6'
import logo from '../assets/reena-biscuit-logo.png'
import { useAuth } from '../auth/AuthContext'

function authMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  if (code.includes('invalid-credential')) return 'E-mail ou senha incorretos.'
  if (code.includes('email-already-in-use')) return 'Este e-mail já possui uma conta.'
  if (code.includes('weak-password')) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (code.includes('invalid-email')) return 'Informe um e-mail válido.'
  if (code.includes('too-many-requests')) return 'Muitas tentativas. Aguarde um pouco e tente novamente.'
  return 'Não foi possível concluir. Confira os dados e tente novamente.'
}

export function LoginPage() {
  const { login, register, resetPassword } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setError(''); setMessage('')
    try {
      if (mode === 'register') await register(name.trim(), email.trim(), password)
      else await login(email.trim(), password)
    } catch (authError) { setError(authMessage(authError)) } finally { setSubmitting(false) }
  }

  async function handleReset() {
    if (!email.trim()) { setError('Informe seu e-mail para recuperar a senha.'); return }
    setError('')
    try { await resetPassword(email.trim()); setMessage('Enviamos um link de recuperação para seu e-mail.') } catch (authError) { setError(authMessage(authError)) }
  }

  return <main className="login-page"><section className="login-card"><div className="login-brand"><div><img src={logo} alt="Logo Reena Biscuit" /></div><span>REENA BISCUIT</span><h1>{mode === 'login' ? 'Bem-vinda de volta' : 'Crie seu acesso'}</h1><p>{mode === 'login' ? 'Entre para organizar seu ateliê.' : 'Seus dados ficarão protegidos e sincronizados.'}</p></div><form onSubmit={handleSubmit}>
    {mode === 'register' && <label className="login-field"><span><FaUser /> Nome</span><input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>}
    <label className="login-field"><span><FaEnvelope /> E-mail</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
    <label className="login-field"><span><FaLock /> Senha</span><input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
    {error && <p className="login-feedback error">{error}</p>}{message && <p className="login-feedback">{message}</p>}
    <button className="primary-button login-submit" disabled={submitting} type="submit"><FaArrowRightToBracket /> {submitting ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
    {mode === 'login' && <button className="login-link" onClick={handleReset} type="button">Esqueci minha senha</button>}
  </form><div className="login-switch"><FaPaw /><span>{mode === 'login' ? 'Primeiro acesso?' : 'Já possui uma conta?'}</span><button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setMessage('') }} type="button">{mode === 'login' ? 'Criar conta' : 'Fazer login'}</button></div></section></main>
}
