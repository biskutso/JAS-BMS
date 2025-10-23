// src/types/service.d.ts
export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  category: 'facial' | 'massage' | 'nail' | 'hair' | 'waxing' | 'other';
  imageUrl?: string;
  availableDays?: string[]; // e.g., ["Monday", "Wednesday", "Friday"]
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl?: string;
  category: string;
}