import React, { useState } from "react";
import ClassSelector from "./ClassSelector";
import ChatList from "./ChatList";
import ChatWindow from "./ChatWindow";
import "./ChatWidget.css";

const ChatWidget = ({ currentUser, onClose }) => {
  const [currentView, setCurrentView] = useState("list"); // 'list', 'classSelector', 'chat'
  const [selectedRoom, setSelectedRoom] = useState(null);

  const handleOpenClassSelector = () => {
    setCurrentView("classSelector");
  };

  const handleBackToList = () => {
    setCurrentView("list");
    setSelectedRoom(null);
  };

  const handleRoomCreated = (room) => {
    setSelectedRoom(room);
    setCurrentView("chat");
  };

  const handleRoomSelected = (room) => {
    setSelectedRoom(room);
    setCurrentView("chat");
  };

  const renderHeader = () => {
    if (currentView === "chat" && selectedRoom) {
      const otherUser =
        currentUser.role === "teacher"
          ? selectedRoom.student
          : selectedRoom.teacher;

      return (
        <div className="chat-widget-header">
          <button className="back-button" onClick={handleBackToList}>
            ← Quay lại
          </button>
          <div className="header-info">
            <h3>{otherUser.name}</h3>
            <p className="class-name">{selectedRoom.class.name}</p>
          </div>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>
      );
    }

    return (
      <div className="chat-widget-header">
        {currentView === "classSelector" && (
          <button className="back-button" onClick={handleBackToList}>
            ← Quay lại
          </button>
        )}
        <h3>💬 Tin nhắn</h3>
        <button className="close-button" onClick={onClose}>
          ✕
        </button>
      </div>
    );
  };

  const renderContent = () => {
    switch (currentView) {
      case "classSelector":
        return (
          <ClassSelector
            currentUser={currentUser}
            onRoomCreated={handleRoomCreated}
          />
        );

      case "chat":
        return (
          <ChatWindow currentUser={currentUser} room={selectedRoom} />
        );

      case "list":
      default:
        return (
          <ChatList
            currentUser={currentUser}
            onRoomSelected={handleRoomSelected}
            onNewChat={handleOpenClassSelector}
          />
        );
    }
  };

  return (
    <div className="chat-widget-overlay" onClick={onClose}>
      <div className="chat-widget-content" onClick={(e) => e.stopPropagation()}>
        {renderHeader()}
        <div className="chat-widget-body">{renderContent()}</div>
      </div>
    </div>
  );
};

export default ChatWidget;
