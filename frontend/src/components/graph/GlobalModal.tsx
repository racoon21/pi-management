import { ConfirmModal } from '../shared/ConfirmModal';
import { useModalStore } from '../../stores/modalStore';
import { TaskFormModal } from './TaskFormModal';
import { HistoryModal } from './HistoryModal';

export const GlobalModal = () => {
  const { isOpen, type, title, message, onConfirm, closeModal } = useModalStore();

  return (
    <>
      {/* Confirm/Delete Modal */}
      <ConfirmModal
        isOpen={isOpen && (type === 'confirm' || type === 'delete')}
        onClose={closeModal}
        onConfirm={onConfirm || (() => {})}
        title={title}
        message={message}
        type={type === 'delete' ? 'danger' : 'warning'}
        confirmText={type === 'delete' ? '삭제' : '확인'}
      />

      {/* Create/Edit Modal */}
      <TaskFormModal />

      {/* History Modal */}
      <HistoryModal />
    </>
  );
};
