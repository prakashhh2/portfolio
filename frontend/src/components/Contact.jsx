import ArrowIcon from './ArrowIcon.jsx'

function Contact({ profile, formState, updateMessage }) {
  return (
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
  )
}

export default Contact
