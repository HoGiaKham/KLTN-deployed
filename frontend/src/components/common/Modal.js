import React from 'react';
import '../../styles/Modal.css';

const Modal = ({
  show,
  onClose,
  onConfirm,
  title,
  message,
  type = 'info', // 'info', 'success', 'warning', 'error', 'confirm'
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  showCancel = false
}) => {
  if (!show) return null;

  const handleOverlayClick = (e) => {
    if (e.target.className === 'modal-overlay') {
      onClose();
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <div className="modal-icon modal-icon-success">
            <svg width="50" height="50" viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="22" fill="#28a745" />
              <path d="M15 25 L22 32 L35 18" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="modal-icon modal-icon-error">
            <svg width="50" height="50" viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="22" fill="#dc3545" />
              <path d="M18 18 L32 32 M32 18 L18 32" stroke="white" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </div>
        );
      case 'warning':
        return (
          <div className="modal-icon modal-icon-warning">
            <svg width="50" height="50" viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="22" fill="#ffc107" />
              <text x="25" y="35" fontSize="30" fontWeight="bold" fill="white" textAnchor="middle">!</text>
            </svg>
          </div>
        );
      case 'confirm':
        return (
          <div className="modal-icon modal-icon-confirm">
            <svg width="50" height="50" viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="22" fill="#17a2b8" />
              <text x="25" y="35" fontSize="30" fontWeight="bold" fill="white" textAnchor="middle">?</text>
            </svg>
          </div>
        );
      default:
        return (
          <div className="modal-icon modal-icon-info">
            <svg width="50" height="50" viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="22" fill="#007bff" />
              <text x="25" y="35" fontSize="30" fontWeight="bold" fill="white" textAnchor="middle">i</text>
            </svg>
          </div>
        );
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container">
        <div className="modal-header">
          {getIcon()}
          {title && <h3 className="modal-title">{title}</h3>}
        </div>
        <div className="modal-body">
          <p className="modal-message">{message}</p>
        </div>
        <div className="modal-footer">
          {showCancel && (
            <button className="modal-btn modal-btn-cancel" onClick={onClose}>
              {cancelText}
            </button>
          )}
          <button
            className={`modal-btn modal-btn-confirm modal-btn-${type}`}
            onClick={onConfirm || onClose}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
