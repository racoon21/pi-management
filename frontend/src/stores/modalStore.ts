import { create } from 'zustand';

type ModalType = 'confirm' | 'edit' | 'create' | 'delete' | 'history' | null;

interface ModalState {
  isOpen: boolean;
  type: ModalType;
  title: string;
  message: string;
  data: any;
  onConfirm: (() => void) | null;
  onCancel: (() => void) | null;

  openModal: (params: {
    type: ModalType;
    title: string;
    message?: string;
    data?: any;
    onConfirm?: () => void;
    onCancel?: () => void;
  }) => void;
  closeModal: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  isOpen: false,
  type: null,
  title: '',
  message: '',
  data: null,
  onConfirm: null,
  onCancel: null,

  openModal: ({ type, title, message = '', data = null, onConfirm, onCancel }) => {
    set({
      isOpen: true,
      type,
      title,
      message,
      data,
      onConfirm: onConfirm || null,
      onCancel: onCancel || null,
    });
  },

  closeModal: () => {
    set({
      isOpen: false,
      type: null,
      title: '',
      message: '',
      data: null,
      onConfirm: null,
      onCancel: null,
    });
  },
}));
