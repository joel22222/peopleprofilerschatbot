import { createContext, useContext, useEffect, useState } from "react";

const backendUrl =
  import.meta.env.VITE_API_URL ||
  "https://peopleprofilerschatbot-backend.onrender.com";

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  // State
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cameraZoomed, setCameraZoomed] = useState(false);

  // Chat function with error handling and safe array checks
  const chat = async (msg) => {
    setLoading(true);
    try {
      const respRaw = await fetch(`${backendUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });

      if (!respRaw.ok) {
        const text = await respRaw.text().catch(() => null);
        console.error("Chat API error:", respRaw.status, text);
        setLoading(false);
        return "Sorry, the server returned an error.";
      }

      const json = await respRaw.json().catch(() => ({}));
      const resp = Array.isArray(json?.messages) ? json.messages : [];

      if (resp.length > 0) {
        setMessages((messages) => [...messages, ...resp]);
      }

      setLoading(false);

      // Combine all messages into a single string
      const combinedText = resp
        .map((msg) => msg?.text || "")
        .join(" ")
        .trim();
      return combinedText || "Sorry, I couldn't get a response.";
    } catch (error) {
      console.error("Error in chat function:", error);
      setLoading(false);
      return "Sorry, I encountered an error processing your message.";
    }
  };

  // Remove the first message after it has been played
  const onMessagePlayed = () => {
    setMessages((messages) => messages.slice(1));
  };

  // Update current message whenever messages array changes
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

// Custom hook to consume ChatContext
export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};
