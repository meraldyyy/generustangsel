import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/ui/Card';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, isAdminActive, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (!session || !isAdminActive) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
