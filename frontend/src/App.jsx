import { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const fallbackProfile = {
  name: 'Alex Morgan',
  role: 'Product designer & developer',
  location: 'Based in Austin, TX',
  availability: 'Available for select projects',
  bio: 'I turn complicated ideas into calm, useful digital products. I care about the small details, the big picture, and everything in between.',
  email: 'hello@alexmorgan.design',
  stats: { experience: '8+ years', projects: '42 shipped', focus: 'Web & product' },
}

const fallbackProjects = [
  { id: 1, title: 'Field notes', description: 'A thoughtful workspace for independent teams to turn research into momentum.', category: 'Product design', year: '2024', accent: 'orange', tags: ['Strategy', 'UX/UI', 'Prototyping'] },
  { id: 2, title: 'Common ground', description: 'Making local volunteering feel as easy and welcoming as sending a message.', category: 'Brand & web', year: '2023', accent: 'blue', tags: ['Identity', 'Web design', 'Development'] },
  { id: 3, title: 'North star', description: 'A clearer way for growing teams to see what matters, and what comes next.', category: 'Product design', year: '2023', accent: 'green', tags: ['Research', 'Design system', 'Launch'] },
]

function ArrowIcon() {
  return <span aria-hidden="true">↗</span>
}

function App() {
  const [profile, setProfile] = useState(fallbackProfile)
  const [projects, setProjects] = useState(fallbackProjects)
  const [menuOpen, setMenuOpen] = useState(false)
  const [formState, setFormState] = useState('idle')

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/profile`).then((response) => response.ok ? response.json() : Promise.reject()),
      fetch(`${API_URL}/api/projects`).then((response) => response.ok ? response.json() : Promise.reject()),
    ]).then(([profileData, projectsData]) => {
      setProfile(profileData)
      setProjects(projectsData)
    }).catch(() => {
      // The seeded fallback keeps the page useful while the API is offline.
    })
  }, [])

  const updateMessage = (event) => {
    event.preventDefault()
    setFormState('sending')
    const formData = new FormData(event.currentTarget)
    fetch(`${API_URL}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    }).then((response) => {
      if (!response.ok) throw new Error('Unable to send')
      setFormState('sent')
      event.currentTarget.reset()
    }).catch(() => setFormState('error'))
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Alex Morgan home">AM<span>.</span></a>
        <button className="menu-toggle" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Toggle navigation">Menu <span>{menuOpen ? '×' : '＋'}</span></button>
        <nav className={menuOpen ? 'nav-links is-open' : 'nav-links'}>
          <a href="#work" onClick={() => setMenuOpen(false)}>Work</a>
          <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a>
        </nav>
        <a className="header-cta" href={`mailto:${profile.email}`}>Let's talk <ArrowIcon /></a>
      </header>

      <main id="top">
        <section className="hero section-wrap">
          <div className="hero-copy">
            <p className="eyebrow"><span className="status-dot" /> {profile.availability}</p>
            <h1>Good work<br /><em>moves</em> people.</h1>
            <p className="hero-intro">{profile.bio}</p>
            <a className="circle-link" href="#work" aria-label="Scroll to selected work"><ArrowIcon /></a>
          </div>
          <div className="hero-art" aria-label="Abstract orange and blue artwork" role="img">
            <div className="art-sun" />
            <div className="art-arch" />
            <div className="art-line line-one" />
            <div className="art-line line-two" />
            <span className="art-caption">SELECTED<br />OBSERVATIONS / 01</span>
          </div>
        </section>

        <section className="work section-wrap" id="work">
          <div className="section-heading">
            <p className="eyebrow">01 / Selected work</p>
            <p className="heading-note">A few things I’ve helped<br />bring into the world.</p>
          </div>
          <div className="project-grid">
            {projects.map((project, index) => (
              <article className={`project-card project-${project.accent}`} key={project.id}>
                <div className="project-visual">
                  <span className="project-number">0{index + 1}</span>
                  <span className="visual-mark">{index === 0 ? '✳' : index === 1 ? '◒' : '✦'}</span>
                  <span className="visual-word">{project.title.split(' ')[0]}</span>
                </div>
                <div className="project-meta">
                  <div>
                    <p className="project-category">{project.category} · {project.year}</p>
                    <h2>{project.title}</h2>
                  </div>
                  <p className="project-description">{project.description}</p>
                </div>
                <div className="tag-row">{project.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="about section-wrap" id="about">
          <div className="section-heading">
            <p className="eyebrow">02 / A little about me</p>
          </div>
          <div className="about-content">
            <h2>Curious by nature.<br /><em>Intentional</em> by design.</h2>
            <div className="about-side">
              <p>I work across strategy, design, and code to help ambitious teams make things people want to use. My process is collaborative, direct, and always rooted in a good question.</p>
              <a className="text-link" href={`mailto:${profile.email}`}>More about my approach <ArrowIcon /></a>
            </div>
          </div>
          <div className="stat-row">
            <div><strong>{profile.stats.experience}</strong><span>Experience</span></div>
            <div><strong>{profile.stats.projects}</strong><span>Projects</span></div>
            <div><strong>{profile.stats.focus}</strong><span>Focus</span></div>
          </div>
        </section>

        <section className="contact section-wrap" id="contact">
          <div className="contact-intro">
            <p className="eyebrow">03 / Start a conversation</p>
            <h2>Have a good<br /><em>feeling</em> about this?</h2>
            <a className="email-link" href={`mailto:${profile.email}`}>{profile.email} <ArrowIcon /></a>
          </div>
          <form className="contact-form" onSubmit={updateMessage}>
            <label>Name<input name="name" required placeholder="Your name" /></label>
            <label>Email<input name="email" type="email" required placeholder="you@company.com" /></label>
            <label>What’s on your mind?<textarea name="message" required rows="3" placeholder="Tell me a little about the project..." /></label>
            <button className="submit-button" type="submit" disabled={formState === 'sending'}>{formState === 'sending' ? 'Sending...' : 'Send message'} <ArrowIcon /></button>
            {formState === 'sent' && <p className="form-feedback success">Message received — I’ll be in touch soon.</p>}
            {formState === 'error' && <p className="form-feedback error">Couldn’t send that just yet. Please email me directly.</p>}
          </form>
        </section>
      </main>

      <footer className="site-footer section-wrap">
        <span>© 2024 {profile.name}</span>
        <span>Made with care, somewhere warm.</span>
        <a href="#top">Back to top ↑</a>
      </footer>
    </div>
  )
}

export default App
