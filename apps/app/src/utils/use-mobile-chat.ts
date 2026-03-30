import React, { useState, useCallback, useRef, useEffect } from "react";

/**
 * Hook to manage mobile chat drawer state, height and resizing.
 * @param defaultHeight percentage of viewport height (0-100).
 */
export function useMobileChat(defaultHeight = 50) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatHeight, setChatHeight] = useState(defaultHeight);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const handleDragStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      setIsDragging(true);
      const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      dragStartY.current = clientY;
      dragStartHeight.current = chatHeight;
    },
    [chatHeight]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleDragMove = (e: MouseEvent | TouchEvent) => {
      const clientY = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const deltaY = dragStartY.current - clientY;
      const deltaHeight = (deltaY / window.innerHeight) * 100;
      const newHeight = Math.max(10, Math.min(95, dragStartHeight.current + deltaHeight));
      setChatHeight(newHeight);
    };

    const handleDragEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchmove", handleDragMove);
    window.addEventListener("touchend", handleDragEnd);

    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleDragMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [isDragging]);

  return {
    isChatOpen,
    setChatHeight,
    setIsChatOpen,
    isDragging,
    chatHeight,
    handleDragStart,
  };
}