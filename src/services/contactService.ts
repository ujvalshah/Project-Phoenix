import { apiClient } from './apiClient';

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export async function submitContactMessage(data: ContactFormData): Promise<void> {
  await apiClient.post('/contact', data);
}
