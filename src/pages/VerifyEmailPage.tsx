import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authService } from '@/services/authService';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

  useEffect(() => {
    if (!token) {
        setStatus('error');
        return;
    }
    const verify = async () => {
        try {
            await authService.verifyEmail(token);
            setStatus('success');
            setTimeout(() => navigate('/'), 3000);
        } catch (e) {
            setStatus('error');
        }
    };
    verify();
  }, [token, navigate]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      {status === 'verifying' && (
          <>
            <Loader2 className="w-12 h-12 text-primary-500 animate-spin mb-4" />
            <h1 className="text-xl font-bold">Verifying your email...</h1>
          </>
      )}
      {status === 'success' && (
          <>
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
            <h1 className="text-2xl font-bold mb-2">Email Verified!</h1>
            <p className="text-slate-500">Redirecting you to the home page...</p>
          </>
      )}
      {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mb-4" />
            <h1 className="text-2xl font-bold mb-2">Verification Failed</h1>
            <p className="text-slate-500">The link may be invalid or expired.</p>
            <button onClick={() => navigate('/')} className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-xl font-bold">Go Home</button>
          </>
      )}
    </div>
  );
};
