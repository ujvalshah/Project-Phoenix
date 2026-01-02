import { useToastContext, ToastType } from '@/context/ToastContext';

interface ToastOptions {
  duration?: number;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const useToast = () => {
  const { showToast } = useToastContext();

  const trigger = (type: ToastType, title: string, optionsOrDesc?: string | ToastOptions) => {
    let options: ToastOptions = {};
    
    if (typeof optionsOrDesc === 'string') {
      options = { description: optionsOrDesc };
    } else if (optionsOrDesc) {
      options = optionsOrDesc;
    }

    showToast({
      type,
      title,
      description: options.description,
      duration: options.duration,
      actionLabel: options.actionLabel,
      onAction: options.onAction,
    });
  };

  return {
    success: (title: string, options?: string | ToastOptions) => trigger('success', title, options),
    error: (title: string, options?: string | ToastOptions) => trigger('error', title, options),
    warning: (title: string, options?: string | ToastOptions) => trigger('warning', title, options),
    info: (title: string, options?: string | ToastOptions) => trigger('info', title, options),
    
    // Low-level access
    show: (opts: { type: ToastType; title: string } & ToastOptions) => showToast(opts)
  };
};


