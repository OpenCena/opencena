// Ponte entre o dropdown de autocomplete (React, no EditorTab) e os atalhos de teclado do editor
// (keymap no schema).

export const autocomplete: {
  active: boolean;
  accept: () => boolean;
  move: (dir: number) => boolean;
  close: () => boolean;
} = {
  active: false,
  accept: () => false,
  move: () => false,
  close: () => false,
};
