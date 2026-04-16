import { Navigate } from 'react-router-dom';
import { ReactNode, useEffect, useState } from 'react';
import request from './request';

export const getToken = () => localStorage.getItem('token');
export const setToken = (token: string) => localStorage.setItem('token', token);
export const clearToken = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('roles');
};

export function parseJwtPayload(token: string): any {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(
    decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    ),
  );
}

export const getRoles = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem('roles') || '[]');
  } catch {
    return [];
  }
};
export const setRoles = (roles: string[]) =>
  localStorage.setItem('roles', JSON.stringify(roles));
export const hasRole = (role: string) => getRoles().includes(role);

export function PrivateRoute({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>(
    'loading',
  );
  const token = getToken();

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    request
      .get('/auth/me')
      .then(() => setStatus('valid'))
      .catch(() => {
        clearToken();
        setStatus('invalid');
      });
  }, [token]);

  if (status === 'loading') return null;
  if (status === 'invalid') return <Navigate to="/login" replace />;
  return <>{children}</>;
}
