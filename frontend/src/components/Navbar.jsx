import ArrowIcon from './ArrowIcon.jsx'

function Navbar({ profile, menuOpen, setMenuOpen }) {
  return (
    <header className="site-header">
      <a className="wordmark" href="#top" aria-label={`${profile.name} home`}>PK<span>.</span></a>
      <button
        className="menu-toggle"
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-expanded={menuOpen}
        aria-label="Toggle navigation"
      >
        Menu <span>{menuOpen ? '×' : '＋'}</span>
      </button>
      <nav className={menuOpen ? 'nav-links is-open' : 'nav-links'}>
        <a href="#work" onClick={() => setMenuOpen(false)}>Work</a>
        <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
        <a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a>
      </nav>
      <div className="header-actions">
        <a className="header-cta" href={`mailto:${profile.email}`}>Let's talk <ArrowIcon /></a>
        <a className="resume-button" href="/Prakash_Kusari_Resume.docx" download>Resume <ArrowIcon /></a>
      </div>
    </header>
  )
}

export default Navbar
