import React from 'react';
import { Link } from 'react-router-dom';
import { SOCIAL_MEDIA_LINKS, APP_NAME, DUMMY_IMAGES } from '@utils/constants';
import { FaFacebookF, FaInstagram, FaTwitter } from 'react-icons/fa';

const SocialIcon: React.FC<{ name: string; url: string }> = ({ name, url }) => {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={name}>
      {name === 'Facebook' && <FaFacebookF className="footer-icon" size={16} />}
      {name === 'Instagram' && <FaInstagram className="footer-icon" size={16} />}
      {name === 'Twitter' && <FaTwitter className="footer-icon" size={16} />}
    </a>
  );
};

const Footer: React.FC = () => {
  return (
    <footer className="main-footer">
      <div className="footer-content">
        {/* Logo and Brand Name */}
        <div className="footer-header">
          <Link to="/" className="footer-logo-link">
            <img src={DUMMY_IMAGES.LOGO} alt={APP_NAME} className="footer-logo" />
          </Link>
          <h3 className="footer-brand-name">{APP_NAME}</h3>
        </div>

        <div className="footer-body">
          {/* About Section */}
          <div className="footer-about-section">
            <h4 className="footer-section-title">About Joyce Aesthetic Salon & Spa</h4>
            <p className="about-description">
              At Joyce Aesthetic, we believe in holistic well-being. Our dedicated team of professionals is committed to providing personalized care in a tranquil and elegant environment. We use only the finest products to ensure exceptional results and a truly memorable experience.
            </p>
          </div>

          {/* Contact Section */}
          <div className="footer-contact-section">
            <p className="contact-line">San Juan St, Dumaguete City, Negros Oriental</p>
            <p className="contact-line">(63+) 9935172743</p>
            <p className="contact-line">info@joyceaestheticsalon&spa.com</p>
            
            <div className="footer-social-links">
              {SOCIAL_MEDIA_LINKS.map(link => (
                <SocialIcon key={link.name} name={link.name} url={link.url} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="copyright-text">© {new Date().getFullYear()} Joyce Aesthetic Salon & Spa. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;