import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authService } from '@/services/authService';
import { Lock, ArrowRight, Check, Loader2 } from 'lucide-react';
import { Input } from '@/components/UI/Input';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) return <div className="p-8 text-center text-red-500">Invalid Token</div>;

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (password !== confirm) {
          setError("Passwords do not match");
          return;
      }
      setIsSubmitting(true);
      setError(null);
      try {
          await authService.resetPassword(token, password);
          setIsSuccess(true);
          setTimeout(() => navigate('/'), 3000);
      } catch (err) {
          setError("Failed to reset password. Token may be expired.");
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
            {isSuccess ? (
                <div className="text-center">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check size={24} />
                    </div>
                    <h2 className="text-xl font-bold mb-2">Password Reset!</h2>
                    <p className="text-slate-500">You can now login with your new password.</p>
                </div>
            ) : (
                <>
                    <h1 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <Lock className="text-primary-500" /> Reset Password
                    </h1>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input 
                            type="password" 
                            label="New Password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            required 
                        />
                        <Input 
                            type="password" 
                            label="Confirm Password" 
                            value={confirm} 
                            onChange={e => setConfirm(e.target.value)} 
                            required 
                        />
                        {error && <p className="text-xs text-red-500 font-bold bg-red-50 p-2 rounded">{error}</p>}
                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <>Reset Password <ArrowRight size={16} /></>}
                        </button>
                    </form>
                </>
            )}
        </div>
    </div>
  );
};
