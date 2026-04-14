import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';

export const getToken = () => localStorage.getItem('token');
export const setToken = (token: string) => localStorage.setItem('token', token);
export const clearToken = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('roles');
  window.location.href = '/login';
};
export const getRoles = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem('roles') || '[]');
  } catch {
    return [];
  }
};
export const setRoles = (roles: string[]) => localStorage.setItem('roles', JSON.stringify(roles));
export const hasRole = (role: string) => getRoles().includes(role);

export function PrivateRoute({ children }: { children: ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}
