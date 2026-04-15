
import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, ArrowRight, Loader2, ChevronLeft, Eye, EyeOff } from 'lucide-react';
import { shallowEqualAuth, useAuthSelector } from '@/context/AuthContext';
import { Input } from '../UI/Input';
import type { SignupPayload } from '@/types/auth';
import { authService } from '@/services/authService';
import { ModalShell } from '@/components/UI/ModalShell';

// Simple validation helpers (minimal client-side checks)
const validateEmail = (email: string): string | null => {
    if (!email) return null; // Let HTML5 required handle empty
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) ? null : 'Please enter a valid email address';
};

const validatePassword = (password: string): string | null => {
    if (!password) return null; // Let HTML5 required handle empty
    if (password.length < 8) return 'Password must be at least 8 characters';
    return null;
};

// Password requirements checker (for visual guidance)
const checkPasswordRequirements = (password: string) => {
    return {
        minLength: password.length >= 8,
        hasUpperCase: /[A-Z]/.test(password),
        hasLowerCase: /[a-z]/.test(password),
        hasNumber: /[0-9]/.test(password),
        hasSpecial: /[^A-Za-z0-9]/.test(password)
    };
};

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, authModalView, login, signup } = useAuthSelector(
    (a) => ({
      isAuthModalOpen: a.isAuthModalOpen,
      closeAuthModal: a.closeAuthModal,
      authModalView: a.authModalView,
      login: a.login,
      signup: a.signup,
    }),
    shallowEqualAuth,
  );

  const [view, setView] = useState<'login' | 'signup' | 'forgot'>(authModalView);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSubmitSuccess, setForgotSubmitSuccess] = useState(false);
  
  // Field-level validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  
  // Login Form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  // Signup Form
  const [fullName, setFullName] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    setView(authModalView);
    setForgotSubmitSuccess(false);
    setError(null);
    setFieldErrors({});
    setEmail('');
    setPassword('');
    setIsPasswordVisible(false);
    // Reset Signup
    setFullName('');
  }, [isAuthModalOpen, authModalView]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setEmail(val);
      // Clear email error when user types
      if (fieldErrors.email) {
          setFieldErrors(prev => ({ ...prev, email: undefined }));
      }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setPassword(val);
      // Clear password error when user types
      if (fieldErrors.password) {
          setFieldErrors(prev => ({ ...prev, password: undefined }));
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    
    // Client-side validation (minimal checks for UX guidance)
    let hasErrors = false;
    const newFieldErrors: typeof fieldErrors = {};
    
    if (view === 'login') {
        const emailError = validateEmail(email);
        if (emailError) {
            newFieldErrors.email = emailError;
            hasErrors = true;
        }
        // Password required check is handled by HTML5
    } else if (view === 'signup') {
        const emailError = validateEmail(email);
        if (emailError) {
            newFieldErrors.email = emailError;
            hasErrors = true;
        }
        
        const passwordError = validatePassword(password);
        if (passwordError) {
            newFieldErrors.password = passwordError;
            hasErrors = true;
        }
    }
    
    if (hasErrors) {
        setFieldErrors(newFieldErrors);
        setIsLoading(false);
        return;
    }
    
    setIsLoading(true);

    try {
        if (view === 'login') {
            await login({ email, password });
        } else if (view === 'signup') {
            // Launch contract: keep signup payload to the minimal 3 fields.
            const signupPayload: SignupPayload = {
                fullName: fullName.trim(),
                email: email.trim(),
                password,
            };

            await signup(signupPayload);
        } else if (view === 'forgot') {
            await authService.requestPasswordReset(email);
            setForgotSubmitSuccess(true);
        }
    } catch (err: any) {
        const safeMessage =
          typeof err?.message === 'string'
            ? err.message
            : (typeof err === 'string' ? err : 'An error occurred');
        setError(safeMessage);
    } finally {
        setIsLoading(false);
    }
  };

  const inputClass = "bg-white/60 dark:bg-black/20 border-slate-200/80 dark:border-slate-700/60 focus:ring-primary-400/50 focus:border-primary-400 dark:text-white backdrop-blur-sm transition-all shadow-sm";
  const labelClass = "block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 ml-1 uppercase tracking-wider";

  return (
    <ModalShell isOpen={isAuthModalOpen} onClose={closeAuthModal} keepMounted>
      <div
        data-state={isAuthModalOpen ? 'open' : 'closed'}
        className="
        relative w-full max-w-md
        bg-white dark:bg-slate-950
        rounded-2xl shadow-2xl
        border border-slate-200/70 dark:border-white/10
        flex flex-col overflow-hidden
        transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none
        will-change-transform
        data-[state=closed]:translate-y-2 data-[state=closed]:scale-[0.985]
        data-[state=closed]:opacity-0 data-[state=open]:translate-y-0
        data-[state=open]:scale-100 data-[state=open]:opacity-100
        max-h-[90vh]
      ">
        
        <button 
            onClick={closeAuthModal} 
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors z-20"
        >
            <X size={20} />
        </button>

        <>
                <div className="px-8 pt-10 pb-2 text-center shrink-0">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
                        {view === 'login' && 'Welcome Back'}
                        {view === 'signup' && 'Join Nuggets'}
                        {view === 'forgot' && 'Reset Password'}
                    </h2>
                    {view === 'login' && <p className="text-sm text-slate-500 dark:text-slate-400">Sign in to continue to your space.</p>}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-8 pt-5">
                    {view === 'forgot' && forgotSubmitSuccess ? (
                        <div className="text-center py-10 px-2">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                              If an account exists with <strong>{email}</strong>, we&apos;ve sent a password reset link.
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                              Check spam if you don&apos;t see it. The link expires in 1 hour.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setForgotSubmitSuccess(false);
                                setView('login');
                              }}
                              className="text-sm font-bold text-primary-600 hover:underline"
                            >
                              Back to Login
                            </button>
                        </div>
                    ) : (
                    <>
                    {/* Toggle Tabs */}
                    {view !== 'forgot' && (
                        <div className="flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl mb-5 relative border border-slate-200/50 dark:border-slate-700/50">
                            <button onClick={() => setView('login')} className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${view === 'login' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}>Log in</button>
                            <button onClick={() => setView('signup')} className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${view === 'signup' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}>Sign up</button>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        
                        {/* SIGNUP FIELDS */}
                        {view === 'signup' && (
                            <>
                                <div>
                                    <label className={labelClass}>Full Name</label>
                                    <Input placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} required className={inputClass} />
                                </div>

                                <div>
                                    <label className={labelClass}>Email</label>
                                    <Input 
                                        type="email" 
                                        placeholder="you@example.com" 
                                        value={email} 
                                        onChange={handleEmailChange} 
                                        required 
                                        className={`${inputClass} ${fieldErrors.email ? 'border-red-300 dark:border-red-700' : ''}`} 
                                    />
                                    {fieldErrors.email && (
                                        <p className="mt-1 text-xs text-red-600 dark:text-red-400 ml-1">{fieldErrors.email}</p>
                                    )}
                                </div>

                                <div>
                                    <label className={labelClass}>Password</label>
                                    <div className="relative">
                                      <Input 
                                          type={isPasswordVisible ? 'text' : 'password'}
                                          placeholder="••••••••" 
                                          value={password} 
                                          onChange={handlePasswordChange} 
                                          required 
                                          className={`${inputClass} pr-14 ${fieldErrors.password ? 'border-red-300 dark:border-red-700' : ''}`} 
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setIsPasswordVisible((prev) => !prev)}
                                        aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                                        aria-pressed={isPasswordVisible}
                                        className="absolute inset-y-0 right-0 mr-3 flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                                      >
                                        {isPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                                      </button>
                                    </div>
                                    {fieldErrors.password && (
                                        <p className="mt-1 text-xs text-red-600 dark:text-red-400 ml-1">{fieldErrors.password}</p>
                                    )}
                                    {/* Password Requirements Checklist (visual guidance only) */}
                                    {password && (
                                        <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Password requirements:</p>
                                            <div className="space-y-1">
                                                {(() => {
                                                    const requirements = checkPasswordRequirements(password);
                                                    return (
                                                        <>
                                                            <div className={`flex items-center gap-2 text-xs ${requirements.minLength ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                                                <span>{requirements.minLength ? '✓' : '○'}</span>
                                                                <span>At least 8 characters</span>
                                                            </div>
                                                            <div className={`flex items-center gap-2 text-xs ${requirements.hasUpperCase ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                                                <span>{requirements.hasUpperCase ? '✓' : '○'}</span>
                                                                <span>One uppercase letter (A-Z)</span>
                                                            </div>
                                                            <div className={`flex items-center gap-2 text-xs ${requirements.hasLowerCase ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                                                <span>{requirements.hasLowerCase ? '✓' : '○'}</span>
                                                                <span>One lowercase letter (a-z)</span>
                                                            </div>
                                                            <div className={`flex items-center gap-2 text-xs ${requirements.hasNumber ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                                                <span>{requirements.hasNumber ? '✓' : '○'}</span>
                                                                <span>One number (0-9)</span>
                                                            </div>
                                                            <div className={`flex items-center gap-2 text-xs ${requirements.hasSpecial ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                                                <span>{requirements.hasSpecial ? '✓' : '○'}</span>
                                                                <span>One special character (!@#$%^&*)</span>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>

                            </>
                        )}

                        {/* LOGIN FIELDS */}
                        {view === 'login' && (
                            <>
                                <div>
                                    <label className={labelClass}>Email Address</label>
                                    <Input 
                                        type="email" 
                                        placeholder="you@example.com" 
                                        leftIcon={<Mail size={16} />} 
                                        value={email} 
                                        onChange={handleEmailChange} 
                                        required 
                                        className={`${inputClass} ${fieldErrors.email ? 'border-red-300 dark:border-red-700' : ''}`} 
                                    />
                                    {fieldErrors.email && (
                                        <p className="mt-1 text-xs text-red-600 dark:text-red-400 ml-1">{fieldErrors.email}</p>
                                    )}
                                </div>
                                <div className="relative">
                                    <div className="flex justify-between items-center mb-1.5 ml-1">
                                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Password</label>
                                    </div>
                                    <Input 
                                        type={isPasswordVisible ? 'text' : 'password'}
                                        placeholder="••••••••" 
                                        leftIcon={<Lock size={16} />} 
                                        value={password} 
                                        onChange={handlePasswordChange} 
                                        required 
                                        className={`${inputClass} pr-14`} 
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setIsPasswordVisible((prev) => !prev)}
                                      aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                                      aria-pressed={isPasswordVisible}
                                      className="absolute inset-y-0 right-0 mr-3 flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                                    >
                                      {isPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <div className="flex justify-between items-center">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${keepSignedIn ? 'bg-primary-500 border-primary-500 text-white' : 'bg-white/50 border-slate-300 dark:border-slate-600 dark:bg-black/20'}`}>
                                            {keepSignedIn && <div className="w-2 h-2 bg-white rounded-sm" />}
                                        </div>
                                        <input type="checkbox" className="hidden" checked={keepSignedIn} onChange={(e) => setKeepSignedIn(e.target.checked)} />
                                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Remember me</span>
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setForgotSubmitSuccess(false);
                                        setView('forgot');
                                      }}
                                      className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white underline transition-colors"
                                    >
                                      Forgot?
                                    </button>
                                </div>
                            </>
                        )}

                        {/* FORGOT FIELDS */}
                        {view === 'forgot' && (
                            <div>
                                <label className={labelClass}>Email Address</label>
                                <Input 
                                    type="email" 
                                    placeholder="you@example.com" 
                                    leftIcon={<Mail size={16} />} 
                                    value={email} 
                                    onChange={handleEmailChange} 
                                    required 
                                    className={inputClass} 
                                />
                            </div>
                        )}

                        {error && (
                            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                {error}
                            </div>
                        )}

                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 bg-primary-500 hover:bg-primary-400 text-slate-900 rounded-xl font-bold text-sm transition-all shadow-lg shadow-primary-500/20 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                        >
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : (
                                <>
                                    {view === 'login' && 'Sign In'}
                                    {view === 'signup' && 'Create Account'}
                                    {view === 'forgot' && 'Send Reset Link'}
                                    {!isLoading && view !== 'forgot' && <ArrowRight size={16} />}
                                </>
                            )}
                        </button>

                        {view === 'forgot' && (
                            <button
                              type="button"
                              onClick={() => {
                                setForgotSubmitSuccess(false);
                                setView('login');
                              }}
                              className="w-full py-3 mt-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                            >
                                <ChevronLeft size={16} /> Back to Login
                            </button>
                        )}
                    </form>
                    </>
                    )}
                </div>
        </>
      </div>
    </ModalShell>
  );
};
