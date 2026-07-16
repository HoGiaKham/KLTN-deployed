import React, { useState, useEffect, useRef } from "react";
import { getSocket } from "../../socket";
import axios from "axios";
import MessageInput from "./MessageInput";
import "./ChatWindow.css";
import { API_BASE, API_HOST } from "../../config";

const ChatWindow = ({ currentUser, room }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (room) {
      fetchMessages();
      joinRoom();
      markAsRead();
    }

    const socket = getSocket();
    if (socket) {
      socket.on("new_message", handleNewMessage);
      socket.on("user_typing", handleUserTyping);
      socket.on("user_stop_typing", handleUserStopTyping);
    }

    return () => {
      if (socket) {
        socket.off("new_message", handleNewMessage);
        socket.off("user_typing", handleUserTyping);
        socket.off("user_stop_typing", handleUserStopTyping);
      }
    };
  }, [room]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/chat/messages/${room._id}`);
      setMessages(response.data);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit("join_room", room._id);
    }
  };

  const markAsRead = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit("read_messages", room._id);
    }
  };

  const handleNewMessage = (data) => {
    if (data.roomId === room._id) {
      setMessages((prev) => [...prev, data.message]);
      markAsRead();
    }
  };

  const handleUserTyping = (data) => {
    if (data.roomId === room._id && data.userId !== currentUser._id) {
      setTyping(true);

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Auto-hide typing after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        setTyping(false);
      }, 3000);
    }
  };

  const handleUserStopTyping = (data) => {
    if (data.roomId === room._id && data.userId !== currentUser._id) {
      setTyping(false);
    }
  };

  const handleSendMessage = (messageData) => {
    const socket = getSocket();
    if (socket) {
      socket.emit("send_message", {
        roomId: room._id,
        ...messageData,
      });
    }
  };

  const handleTyping = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit("typing", room._id);
    }
  };

  const handleStopTyping = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit("stop_typing", room._id);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="chat-window-container">
        <div className="loading-spinner">Đang tải tin nhắn...</div>
      </div>
    );
  }

  return (
    <div className="chat-window-container">
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-messages">
            <p>💬 Chưa có tin nhắn nào</p>
            <p className="sub-text">Bắt đầu cuộc trò chuyện ngay bây giờ!</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isMine = msg.sender._id === currentUser._id;

              return (
                <div
                  key={msg._id}
                  className={`message ${isMine ? "mine" : "theirs"}`}
                >
                  {!isMine && (
                    <div className="message-avatar">
                      {msg.sender.avatar ? (
                        <img src={msg.sender.avatar} alt={msg.sender.name} />
                      ) : (
                        <div className="avatar-placeholder">
                          {msg.sender.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="message-content">
                    {msg.messageType === "text" ? (
                      <div className="message-bubble">{msg.content}</div>
                    ) : (
                      <div className="message-image">
                        <img
                          src={`${API_HOST}${msg.imageUrl}`}
                          alt="Shared image"
                          onClick={() =>
                            window.open(
                              `${API_HOST}${msg.imageUrl}`,
                              "_blank"
                            )
                          }
                        />
                      </div>
                    )}
                    <div className="message-time">{formatTime(msg.createdAt)}</div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}

        {typing && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="typing-text">Đang nhập...</span>
          </div>
        )}
      </div>

      <MessageInput
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        onStopTyping={handleStopTyping}
      />
    </div>
  );
};

export default ChatWindow;
