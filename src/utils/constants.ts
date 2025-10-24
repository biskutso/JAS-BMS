// src/utils/constants.ts

export const APP_NAME = "Joyce Aesthetic Salon & Spa";
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api"; // Replace with your actual backend URL

export const NAV_LINKS = [
  { name: "Home", path: "/" },
  { name: "Services", path: "/services" },
  { name: "Contact", path: "/contact" },
  { name: "Login", path: "/login" },
];

export const FOOTER_LINKS = [
  { category: "Services", links: ["Facials", "Massages", "Manicures", "Hair Styling"] },
  { category: "About Us", links: ["Our Story", "Team", "Careers"] },
  { category: "Support", links: ["FAQ", "Privacy Policy", "Terms of Service"] },
];

export const SOCIAL_MEDIA_LINKS = [
  { name: "Facebook", url: "https://facebook.com/joycespa" },
  { name: "Instagram", url: "https://instagram.com/joycespa" },
  { name: "Twitter", url: "https://twitter.com/joycespa" },
];


export const getImagePath = (imageName: string): string => {
  return `/assets/images/${imageName}`;
};

// Dummy Images (replace with actual paths or CDN URLs)
export const DUMMY_IMAGES = {
  HERO_WOMAN: getImagePath('hero-woman.jpg'),
  SERVICE_MASSAGE: getImagePath('service-massage.jpg'),
  SERVICE_FACIAL: getImagePath('service-facial.jpg'),
  SERVICE_MANICURE: getImagePath('service-manicure.jpg'),
  LOGO: getImagePath('logo.png'),
  CLIENT_AVATAR: getImagePath('client-avatar.jpg'),
  LOCATION_MAP: getImagePath('location-map.png'),
} as const;