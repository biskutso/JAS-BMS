import React from 'react';
import { Link } from 'react-router-dom';
import { FOOTER_LINKS, SOCIAL_MEDIA_LINKS, APP_NAME, DUMMY_IMAGES } from '@utils/constants';
import { FaFacebookF, FaInstagram, FaTwitter } from 'react-icons/fa';

const SocialIcon: React.FC<{ name: string; url: string }> = ({ name, url }) => {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={name}>
      {name === 'Facebook' && <FaFacebookF className="footer-icon" size={20} />}
      {name === 'Instagram' && <FaInstagram className="footer-icon" size={20} />}
      {name === 'Twitter' && <FaTwitter className="footer-icon" size={20} />}
    </a>
  );
};

const Footer: React.FC = () => {
  return (
    <footer className="main-footer">
      <div className="footer-section footer-brand-info">
        <Link to="/">
          <img src={DUMMY_IMAGES.LOGO} alt={APP_NAME} className="logo" />
        </Link>
        <p>{APP_NAME} &copy; {new Date().getFullYear()}. All rights reserved.</p>
        <p>San Juan St, Dumaguete City, Negros Oriental</p>
        <p>Phone: (63+) 9935172743</p>
        <p>Email: info@{APP_NAME.toLowerCase().replace(/\s/g, '')}.com</p>
        <div className="footer-social-links">
          {SOCIAL_MEDIA_LINKS.map(link => (
            <SocialIcon key={link.name} name={link.name} url={link.url} />
          ))}
        </div>
      </div>

      {FOOTER_LINKS.map((section) => (
        <div key={section.category} className="footer-section">
          <h4>{section.category}</h4>
          <ul>
            {section.links.map((link) => (
              <li key={link}>
                <Link to={`/${link.toLowerCase().replace(/\s/g, '')}`}>{link}</Link>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} {APP_NAME}. Designed with elegance and care.</p>
      </div>
    </footer>
  );
};

export default Footer;