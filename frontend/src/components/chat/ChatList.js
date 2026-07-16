import React, { useState, useEffect } from "react";
import { getSocket } from "../../socket";
import axios from "axios";
import "./ChatList.css";
import { API_BASE } from "../../config";

const ChatList = ({ currentUser, onRoomSelected, onNewChat }) => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRooms();

    // Listen for real-time updates
    const socket = getSocket();
    if (socket) {
      socket.on("new_message", handleNewMessage);
      socket.on("notification", handleNotification);
    }

    return () => {
      if (socket) {
        socket.off("new_message", handleNewMessage);
        socket.off("notification", handleNotification);
      }
    };
  }, [currentUser]);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_BASE}/chat/rooms/${currentUser._id}?role=${currentUser.role}`
      );
      setRooms(response.data);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewMessage = (data) => {
    // Refresh rooms when new message arrives
    fetchRooms();
  };

  const handleNotification = (data) => {
    if (data.type === "new_message") {
      fetchRooms();
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";

    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Vừa xong";
    if (minutes < 60) return `${minutes} phút`;
    if (hours < 24) return `${hours} giờ`;
    if (days < 7) return `${days} ngày`;
    return date.toLocaleDateString("vi-VN");
  };

  if (loading) {
    return (
      <div className="chat-list-container">
        <div className="loading-spinner">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="chat-list-container">
      {currentUser.role === "student" && (
        <button className="new-chat-button" onClick={onNewChat}>
          + Tin nhắn mới
        </button>
      )}

      {rooms.length === 0 ? (
        <div className="empty-list">
          <p>📭 Chưa có cuộc trò chuyện nào</p>
          {currentUser.role === "student" && (
            <p className="sub-text">Nhấn "Tin nhắn mới" để bắt đầu</p>
          )}
        </div>
      ) : (
        <div className="room-list">
          {rooms.map((room) => {
            const otherUser =
              currentUser.role === "teacher" ? room.student : room.teacher;
            const unreadCount = room.unreadCount[currentUser.role] || 0;

            return (
              <div
                key={room._id}
                className="room-item"
                onClick={() => onRoomSelected(room)}
              >
                <div className="room-avatar">
                  {otherUser.avatar ? (
                    <img src={otherUser.avatar} alt={otherUser.name} />
                  ) : (
                    <div className="avatar-placeholder">
                      {otherUser.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="room-info">
                  <div className="room-header">
                    <h4>{otherUser.name}</h4>
                    <span className="room-time">
                      {formatTime(room.lastMessage?.timestamp)}
                    </span>
                  </div>

                  <p className="room-class">{room.class.name}</p>

                  {room.lastMessage && (
                    <p className="room-preview">
                      {room.lastMessage.content}
                    </p>
                  )}
                </div>

                {unreadCount > 0 && (
                  <div className="unread-badge">{unreadCount}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChatList;
