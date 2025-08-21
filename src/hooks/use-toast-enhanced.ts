import { toast } from "sonner";

export interface ToastOptions {
  title?: string;
  description?: string;
  duration?: number;
}

export const useToastEnhanced = () => {
  const showSuccess = (message: string, options?: ToastOptions) => {
    toast.success(options?.title || "Success", {
      description: message,
      duration: options?.duration || 3000,
    });
  };

  const showError = (message: string, options?: ToastOptions) => {
    toast.error(options?.title || "Error", {
      description: message,
      duration: options?.duration || 4000,
    });
  };

  const showWarning = (message: string, options?: ToastOptions) => {
    toast.warning(options?.title || "Warning", {
      description: message,
      duration: options?.duration || 3500,
    });
  };

  const showInfo = (message: string, options?: ToastOptions) => {
    toast.info(options?.title || "Info", {
      description: message,
      duration: options?.duration || 3000,
    });
  };

  const showLoading = (message: string) => {
    return toast.loading(message);
  };

  const dismissToast = (toastId: string | number) => {
    toast.dismiss(toastId);
  };

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoading,
    dismissToast,
  };
};
