// src/pages/public/Contact.tsx
import React from 'react';
import ContactForm from '@components/public/ContactForm'; // Using alias
import { APP_NAME } from '@utils/constants'; // Using alias

const Contact: React.FC = () => {
  return (
    <div className="page-container">
      <h1 className="page-title">Contact Us</h1>
      <p className="section-subtitle">
        Have a question or want to schedule an appointment? We'd love to hear from you.
        Fill out the form below or reach us directly.
      </p>
      <ContactForm />
      <div style={{ textAlign: 'center', marginTop: 'var(--spacing-lg)' }}>
        <p><strong>Phone:</strong> (123) 456-7890</p>
        <p><strong>Email:</strong> info@{APP_NAME.toLowerCase().replace(/\s/g, '')}.com</p>
        <p><strong>Address:</strong> 123 Serenity Lane, Wellness City, WC 54321</p>
      </div>
    </div>
  );
};

export default Contact;