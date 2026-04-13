import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const TAWK_SCRIPT_ID = 'tawk-to-script';
const TAWK_SRC = 'https://embed.tawk.to/69d7d472acf4021c34842730/1jlphboh8';

const TawkChat = () => {
  const location = useLocation();

  const isAllowedPage =
    location.pathname === '/' ||
    location.pathname.startsWith('/services') ||
    location.pathname.startsWith('/contact');

  useEffect(() => {
    if (document.getElementById(TAWK_SCRIPT_ID)) return;

    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = new Date();

    window.Tawk_API.onLoad = () => {
      window.Tawk_API?.hideWidget?.();
      window.Tawk_API?.minimize?.();
    };

    const script = document.createElement('script');
    script.id = TAWK_SCRIPT_ID;
    script.src = TAWK_SRC;
    script.async = true;
    script.charset = 'UTF-8';
    script.setAttribute('crossorigin', '*');

    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!isAllowedPage) {
      window.Tawk_API?.hideWidget?.();
      window.Tawk_API?.minimize?.();
    }
  }, [isAllowedPage]);

  return null;
};

export default TawkChat;