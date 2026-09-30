function Footer({ profile }) {
  return (
    <footer className="site-footer section-wrap">
      <span>© 2026 {profile.name}</span>
      <span>Made with care, somewhere warm.</span>
      <a href="#top">Back to top ↑</a>
    </footer>
  )
}

export default Footer
