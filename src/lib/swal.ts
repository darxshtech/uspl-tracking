import Swal, { SweetAlertOptions } from "sweetalert2";

// Base custom styled Swal instance matching Unitglo theme
const CustomSwal = Swal.mixin({
  customClass: {
    popup: "rounded-2xl shadow-2xl border border-slate-200 bg-white text-slate-900 font-sans p-6",
    title: "text-lg font-bold text-slate-900",
    htmlContainer: "text-sm text-slate-600",
    confirmButton: "rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold px-5 py-2.5 shadow-md shadow-sky-600/20 text-sm transition-all cursor-pointer mx-1.5",
    cancelButton: "rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-2.5 text-sm transition-all cursor-pointer mx-1.5",
    denyButton: "rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 shadow-md shadow-red-600/20 text-sm transition-all cursor-pointer mx-1.5",
  },
  buttonsStyling: false,
});

export const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 3500,
  timerProgressBar: true,
  customClass: {
    popup: "rounded-xl shadow-lg border border-slate-100 bg-white/95 backdrop-blur-md text-slate-800 text-sm py-2 px-3",
    title: "text-sm font-semibold text-slate-800",
  },
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  },
});

export const showSuccess = (title: string, text?: string) => {
  return CustomSwal.fire({
    icon: "success",
    title,
    text,
    timer: 2500,
    showConfirmButton: false,
  });
};

export const showError = (title: string, text?: string) => {
  return CustomSwal.fire({
    icon: "error",
    title,
    text,
    confirmButtonText: "Okay",
  });
};

export const showWarning = (title: string, text?: string) => {
  return CustomSwal.fire({
    icon: "warning",
    title,
    text,
    confirmButtonText: "Got it",
  });
};

export const showInfo = (title: string, text?: string) => {
  return CustomSwal.fire({
    icon: "info",
    title,
    text,
    confirmButtonText: "Close",
  });
};

export const showToast = (title: string, icon: "success" | "error" | "warning" | "info" = "success") => {
  return Toast.fire({
    icon,
    title,
  });
};

export const showConfirm = async (
  title: string,
  text?: string,
  confirmButtonText = "Yes, continue",
  cancelButtonText = "Cancel"
): Promise<boolean> => {
  const result = await CustomSwal.fire({
    title,
    text,
    icon: "question",
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true,
  });
  return result.isConfirmed;
};

export default CustomSwal;
