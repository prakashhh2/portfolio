import Hero from './Hero.jsx'
import Work from './Work.jsx'
import About from './About.jsx'
import Contact from './Contact.jsx'

function Body({ profile, projects, formState, updateMessage }) {
  return (
    <main id="top">
      <Hero profile={profile} />
      <Work projects={projects} />
      <About profile={profile} />
      <Contact profile={profile} formState={formState} updateMessage={updateMessage} />
    </main>
  )
}

export default Body
