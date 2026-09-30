import ArrowIcon from './ArrowIcon.jsx'

function Hero({ profile }) {
  return (
    <section className="hero section-wrap">
      <div className="hero-copy">
        <p className="eyebrow"><span className="status-dot" /> {profile.availability}</p>
        <h1>Building useful things<br /><em>with code.</em></h1>
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
  )
}

export default Hero
