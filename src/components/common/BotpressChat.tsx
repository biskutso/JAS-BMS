import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const INJECT_SCRIPT_ID = 'botpress-inject-script';
const BOT_SCRIPT_ID = 'botpress-bot-script';

const ALLOWED_PATHS = ['/', '/services', '/contact'];

const BOTPRESS_INJECT_SRC = 'https://cdn.botpress.cloud/webchat/v3.6/inject.js';
const BOTPRESS_BOT_SRC =
  'https://files.bpcontent.cloud/2026/03/26/06/20260326064200-XUK6W57C.js';

const appendScript = (id: string, src: string, defer = false) => {
  if (document.getElementById(id)) return;

  const script = document.createElement('script');
  script.id = id;
  script.src = src;
  script.async = false;
  script.defer = defer;
  document.body.appendChild(script);
};

const removeScript = (id: string) => {
  const script = document.getElementById(id);
  if (script) script.remove();
};

const removeBotpressElements = () => {
  const selectors = [
    '#bp-web-widget-container',
    '#botpress-webchat',
    'iframe[src*="botpress"]',
    'iframe[title*="botpress"]',
  ];

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => el.remove());
  });
};

const loadBotpress = () => {
  appendScript(INJECT_SCRIPT_ID, BOTPRESS_INJECT_SRC);
  appendScript(BOT_SCRIPT_ID, BOTPRESS_BOT_SRC, true);
};

const unloadBotpress = () => {
  removeBotpressElements();
  removeScript(BOT_SCRIPT_ID);
  removeScript(INJECT_SCRIPT_ID);
};

const BotpressChat = () => {
  const location = useLocation();

  useEffect(() => {
    const shouldShow = 
        location.pathname === '/' ||
        location.pathname.startsWith('/services') ||
        location.pathname.startsWith('/contact');

    if (shouldShow) {
      unloadBotpress();
      loadBotpress();

      const t1 = window.setTimeout(() => {
        removeBotpressElements();
        loadBotpress();
      }, 300);

      const t2 = window.setTimeout(() => {
        removeBotpressElements();
        loadBotpress();
      }, 1000);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else {
      unloadBotpress();
    }
  }, [location.pathname]);

  return null;
};

export default BotpressChat;