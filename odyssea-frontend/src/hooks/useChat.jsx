import { createContext, useContext, useEffect, useState } from "react";

const backendUrl = import.meta.env.VITE_API_URL || "https://peopleprofilerschatbot-backend.onrender.com";

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const chat = async (message) => {
    setLoading(true);
    try {
      const data = await fetch(`${backendUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });
      const resp = (await data.json()).messages;
      setMessages((messages) => [...messages, ...resp]);
      setLoading(false);
      
      // Return the combined text from all messages for chat history
      const combinedText = resp.map(msg => msg.text).join(' ');
      return combinedText;
    } catch (error) {
      console.error("Error in chat function:", error);
      setLoading(false);
      return "Sorry, I encountered an error processing your message.";
    }
  };

  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState();
  const [loading, setLoading] = useState(false);
  const [cameraZoomed, setCameraZoomed] = useState(false);
  
  const onMessagePlayed = () => {
    setMessages((messages) => messages.slice(1));
  };

  useEffect(() => {
    if (messages.length > 0) {
      setMessage(messages[0]);
    } else {
      setMessage(null);
    }
  }, [messages]);

  return (
    <ChatContext.Provider
      value={{
        chat,
        message,
        onMessagePlayed,
        loading,
        cameraZoomed,
        setCameraZoomed,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};