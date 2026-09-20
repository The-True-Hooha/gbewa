import { useEffect } from 'react'

import { applyTheme } from '../utils/applyTheme'
import packageData from '../../package.json'
import './Welcome.css'

const closeTab = () => window.close()
const openSettings = () => chrome.runtime.openOptionsPage()
const openExtensionsPage = () => chrome.tabs.create({ url: 'chrome://extensions' })

export const Welcome = () => {
  useEffect(() => {
    void applyTheme()
  }, [])

  return (
    <main className="welcome">
      <header className="topbar">
        <div className="brand">
          <img className="brand-icon" src="/icons/gbewa-32px.png" alt="" width={28} height={28} />
          <span className="brand-name">gbewa</span>
        </div>
        <div className="topbar-meta">
          installed just now &middot; v{packageData.version} &middot; {packageData.license}
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">&#10003; installed and ready</p>
        <h1>You&rsquo;re in. One small thing and you&rsquo;ll never need this page again.</h1>
        <div className="hero-sub">
          <p>
            gbewa only runs when you click it &mdash; no background scanning, nothing to sign into.
            The step below takes about ten seconds, and the rest is optional.
          </p>
          <a
            className="skip-link"
            href="#"
            onClick={(e) => {
              e.preventDefault()
              closeTab()
            }}
          >
            skip all this, I&rsquo;ll figure it out &rarr;
          </a>
        </div>
      </section>

      <hr />

      <section className="step">
        <div className="step-text">
          <p className="step-number">
            <span>01</span> <span className="step-time">10 seconds</span>
          </p>
          <h2>Pin it to the toolbar.</h2>
          <p>
            Chrome hides new extensions behind the puzzle-piece icon. Click it, find gbewa, hit the
            pin &mdash; otherwise you&rsquo;ll forget it&rsquo;s there by Thursday.
          </p>
        </div>
        <div className="step-visual">
          <ExtensionsPanelMock />
        </div>
      </section>

      <hr />

      <section className="step step-reverse">
        <div className="step-visual">
          <PickerMock />
        </div>
        <div className="step-text">
          <p className="step-number">
            <span>02</span> <span className="step-time">5 seconds</span>
          </p>
          <h2>Click it, then click what you want.</h2>
          <p>
            Clicking the toolbar icon arms the picker on that tab. Hover any image or video and it
            outlines &mdash; click it, and gbewa grabs the best-quality version it can find.
          </p>
        </div>
      </section>

      <hr />

      <section className="step">
        <div className="step-text">
          <p className="step-number">
            <span>03</span> <span className="step-time">optional</span>
          </p>
          <h2>Tweak how it looks.</h2>
          <p>
            Defaults are fine: theme follows your system, and you get a notification when a download
            finishes. Two settings, that&rsquo;s all there&rsquo;ll ever be.
          </p>
        </div>
        <div className="step-visual">
          <SettingsMock />
        </div>
      </section>

      <p className="privacy-note">
        <span className="lock-icon" aria-hidden="true">
          &#128274;
        </span>
        <span>
          <strong>There&rsquo;s no server, so there&rsquo;s nothing to trust us with.</strong>
          <br />
          Every download happens directly between your browser and the site you&rsquo;re on &mdash;
          gbewa never sees or forwards a URL. You&rsquo;re welcome to read the source yourself.
        </span>
      </p>

      <footer className="footer-band">
        <div className="footer-band-text">
          <h2>That&rsquo;s everything.</h2>
          <p>
            No account, no email, no survey about your workflow. Open any page with pictures or
            video and click the icon.
          </p>
        </div>
        <button className="cta-button" onClick={closeTab}>
          Try it now
        </button>
      </footer>

      <div className="footer-links">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            openSettings()
          }}
        >
          open settings
        </a>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            openExtensionsPage()
          }}
        >
          how to uninstall
        </a>
      </div>
    </main>
  )
}

const ExtensionsPanelMock = () => (
  <div className="mock-card mock-extensions">
    <p className="mock-title">&#129513; Extensions</p>
    <div className="mock-row mock-row-active">
      <img className="mock-row-icon" src="/icons/gbewa-32px.png" alt="" width={20} height={20} />
      <span>gbewa</span>
      <span className="mock-pin mock-pin-active">&#128204;</span>
    </div>
    <div className="mock-row">
      <span className="mock-row-icon mock-row-icon-plain">&#128273;</span>
      <span>1Password</span>
      <span className="mock-pin">&#128204;</span>
    </div>
    <div className="mock-row">
      <span className="mock-row-icon mock-row-icon-plain">A</span>
      <span>Grammarly</span>
      <span className="mock-pin">&#128204;</span>
    </div>
    <p className="mock-footer">Manage extensions</p>
  </div>
)

const PickerMock = () => (
  <div className="mock-card mock-picker">
    <div className="mock-picker-frame">
      <div className="mock-picker-image" />
      <div className="mock-picker-outline" />
      <span className="mock-cursor" aria-hidden="true">
        &#8598;
      </span>
    </div>
    <p className="mock-caption">hover &rarr; outline &rarr; click &rarr; download</p>
  </div>
)

const SettingsMock = () => (
  <div className="mock-card mock-settings">
    <p className="mock-title">Settings</p>
    <div className="mock-field">
      <p className="mock-field-label">Theme</p>
      <div className="mock-radio-row">
        <span>&#9675; Light</span>
        <span className="mock-radio-selected">&#9679; System</span>
        <span>&#9675; Dark</span>
      </div>
    </div>
    <div className="mock-field">
      <label className="mock-checkbox">
        <span className="mock-checkbox-box mock-checkbox-checked">&#10003;</span>
        Notify me when a download finishes
      </label>
    </div>
    <a
      className="mock-footer mock-footer-link"
      href="#"
      onClick={(e) => {
        e.preventDefault()
        openSettings()
      }}
    >
      open settings &rarr;
    </a>
  </div>
)

export default Welcome
