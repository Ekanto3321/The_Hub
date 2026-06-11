import React from 'react';
import { Button } from 'react95';

export default function EmojiPicker({ onSelect, disabled = false }) {
  const emojis = [
    '😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎', '🤩',
    '😮', '😲', '😢', '😭', '😡', '🤯', '😴', '🤔', '🙄', '😏',
    '🙂', '😉', '😇', '🥳', '😅', '🤗', '😬', '🤐', '🤓', '🫠',
    '👍', '👎', '👏', '🙌', '👀', '💀', '🤝', '🙏', '✌️', '👌',
    '🔥', '💯', '✨', '⭐', '🎉', '🎊', '🎬', '🎵', '🎶', '💬',
    '❤️', '💙', '💚', '💛', '💜', '🖤', '💔', '💖', '💕', '💞',
    '🚀', '🌟', '🍿', '📺', '⌛', '📼', '🕹️', '💻', '📡', '🎮'
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '4px',
        maxWidth: 300,
      }}
    >
      {emojis.map((emoji) => (
        <Button
          key={emoji}
          size="sm"
          disabled={disabled}
          onClick={() => onSelect?.(emoji)}
          style={{
            minWidth: 32,
            height: 32,
            padding: 0,
            fontSize: '16px',
            lineHeight: 1,
          }}
        >
          {emoji}
        </Button>
      ))}
    </div>
  );
}
