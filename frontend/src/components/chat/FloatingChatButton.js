import React, { useState, useEffect } from "react";
import { getSocket } from "../../socket";
import ChatWidget from "./ChatWidget";
import "./FloatingChatButton.css";
import { API_BASE } from "../../config";

const FloatingChatButton = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!currentUser) return;

    // Fetch initial unread count
    fetchUnreadCount();

    // Listen for real-time notifications
    const socket = getSocket();
    if (socket) {
      socket.on("notification", handleNotification);
    }

    return () => {
      if (socket) {
        socket.off("notification", handleNotification);
      }
    };
  }, [currentUser]);

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/chat/unread-count/${currentUser._id}?role=${currentUser.role}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  const handleNotification = (data) => {
    if (data.type === "new_message") {
      setUnreadCount((prev) => prev + 1);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    // Refresh unread count when closing
    fetchUnreadCount();
  };

  return (
    <>
      <button className="floating-chat-button" onClick={handleOpen}>
        <span className="chat-icon">💬</span>
        {unreadCount > 0 && <span className="chat-badge">{unreadCount}</span>}
      </button>

      {isOpen && <ChatWidget currentUser={currentUser} onClose={handleClose} />}
    </>
  );
};

export default FloatingChatButton;
