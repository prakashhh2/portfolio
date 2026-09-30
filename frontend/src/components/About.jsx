import ArrowIcon from './ArrowIcon.jsx'

function About({ profile }) {
  return (
    <section className="about section-wrap" id="about">
      <div className="section-heading">
        <p className="eyebrow">02 / A little about me</p>
      </div>
      <div className="about-content">
        <h2>Curious by nature.<br /><em>Intentional</em> in practice.</h2>
        <div className="about-side">
          <p>I’m a Computer Science student at Southeastern Louisiana University focused on data science, frontend development, AI, and Solana. I enjoy making complex technology easier to use.</p>
          <a className="text-link" href="/Prakash_Kusari_Resume.docx" download>Download my resume <ArrowIcon /></a>
        </div>
      </div>
      <div className="stat-row">
        <div><strong>{profile.stats.experience}</strong><span>Experience</span></div>
        <div><strong>{profile.stats.projects}</strong><span>Projects</span></div>
        <div><strong>{profile.stats.focus}</strong><span>Focus</span></div>
      </div>
    </section>
  )
}

export default About
