import type { MindmapData } from './node';

/** Spec §8 reference data (acceptance view). First-level nodes are listed top to bottom per side. */
export const REFERENCE_DATA: MindmapData = [
  { id: 'root', parentId: null, text: 'SHAKESPEARE' },
  { id: 'vida', parentId: 'root', text: 'VIDA', side: 'right' },
  { id: 'hamlet', parentId: 'vida', text: 'Hamlet' },
  { id: 'othello', parentId: 'vida', text: 'Othello' },
  { id: 'poesia', parentId: 'root', text: 'POESIA', side: 'right' },
  { id: 'comedia', parentId: 'root', text: 'COMEDIA', side: 'right' },
  { id: 'historia', parentId: 'root', text: 'HISTORIA', side: 'right' },
  { id: 'tragedia', parentId: 'root', text: 'TRAGEDIA', side: 'left' },
  { id: 'macbeth', parentId: 'tragedia', text: 'Macbeth' },
  { id: 'king-lear', parentId: 'tragedia', text: 'King Lear' },
  { id: 'sonetos', parentId: 'root', text: 'SONETOS', side: 'left' },
  { id: 'amor', parentId: 'root', text: 'AMOR', side: 'left' },
  { id: 'magia', parentId: 'root', text: 'MAGIA', side: 'left' },
];
