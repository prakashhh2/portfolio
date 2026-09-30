function Work({ projects }) {
  return (
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
  )
}

export default Work
