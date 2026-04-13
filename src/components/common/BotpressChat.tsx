import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const INJECT_SCRIPT_ID = 'botpress-inject-script'
const BOT_SCRIPT_ID = 'botpress-bot-script'

const BOTPRESS_INJECT_SRC = 'https://cdn.botpress.cloud/webchat/v3.6/inject.js'
const BOTPRESS_BOT_SRC =
  'https://files.bpcontent.cloud/2026/03/26/06/20260326064200-XUK6W57C.js'

const HANDOFF_DELAY_MS = 700
const RETURN_DELAY_MS = 700

const BOTPRESS_INLINE_STYLES = `
  button[aria-label*="voice"],
  button[aria-label*="Voice"],
  button[aria-label*="microphone"],
  button[aria-label*="Microphone"],
  button[data-testid*="voice"],
  button[data-testid*="mic"] {
    display: none !important;
  }
`

const appendScript = (id: string, src: string, defer = false) => {
  if (document.getElementById(id)) return

  const script = document.createElement('script')
  script.id = id
  script.src = src
  script.async = false
  script.defer = defer
  document.body.appendChild(script)
}

const removeScript = (id: string) => {
  const script = document.getElementById(id)
  if (script) script.remove()
}

const removeBotpressElements = () => {
  const selectors = [
    '#bp-web-widget-container',
    '#botpress-webchat',
    'iframe[src*="botpress"]',
    'iframe[title*="botpress"]',
  ]

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => el.remove())
  })
}

const loadBotpress = () => {
  appendScript(INJECT_SCRIPT_ID, BOTPRESS_INJECT_SRC)
  appendScript(BOT_SCRIPT_ID, BOTPRESS_BOT_SRC, true)
}

const unloadBotpress = () => {
  removeBotpressElements()
  removeScript(BOT_SCRIPT_ID)
  removeScript(INJECT_SCRIPT_ID)
}

const closeBotpressWidget = () => {
  if (window.botpress?.close) {
    window.botpress.close()
    return
  }

  const selectors = [
    '#bp-web-widget-container',
    '#botpress-webchat',
    'iframe[src*="botpress"]',
    'iframe[title*="botpress"]',
  ]

  selectors.forEach((selector) => {
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      el.style.display = 'none'
    })
  })
}

const openBotpressWidget = () => {
  if (window.botpress?.open) {
    window.botpress.open()
    return
  }

  const selectors = [
    '#bp-web-widget-container',
    '#botpress-webchat',
    'iframe[src*="botpress"]',
    'iframe[title*="botpress"]',
  ]

  selectors.forEach((selector) => {
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      el.style.display = ''
    })
  })
}

const BotpressChat = () => {
  const location = useLocation()
  const botpressListenerBound = useRef(false)
  const tawkEventsBound = useRef(false)
  const handoffActive = useRef(false)
  const configAppliedRef = useRef(false)

  const isAllowedPage =
    location.pathname === '/' ||
    location.pathname.startsWith('/services') ||
    location.pathname.startsWith('/contact')

  useEffect(() => {
    if (isAllowedPage) {
      unloadBotpress()
      loadBotpress()

      const t1 = window.setTimeout(() => {
        removeBotpressElements()
        loadBotpress()
      }, 300)

      const t2 = window.setTimeout(() => {
        removeBotpressElements()
        loadBotpress()
      }, 1000)

      const t3 = window.setTimeout(() => {
        if (!handoffActive.current) {
          window.Tawk_API?.hideWidget?.()
          window.Tawk_API?.minimize?.()
        }
      }, 1500)

      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
        clearTimeout(t3)
      }
    }

    unloadBotpress()
    configAppliedRef.current = false
    window.Tawk_API?.hideWidget?.()
    window.Tawk_API?.minimize?.()
  }, [isAllowedPage])

  useEffect(() => {
    let attempts = 0
    const maxAttempts = 40

    const applyBotpressConfig = () => {
      if (!window.botpress?.config || configAppliedRef.current) return false

      window.botpress.config({
        configuration: {
          additionalStylesheet: BOTPRESS_INLINE_STYLES,
        },
      })

      configAppliedRef.current = true
      return true
    }

    const openTawkAfterDelay = (payload: any, retries = 20) => {
      if (!isAllowedPage) return

      if (window.Tawk_API?.maximize) {
        handoffActive.current = true

        const name = payload?.name || 'Website Visitor'
        const email = payload?.email || ''

        closeBotpressWidget()

        window.setTimeout(() => {
          const openTawk = () => {
            window.Tawk_API?.showWidget?.()
            window.Tawk_API?.maximize?.()
          }

          if (window.Tawk_API?.setAttributes) {
            window.Tawk_API.setAttributes({ name, email }, () => {
              openTawk()
            })
          } else {
            window.Tawk_API!.visitor = { name, email }
            openTawk()
          }
        }, HANDOFF_DELAY_MS)

        return
      }

      if (retries > 0) {
        window.setTimeout(() => openTawkAfterDelay(payload, retries - 1), 500)
      }
    }

    const tryBindBotpressListener = () => {
      if (!window.botpress?.on) {
        attempts += 1
        if (attempts < maxAttempts) {
          window.setTimeout(tryBindBotpressListener, 500)
        }
        return
      }

      if (botpressListenerBound.current) return
      botpressListenerBound.current = true

      applyBotpressConfig()

      window.botpress.on('webchat:ready', () => {
        applyBotpressConfig()
      })

      window.botpress.on('webchat:opened', () => {
        applyBotpressConfig()
      })

      window.botpress.on('customEvent', (event: any) => {
        const payload = event?.payload ?? event
        if (payload?.action !== 'handoff_to_tawk') return

        openTawkAfterDelay(payload)
      })
    }

    tryBindBotpressListener()
  }, [isAllowedPage])

  useEffect(() => {
    let attempts = 0
    const maxAttempts = 40

    const restoreBotpressAfterDelay = () => {
      handoffActive.current = false

      window.Tawk_API?.hideWidget?.()
      window.Tawk_API?.minimize?.()

      window.setTimeout(() => {
        if (isAllowedPage) {
          openBotpressWidget()
        }
      }, RETURN_DELAY_MS)
    }

    const tryBindTawkEvents = () => {
      if (!window.Tawk_API) {
        attempts += 1
        if (attempts < maxAttempts) {
          window.setTimeout(tryBindTawkEvents, 500)
        }
        return
      }

      if (tawkEventsBound.current) return
      tawkEventsBound.current = true

      window.Tawk_API.onChatEnded = () => {
        restoreBotpressAfterDelay()
      }

      window.Tawk_API.onChatHidden = () => {
        if (handoffActive.current) {
          restoreBotpressAfterDelay()
        }
      }
    }

    tryBindTawkEvents()
  }, [isAllowedPage])

  return null
}

export default BotpressChat