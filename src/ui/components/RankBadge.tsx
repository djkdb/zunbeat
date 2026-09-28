export function RankBadge({ rank, size = 'md' }: { rank: string; size?: 'sm' | 'md' | 'xl' }) {
  const cls = rank.replace('+', 'plus').toLowerCase();
  return (
    <span className={`rank rank--${size} rank--${cls}`} aria-label={`Rank ${rank}`}>
      {rank}
    </span>
  );
}
