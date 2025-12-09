// src/pages/public/Contact.tsx
import React from 'react';
import ContactForm from '@components/public/ContactForm';
import { APP_NAME } from '@utils/constants';
import { FaMapMarkerAlt, FaPhoneAlt, FaEnvelope, FaClock } from 'react-icons/fa';

const Contact: React.FC = () => {
  return (
    <main className="contacts-container">
      <section className="contacts-hero contact-hero">
        <div className="contacts-inner-container">
          <h1 className="animate-fade-in-up" style={{animationDelay: '0.2s'}}>Get in Touch</h1>
          <p className="animate-fade-in-up" style={{animationDelay: '0.4s'}}>We're here to answer all your questions and help you book your next appointment.</p>
        </div>
      </section>

      <section className="contacts-info-section animate-fade-in-up" style={{animationDelay: '0.4s'}}>
        <div className="contacts-inner-container">
          <div className="contacts-details">
            <div className="contacts-detail-item">
              <span className="contacts-icon-custom">
                <FaMapMarkerAlt />
              </span>
              <h3>Our Location</h3>
              <p>San Juan St, Dumaguete City, Negros Oriental</p>
              <a href="#map" className="contacts-btn contacts-btn-tertiary">View on Map</a>
            </div>
            <div className="contacts-detail-item">
              <span className="contacts-icon-custom">
                <FaPhoneAlt />
              </span>
              <h3>Call Us</h3>
              <p>(123) 456-7890</p>
            </div>
            <div className="contacts-detail-item">
              <span className="contacts-icon-custom">
                <FaEnvelope />
              </span>
              <h3>Email Us</h3>
              <p>info@joyceaesthetic.com</p>
            </div>
            <div className="contacts-detail-item">
              <span className="contacts-icon-custom">
                <FaClock />
              </span>
              <h3>Opening Hours</h3>
              <p>Mon-Fri: 9:00AM-7:00PM</p>
              <p>Sat: 10:00AM-5:00PM</p>
              <p>Sun: Closed</p>
            </div>
          </div>
        </div>
      </section>

      <section className="contacts-form-section">
        <div className="contacts-inner-container">
          <h2>Send Us a Message</h2>
          <ContactForm />
        </div>
      </section>

      <section className="contacts-map-section" id="map">
        <div className="contacts-inner-container">
          <h2>Find Us Easily</h2>
          <div className="contacts-map-embed">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3937.264654002145!2d123.30243287438125!3d9.309801984531575!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33ab6fdf1021bfa1%3A0xa6e68aaa604bfadc!2sJoyce%20Aesthetic%20Salon%20and%20Spa!5e0!3m2!1sen!2sph!4v1760251969483!5m2!1sen!2sph"
              width="100%"
              height="450"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              title="Business Location"
            ></iframe>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Contact;