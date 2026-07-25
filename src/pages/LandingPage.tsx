import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FaArrowRight, FaBars, FaCat, FaHeart, FaInstagram, FaPaw, FaQuoteLeft, FaRegStar, FaWandMagicSparkles, FaXmark } from 'react-icons/fa6'
import logo from '../assets/reena-biscuit-logo.png'

const services = [
  { icon: FaRegStar, title: 'Reena POP', text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Uma versão cheia de personalidade e detalhes.' },
  { icon: FaCat, title: 'Reena Chibi', text: 'Sed do eiusmod tempor incididunt ut labore. Traços delicados em um estilo fofo e expressivo.' },
  { icon: FaWandMagicSparkles, title: 'Reena Anime', text: 'Ut enim ad minim veniam, quis nostrud exercitation. Personagens modelados à mão com cuidado.' },
  { icon: FaHeart, title: 'Noivinhos', text: 'Duis aute irure dolor in reprehenderit. Uma lembrança personalizada para celebrar esse momento.' },
]

const steps = [
  ['01', 'Conte sua ideia', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'],
  ['02', 'Aprovação dos detalhes', 'Sed do eiusmod tempor incididunt ut labore et dolore.'],
  ['03', 'Criação artesanal', 'Ut enim ad minim veniam, quis nostrud exercitation ullamco.'],
  ['04', 'Sua peça fica pronta', 'Duis aute irure dolor in reprehenderit in voluptate velit.'],
]

export function LandingPage({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return <main className="landing-page">
    <header className="landing-header">
      <Link className="landing-brand" to="/" aria-label="Reena Biscuit — início"><img src={logo} alt="" /><span><strong>Reena Biscuit</strong><small>Onde a imaginação ganha forma</small></span></Link>
      <button className="landing-menu-button" onClick={() => setMenuOpen(!menuOpen)} type="button" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}>{menuOpen ? <FaXmark /> : <FaBars />}</button>
      <nav className={menuOpen ? 'landing-nav open' : 'landing-nav'} aria-label="Navegação da página">
        <a href="#sobre" onClick={closeMenu}>Sobre</a><a href="#servicos" onClick={closeMenu}>Criações</a><a href="#processo" onClick={closeMenu}>Como funciona</a><a href="#contato" onClick={closeMenu}>Contato</a>
        <Link className="landing-login" onClick={closeMenu} to={isLoggedIn ? '/dashboard' : '/login'}>{isLoggedIn ? 'Abrir dashboard' : 'Área da artesã'} <FaArrowRight /></Link>
      </nav>
    </header>

    <section className="landing-hero">
      <div className="landing-hero-copy">
        <span className="landing-eyebrow"><FaPaw /> FEITO À MÃO, FEITO COM AFETO</span>
        <h1>Peças personalizadas<br /><em>feitas com cuidado e carinho</em></h1>
        <p>Cada peça é modelada totalmente à mão, com atenção a cada detalhe, para dar forma a ideias e momentos especiais.</p>
        <div className="landing-hero-actions"><a className="landing-primary" href="#contato">Quero uma peça personalizada <FaArrowRight /></a><a className="landing-secondary" href="#servicos">Conheça o trabalho</a></div>
        <div className="landing-trust"><span><FaRegStar /> Totalmente à mão</span><span><FaHeart /> Feito com carinho</span><span><FaPaw /> Exclusivo para você</span></div>
      </div>
      <div className="landing-hero-art" aria-label="Ilustração decorativa da identidade Reena Biscuit">
        <div className="landing-art-orbit orbit-one"><FaPaw /></div><div className="landing-art-orbit orbit-two"><FaHeart /></div>
        <div className="landing-logo-frame"><img src={logo} alt="Logo Reena Biscuit" /></div>
        <span className="landing-art-note">Peças únicas<br />para momentos únicos</span>
      </div>
    </section>

    <section className="landing-intro" id="sobre">
      <div><span className="landing-eyebrow">NOSSO ATELIÊ</span><h2>Onde cada detalhe<br />nasce com <em>carinho</em></h2></div>
      <div><p>Ao apoiar o trabalho artesanal, você valoriza o cuidado, o carinho e o tempo que coloco em cada peça. Da escolha das cores aos pequenos acabamentos, tudo passa pelas minhas mãos.</p><p>Por isso, cada criação tem seu próprio jeitinho: ela nasce da sua ideia e ganha forma aos poucos, com atenção e afeto em todas as etapas.</p><a href="#processo">Conheça o processo <FaArrowRight /></a></div>
    </section>

    <section className="landing-services" id="servicos">
      <div className="landing-section-heading"><span className="landing-eyebrow"><FaPaw /> CRIAÇÕES COM PROPÓSITO</span><h2>Um pedacinho de afeto<br />feito especialmente <em>para você</em></h2><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aute irure dolor in reprehenderit.</p></div>
      <div className="landing-service-grid">{services.map(({ icon: Icon, title, text }) => <article key={title}><div><Icon /></div><span>REENA BISCUIT</span><h3>{title}</h3><p>{text}</p><a href="#contato">Saber mais <FaArrowRight /></a></article>)}</div>
    </section>

    <section className="landing-process" id="processo">
      <div className="landing-process-copy"><span className="landing-eyebrow">DO SONHO À PEÇA PRONTA</span><h2>Seu pedido,<br /><em>passo a passo</em></h2><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Acompanhe cada etapa de uma criação feita especialmente para você.</p></div>
      <div className="landing-step-list">{steps.map(([number, title, text]) => <article key={number}><strong>{number}</strong><span><h3>{title}</h3><p>{text}</p></span></article>)}</div>
    </section>

    <section className="landing-testimonial"><FaQuoteLeft /><blockquote>“Lorem ipsum dolor sit amet, consectetur adipiscing elit. A peça ficou ainda mais linda do que eu imaginava e cheia de detalhes especiais.”</blockquote><span>— Nome da cliente</span></section>

    <section className="landing-cta" id="contato">
      <div><span className="landing-eyebrow"><FaHeart /> VAMOS CRIAR JUNTAS?</span><h2>Sua ideia pode virar<br /><em>uma peça inesquecível</em></h2><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Entre em contato e conte como você imagina sua peça.</p></div>
      <div className="landing-contact-card"><FaInstagram /><span><strong>Fale com a Reena Biscuit</strong><small>Em breve, seu Instagram e WhatsApp aparecerão aqui.</small></span><FaArrowRight /></div>
    </section>

    <footer className="landing-footer"><Link className="landing-brand" to="/"><img src={logo} alt="" /><span><strong>Reena Biscuit</strong><small>Onde a imaginação ganha forma</small></span></Link><p>© {new Date().getFullYear()} Reena Biscuit. Lorem ipsum dolor sit amet.</p><Link to={isLoggedIn ? '/dashboard' : '/login'}>{isLoggedIn ? 'Dashboard' : 'Área da artesã'}</Link></footer>
  </main>
}
