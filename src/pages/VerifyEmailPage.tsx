import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

export const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
      <h1 className="text-2xl font-bold mb-2">Email verification is not required</h1>
      <p className="text-slate-500">You can continue using the app without verifying your email right now.</p>
      <button onClick={() => navigate('/')} className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-xl font-bold">
        Go Home
      </button>
    </div>
  );
};
