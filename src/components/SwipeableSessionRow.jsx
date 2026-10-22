import React, { useState, useRef } from 'react';
import { FiTrash2 } from 'react-icons/fi';

const SWIPE_DELETE_WIDTH = 72;

const SwipeableSessionRow = ({ children, onDelete }) => {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const baseXRef = useRef(0);

  const handleTouchStart = (e) => {
    startXRef.current = e.touches[0].clientX;
    baseXRef.current = dragX;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    const delta = e.touches[0].clientX - startXRef.current;
    const next = Math.min(0, Math.max(-SWIPE_DELETE_WIDTH, baseXRef.current + delta));
    setDragX(next);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setDragX((x) => (x < -SWIPE_DELETE_WIDTH / 2 ? -SWIPE_DELETE_WIDTH : 0));
  };

  return (
    <div className="relative overflow-hidden">
      <div style={{ width: SWIPE_DELETE_WIDTH }} className="absolute inset-y-0 right-0 flex items-center justify-center">
        <button
          onClick={() => {
            onDelete();
            setDragX(0);
          }}
          className="w-11 h-11 flex items-center justify-center rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
        >
          <FiTrash2 size={16} />
        </button>
      </div>
      <div
        className="bg-[var(--admin-bg)] touch-pan-y"
        style={{ transform: `translateX(${dragX}px)`, transition: isDragging ? 'none' : 'transform 200ms ease' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeableSessionRow;
