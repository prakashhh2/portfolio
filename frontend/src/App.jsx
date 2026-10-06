import { useEffect, useState } from 'react'
import Navbar from './components/Navbar.jsx'
import Body from './components/Body.jsx'
import Footer from './components/Footer.jsx'

// Production uses the same-origin /api rewrite; local development can still
// point directly at the FastAPI server or override it with VITE_API_URL.
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')

const fallbackProfile = {
  name: 'Prakash Kusari',
  role: 'Computer science student & frontend developer',
  location: 'Based in Hammond, LA',
  availability: 'Open to internships and software opportunities',
  bio: 'I build accessible web experiences and practical systems across frontend development, AI, data, and Solana. I enjoy turning complex ideas into products people can use.',
  email: 'prakashkusari0@gmail.com',
  stats: { experience: 'Research + internship', projects: '3 featured', focus: 'AI, Web3 & data' },
}

const fallbackProjects = [
  { id: 1, title: 'SolPOS', description: 'An AI-powered Solana point-of-sale platform helping small merchants accept fast, low-cost USDC payments.', category: 'Solana · HackLion', year: '2025', accent: 'orange', tags: ['Next.js', 'Solana Pay', 'Gemini AI'] },
  { id: 2, title: 'Credence', description: 'A decentralized certificate verification platform using Solana and IPFS to make academic credentials tamper-proof.', category: 'Blockchain platform', year: '2025', accent: 'blue', tags: ['React', 'Anchor', 'IPFS'] },
  { id: 3, title: 'AI Teaching Assistant', description: 'A real-time AI-powered teaching assistant research project designed to improve student learning and academic support.', category: 'University research', year: '2025–present', accent: 'green', tags: ['LLMs', 'Retrieval', 'AI workflows'] },
]

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
      <Navbar profile={profile} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <Body profile={profile} projects={projects} formState={formState} updateMessage={updateMessage} />
      <Footer profile={profile} />
    </div>
  )
}

export default App
