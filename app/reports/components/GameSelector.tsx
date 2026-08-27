'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gamepad2 } from 'lucide-react';

export const ALL_GAMES = 'all';
export const UNCLASSIFIED_GAME = 'unclassified';

interface GameSelectorProps {
  games: { id: string; title: string }[];
  selectedGame: string;
  onSelectGame: (gameId: string) => void;
  allGamesLabel: string;
  unclassifiedLabel: string;
}

export function GameSelector({ games, selectedGame, onSelectGame, allGamesLabel, unclassifiedLabel }: GameSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Gamepad2 className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedGame} onValueChange={onSelectGame}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder={allGamesLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_GAMES}>{allGamesLabel}</SelectItem>
          {games.map((game) => (
            <SelectItem key={game.id} value={game.id}>
              {game.title}
            </SelectItem>
          ))}
          <SelectItem value={UNCLASSIFIED_GAME}>{unclassifiedLabel}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
