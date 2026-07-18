import React, { useEffect } from "react";

const ModalOverlay = ({
  onClose,
  overlayClassName = "modal",
  contentClassName = "",
  contentStyle = {},
  children,
}) => {
  useEffect(() => {
    if (!onClose) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  return (
    <div className={overlayClassName} onClick={handleOverlayClick}>
      <div className={`modal-content ${contentClassName}`} style={contentStyle} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

export default ModalOverlay;
